
let data = [];
let currentIndex = 0;
let listElements = [];
const bookmarked = new Set();
const doubts = JSON.parse(localStorage.getItem('doubts') || '[]');

function highlightDoubts(text, doubtTexts) {
  if (!text) return '';
  let highlightedText = text;
  doubtTexts.forEach(doubt => {
    const regex = new RegExp(`(${doubt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'g');
    highlightedText = highlightedText.replace(regex, '<span class="doubt-highlight">$1</span>');
  });
  return highlightedText;
}

function renderSutra(index) {
  const sutra = data[index];
  const doubtTexts = doubts
    .filter(d => d.index === sutra.index)
    .map(d => d.text);
  const container = document.getElementById('sutraContent');
  container.innerHTML = `
    <div class="sutra">
      <div class="sutra-btn">
        <button onclick="navigate(-1)"><i class="fas fa-arrow-left"></i></button>
        <p>${sutra.index}</p>
        <button onclick="navigate(1)"><i class="fas fa-arrow-right"></i></button>
      </div>
      
      <div class="section"><strong>अथ निरुक्तम्</strong>
        <div class="meta">(अध्यायः ${sutra.adhyay}, खण्डः ${sutra.khand})</div><hr>
        ${highlightDoubts(sutra.text, doubtTexts)}</div>
      
      <div class="section">
        <button class="toggle-btn" onclick="toggleExclusive('durg')">दुर्गटीका</button>
        <div id="durg" class="toggle-content"><hr>${highlightDoubts(sutra.durg, doubtTexts)}</div>
      </div>
      <div class="section">
        <button class="toggle-btn" onclick="toggleExclusive('skand')">स्कन्दटीका</button>
        <div id="skand" class="toggle-content"><hr>${highlightDoubts(sutra.skand, doubtTexts)}</div>
      </div>
      <button class="add-remove-bookmark" onclick="toggleBookmark(${index})">
        ${bookmarked.has(index) ? '🔖 बुकमार्क हटाएं' : '📌 बुकमार्क करें'}
      </button>
      <br><br><br><br>
    </div>
  `;
  listElements.forEach((el, i) => {
    el.classList.toggle('active', i === index);
    if (i === index) {
      document.title = `निरुक्त_(${sutra.index})`;
    }
  });
}

function toggleDoubtPad() {
  const pad = document.getElementById('doubtPad');
  pad.classList.toggle('open');
}

function populateSidebar() {
  const ul = document.getElementById('sutraList');
  ul.innerHTML = '';
  listElements = [];
  data.forEach((sutra, index) => {
    const li = document.createElement('li');
    let label = (sutra.index + ': ' + sutra.text.trim()).slice(0, 30);
    li.textContent = label;
    li.title = sutra.index + ': ' + sutra.text.trim();
    li.onclick = (e) => {
      e.stopPropagation();
      currentIndex = index;
      renderSutra(index);
      toggleSidebar(true);
    };
    listElements.push(li);
    ul.appendChild(li);
  });
}

function updateFilters() {
  const adhyaySet = new Set();
  data.forEach(s => adhyaySet.add(s.adhyay));

  const sel = document.getElementById('filterAdhyay');
  sel.innerHTML = '<option value="">अध्याय</option>' + [...adhyaySet].map(a => `<option>${a}</option>`).join('');
}

function applyFilters() {
  const adhyay = document.getElementById('filterAdhyay').value;
  const showBookmarked = document.getElementById('filterBookmarked')?.classList.contains('active');

  const ul = document.getElementById('sutraList');
  ul.innerHTML = '';
  listElements.forEach((li, i) => {
    const s = data[i];
    const match = (!adhyay || s.adhyay == adhyay) && (!showBookmarked || bookmarked.has(i));
    if (match) ul.appendChild(li);
  });
}

function navigate(offset) {
  const newIndex = currentIndex + offset;
  if (newIndex >= 0 && newIndex < data.length) {
    currentIndex = newIndex;
    renderSutra(currentIndex);
  }
}

function toggleBookmark(index) {
  bookmarked.has(index) ? bookmarked.delete(index) : bookmarked.add(index);
  renderSutra(index);
  applyFilters();
}

document.getElementById('searchInput').addEventListener('input', function () {
  const q = this.value.toLowerCase();
  const ul = document.getElementById('sutraList');
  ul.innerHTML = '';
  listElements.forEach((li, i) => {
    const sutra = data[i];
    const fullText = (sutra.index + ': ' + sutra.text).toLowerCase();
    if (fullText.includes(q)) {
      ul.appendChild(li);
    }
  });
});

document.getElementById('filterAdhyay').onchange = applyFilters;
document.getElementById('filterBookmarked').onclick = function () {
  this.classList.toggle('active');
  applyFilters();
};

const tips = [
  "नैकपदानि निर्ब्रूयात्।",
  "नावैयाकरणाय।",
  "नानुपसन्नाय।",
  "नित्यं ह्यविज्ञातुर्विज्ञानेऽसूया।",
  "उपसन्नाय तु निर्ब्रूयात्।",
  "तिस्त्र एव देवता इति नैरुक्ताः।",
  "अग्निः पृथिवीस्थानः।", "वायुर्वेन्द्रो वान्तरिक्षस्थानः।", "सूर्यो द्युस्थानः।"
]

function showTip() {
  const box = document.getElementById('tipsBox');
  const tip = tips[Math.floor(Math.random() * tips.length)];
  box.innerHTML = `<b>निरुक्तोद्धरणानि :</b>  ${tip}`;
}
setInterval(showTip, 5000);
showTip();

function toggleSidebar(forceClose = null) {
  const aside = document.getElementById('sidebar');
  if (forceClose === true) {
    aside.classList.remove('open');
  } else if (forceClose === false) {
    aside.classList.add('open');
  } else {
    aside.classList.toggle('open');
  }
}

function toggleExclusive(idToShow) {
  ['durg', 'skand'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = id === idToShow && el.style.display !== 'block' ? 'block' : 'none';
  });
}

function boldMarkedText(input) {
  if (!input) return '';
  return input
    .replace(/b(.*?)b/g, '<b>$1</b>')
    .replace(/n(.*?)n/g, '<i>$1</i>');
}


fetch("data.json")
  .then(res => res.json())
  .then(json => {
    data = json.niruktam.map(item => ({
      ...item,
      text: boldMarkedText(item.text),
      durg: boldMarkedText(item.durg),
      skand: boldMarkedText(item.skand)
    }));

    populateSidebar();
    updateFilters();
    renderSutra(currentIndex);
    document.getElementById('loader').style.display = 'none';
  })
  .catch(err => {
    document.getElementById('sutraContent').innerText = 'Error loading data: ' + err.message;
    document.getElementById('loader').style.display = 'none';
  });

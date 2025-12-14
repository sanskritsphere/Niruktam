// =============== STATE ===============
// =============== CUSTOM VYAKHYA DATA ===============
const customVyakhya = [
  {
    "shabda": "समाम्नायः",
    "vyakhya": "गुरु-शिष्यपरम्परया सम्यक् आम्नातः वेदादिशब्दसमूहः। अर्थात् परम्परागत रूपेण प्राप्त शास्त्रीय ज्ञान।"
  },
  {
    "shabda": "निघण्टवः",
    "vyakhya": "वैदिकशब्दानां अर्थप्रकाशनार्थं रचिताः शब्दसमूहाः, ये निरुक्तस्य आधारभूताः।"
  },
  {
    "shabda": "कस्मात्",
    "vyakhya": "हेतुप्रश्नवाचकः शब्दः, कारणजिज्ञासायां प्रयुज्यते।"
  },
  {
    "shabda": "अपि वा",
    "vyakhya": "विकल्पसूचकः अव्ययसमूहः, अन्यसम्भावनां दर्शयति।"
  },
  {
    "shabda": "हननात् एव",
    "vyakhya": "धात्वर्थविशेषेण निष्पन्नत्वस्य संकेतः, हिंसार्थक-धातोः निष्पत्तिं सूचयति।"
  },
  {
    "shabda": "भावप्रधानम् आख्यातम्",
    "vyakhya": "यत्र क्रियाभावः प्रधानः भवति तत् आख्यातपदम्, धात्वर्थप्रधानत्वात्।"
  },
  {
    "shabda": "सत्त्वप्रधानानि नामानि",
    "vyakhya": "यत्र द्रव्य वा वस्तुस्वरूपं प्रधानं भवति, तानि नामपदानि इति कथ्यन्ते।"
  }
];

// Normalisation helper for matching (Devanagari NFC + trim)
function normalizeShabda(s) {
  return (s || "").normalize("NFC").trim();
}
let data = [];
let currentIndex = 0;
let listElements = [];

const TAGS = [
  { key: '#b', label: 'निर्वचन' },  // #b(.*?)b#
  { key: '#m', label: 'मन्त्र' },   // #m(.*?)m#
  { key: '#v', label: 'विशेष' }, // #v(.*?)v#
  { key: '#s', label: 'श्लोक'}   // #s(.*?)s#
];

const termsByTag = {};               // { b:[], m:[], v:[] }
TAGS.forEach(t => termsByTag[t.key] = []);

const bookmarked = new Set();
const doubts = JSON.parse(localStorage.getItem('doubts') || '[]');

const markState = { query: "", activeTag: 'b' };  // right sidebar
const leftSearchState = { q: "" };                // left sidebar search

// सिर्फ left-labels के लिए b...b unwrap (list label generate करते समय)
const MARK_RE_B = /b(.*?)b/g;


// =============== HELPERS ===============
function normalizeNFC(s){ return (s || "").normalize("NFC"); }

function escapeHTML(s=""){
  return s.replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function highlightLabel(label="", q=""){
  label = normalizeNFC(label);
  q = normalizeNFC(q);
  const safe = escapeHTML(label);
  if(!q) return safe;
  const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  return safe.replace(re, m => `<span class="mark">${m}</span>`);
}

function debounce(fn, wait = 200){
  let t; 
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}

function highlightDoubts(text, doubtTexts) {
  if (!text) return '';
  let out = text;
  doubtTexts.forEach(doubt => {
    const q = normalizeNFC(doubt);
    if (!q) return;
    const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'g');
    out = out.replace(re, '<span class="doubt-highlight">$1</span>');
  });
  return out;
}

/* ========= main content temporary highlight after click ========= */
function flashSearchInMain(query, duration = 1600){
  query = (query || "").trim();
  if (!query) return;
  const container = document.getElementById('sutraContent');
  if (!container) return;

  const qN = normalizeNFC(query).toLowerCase();

  // remove previous flashes
  container.querySelectorAll('.main-flash').forEach(span => {
    const text = document.createTextNode(span.textContent);
    const p = span.parentNode;
    if (p) p.replaceChild(text, span);
  });

  // walk text nodes and wrap matches
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  let node, firstSpan = null;

  const wrapMatchesInNode = (textNode) => {
    const original = textNode.nodeValue;
    const origN = normalizeNFC(original);
    const hay = origN.toLowerCase();

    let start = 0, idx = hay.indexOf(qN, start);
    if (idx === -1) return;

    const parent = textNode.parentNode;
    const frag = document.createDocumentFragment();
    let pos = 0;

    while (idx !== -1) {
      const absStart = idx;
      const absEnd = idx + qN.length;

      const before = original.slice(pos, absStart);
      const match  = original.slice(absStart, absEnd);

      if (before) frag.appendChild(document.createTextNode(before));

      const span = document.createElement('span');
      span.className = 'main-flash';
      span.textContent = match;
      frag.appendChild(span);
      if (!firstSpan) firstSpan = span;

      pos = absEnd;
      start = absEnd;
      idx = hay.indexOf(qN, start);
    }
    const after = original.slice(pos);
    if (after) frag.appendChild(document.createTextNode(after));

    parent.replaceChild(frag, textNode);
  };

  while ((node = walker.nextNode())) {
    if (!node.parentElement) continue;
    const tag = node.parentElement.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE') continue;
    wrapMatchesInNode(node);
  }

  if (firstSpan) {
    firstSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  setTimeout(() => {
    container.querySelectorAll('.main-flash').forEach(span => {
      const text = document.createTextNode(span.textContent);
      const p = span.parentNode;
      if (p) p.replaceChild(text, span);
    });
  }, duration);
}
/* ========= /flash ========= */

/* ========= SINGLE-PASS tag collector: b/m/v/... =========
   किसी एक replace से सारे tags पकड़ो ताकि HTML inject होने के बाद regex न बिगड़े  */
function processAllTags(str, sutraIdx, field){
  let src = str || '';
  if (!src) return { html: '' };

  const keys = TAGS.map(t => t.key);                   // ['b','m','v',...]
  const re = new RegExp(`(${keys.join("|")})([\\s\\S]*?)\\1`, "g"); // (b|m|v) ... \1

  const counters = Object.fromEntries(keys.map(k => [k, 0]));

  const html = src.replace(re, (m, tagKey, inner) => {
    const i = counters[tagKey]++;
    const id = `mark-${tagKey}-${sutraIdx}-${field}-${i}`;
    const label = (inner || '').trim();

    // collect strictly into active tag bucket
    termsByTag[tagKey].push({ id, label, sutraIdx, field, tag: tagKey });

    // visible anchor (escape to avoid leaking tags)
    return `<span class="mark-anchor tag-${tagKey}" id="${id}"><b>${escapeHTML(label)}</b></span>`;
  });

  return { html };
}


// =============== RENDER: MAIN PANEL ===============
function renderSutra(index) {
  const sutra = data[index];
  if (!sutra) return;

  const doubtTexts = doubts.filter(d => d.index === sutra.index).map(d => d.text);
  const container = document.getElementById('sutraContent');
  if (!container) return;

  container.innerHTML = `
    <div class="sutra">
      <div class="sutra-btn">
        <button onclick="navigate(-1)"><i class="fas fa-arrow-left"></i></button>
        <p>${sutra.index}</p>
        <button onclick="navigate(1)"><i class="fas fa-arrow-right"></i></button>
      </div>
      
      <div class="section"><strong>अथ निरुक्तम्</strong>
        <div class="meta">(अध्यायः ${sutra.adhyay}, खण्डः ${sutra.khand})</div><hr>
        ${highlightDoubts(sutra.text, doubtTexts)}
      </div>
      
      <div class="section">
        <button class="toggle-btn" onclick="toggleExclusive('durg')">दुर्गवृत्तिः</button>
        <div id="durg" class="toggle-content"><hr>${highlightDoubts(sutra.durg, doubtTexts)}</div>
      </div>
      <div class="section">
        <button class="toggle-btn" onclick="toggleExclusive('skand')">निरुक्तभाष्यटीका(श्रीस्कन्दस्वामी)</button>
        <div id="skand" class="toggle-content"><hr>${highlightDoubts(sutra.skand, doubtTexts)}</div>
      </div>
       <div class="section">
        <button class="toggle-btn" onclick="toggleExclusive('vivaran')">THE NIRUKTA</button>
        <div id="vivaran" class="toggle-content"><hr>${highlightDoubts(sutra.vivaran, doubtTexts)}</div>
      </div>
      <button class="add-remove-bookmark" onclick="toggleBookmark(${index})">
        ${bookmarked.has(index) ? '🔖 बुकमार्क हटाएं' : '📌 बुकमार्क करें'}
      </button>
      <br><br><br><br>
    </div>
  `;

  // निर्वचन शब्दों पर click → व्याख्या panel
  container.querySelectorAll('.mark-anchor').forEach(anchor => {
    anchor.style.cursor = 'pointer';
    anchor.title = 'व्याख्या देखने के लिए क्लिक करें';
    anchor.onclick = (e) => {
      e.stopPropagation();
      const anchorId = anchor.id;
      showVyakhya(anchorId);
    };
  });


  listElements.forEach((el, i) => {
    el.classList.toggle('active', i === index);
    if (i === index) document.title = `นिरुक्त_(${sutra.index})`;
  });
}


// =============== LEFT LIST (always from plain) ===============
function populateSidebar() {
  const ul = document.getElementById('sutraList');
  if (!ul) return;

  ul.innerHTML = '';
  listElements = [];

  data.forEach((sutra, index) => {
    const base = `${sutra.index}: ${sutra.text_plain || ""}`.trim();
    const title = base;
    const label = base;

    const li = document.createElement('li');
    li.textContent = label;          // plain
    li.title = title;
    li.dataset.baseLabel = label;    // restore के लिए

    li.onclick = (e) => {
      e.stopPropagation();
      currentIndex = index;
      renderSutra(index);
      if (leftSearchState.q && leftSearchState.q.trim()) {
        setTimeout(() => flashSearchInMain(leftSearchState.q), 60);
      }
      toggleSidebar(true);
    };

    listElements.push(li);
    ul.appendChild(li);
  });
}

// master renderer: left search + adhyay + bookmark
function applyFilters() {
  const ul = document.getElementById('sutraList');
  if (!ul) return;

  const adhyayEl = document.getElementById('filterAdhyay');
  const bookmarkedBtn = document.getElementById('filterBookmarked');

  const adhyay = adhyayEl ? adhyayEl.value : "";
  const showBookmarked = bookmarkedBtn ? bookmarkedBtn.classList.contains('active') : false;

  const q = normalizeNFC((leftSearchState.q || "").toLowerCase());

  ul.innerHTML = '';

  listElements.forEach((li, i) => {
    const s = data[i];
    const passAdhyay   = (!adhyay || s.adhyay == adhyay);
    const passBookmark = (!showBookmarked || bookmarked.has(i));
    const passSearch   = (!q || (s._search || "").includes(q));

    if (passAdhyay && passBookmark && passSearch) {
      ul.appendChild(li);
    }
  });
}


// =============== RIGHT SIDEBAR (tabs + list) ===============
function buildMarkTabs(){
  const sidebar = document.getElementById('markSidebar');
  if (!sidebar) return;

  let tabs = document.getElementById('markTabs');
  if (!tabs){
    tabs = document.createElement('div');
    tabs.id = 'markTabs';
    tabs.style.display = 'flex';
    tabs.style.gap = '.5rem';
    tabs.style.marginBottom = '.5rem';
    tabs.style.flexWrap = 'wrap';
    const h2 = sidebar.querySelector('h2');
    if (h2 && h2.parentNode) h2.parentNode.insertBefore(tabs, h2);
    else sidebar.insertBefore(tabs, sidebar.firstChild);
  }

  tabs.innerHTML = '';
  TAGS.forEach(tag => {
    const btn = document.createElement('button');
    btn.className = 'mark-tab-btn';
    btn.textContent = tag.label;
    btn.dataset.tag = tag.key;
    btn.style.padding = '.35rem .6rem';
    btn.style.border = '1px solid #cfd6de';
    btn.style.borderRadius = '6px';
    btn.style.background = (markState.activeTag === tag.key) ? '#e8f0fe' : '#fff';
    btn.style.cursor = 'pointer';
    btn.setAttribute('aria-selected', markState.activeTag === tag.key ? 'true' : 'false');
    btn.onclick = () => {
      markState.activeTag = tag.key;
      buildMarkTabs();     // active style refresh
      renderMarkSidebar(); // list refresh
    };
    tabs.appendChild(btn);
  });
}

function renderMarkSidebar() {
  const ul = document.getElementById('markList');
  const countEl = document.getElementById('markSearchCount');
  if (!ul) return;

  const active = markState.activeTag || 'b';
  const source = termsByTag[active] || [];

  const q = normalizeNFC((markState.query || "").toLowerCase().trim());
  const filtered = q
    ? source.filter(t => normalizeNFC(t.label).toLowerCase().includes(q))
    : source;

  ul.innerHTML = '';

  filtered.forEach((t) => {
    const li = document.createElement('li');
    const idx = data[t.sutraIdx]?.index || '';
    li.innerHTML = `${highlightLabel(t.label, q)} <span style="opacity:.7">(${idx})</span>`;
    li.title = `${t.label} — सूक्त ${idx}`;
    li.onclick = (e) => {
      e.stopPropagation();
      currentIndex = t.sutraIdx;
      renderSutra(currentIndex);
      if (markState.query && markState.query.trim()) {
        setTimeout(() => flashSearchInMain(markState.query), 60);
      }
      setTimeout(() => {
        const el = document.getElementById(t.id);
        if (el) {
          el.classList.add('flash');
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => el.classList.remove('flash'), 1500);
        }
      }, 50);
    };
    ul.appendChild(li);
  });

  if (countEl) countEl.textContent = String(filtered.length || 0);
}


// =============== FILTERS / NAV / TOGGLES ===============
function updateFilters() {
  const adhyaySet = new Set();
  data.forEach(s => adhyaySet.add(s.adhyay));
  const sel = document.getElementById('filterAdhyay');
  if (!sel) return;
  sel.innerHTML = '<option value="">अध्याय</option>' + [...adhyaySet].map(a => `<option>${a}</option>`).join('');
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

function toggleSidebar(forceClose = null) {
  const aside = document.getElementById('sidebar');
  if (!aside) return;
  if (forceClose === true) aside.classList.remove('open');
  else if (forceClose === false) aside.classList.add('open');
  else aside.classList.toggle('open');
}

function toggleExclusive(idToShow) {
  ['durg', 'skand', 'vivaran'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = id === idToShow && el.style.display !== 'block' ? 'block' : 'none';
  });
}


// =============== UI WIRING (bind after DOMContentLoaded) ===============
function wireUI(){

  // LEFT sidebar search input (always from plain dataset)
  const input = document.getElementById("searchInput");
  if (input){
    input.addEventListener('input', function() {
      leftSearchState.q = input.value || "";

      const filter = input.value.normalize("NFC").toUpperCase();
      const ul = document.getElementById("sutraList");
      const li = ul.getElementsByTagName("li");

      for (let i = 0; i < li.length; i++) {
        const base = (li[i].dataset.baseLabel || li[i].textContent || "").normalize("NFC");
        const idx = base.toUpperCase().indexOf(filter);

        if (idx > -1) {
          li[i].style.display = "";
          const before = base.slice(0, idx);
          const middle = base.slice(idx, idx + filter.length);
          const after  = base.slice(idx + filter.length);
          li[i].innerHTML = `${before}<span class="chihnit">${middle}</span>${after}`;
        } else {
          li[i].style.display = "none";
          li[i].textContent = base; // restore plain
        }
      }
    });
  }

  // Filters wiring
  const adhyaySelect = document.getElementById('filterAdhyay');
  if (adhyaySelect) adhyaySelect.onchange = applyFilters;

  const bookmarkedBtnEl = document.getElementById('filterBookmarked');
  if (bookmarkedBtnEl){
    bookmarkedBtnEl.onclick = function () {
      this.classList.toggle('active');
      applyFilters();
    };
  }

  // RIGHT sidebar search input
  const markSearchInput = document.getElementById('markSearchInput');
  if (markSearchInput){
    markState.query = ""; // init
    markSearchInput.addEventListener('input', debounce(e => {
      markState.query = e.target.value || "";
      renderMarkSidebar();
    }, 150));
  }

  // Build right tabs initially
  buildMarkTabs();
}


// =============== FETCH + PROCESS ===============
document.addEventListener('DOMContentLoaded', () => {
  wireUI();  // DOM ready

  fetch("data.json")
    .then(res => res.json())
    .then(json => {
      // reset buckets each load
      TAGS.forEach(t => { termsByTag[t.key] = []; });

      data = json.niruktam.map((item, i) => {
        // Plain versions for LEFT labels/search (strip all tags + unwrap b/m/v)
        const rawText  = item.text  || "";
        const rawDurg  = item.durg  || "";
        const rawSkand = item.skand || "";
        const rawVivaran = item.vivaran || "";

        const stripAll = s => (s || "")
  .replace(/<[^>]*>/g, "")
  .replace(/#b([\s\S]*?)#b/g, (_, p1)=> (p1||"").trim())
  .replace(/#m([\s\S]*?)#m/g, (_, p1)=> (p1||"").trim())
  .replace(/#v([\s\S]*?)#v/g, (_, p1)=> (p1||"").trim())
  .replace(/#s([\s\S]*?)#s/g, (_, p1)=> (p1||"").trim());

        const text_plain  = stripAll(rawText);
        const durg_plain  = stripAll(rawDurg);
        const skand_plain = stripAll(rawSkand);
        const vivaran_plain = stripAll(rawVivaran);

        // Left search key from plain text
        const searchKey = normalizeNFC((item.index + ': ' + text_plain)).toLowerCase();

        // Main HTML with anchors for ALL configured tags (single-pass)
        const pText  = processAllTags(item.text,  i, 'text');
        const pDurg  = processAllTags(item.durg,  i, 'durg');
        const pSkand = processAllTags(item.skand, i, 'skand');
        const pVivaran = processAllTags(item.vivaran, i, 'vivaran');

        return {
          ...item,
          text:  pText.html,
          durg:  pDurg.html,
          skand: pSkand.html,
          vivaran: pVivaran.html,
          text_plain,
          durg_plain,
          skand_plain,
          vivaran_plain,
          _search: searchKey
        };
      });

      // Left list + filters
      populateSidebar();
      updateFilters();
      applyFilters();

      // Main + Right side
      renderSutra(currentIndex);
      renderMarkSidebar();

      const loader = document.getElementById('loader');
      if (loader) loader.style.display = 'none';
    })
    .catch(err => {
      const cont = document.getElementById('sutraContent');
      if (cont) cont.innerText = 'Error loading data: ' + err.message;
      const loader = document.getElementById('loader');
      if (loader) loader.style.display = 'none';
    });
});



function showVyakhya(anchorId) {
  const panel = document.getElementById('vyakhya');
  const contentEl = document.getElementById('vyakhya-content');
  const titleEl = document.getElementById('vyakhya-title');
  if (!panel || !contentEl || !titleEl) return;

  let foundTerm = null;
  for (const tagKey in termsByTag) {
    foundTerm = termsByTag[tagKey].find(t => t.id === anchorId);
    if (foundTerm) break;
  }

  if (!foundTerm) {
    return; // कोई term नहीं मिला → कुछ मत करो
  }

  const sutra = data[foundTerm.sutraIdx];
  if (!sutra) return;

  const normalizedLabel = normalizeShabda(foundTerm.label);

  // केवल custom व्याख्या ढूंढो
  const customEntry = customVyakhya.find(entry => 
    normalizeShabda(entry.shabda) === normalizedLabel
  );

  // अगर custom व्याख्या नहीं मिली → panel बिल्कुल न खोलो
  if (!customEntry) {
    return;
  }

  // custom व्याख्या मिल गई → panel खोलो
  const tagLabel = TAGS.find(t => t.key === foundTerm.tag)?.label || foundTerm.tag;

  titleEl.textContent = `व्याख्या: ${foundTerm.label}`;

  contentEl.innerHTML = `
    <p><strong>शब्द:</strong> ${foundTerm.label}</p>
    <p><strong>प्रकार:</strong> ${tagLabel}</p>
    <p><strong>सूत्र:</strong> ${sutra.index}</p>
    <hr style="margin:10px 0; border-color:#a0785a;">
    <div style="font-size:1.1rem; line-height:1.9; padding:8px 0;">
      <strong>व्याख्या:</strong><br>
      ${customEntry.vyakhya}
    </div>
  `;

  panel.classList.add('open');
}
function closeVyakhya() {
  const panel = document.getElementById('vyakhya');
  if (panel) panel.classList.remove('open');
}
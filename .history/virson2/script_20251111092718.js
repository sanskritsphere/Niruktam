// =============== STATE ===============
let data = [];
let currentIndex = 0;
let listElements = [];

// Right sidebar config: tabs/tags
const TAGS = [
  { key: 'b', label: 'निर्वचन' },  // b(.*?)b
  { key: 'm', label: 'मन्त्र' },   // m(.*?)m
  { key: 'v', label: 'विशेष' }     // v(.*?)v
];
// terms grouped by tag key
const termsByTag = {}; // e.g., { b: [...], m: [...], v: [...] }
TAGS.forEach(t => termsByTag[t.key] = []);

const bookmarked = new Set();
const doubts = JSON.parse(localStorage.getItem('doubts') || '[]');

const markState = { query: "", activeTag: 'b' };  // right sidebar state
const leftSearchState = { q: "" };                 // left sidebar search

const MARK_RE_B = /b(.*?)b/g; // still used by plainFromMarked for left labels


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

// Remove HTML + unwrap b...b → plain text (left labels only care b)
function plainFromMarked(s){
  if (!s) return "";
  s = s.replace(/<[^>]*>/g, "");
  s = s.replace(MARK_RE_B, (_, p1) => (p1 || "").trim());
  return s.trim().replace(/\s+/g, " ");
}

function debounce(fn, wait = 200){
  let t; 
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}

// Doubt highlight (unchanged)
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

/* ========= NEW: main content temporary highlight after click ========= */
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
/* ========= /NEW ========= */


// =============== TAGGED MARK COLLECTOR ===============
// Replace b/m/v tags into anchors and collect terms into termsByTag
function processAllTags(str, sutraIdx, field){
  let html = str || '';
  if (!html) return { html: '', collected: 0 };

  TAGS.forEach(tag => {
    const re = new RegExp(`${tag.key}(.*?)${tag.key}`, 'g');
    let i = 0;
    html = html.replace(re, (m, p1) => {
      const id = `mark-${tag.key}-${sutraIdx}-${field}-${i++}`;
      const label = (p1 || '').trim();
      termsByTag[tag.key].push({ id, label, sutraIdx, field, tag: tag.key });
      return `<span class="mark-anchor tag-${tag.key}" id="${id}"><b>${label}</b></span>`;
    });
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
    if (i === index) document.title = `निरुक्त_(${sutra.index})`;
  });
}


// =============== LEFT LIST ===============
function populateSidebar() {
  const ul = document.getElementById('sutraList');
  if (!ul) return;

  ul.innerHTML = '';
  listElements = [];

  data.forEach((sutra, index) => {
    const li = document.createElement('li');
    const txtPlain = plainFromMarked(sutra.text || sutra.title || "");
    const title = `${sutra.index}: ${txtPlain}`;
    const label = title;

    li.textContent = label;
    li.title = title;

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

  // container बनाओ/ढूँढो
  let tabs = document.getElementById('markTabs');
  if (!tabs){
    tabs = document.createElement('div');
    tabs.id = 'markTabs';
    tabs.style.display = 'flex';
    tabs.style.gap = '.5rem';
    tabs.style.marginBottom = '.5rem';
    tabs.style.flexWrap = 'wrap';
    // h2 से ऊपर insert कर दो
    const h2 = sidebar.querySelector('h2');
    if (h2 && h2.parentNode) h2.parentNode.insertBefore(tabs, h2);
    else sidebar.insertBefore(tabs, sidebar.firstChild);
  }

  // buttons render
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
      // right search flash (optional)
      if (markState.query && markState.query.trim()) {
        setTimeout(() => flashSearchInMain(markState.query), 60);
      }
      // jump to that anchor
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
  ['durg', 'skand'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = id === idToShow && el.style.display !== 'block' ? 'block' : 'none';
  });
}


// =============== UI WIRING (bind after DOMContentLoaded) ===============
function wireUI(){

  // LEFT sidebar search input (highlight + state)
  const input = document.getElementById("searchInput");
  if (input){
    input.addEventListener('input', function() {
      leftSearchState.q = input.value || "";

      const filter = input.value.normalize("NFC").toUpperCase();
      const ul = document.getElementById("sutraList");
      const li = ul.getElementsByTagName("li");
      for (let i = 0; i < li.length; i++) {
        let text = li[i].textContent.normalize("NFC");
        let idx = text.toUpperCase().indexOf(filter);
        if (idx > -1) {
          li[i].style.display = "";
          let before = text.slice(0, idx);
          let middle = text.slice(idx, idx + filter.length);
          let after = text.slice(idx + filter.length);
          li[i].innerHTML = `${before}<span class="chihnit">${middle}</span>${after}`;
        } else {
          li[i].style.display = "none";
          li[i].innerHTML = text; 
        }
      }
    });
  }

  // Filters wiring
  const adhyaySelect = document.getElementById('filterAdhyay');
  if (adhyaySelect) adhyaySelect.onchange = applyFilters;
  else console.warn('[filter] #filterAdhyay नहीं मिला');

  const bookmarkedBtnEl = document.getElementById('filterBookmarked');
  if (bookmarkedBtnEl){
    bookmarkedBtnEl.onclick = function () {
      this.classList.toggle('active');
      applyFilters();
    };
  } else {
    console.warn('[filter] #filterBookmarked नहीं मिला');
  }

  // RIGHT sidebar search input
  const markSearchInput = document.getElementById('markSearchInput');
  if (markSearchInput){
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
  wireUI();  // DOM elements are now available

  fetch("data.json")
    .then(res => res.json())
    .then(json => {
      data = json.niruktam.map((item, i) => {
        // left-search key from raw text (only unwrap b...b for left labels)
        const rawText  = item.text || "";
        const searchPlain = rawText.replace(/<[^>]*>/g, "")
                                   .replace(MARK_RE_B, (_, p1)=> (p1||"").trim());
        const searchKey = normalizeNFC((item.index + ': ' + searchPlain)).toLowerCase();

        // process all tags for each field and collect termsByTag
        const pText  = processAllTags(item.text,  i, 'text');
        const pDurg  = processAllTags(item.durg,  i, 'durg');
        const pSkand = processAllTags(item.skand, i, 'skand');

        return {
          ...item,
          text:  pText.html,
          durg:  pDurg.html,
          skand: pSkand.html,
          _search: searchKey
        };
      });

      // left list + filters
      populateSidebar();
      updateFilters();
      applyFilters();

      // main + right list
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

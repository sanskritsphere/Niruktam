// =============== STATE ===============
let data = [];
let currentIndex = 0;
let listElements = [];
const terms = [];                       // right sidebar terms
const MARK_RE = /b(.*?)b/g;

const bookmarked = new Set();
const doubts = JSON.parse(localStorage.getItem('doubts') || '[]');

const markState = { query: "" };        // right sidebar search
const leftSearchState = { q: "" };      // left sidebar search


// =============== HELPERS ===============
function normalizeNFC(s){ return (s || "").normalize("NFC"); }

function escapeHTML(s=""){
  return s.replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

// Devanagari-friendly highlight (right sidebar)
function highlightLabel(label="", q=""){
  label = normalizeNFC(label);
  q = normalizeNFC(q);
  const safe = escapeHTML(label);
  if(!q) return safe;
  const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  return safe.replace(re, m => `<span class="mark">${m}</span>`);
}

// Remove HTML + unwrap b...b → plain text (left labels)
function plainFromMarked(s){
  if (!s) return "";
  s = s.replace(/<[^>]*>/g, "");
  s = s.replace(MARK_RE, (_, p1) => (p1 || "").trim());
  return s.trim().replace(/\s+/g, " ");
}

function debounce(fn, wait = 200){
  let t; 
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}

// Wrap doubts with highlight span
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

// b...b → anchor + collect for right sidebar
function markAndCollect(str, sutraIdx, field) {
  if (!str) return { html: '', localTerms: [] };
  let i = 0;
  const localTerms = [];
  const html = str.replace(MARK_RE, (m, p1) => {
    const id = `mark-${sutraIdx}-${field}-${i++}`;
    const label = (p1 || '').trim();
    localTerms.push({ id, label, sutraIdx, field });
    return `<span class="mark-anchor" id="${id}"><b>${label}</b></span>`;
  });
  return { html, localTerms };
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
    if (p) {
      p.replaceChild(text, span);
    }
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
      // NEW: left search query को main में थोड़ी देर flash करो
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
    const passSearch   = (!q || (s._search || "").includes(q));  // precomputed key

    if (passAdhyay && passBookmark && passSearch) {
      ul.appendChild(li);
    }
  });
}


// =============== RIGHT SIDEBAR (marked terms) ===============
function renderMarkSidebar() {
  const ul = document.getElementById('markList');
  const countEl = document.getElementById('markSearchCount');
  if (!ul) return;

  const q = normalizeNFC((markState.query || "").toLowerCase().trim());
  const filtered = q
    ? terms.filter(t => normalizeNFC(t.label).toLowerCase().includes(q))
    : terms;

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
      // NEW: अगर right search में query है तो main में भी flash कर दो
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
  ['durg', 'skand'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = id === idToShow && el.style.display !== 'block' ? 'block' : 'none';
  });
}


// =============== UI WIRING (bind after DOMContentLoaded) ===============
function wireUI(){

  // LEFT sidebar search input (existing highlight + state update)
  var input, filter, ul, li, i;
  input = document.getElementById("searchInput");
  if (input){
    input.addEventListener('input', function() {
      // update state for main flashing
      leftSearchState.q = input.value || "";

      filter = input.value.normalize("NFC").toUpperCase();
      ul = document.getElementById("sutraList");
      li = ul.getElementsByTagName("li");
      for (i = 0; i < li.length; i++) {
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
}


// =============== FETCH + PROCESS ===============
document.addEventListener('DOMContentLoaded', () => {
  wireUI();  // DOM elements are now available

  fetch("data.json")
    .then(res => res.json())
    .then(json => {
      data = json.niruktam.map((item, i) => {
        // left-search key (raw JSON → plain, no HTML/anchors)
        const rawText  = item.text || "";
        const searchPlain = rawText.replace(/<[^>]*>/g, "")
                                   .replace(/b(.*?)b/g, (_, p1)=> (p1||"").trim());
        const searchKey = normalizeNFC((item.index + ': ' + searchPlain)).toLowerCase();

        const t1 = markAndCollect(item.text,  i, 'text');
        const t2 = markAndCollect(item.durg,  i, 'durg');
        const t3 = markAndCollect(item.skand, i, 'skand');
        terms.push(...t1.localTerms, ...t2.localTerms, ...t3.localTerms);

        return {
          ...item,
          text:  t1.html,
          durg:  t2.html,
          skand: t3.html,
          _search: searchKey
        };
      });

      // Build list items once
      populateSidebar();
      updateFilters();

      // Render left list according to current filters + search
      applyFilters();

      // Render main + right sidebar
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

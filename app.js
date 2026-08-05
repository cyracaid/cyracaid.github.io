/* =============================================================================
   cyracaid.github.io — rendering + i18n layer
   -----------------------------------------------------------------------------
   All content lives in i18n/<lang>.json. This file only renders it.

   To add a language:
     1. copy i18n/en.json -> i18n/xx.json and translate the values
     2. add {"code":"xx","label":"..."} to i18n/langs.json
   Nothing in this file needs to change. Any field you leave out of xx.json
   automatically falls back to the English one.
   ========================================================================== */

const DEFAULT_LANG = 'en';
const STORAGE_KEY = 'site-lang';

const state = { lang: DEFAULT_LANG, langs: [], data: null, base: null, cache: {} };

/* ----------------------------------------------------------------- utils -- */

const $ = (sel) => document.querySelector(sel);

// Escape text that goes into an HTML attribute.
const attr = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// Per-field fallback: anything missing/empty in the active language falls back
// to the English value at the same path.
function merge(base, over) {
  if (Array.isArray(base)) {
    if (!Array.isArray(over)) return base;
    return over.map((v, i) => (i < base.length ? merge(base[i], v) : v));
  }
  if (base && typeof base === 'object') {
    if (!over || typeof over !== 'object') return base;
    const out = {};
    for (const k of new Set([...Object.keys(base), ...Object.keys(over)])) {
      out[k] = k in over ? merge(base[k], over[k]) : base[k];
    }
    return out;
  }
  return over === undefined || over === null || over === '' ? base : over;
}

async function loadLang(code) {
  if (state.cache[code]) return state.cache[code];
  const res = await fetch(`i18n/${code}.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`i18n/${code}.json → HTTP ${res.status}`);
  const json = await res.json();
  state.cache[code] = json;
  return json;
}

/* ------------------------------------------------------------- language --- */

function resolveLang() {
  const codes = state.langs.map((l) => l.code);
  const fromUrl = new URLSearchParams(location.search).get('lang');
  if (codes.includes(fromUrl)) return fromUrl;

  let stored = null;
  try { stored = localStorage.getItem(STORAGE_KEY); } catch (e) { /* private mode */ }
  if (codes.includes(stored)) return stored;

  const nav = (navigator.language || '').toLowerCase();
  if (nav.startsWith('zh') && codes.includes('cn')) return 'cn';
  if (nav.startsWith('ko') && codes.includes('ko')) return 'ko';
  return codes.includes(DEFAULT_LANG) ? DEFAULT_LANG : codes[0];
}

async function setLang(code, { push = true } = {}) {
  state.lang = code;
  const over = await loadLang(code);
  state.data = code === DEFAULT_LANG ? state.base : merge(state.base, over);

  try { localStorage.setItem(STORAGE_KEY, code); } catch (e) { /* ignore */ }

  if (push) {
    // Language lives in the query string, so it survives every hash route
    // change — including the project sub-pages.
    const url = new URL(location.href);
    url.searchParams.set('lang', code);
    history.replaceState(null, '', url);
  }

  applyMeta();
  renderAll();
  handleRoute({ scroll: false });
}

function applyMeta() {
  const m = state.data.meta;
  document.documentElement.lang = m.htmlLang;
  document.title = m.title;
  const set = (sel, val) => { const el = $(sel); if (el) el.setAttribute('content', val); };
  set('meta[name="description"]', m.description);
  set('meta[property="og:title"]', m.title);
  set('meta[property="og:description"]', m.description);
  set('meta[property="og:locale"]', m.ogLocale);
  set('meta[name="twitter:title"]', m.title);
  set('meta[name="twitter:description"]', m.description);
}

/* --------------------------------------------------------------- render --- */

function renderLangSwitch() {
  $('#lang-switch').innerHTML = state.langs.map((l) =>
    `<button type="button" class="lang-btn${l.code === state.lang ? ' active' : ''}" data-lang="${attr(l.code)}">${l.label}</button>`
  ).join('');
}

function renderChrome() {
  const d = state.data;
  document.querySelectorAll('[data-nav]').forEach((a) => {
    const key = a.dataset.nav;
    if (d.nav[key]) a.textContent = d.nav[key];
  });
  $('#sb-name').textContent = d.profile.name;
  $('#sb-alt').textContent = d.profile.alt;
  $('#sb-affil').textContent = d.profile.affiliation;
  $('#sb-bio').textContent = d.profile.bio;
  $('#sb-tags').innerHTML = d.profile.tags
    .map((t) => `<span class="${attr(t.cls)}">${t.text}</span>`).join('');
  $('#carousel-prev').setAttribute('aria-label', d.a11y.prevPhoto);
  $('#carousel-next').setAttribute('aria-label', d.a11y.nextPhoto);
}

const header = (title, big) =>
  `<div class="section-header"><span class="section-title${big ? ' section-title-lg' : ''}">${title}</span><div class="section-rule"></div></div>`;

function newsItem(n) {
  const tag = n.tagText
    ? `<div class="news-tags"><span class="${attr(n.tagCls)}">${n.tagText}</span></div>` : '';
  return `<div class="news-item"><div class="news-date">${n.date}</div>` +
         `<div class="news-content">${tag}${n.body}</div></div>`;
}

function renderHome() {
  const d = state.data;
  const s = d.sections;

  const research = `
    <div class="section-lg" id="research">
      ${header(s.research, true)}
      <div class="research-overview">
        ${d.research.paragraphs.map((p) => `<p>${p}</p>`).join('')}
        <div class="research-areas">
          ${d.research.tags.map((t) => `<span class="${attr(t.cls)}">${t.text}</span>`).join('')}
        </div>
      </div>
    </div>`;

  const news = `
    <div class="section" id="news">
      ${header(s.news)}
      <div class="news-timeline">
        ${d.news.recent.map(newsItem).join('')}
        <details>
          <summary class="news-toggle">${d.news.moreLabel}</summary>
          ${d.news.earlier.map(newsItem).join('')}
        </details>
      </div>
    </div>`;

  const experience = `
    <div class="section" id="experience">
      ${header(s.experience)}
      ${d.experience.map((e) => `
        <div class="entry">
          <div class="entry-header">
            <span class="entry-org">${e.url
              ? `<a href="${attr(e.url)}" target="_blank" rel="noopener">${e.org}</a>` : e.org}</span>
            <span class="entry-date">${e.date}</span>
          </div>
          <div class="entry-role">${e.role}</div>
          <ul class="entry-bullets">${e.bullets.map((b) => `<li>${b}</li>`).join('')}</ul>
        </div>`).join('')}
    </div>`;

  const education = `
    <div class="section" id="education">
      ${header(s.education)}
      ${d.education.map((c) => `
        <div class="edu-card"><div class="edu-row">
          <div>
            <div class="edu-school">${c.school}</div>
            <div class="edu-degree">${c.degree}</div>
          </div>
          <div style="text-align:right;">
            <div class="edu-date">${c.date}</div>
            <div class="edu-gpa">${c.gpa}</div>
          </div>
        </div></div>`).join('')}
    </div>`;

  const publications = `
    <div class="section" id="publications">
      ${header(s.publications)}
      ${d.publications.map((p) => {
        const thumbCls = p.thumbs.length > 1 ? 'pub-thumb-duo' : 'pub-thumb';
        const thumbs = p.thumbs.length
          ? `<div class="${thumbCls}">${p.thumbs.map((t) =>
              `<img src="${attr(t.src)}" alt="${attr(t.alt)}" loading="lazy">`).join('')}</div>`
          : '';
        const links = p.links.length
          ? `<div class="pub-body-links">${p.links.map((l) =>
              `<a href="${attr(l.href)}"${l.ext ? ' target="_blank" rel="noopener"' : ''} data-stop>${l.label}</a>`
            ).join('')}</div>`
          : '';
        return `
        <div class="pub-showcase${p.slug ? ' clickable' : ''}"${p.slug ? ` data-project="${attr(p.slug)}"` : ''}>
          <div class="pub-showcase-inner">
            ${thumbs}
            <div class="pub-body">
              <div class="pub-body-title">${p.title}</div>
              <div class="pub-body-authors">${p.authors}</div>
              <div class="pub-body-venue">${p.venue} <span class="venue-tag">${p.year}</span></div>
              <div class="pub-body-snip">${p.snippet}</div>
              ${links}
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>`;

  const skills = `
    <div class="section" id="skills">
      ${header(s.skills)}
      <div class="honors-grid">
        ${d.skills.map((h) => `<div class="honor-item">${h}</div>`).join('')}
      </div>
    </div>`;

  const repos = `
    <div class="section" id="repos">
      ${header(s.repos)}
      <div class="repo-footnote">${d.repos}</div>
    </div>`;

  $('#resume').innerHTML = research + news + experience + education + publications + skills + repos;
}

function renderFooter() {
  const f = state.data.footer;
  $('#site-footer').innerHTML = `
    <div class="footer-ornament">
      <svg viewBox="0 0 140 40" width="140" height="40" fill="none" stroke="currentColor" stroke-width="0.6" opacity="0.35">
        <circle cx="20" cy="20" r="3.5"/><circle cx="70" cy="20" r="3.5"/><circle cx="120" cy="20" r="3.5"/>
        <path d="M23.5 20Q33 12 45 16Q57 20 66.5 20"/><path d="M73.5 20Q83 26 95 22Q107 18 116.5 20"/>
        <path d="M20 16Q20 7 25 7Q30 7 30 16"/><path d="M120 16Q120 7 115 7Q110 7 110 16"/>
        <path d="M70 23.5L70 33"/><path d="M65 28L75 28"/>
      </svg>
    </div>
    <h2 class="footer-heading">${f.heading}</h2>
    <p class="footer-text">${f.text}</p>
    <p class="footer-tagline">${f.tagline}</p>
    <div class="footer-links">
      <a href="mailto:cyracaid@gmail.com" class="footer-link"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 4L12 13 2 4"/></svg>cyracaid@gmail.com</a>
      <a href="https://github.com/cyracaid" target="_blank" rel="noopener" class="footer-link"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>GitHub</a>
      <a href="https://linkedin.com/in/cyrad" target="_blank" rel="noopener" class="footer-link"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>LinkedIn</a>
    </div>
    <div class="footer-copy">${f.copy}</div>`;
}

function renderAll() {
  renderLangSwitch();
  renderChrome();
  renderHome();
  renderFooter();
  initCarousel();
}

/* -------------------------------------------------------------- routing --- */

const BACK_ARROW = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>';

function renderProjectPage(slug) {
  const p = state.data.projects[slug];
  if (!p) return false;
  const t = state.data.project;

  const links = Object.entries(p.links || {}).map(([key, href]) =>
    `<a href="${attr(href)}" target="_blank" rel="noopener">${key.toUpperCase()} ↗</a>`).join('');

  const block = (heading, body) => body
    ? `<div class="project-detail-section"><h3>${heading}</h3><p>${body}</p></div>` : '';

  $('#view-project').innerHTML = `
    <div class="project-detail">
      <a class="back-link" href="#/">${BACK_ARROW}${t.back}</a>
      <div class="project-detail-header">
        <div class="project-detail-title">${p.title}</div>
        <div class="project-detail-meta"><strong>${p.authors}</strong></div>
        <div class="project-detail-meta">${p.venue} · ${p.year}</div>
        <div class="project-detail-tags">${(p.tags || []).map((x) => `<span class="tag tag-accent">${x}</span>`).join('')}</div>
        <div class="project-links-bar">${links}</div>
      </div>
      ${block(t.overview, p.summary)}
      ${block(t.motivation, p.motivation)}
      ${block(t.methodology, p.methodology)}
      ${block(t.results, p.results)}
      ${block(t.impact, p.impact)}
      <a class="back-link" href="#/" style="margin-top: 8px;">${BACK_ARROW}${t.backHome}</a>
    </div>`;
  return true;
}

function handleRoute({ scroll = true } = {}) {
  const hash = location.hash || '';
  const m = hash.match(/^#\/project\/([\w-]+)$/);

  if (m && renderProjectPage(m[1])) {
    document.body.classList.add('project-view');
    if (scroll) window.scrollTo({ top: 0 });
    return;
  }

  document.body.classList.remove('project-view');
  $('#view-project').innerHTML = '';

  // Plain anchors (#resume, #publications, #repos) — the content is rendered
  // by JS, so the browser's own jump may have fired before the node existed.
  if (scroll && hash && !hash.startsWith('#/')) {
    const el = document.getElementById(hash.slice(1));
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

/* ------------------------------------------------------------- carousel --- */

let currentSlide = 0;

function goToSlide(n) {
  const track = $('#carousel-track');
  const dots = $('#carousel-dots');
  if (!track) return;
  const slides = track.querySelectorAll('.carousel-slide');
  if (!slides.length) return;
  if (n < 0) n = slides.length - 1;
  if (n >= slides.length) n = 0;
  currentSlide = n;
  track.style.transform = `translateX(-${n * 100}%)`;
  if (dots) dots.querySelectorAll('.carousel-dot')
    .forEach((d, i) => d.classList.toggle('active', i === n));
}

function initCarousel() {
  const track = $('#carousel-track');
  const dots = $('#carousel-dots');
  if (!track || !dots || dots.childElementCount) return;
  const slides = track.querySelectorAll('.carousel-slide');
  if (slides.length < 2) return;
  dots.innerHTML = '';
  slides.forEach((_, i) => {
    const dot = document.createElement('span');
    dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
    dot.addEventListener('click', () => goToSlide(i));
    dots.appendChild(dot);
  });
  goToSlide(0);
}

/* ------------------------------------------------------- cat companion --- */

function boopCat() {
  const c = document.querySelector('.cat-companion');
  if (!c) return;
  c.style.animation = 'none';
  void c.offsetHeight;
  c.style.animation = 'catBoop 0.4s ease';
  setTimeout(() => { c.style.animation = 'catFloat 5s ease-in-out infinite'; }, 400);
}
window.boopCat = boopCat;

function initDraggableCat() {
  const cat = document.querySelector('.cat-companion');
  if (!cat) return;
  const defaultX = 15, defaultY = -12, boundX = 120, maxDrag = 80;
  let offsetX = 0, offsetY = 0;

  const onMouseMove = (e) => {
    const parent = cat.parentElement.getBoundingClientRect();
    const rawX = e.clientX - parent.left - offsetX;
    const rawY = e.clientY - parent.top - offsetY;
    const dx = rawX - defaultX, dy = rawY - defaultY;
    const dist = Math.hypot(dx, dy);
    let x = rawX, y = rawY;
    if (dist > boundX) {
      const angle = Math.atan2(dy, dx);
      const excess = dist - boundX;
      const pull = Math.min(boundX + excess * (boundX / (boundX + excess * 1.2)), boundX + maxDrag);
      x = defaultX + Math.cos(angle) * pull;
      y = defaultY + Math.sin(angle) * pull;
    }
    cat.style.left = `${x}px`;
    cat.style.top = `${y}px`;
  };

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    cat.style.transition = 'left 0.45s cubic-bezier(0.34,1.56,0.64,1), top 0.45s cubic-bezier(0.34,1.56,0.64,1)';
    cat.style.left = `${defaultX}px`;
    cat.style.top = `${defaultY}px`;
    setTimeout(() => {
      cat.style.transition = '';
      cat.style.animation = 'catFloat 5s ease-in-out infinite';
    }, 450);
  };

  cat.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const rect = cat.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    cat.style.animation = 'none';
    cat.style.transition = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });
}

/* ------------------------------------------------------------ listeners --- */

document.addEventListener('click', (e) => {
  const langBtn = e.target.closest('.lang-btn');
  if (langBtn) { setLang(langBtn.dataset.lang); return; }

  const prev = e.target.closest('#carousel-prev');
  if (prev) { goToSlide(currentSlide - 1); return; }
  const next = e.target.closest('#carousel-next');
  if (next) { goToSlide(currentSlide + 1); return; }

  // A link inside a publication card must not also trigger the card itself.
  if (e.target.closest('[data-stop]')) return;

  const card = e.target.closest('[data-project]');
  if (card) { location.hash = `#/project/${card.dataset.project}`; }
});

window.addEventListener('hashchange', () => handleRoute());

/* ----------------------------------------------------------------- boot --- */

(async function boot() {
  try {
    state.langs = await (await fetch('i18n/langs.json', { cache: 'no-cache' })).json();
    state.base = await loadLang(DEFAULT_LANG);
    initDraggableCat();
    await setLang(resolveLang(), { push: true });
  } catch (err) {
    console.error(err);
    document.querySelector('.main-content').innerHTML =
      `<div class="boot-error"><strong>Content failed to load.</strong><br>` +
      `The <code>i18n/</code> files could not be fetched (${attr(err.message)}).<br><br>` +
      `If you opened this file directly from disk, run a local server instead — ` +
      `<code>python3 -m http.server</code> — or view it on GitHub Pages.</div>`;
  }
})();

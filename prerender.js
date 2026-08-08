#!/usr/bin/env node
/* =============================================================================
   prerender.js — bakes the English content into index.html for crawlers.
   -----------------------------------------------------------------------------
   Why: the site renders from i18n/*.json in the browser. Googlebot does run JS,
   but it queues JS pages and often indexes the empty shell first. Tools that
   never run JS (WeChat previews, some academic indexers) see nothing at all.

   This script loads the real page in a headless DOM, lets app.js render the
   English version, then writes that markup back into index.html. app.js still
   overwrites it on load, so nothing changes for real visitors.

   Run it after you edit i18n/en.json:
       npm install jsdom          # once
       node prerender.js

   Skipping it is safe — visitors always see the live JSON. Only crawlers would
   see slightly stale content.
   ========================================================================== */

const { JSDOM, VirtualConsole } = require('jsdom');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const FILE = path.join(ROOT, 'index.html');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

// Elements whose innerHTML gets baked in.
const TARGETS = [
  { open: '<div id="resume">', close: '</div>', sel: '#resume' },
  { open: '<footer class="site-footer" id="site-footer">', close: '</footer>', sel: '#site-footer' },
  { open: '<div class="sidebar-tags" id="sb-tags">', close: '</div>', sel: '#sb-tags' },
];

const server = http.createServer((req, res) => {
  const p = new URL(req.url, 'http://x').pathname;
  fs.readFile(path.join(ROOT, p === '/' ? 'index.html' : p), (err, buf) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'text/plain' });
    res.end(buf);
  });
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

server.listen(0, async () => {
  const base = `http://127.0.0.1:${server.address().port}/`;
  const vc = new VirtualConsole();
  vc.on('jsdomError', () => {});

  const dom = new JSDOM(fs.readFileSync(FILE, 'utf8'), {
    url: base + '?lang=en',
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(w) {
      w.fetch = (input, init) => globalThis.fetch(new URL(input, base).href, init);
      w.scrollTo = () => {};
      w.HTMLElement.prototype.scrollIntoView = () => {};
    },
  });

  await wait(1200);
  const doc = dom.window.document;

  if (!doc.querySelector('#resume .section-lg')) {
    console.error('prerender failed: app.js did not render. Check i18n/en.json.');
    process.exit(1);
  }

  let html = fs.readFileSync(FILE, 'utf8');

  for (const t of TARGETS) {
    const start = html.indexOf(t.open);
    if (start === -1) { console.error('marker not found:', t.open); process.exit(1); }
    const from = start + t.open.length;
    const end = html.indexOf(t.close + '\n', from);
    const stop = end === -1 ? html.indexOf(t.close, from) : end;
    const body = doc.querySelector(t.sel).innerHTML;
    html = html.slice(0, from) + '\n' + body + '\n' + html.slice(stop);
    console.log('baked', t.sel, `(${body.length} chars)`);
  }

  // Crawlable links to the other languages. app.js replaces these with buttons.
  const langs = JSON.parse(fs.readFileSync(path.join(ROOT, 'i18n/langs.json'), 'utf8'));
  const nav = langs.map((l) =>
    `<a class="lang-btn${l.code === 'en' ? ' active' : ''}" href="?lang=${l.code}">${l.label}</a>`).join('');
  html = html.replace(/(<div class="nav-right" id="lang-switch">)[\s\S]*?(<\/div>)/,
    `$1${nav}$2`);

  // Sidebar single-line fields.
  for (const [sel, id] of [['#sb-affil', 'sb-affil'], ['#sb-bio', 'sb-bio']]) {
    const val = doc.querySelector(sel).textContent;
    html = html.replace(new RegExp(`(id="${id}">)[^<]*(<)`), `$1${val}$2`);
  }

  fs.writeFileSync(FILE, html);
  console.log('\nindex.html updated —', html.split('\n').length, 'lines');
  dom.window.close();
  server.close();
});

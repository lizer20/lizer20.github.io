/* ==========================================================================
   site.js — tum sayfalarda ortak: header, footer, veri yukleme, yardimcilar
   Header ve footer TEK yerden (burasi) uretilir; menuye link eklemek
   istersen asagidaki NAV dizisine bir satir eklemen yeterli.
   ========================================================================== */

const SITE = {
  name: 'Emre Biltekin',
  url:  'https://emrebiltekin.me',
  startYear: 2026,

  // GoatCounter ziyaretci sayaci.
  // goatcounter.com'da hesap acinca sana bir kod verilir (orn. "emrebiltekin").
  // Buraya yazdigin anda sayac calismaya baslar; bos birakirsan hicbir sey yuklenmez.
  // Cerez kullanmaz, kisisel veri toplamaz -> cerez uyarisi gerekmez.
  goatcounter: ''
};

const NAV = [
  { href: '/',             key: 'nav.home' },
  { href: '/projects.html', key: 'nav.projects' },
  { href: '/blog.html',     key: 'nav.blog' },
  { href: '/about.html',    key: 'nav.about' },
  { href: '/contact.html',  key: 'nav.contact' }
];

/* ---------- SVG ikonlari ---------- */
const ICONS = {
  github:   '<path d="M12 2A10 10 0 0 0 8.84 21.5c.5.08.66-.23.66-.5v-1.7C6.73 19.9 6.14 18 6.14 18c-.46-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.16.59.67.5A10 10 0 0 0 12 2Z"/>',
  linkedin: '<path d="M6.94 5a1.94 1.94 0 1 1-3.88 0 1.94 1.94 0 0 1 3.88 0ZM3.5 8.5h3.4V21H3.5V8.5Zm5.6 0h3.26v1.71h.05c.45-.86 1.56-1.76 3.21-1.76 3.43 0 4.07 2.26 4.07 5.2V21h-3.4v-6.1c0-1.45-.03-3.32-2.02-3.32-2.03 0-2.34 1.58-2.34 3.21V21H9.1V8.5Z"/>',
  x:        '<path d="M17.53 3h3.05l-6.66 7.62L21.75 21h-6.13l-4.8-6.28L5.32 21H2.27l7.12-8.14L2.25 3h6.28l4.34 5.74L17.53 3Zm-1.07 16.17h1.69L7.62 4.74H5.8l10.66 14.43Z"/>',
  instagram:'<path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41 1.27-.06 1.65-.07 4.85-.07ZM12 7.7a4.3 4.3 0 1 0 0 8.6 4.3 4.3 0 0 0 0-8.6Zm0 7.09a2.79 2.79 0 1 1 0-5.58 2.79 2.79 0 0 1 0 5.58Zm5.48-7.26a1 1 0 1 1-2.01 0 1 1 0 0 1 2.01 0Z"/>',
  youtube:  '<path d="M21.58 7.19a2.51 2.51 0 0 0-1.77-1.78C18.25 5 12 5 12 5s-6.25 0-7.81.41A2.51 2.51 0 0 0 2.42 7.2 26.2 26.2 0 0 0 2 12a26.2 26.2 0 0 0 .42 4.81 2.51 2.51 0 0 0 1.77 1.78C5.75 19 12 19 12 19s6.25 0 7.81-.41a2.51 2.51 0 0 0 1.77-1.78C21.86 15.26 22 13.66 22 12s-.14-3.26-.42-4.81ZM10 15.02V8.98L15.2 12 10 15.02Z"/>',
  itch:     '<path d="M3.13 3.5C2.36 3.96.87 5.67.87 6.11v.73c0 .93.87 1.75 1.65 1.75.95 0 1.74-.78 1.74-1.72 0 .94.77 1.72 1.72 1.72.94 0 1.68-.78 1.68-1.72 0 .94.81 1.72 1.75 1.72h.02c.94 0 1.75-.78 1.75-1.72 0 .94.73 1.72 1.68 1.72.94 0 1.72-.78 1.72-1.72 0 .94.79 1.72 1.74 1.72.78 0 1.65-.82 1.65-1.75v-.73c0-.44-1.49-2.15-2.26-2.61C17.24 3.44 15.03 3.4 12 3.4s-5.24.04-8.87.1Zm6.3 6.68a1.9 1.9 0 0 1-1.57.86c-.7 0-1.32-.36-1.7-.9-.37.54-1 .9-1.7.9-.24 0-.47-.05-.68-.13-.1 1.02-.14 2-.14 2.72v1.5c0 2.34.32 4.32 2.9 4.32h1.9c.6 0 1.04-.5 1.04-1.1v-1.7c0-.68.4-1.13 1.02-1.34h1.2c.62.2 1.02.66 1.02 1.34v1.7c0 .6.44 1.1 1.05 1.1h1.9c2.57 0 2.89-1.98 2.89-4.32v-1.5c0-.72-.04-1.7-.14-2.72-.21.08-.44.13-.68.13-.7 0-1.33-.36-1.7-.9a2.03 2.03 0 0 1-1.7.9c-.66 0-1.24-.33-1.58-.86-.34.53-.92.86-1.58.86h-.02c-.65 0-1.24-.33-1.58-.86Zm-.36 3.15h2.93l1.53 1.53h1.44v1.44l-1.53 1.53h-2.87l-1.5-1.53v-1.44h1.44l1.53-1.53Z"/>',
  mail:     '<path d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm1 2.25V17h16V7.25l-8 5.33-8-5.33ZM19.4 7H4.6l7.4 4.93L19.4 7Z"/>',
  discord:  '<path d="M19.3 5.34A16.4 16.4 0 0 0 15.2 4l-.2.42a12.5 12.5 0 0 1 3.6 1.85 17.4 17.4 0 0 0-13.2 0A12.5 12.5 0 0 1 9 4.42L8.8 4a16.4 16.4 0 0 0-4.1 1.34C2.1 9.28 1.4 13.1 1.75 16.87A16.6 16.6 0 0 0 6.8 19.4l1.1-1.5a10.8 10.8 0 0 1-1.7-.82l.42-.32a11.9 11.9 0 0 0 10.76 0l.42.32c-.54.32-1.11.6-1.7.82l1.1 1.5a16.6 16.6 0 0 0 5.05-2.53c.42-4.36-.7-8.15-2.95-11.53ZM8.55 14.6c-.98 0-1.79-.9-1.79-2s.79-2.01 1.79-2.01c1 0 1.8.9 1.79 2.01 0 1.1-.79 2-1.79 2Zm6.6 0c-.98 0-1.79-.9-1.79-2s.79-2.01 1.79-2.01c1 0 1.8.9 1.79 2.01 0 1.1-.79 2-1.79 2Z"/>',
  globe:    '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6.92 6h-2.95a15.6 15.6 0 0 0-1.38-3.56A8.03 8.03 0 0 1 18.92 8ZM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96ZM4.26 14a8.1 8.1 0 0 1 0-4h3.38a16.6 16.6 0 0 0 0 4H4.26Zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56A8 8 0 0 1 5.08 16Zm2.95-8H5.08a8 8 0 0 1 4.33-3.56A15.6 15.6 0 0 0 8.03 8ZM12 19.96A13.9 13.9 0 0 1 10.09 16h3.82A13.9 13.9 0 0 1 12 19.96ZM14.34 14H9.66a14.9 14.9 0 0 1 0-4h4.68a14.9 14.9 0 0 1 0 4Zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95a8 8 0 0 1-4.33 3.56ZM16.36 14a16.6 16.6 0 0 0 0-4h3.38a8.1 8.1 0 0 1 0 4h-3.38Z"/>',
  arrow:    '<path d="M13.17 5.17 12 6.34 16.83 11H4v2h12.83L12 17.66l1.17 1.17L20 12l-6.83-6.83Z"/>',
  arrowL:   '<path d="M10.83 5.17 12 6.34 7.17 11H20v2H7.17L12 17.66l-1.17 1.17L4 12l6.83-6.83Z"/>',
  search:   '<path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5Zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14Z"/>',
  menu:     '<path d="M3 6h18v2H3V6Zm0 5h18v2H3v-2Zm0 5h18v2H3v-2Z"/>',
  rss:      '<path d="M6.18 17.82a2.18 2.18 0 1 1-4.36 0 2.18 2.18 0 0 1 4.36 0ZM2 10.9v3.05A6.05 6.05 0 0 1 8.05 20h3.05C11.1 15 7 10.9 2 10.9Zm0-5.9v3.04C8.6 8.04 13.96 13.4 13.96 20H17C17 11.72 10.28 5 2 5Z"/>',
  moon:     '<path d="M12.3 2a1 1 0 0 0-.86 1.54A7.5 7.5 0 0 1 4.9 14.9a1 1 0 0 0-1.09 1.4A9.5 9.5 0 1 0 12.3 2Z"/>',
  sun:      '<path d="M12 17a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-2a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-1-13h2v3h-2V2Zm0 17h2v3h-2v-3ZM2 11h3v2H2v-2Zm17 0h3v2h-3v-2ZM4.22 5.64l1.42-1.42 2.12 2.12-1.41 1.42L4.22 5.64Zm12.02 12.02 1.41-1.42 2.13 2.12-1.42 1.42-2.12-2.12Zm2.12-13.44 1.42 1.42-2.13 2.12-1.41-1.42 2.12-2.12ZM5.64 19.78l-1.42-1.42 2.12-2.12 1.42 1.41-2.12 2.13Z"/>'
};

/* ---------- Tema (acik / koyu) ---------- */
const THEME_KEY = 'site.theme';
const Theme = {
  get(){
    return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
  },
  set(mode){
    if (mode === 'light') document.documentElement.dataset.theme = 'light';
    else delete document.documentElement.dataset.theme;
    try { localStorage.setItem(THEME_KEY, mode); } catch (e) {}
  },
  toggle(){ this.set(this.get() === 'light' ? 'dark' : 'light'); }
};

function icon(name, size = 18){
  const path = ICONS[name] || ICONS.globe;
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' + path + '</svg>';
}

/* ---------- Yardimcilar ---------- */
function esc(s){
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** JSON dosyalarini cek ve bellekte tut (ayni dosya iki kez indirilmesin) */
const _jsonCache = {};
function loadJSON(path){
  if (!_jsonCache[path]){
    _jsonCache[path] = fetch(path, { cache: 'no-cache' })
      .then(r => {
        if (!r.ok) throw new Error(path + ' -> HTTP ' + r.status);
        return r.json();
      });
  }
  return _jsonCache[path];
}

function loadText(path){
  return fetch(path, { cache: 'no-cache' }).then(r => {
    if (!r.ok) throw new Error(path + ' -> HTTP ' + r.status);
    return r.text();
  });
}

function formatDate(iso, lang){
  if (!iso) return '';
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
  if (isNaN(d)) return iso;
  return d.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB',
    { year: 'numeric', month: 'long', day: 'numeric' });
}

/** Hangi nav linki aktif? */
function isCurrent(href){
  const p = location.pathname.replace(/index\.html$/, '');
  if (href === '/') return p === '/' || p === '';
  if (href === '/blog.html') return p === '/blog.html' || p.startsWith('/blog/');
  return p === href;
}

/* ---------- Header ---------- */
function renderHeader(){
  const host = document.getElementById('site-header');
  if (!host) return;

  const links = NAV.map(item =>
    '<li><a href="' + item.href + '" data-i18n="' + item.key + '"' +
    (isCurrent(item.href) ? ' aria-current="page"' : '') + '></a></li>'
  ).join('');

  host.className = 'site-header';
  host.innerHTML =
    '<nav class="wrap nav" aria-label="Ana menü">' +
      '<a class="brand" href="/">' + esc(SITE.name) + '<span class="dot">.</span></a>' +
      '<button class="nav-toggle" id="navToggle" aria-expanded="false" aria-controls="navLinks">' +
        '<span class="sr-only" data-i18n="nav.menu"></span>' + icon('menu', 20) +
      '</button>' +
      '<ul class="nav-links" id="navLinks">' + links +
        '<li class="ctrl-li">' +
          '<div class="lang-switch" role="group" aria-label="Language">' +
            '<button type="button" data-lang="tr">TR</button>' +
            '<button type="button" data-lang="en">EN</button>' +
          '</div>' +
          '<button type="button" class="theme-toggle" id="themeToggle">' +
            '<span class="sr-only" data-i18n="nav.theme"></span>' +
            '<span class="icon-moon">' + icon('moon', 16) + '</span>' +
            '<span class="icon-sun">'  + icon('sun', 16)  + '</span>' +
          '</button>' +
        '</li>' +
      '</ul>' +
    '</nav>';

  host.querySelector('#themeToggle').addEventListener('click', () => Theme.toggle());

  const toggle = host.querySelector('#navToggle');
  const list   = host.querySelector('#navLinks');
  toggle.addEventListener('click', () => {
    const open = list.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  host.querySelectorAll('.lang-switch button').forEach(btn => {
    btn.addEventListener('click', () => Lang.set(btn.dataset.lang));
  });

  const onScroll = () => host.classList.toggle('is-stuck', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ---------- Footer ---------- */
function renderFooter(profile){
  const host = document.getElementById('site-footer');
  if (!host) return;

  const social = (profile && profile.social || []).map(s =>
    '<a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer" title="' + esc(s.label) + '">' +
      '<span class="sr-only">' + esc(s.label) + '</span>' + icon(s.icon) +
    '</a>'
  ).join('');

  const year = new Date().getFullYear();
  const years = year > SITE.startYear ? SITE.startYear + '–' + year : String(year);

  host.className = 'site-footer';
  host.innerHTML =
    '<div class="wrap footer-inner">' +
      '<p>© ' + years + ' ' + esc(SITE.name) + ' · <span data-i18n="footer.rights"></span></p>' +
      '<div class="social">' + social +
        '<a href="/feed.xml" title="RSS"><span class="sr-only">RSS</span>' + icon('rss') + '</a>' +
      '</div>' +
    '</div>';
}

/* ---------- Baslatma ---------- */
let profilePromise = null;
function getProfile(){
  if (!profilePromise) profilePromise = loadJSON('/content/profile.json').catch(() => ({}));
  return profilePromise;
}

/** Ziyaretci sayaci — sadece SITE.goatcounter doluysa yuklenir */
function initAnalytics(){
  if (!SITE.goatcounter) return;
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return; // lokal test sayilmasin
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://gc.zgo.at/count.js';
  s.setAttribute('data-goatcounter', 'https://' + SITE.goatcounter + '.goatcounter.com/count');
  document.body.appendChild(s);
}

document.addEventListener('DOMContentLoaded', () => {
  renderHeader();
  getProfile().then(p => {
    renderFooter(p);
    applyI18n();
  });
  applyI18n();
  initAnalytics();
});

// Dil degisince header/footer metinleri de guncellensin
document.addEventListener('langchange', () => applyI18n());

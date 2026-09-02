/* ==========================================================================
   i18n — arayuz metinleri (TR / EN)
   Yeni metin eklemek icin: asagidaki iki nesneye ayni anahtari ekle,
   HTML'de de  <span data-i18n="anahtar"></span>  yaz. Hepsi bu.
   ========================================================================== */

const I18N = {
  tr: {
    'nav.home':      'Ana Sayfa',
    'nav.projects':  'Projeler',
    'nav.blog':      'Blog',
    'nav.about':     'Hakkımda',
    'nav.contact':   'İletişim',
    'nav.menu':      'Menü',
    'nav.theme':     'Temayı değiştir',

    'home.featured.title': 'Öne Çıkan Projeler',
    'home.featured.desc':  'Üzerinde çalıştığım oyunlar, siteler ve araçlar.',
    'home.featured.all':   'Tüm projeler',
    'home.latest.title':   'Son Yazılar',
    'home.latest.desc':    'Geliştirme notları, finans ve teknoloji üzerine yazdıklarım.',
    'home.latest.all':     'Tüm yazılar',

    'projects.title':  'Projeler',
    'projects.desc':   'Geliştirdiğim oyunlar, web projeleri ve araçlar.',
    'projects.search': 'Proje ara...',
    'projects.empty':  'Bu filtreye uyan proje yok.',

    'blog.title':   'Blog',
    'blog.desc':    'Yazılım, oyun geliştirme, ağ teknolojileri ve finans üzerine yazılar.',
    'blog.search':  'Yazılarda ara...',
    'blog.empty':   'Bu filtreye uyan yazı yok.',
    'blog.back':    'Tüm yazılar',
    'blog.notfound':'Yazı bulunamadı.',
    'blog.nolang':  'Bu yazının Türkçe çevirisi henüz yok. İngilizce sürümü gösteriliyor.',

    'about.title': 'Hakkımda',

    'contact.title': 'İletişim',
    'contact.desc':  'Proje, iş birliği veya sadece merhaba demek için bana ulaşabilirsin.',
    'contact.email': 'E-posta',

    'filter.all':   'Tümü',
    'filter.game':  'Oyun',
    'filter.web':   'Web',
    'filter.tool':  'Araç',
    'filter.other': 'Diğer',

    'common.loading':   'Yükleniyor...',
    'common.readMore':  'Devamını oku',
    'common.minRead':   'dk okuma',
    'common.featured':  'Öne çıkan',
    'common.viewAll':   'Tümünü gör',
    'common.noImage':   'GÖRSEL YOK',
    'common.draft':     'Taslak',
    'common.error':     'İçerik yüklenemedi.',

    'footer.built':  'Kendi ellerimle yapıldı.',
    'footer.rights': 'Tüm hakları saklıdır.',

    '404.title': 'Sayfa bulunamadı',
    '404.desc':  'Aradığın sayfa taşınmış veya hiç var olmamış olabilir.',
    '404.home':  'Ana sayfaya dön'
  },

  en: {
    'nav.home':      'Home',
    'nav.projects':  'Projects',
    'nav.blog':      'Blog',
    'nav.about':     'About',
    'nav.contact':   'Contact',
    'nav.menu':      'Menu',
    'nav.theme':     'Toggle theme',

    'home.featured.title': 'Featured Projects',
    'home.featured.desc':  'Games, sites and tools I have been working on.',
    'home.featured.all':   'All projects',
    'home.latest.title':   'Latest Writing',
    'home.latest.desc':    'Development notes and thoughts on finance and technology.',
    'home.latest.all':     'All posts',

    'projects.title':  'Projects',
    'projects.desc':   'Games, web projects and tools I have built.',
    'projects.search': 'Search projects...',
    'projects.empty':  'No projects match this filter.',

    'blog.title':   'Blog',
    'blog.desc':    'Writing on software, game development, networking and finance.',
    'blog.search':  'Search posts...',
    'blog.empty':   'No posts match this filter.',
    'blog.back':    'All posts',
    'blog.notfound':'Post not found.',
    'blog.nolang':  'This post has no English translation yet. Showing the Turkish version.',

    'about.title': 'About',

    'contact.title': 'Contact',
    'contact.desc':  'Reach out about a project, a collaboration, or just to say hi.',
    'contact.email': 'Email',

    'filter.all':   'All',
    'filter.game':  'Game',
    'filter.web':   'Web',
    'filter.tool':  'Tool',
    'filter.other': 'Other',

    'common.loading':   'Loading...',
    'common.readMore':  'Read more',
    'common.minRead':   'min read',
    'common.featured':  'Featured',
    'common.viewAll':   'View all',
    'common.noImage':   'NO IMAGE',
    'common.draft':     'Draft',
    'common.error':     'Could not load content.',

    'footer.built':  'Handmade.',
    'footer.rights': 'All rights reserved.',

    '404.title': 'Page not found',
    '404.desc':  'The page you are looking for has moved or never existed.',
    '404.home':  'Back to home'
  }
};

const LANG_KEY = 'site.lang';

/** Aktif dili belirle: URL > localStorage > tarayici > 'tr' */
function detectLang(){
  const fromUrl = new URLSearchParams(location.search).get('lang');
  if (fromUrl === 'tr' || fromUrl === 'en') return fromUrl;
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'tr' || saved === 'en') return saved;
  } catch (e) { /* gizli sekme vb. */ }
  return (navigator.language || '').toLowerCase().startsWith('tr') ? 'tr' : 'en';
}

let currentLang = detectLang();

const Lang = {
  get(){ return currentLang; },

  set(lang){
    if (lang !== 'tr' && lang !== 'en') return;
    currentLang = lang;
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
    document.documentElement.lang = lang;
    applyI18n();
    document.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
  },

  /** Ceviri anahtarini metne cevirir; anahtar yoksa anahtari doner (eksigi gorursun) */
  t(key){
    const table = I18N[currentLang] || I18N.tr;
    return (key in table) ? table[key] : key;
  },

  /** Iki dilli bir nesneden aktif dildeki degeri al: {tr:"...", en:"..."} */
  pick(obj, fallback = ''){
    if (obj == null) return fallback;
    if (typeof obj === 'string') return obj;
    return obj[currentLang] || obj.tr || obj.en || fallback;
  }
};

/** data-i18n / data-i18n-attr tasiyan tum elemanlari gunceller */
function applyI18n(root = document){
  root.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = Lang.t(el.getAttribute('data-i18n'));
  });
  // ornek:  data-i18n-attr="placeholder:blog.search"
  root.querySelectorAll('[data-i18n-attr]').forEach(el => {
    el.getAttribute('data-i18n-attr').split(';').forEach(pair => {
      const [attr, key] = pair.split(':').map(s => s && s.trim());
      if (attr && key) el.setAttribute(attr, Lang.t(key));
    });
  });
  document.querySelectorAll('.lang-switch button').forEach(btn => {
    btn.setAttribute('aria-pressed', String(btn.dataset.lang === currentLang));
  });
}

document.documentElement.lang = currentLang;

/* ==========================================================================
   pages.js — sayfa mantigi
   Hangi sayfada olduguna <body data-page="..."> ile karar verir.
   Dil degistiginde ilgili sayfa kendini yeniden cizer.
   ========================================================================== */

const PATHS = {
  profile:  '/content/profile.json',
  projects: '/content/projects.json',
  posts:    '/content/posts.json'
};

const postUrl = slug => '/blog/' + slug + '.html';
const byDateDesc = (a, b) => String(b.date || '').localeCompare(String(a.date || ''));

/* ---------- Ortak parcalar ---------- */

function tagList(tags, accent){
  if (!tags || !tags.length) return '';
  return '<div class="tags">' + tags.map(t =>
    '<span class="tag' + (accent ? ' tag-accent' : '') + '">' + esc(t) + '</span>').join('') + '</div>';
}

function projectCard(p){
  const lang = Lang.get();
  const loc  = p[lang] || p.tr || p.en || {};
  const cover = p.cover
    ? '<img src="' + esc(p.cover) + '" alt="' + esc(loc.title || p.slug) + '" loading="lazy">'
    : '<span class="ph">' + Lang.t('common.noImage') + '</span>';

  const links = (p.links || []).map(l =>
    '<a class="btn btn-ghost btn-sm" href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer">' +
    esc(l.label) + '</a>').join('');

  return '<article class="card">' +
    '<div class="card-media">' + cover + '</div>' +
    '<div class="card-body">' +
      '<div class="card-meta"><span>' + esc(p.date || '') + '</span>' +
        (p.featured ? '<span class="tag tag-accent">' + Lang.t('common.featured') + '</span>' : '') +
      '</div>' +
      '<h3 class="card-title">' + esc(loc.title || p.slug) + '</h3>' +
      '<p class="card-desc">' + esc(loc.summary || '') + '</p>' +
      tagList(p.tags) +
      (links ? '<div class="card-links">' + links + '</div>' : '') +
    '</div>' +
  '</article>';
}

function postRow(post){
  const lang = Lang.get();
  const loc  = post[lang] || post.tr || post.en || {};
  return '<li class="post-item">' +
    '<a class="post-link" href="' + postUrl(post.slug) + '">' +
      '<time class="post-date" datetime="' + esc(post.date) + '">' + formatDate(post.date, lang) + '</time>' +
      '<div>' +
        '<h3 class="post-title">' + esc(loc.title || post.slug) +
          (post.draft ? ' <span class="tag">' + Lang.t('common.draft') + '</span>' : '') +
        '</h3>' +
        '<p class="post-sum">' + esc(loc.summary || '') + '</p>' +
        tagList(post.tags) +
      '</div>' +
    '</a>' +
  '</li>';
}

function setState(host, key){
  host.innerHTML = '<div class="empty">' + Lang.t(key) + '</div>';
}

/* ---------- Ana sayfa ---------- */
function initHome(){
  const heroName    = document.getElementById('heroName');
  const heroRole    = document.getElementById('heroRole');
  const heroTag     = document.getElementById('heroTagline');
  const heroAvatar  = document.getElementById('heroAvatar');
  const featuredBox = document.getElementById('featuredProjects');
  const latestBox   = document.getElementById('latestPosts');

  function drawProfile(p){
    if (!p) return;
    if (heroName) heroName.textContent = p.name || SITE.name;
    if (heroRole) heroRole.textContent = Lang.pick(p.role);
    if (heroTag)  heroTag.textContent  = Lang.pick(p.tagline);
    if (heroAvatar){
      heroAvatar.innerHTML = p.avatar
        ? '<img src="' + esc(p.avatar) + '" alt="' + esc(p.name || '') + '">'
        : '<div class="placeholder">FOTOĞRAF<br>/assets/img/avatar.jpg<br>ekleyip profile.json&#39;a yaz</div>';
    }
  }

  function drawProjects(data){
    if (!featuredBox) return;
    const list = (data.projects || []).filter(p => p.featured).sort(byDateDesc).slice(0, 3);
    if (!list.length) return setState(featuredBox, 'projects.empty');
    featuredBox.innerHTML = list.map(projectCard).join('');
  }

  function drawPosts(data){
    if (!latestBox) return;
    const list = (data.posts || []).filter(p => !p.draft).sort(byDateDesc).slice(0, 4);
    if (!list.length) return setState(latestBox, 'blog.empty');
    latestBox.innerHTML = list.map(postRow).join('');
  }

  const redraw = () => {
    getProfile().then(drawProfile);
    loadJSON(PATHS.projects).then(drawProjects).catch(() => featuredBox && setState(featuredBox, 'common.error'));
    loadJSON(PATHS.posts).then(drawPosts).catch(() => latestBox && setState(latestBox, 'common.error'));
  };
  redraw();
  document.addEventListener('langchange', redraw);
}

/* ---------- Projeler sayfasi ---------- */
function initProjects(){
  const box       = document.getElementById('projectsGrid');
  const filterBox = document.getElementById('projectFilters');
  const searchInp = document.getElementById('projectSearch');
  if (!box) return;

  let all = [];
  let activeType = 'all';

  function draw(){
    const q = (searchInp && searchInp.value || '').trim().toLowerCase();
    const lang = Lang.get();

    const list = all.filter(p => {
      if (activeType !== 'all' && p.type !== activeType) return false;
      if (!q) return true;
      const loc = p[lang] || {};
      const hay = [loc.title, loc.summary, (p.tags || []).join(' '), p.type].join(' ').toLowerCase();
      return hay.includes(q);
    }).sort(byDateDesc);

    if (!list.length) return setState(box, 'projects.empty');
    box.innerHTML = list.map(projectCard).join('');
  }

  function drawFilters(){
    if (!filterBox) return;
    const types = ['all'].concat([...new Set(all.map(p => p.type || 'other'))]);
    filterBox.innerHTML = types.map(t =>
      '<button type="button" class="filter-btn" data-type="' + t + '" aria-pressed="' +
      (t === activeType) + '">' + Lang.t('filter.' + t) + '</button>').join('');
    filterBox.querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => { activeType = b.dataset.type; drawFilters(); draw(); });
    });
  }

  loadJSON(PATHS.projects).then(data => {
    all = data.projects || [];
    drawFilters();
    draw();
  }).catch(() => setState(box, 'common.error'));

  if (searchInp) searchInp.addEventListener('input', draw);
  document.addEventListener('langchange', () => { drawFilters(); draw(); });
}

/* ---------- Blog listesi ---------- */
function initBlog(){
  const box       = document.getElementById('postsList');
  const filterBox = document.getElementById('postFilters');
  const searchInp = document.getElementById('postSearch');
  if (!box) return;

  let all = [];
  let activeTag = 'all';

  function draw(){
    const q = (searchInp && searchInp.value || '').trim().toLowerCase();
    const lang = Lang.get();

    const list = all.filter(p => {
      if (activeTag !== 'all' && !(p.tags || []).includes(activeTag)) return false;
      if (!q) return true;
      const loc = p[lang] || {};
      const hay = [loc.title, loc.summary, (p.tags || []).join(' ')].join(' ').toLowerCase();
      return hay.includes(q);
    }).sort(byDateDesc);

    if (!list.length) return setState(box, 'blog.empty');
    box.innerHTML = list.map(postRow).join('');
  }

  function drawFilters(){
    if (!filterBox) return;
    const tags = [...new Set(all.flatMap(p => p.tags || []))].sort();
    filterBox.innerHTML =
      '<button type="button" class="filter-btn" data-tag="all" aria-pressed="' + (activeTag === 'all') + '">' +
      Lang.t('filter.all') + '</button>' +
      tags.map(t => '<button type="button" class="filter-btn" data-tag="' + esc(t) + '" aria-pressed="' +
        (t === activeTag) + '">' + esc(t) + '</button>').join('');
    filterBox.querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => { activeTag = b.dataset.tag; drawFilters(); draw(); });
    });
  }

  loadJSON(PATHS.posts).then(data => {
    all = (data.posts || []).filter(p => !p.draft);
    drawFilters();
    draw();
  }).catch(() => setState(box, 'common.error'));

  if (searchInp) searchInp.addEventListener('input', draw);
  document.addEventListener('langchange', () => { drawFilters(); draw(); });
}

/* ---------- Tek yazi sayfasi ---------- */
function initPost(){
  const slug     = window.POST_SLUG;
  const titleEl  = document.getElementById('postTitle');
  const metaEl   = document.getElementById('postMeta');
  const bodyEl   = document.getElementById('postBody');
  const noticeEl = document.getElementById('postNotice');
  if (!slug || !bodyEl) return;

  function draw(){
    const lang = Lang.get();
    loadJSON(PATHS.posts).then(data => {
      const post = (data.posts || []).find(p => p.slug === slug);
      if (!post){
        if (titleEl) titleEl.textContent = Lang.t('blog.notfound');
        bodyEl.innerHTML = '';
        return;
      }

      // Aktif dilde yoksa diger dile dus ve kullaniciyi bilgilendir
      const other = lang === 'tr' ? 'en' : 'tr';
      const useLang = (post[lang] && post[lang].file) ? lang : other;
      const loc = post[useLang] || {};

      if (noticeEl){
        noticeEl.hidden = (useLang === lang);
        noticeEl.textContent = Lang.t('blog.nolang');
      }

      if (titleEl) titleEl.textContent = loc.title || slug;
      document.title = (loc.title || slug) + ' · ' + SITE.name;

      bodyEl.innerHTML = '<div class="loading">' + Lang.t('common.loading') + '</div>';

      loadText(loc.file).then(md => {
        bodyEl.innerHTML = MD.render(md);
        if (metaEl){
          metaEl.innerHTML =
            '<time datetime="' + esc(post.date) + '">' + formatDate(post.date, lang) + '</time>' +
            '<span>·</span><span>' + MD.readingTime(md) + ' ' + Lang.t('common.minRead') + '</span>' +
            ((post.tags || []).length ? '<span>·</span>' + tagList(post.tags) : '');
        }
      }).catch(() => { bodyEl.innerHTML = '<div class="empty">' + Lang.t('common.error') + '</div>'; });
    }).catch(() => { bodyEl.innerHTML = '<div class="empty">' + Lang.t('common.error') + '</div>'; });
  }

  draw();
  document.addEventListener('langchange', draw);
}

/* ---------- Hakkimda sayfasi ---------- */
function initAbout(){
  const bioEl    = document.getElementById('aboutBio');
  const skillsEl = document.getElementById('aboutSkills');
  const avatarEl = document.getElementById('aboutAvatar');

  function draw(){
    getProfile().then(p => {
      if (bioEl){
        bioEl.innerHTML = Lang.pick(p.bio).split(/\n{2,}/)
          .map(par => '<p>' + esc(par) + '</p>').join('');
      }
      if (avatarEl){
        avatarEl.innerHTML = p.avatar
          ? '<img src="' + esc(p.avatar) + '" alt="' + esc(p.name || '') + '">'
          : '<div class="placeholder">FOTOĞRAF<br>/assets/img/avatar.jpg</div>';
      }
      if (skillsEl){
        skillsEl.innerHTML = (p.skills || []).map(g =>
          '<div class="skill-group"><h3>' + esc(Lang.pick(g.group)) + '</h3>' +
          tagList(g.items) + '</div>').join('');
      }
    });
  }
  draw();
  document.addEventListener('langchange', draw);
}

/* ---------- Iletisim sayfasi ---------- */
function initContact(){
  const box = document.getElementById('contactCards');
  if (!box) return;

  function draw(){
    getProfile().then(p => {
      const items = [];
      if (p.email){
        items.push({ label: Lang.t('contact.email'), value: p.email, url: 'mailto:' + p.email, icon: 'mail' });
      }
      (p.social || []).forEach(s => {
        if (String(s.url).startsWith('mailto:')) return;   // e-posta zaten yukarida
        items.push({ label: s.label, value: String(s.url).replace(/^https?:\/\//, ''), url: s.url, icon: s.icon });
      });

      box.innerHTML = items.map(i =>
        '<a class="contact-card" href="' + esc(i.url) + '"' +
        (i.url.startsWith('mailto:') ? '' : ' target="_blank" rel="noopener noreferrer"') + '>' +
          '<span class="ico">' + icon(i.icon, 20) + '</span>' +
          '<span class="txt"><span class="label">' + esc(i.label) + '</span>' +
          '<span class="value">' + esc(i.value) + '</span></span>' +
        '</a>').join('');
    });
  }
  draw();
  document.addEventListener('langchange', draw);
}

/* ---------- Yonlendirici ---------- */
document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  ({ home: initHome, projects: initProjects, blog: initBlog,
     post: initPost, about: initAbout, contact: initContact }[page] || function(){})();
});

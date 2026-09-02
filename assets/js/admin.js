/* ==========================================================================
   admin.js — yonetim paneli
   Tarayicidan dogrudan GitHub API'sine commit atar; arada sunucu yoktur.

   Bir yazi yayinlandiginda TEK commit'te su dosyalar guncellenir:
     content/posts/<slug>.tr.md , <slug>.en.md , content/posts.json ,
     blog/<slug>.html , feed.xml , sitemap.xml
   Tek commit olmasi onemli: site hicbir an yarim kalmis durumda kalmaz.

   TOKEN: sadece bu tarayicinin localStorage'inda durur; repoya YAZILMAZ,
   GitHub disinda hicbir sunucuya GONDERILMEZ.
   ========================================================================== */

const KEY = { token: 'admin.token', owner: 'admin.owner', repo: 'admin.repo' };

/* Gorsel klasorleri */
const DIR = {
  postImg: 'assets/img/posts',
  projImg: 'assets/img/projects',
  avatar:  'assets/img'
};

/* ==========================================================================
   base64 yardimcilari
   ========================================================================== */

function toB64(str){
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin);
}

async function blobToB64(blob){
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  const CHUNK = 0x8000;                       // yigin tasmasini onlemek icin parcali
  for (let i = 0; i < buf.length; i += CHUNK){
    bin += String.fromCharCode.apply(null, buf.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

/* ==========================================================================
   GitHub istemcisi
   ========================================================================== */

const GH = {
  token: '', owner: '', repo: '', branch: 'main',

  get base(){ return 'https://api.github.com/repos/' + this.owner + '/' + this.repo; },

  async api(url, opts = {}){
    const res = await fetch(url.startsWith('http') ? url : this.base + url, {
      ...opts,
      headers: {
        'Authorization': 'Bearer ' + this.token,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(opts.headers || {})
      }
    });
    if (!res.ok){
      let msg = res.status + ' ' + res.statusText;
      try { const j = await res.json(); if (j.message) msg += ' — ' + j.message; } catch (e) {}
      throw new Error(msg);
    }
    return res.status === 204 ? null : res.json();
  },

  async verify(){
    const repo = await this.api('');
    this.branch = repo.default_branch || 'main';
    return repo.full_name;
  },

  /** Dosyayi ham metin olarak oku; yoksa null */
  async readFile(path){
    const res = await fetch(this.base + '/contents/' + path + '?ref=' + this.branch, {
      headers: {
        'Authorization': 'Bearer ' + this.token,
        'Accept': 'application/vnd.github.raw',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      cache: 'no-store'
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('Okunamadi: ' + path + ' (' + res.status + ')');
    return res.text();
  },

  /**
   * Birden fazla dosyayi TEK commit'te yaz/sil.
   * changes: [{path, content}] metin | [{path, b64}] ikili | [{path, remove:true}] silme
   */
  async commitFiles(message, changes){
    // Ayni yola birden fazla kayit gelirse sonuncusu gecerli olsun
    // (orn. slug degisimi + dil silme ayni dosyayi iki kez isaretleyebilir)
    const unique = [...new Map(changes.map(c => [c.path, c])).values()];

    const ref = await this.api('/git/ref/heads/' + this.branch);
    const baseCommitSha = ref.object.sha;
    const baseCommit = await this.api('/git/commits/' + baseCommitSha);

    const tree = [];
    for (const c of unique){
      if (c.remove){
        tree.push({ path: c.path, mode: '100644', type: 'blob', sha: null });
        continue;
      }
      const blob = await this.api('/git/blobs', {
        method: 'POST',
        body: JSON.stringify({
          content: c.b64 != null ? c.b64 : toB64(c.content),
          encoding: 'base64'
        })
      });
      tree.push({ path: c.path, mode: '100644', type: 'blob', sha: blob.sha });
    }

    const newTree = await this.api('/git/trees', {
      method: 'POST',
      body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree })
    });
    const newCommit = await this.api('/git/commits', {
      method: 'POST',
      body: JSON.stringify({ message, tree: newTree.sha, parents: [baseCommitSha] })
    });
    await this.api('/git/refs/heads/' + this.branch, {
      method: 'PATCH',
      body: JSON.stringify({ sha: newCommit.sha })
    });
    return newCommit.sha;
  }
};

/* ==========================================================================
   Durum
   ========================================================================== */

let postsDoc = null;
let projectsDoc = null;
let profileDoc = null;
let editing = null;      // duzenlenen yazi
let editProj = null;     // duzenlenen proje
let editLang = 'tr';
let savedDraft = null;   // geri yuklenmeyi bekleyen otomatik kayit

/* ==========================================================================
   Kucuk yardimcilar
   ========================================================================== */

const $ = sel => document.querySelector(sel);
const attr = s => String(s == null ? '' : s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function toast(msg, kind = 'info', ms = 4200){
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), ms);
}

function busy(on){
  $('#app').classList.toggle('busy', on);
  $('#busyDot').hidden = !on;
}

function todayISO(){
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function showView(name){
  ['list', 'editor', 'projects', 'projeditor', 'profile']
    .forEach(v => { $('#view-' + v).hidden = (v !== name); });
}

function selectTab(view){
  document.querySelectorAll('.adm-tab').forEach(x =>
    x.setAttribute('aria-selected', String(x.dataset.view === view)));
}

/* ==========================================================================
   Gorsel yukleme
   ========================================================================== */

/** Buyuk gorselleri kuculterek WebP'e cevir. GIF/SVG oldugu gibi kalir. */
async function processImage(file, maxW = 1600, quality = 0.82){
  const keepAsIs = /image\/(gif|svg\+xml)/.test(file.type);
  if (keepAsIs){
    return { blob: file, ext: file.type === 'image/gif' ? 'gif' : 'svg', converted: false };
  }
  try {
    const bmp = await createImageBitmap(file);
    let w = bmp.width, h = bmp.height;
    if (w > maxW){ h = Math.round(h * maxW / w); w = maxW; }

    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
    bmp.close && bmp.close();

    const blob = await new Promise(r => canvas.toBlob(r, 'image/webp', quality));
    if (!blob) throw new Error('webp uretilemedi');

    // Kucultme ise yaramadiysa orijinali kullan
    if (blob.size >= file.size && file.size < 900 * 1024){
      return { blob: file, ext: (file.name.split('.').pop() || 'jpg').toLowerCase(), converted: false };
    }
    return { blob, ext: 'webp', converted: true, from: file.size };
  } catch (e){
    return { blob: file, ext: (file.name.split('.').pop() || 'jpg').toLowerCase(), converted: false };
  }
}

function safeFileName(originalName, ext){
  const base = MD.slugify(originalName.replace(/\.[^.]+$/, '')).slice(0, 40) || 'gorsel';
  const stamp = Date.now().toString(36).slice(-5);
  return base + '-' + stamp + '.' + ext;
}

const fmtKB = n => (n / 1024).toFixed(0) + ' KB';

/** Dosya sec -> kucult -> repoya commit et -> site icindeki yolunu don */
function pickImage(dir){
  return new Promise(resolve => {
    const input = $('#fileInput');
    input.value = '';
    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return resolve(null);

      busy(true);
      try {
        const proc = await processImage(file);
        const name = safeFileName(file.name, proc.ext);
        const path = dir + '/' + name;
        const b64  = await blobToB64(proc.blob);

        await GH.commitFiles('Görsel eklendi: ' + name, [{ path, b64 }]);

        toast(proc.converted
          ? 'Yüklendi: ' + name + ' (' + fmtKB(proc.from) + ' → ' + fmtKB(proc.blob.size) + ')'
          : 'Yüklendi: ' + name + ' (' + fmtKB(proc.blob.size) + ')', 'ok');

        resolve('/' + path);
      } catch (err){
        toast('Görsel yüklenemedi: ' + err.message, 'err', 9000);
        resolve(null);
      } finally {
        busy(false);
      }
    };
    input.click();
  });
}

/* ==========================================================================
   Uretilen dosyalar
   ========================================================================== */

function buildPostPage(post){
  const tr = post.tr || {}, en = post.en || {};
  const title = tr.title || en.title || post.slug;
  const desc  = tr.summary || en.summary || '';
  const url   = SITE.url + '/blog/' + post.slug + '.html';
  const img   = post.cover ? (SITE.url + post.cover) : (SITE.url + '/assets/img/og-default.png');

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>/* Tema tercihini sayfa cizilmeden once uygula (ekran yanip sonmesin) */
try{ if(localStorage.getItem('site.theme')==='light') document.documentElement.dataset.theme='light'; }catch(e){}<\/script>

<!-- ==== Yaziya ozel bilgiler (admin paneli uretti) ==== -->
<title>${attr(title)} — ${attr(SITE.name)}</title>
<meta name="description" content="${attr(desc)}">
<link rel="canonical" href="${attr(url)}">
<meta property="og:title" content="${attr(title)} — ${attr(SITE.name)}">
<meta property="og:description" content="${attr(desc)}">
<meta property="og:url" content="${attr(url)}">
<meta property="article:published_time" content="${attr(post.date)}">
<script>window.POST_SLUG = ${JSON.stringify(post.slug)};<\/script>
<!-- =================================================== -->

<meta property="og:type" content="article">
<meta property="og:site_name" content="${attr(SITE.name)}">
<meta property="og:image" content="${attr(img)}">
<meta name="twitter:card" content="summary_large_image">

<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/style.css">
<link rel="alternate" type="application/rss+xml" title="${attr(SITE.name)}" href="/feed.xml">
</head>

<body data-page="post">
<a class="skip-link" href="#main">İçeriğe geç</a>
<header id="site-header"></header>

<main id="main">
  <div class="wrap wrap-narrow">
    <div class="article-head">
      <a class="back-link" href="/blog.html">←&nbsp;<span data-i18n="blog.back"></span></a>
      <h1 id="postTitle" style="margin-top:18px"></h1>
      <div class="article-meta" id="postMeta"></div>
      <p class="tag" id="postNotice" hidden></p>
    </div>

    <article class="prose" id="postBody">
      <div class="loading" data-i18n="common.loading"></div>
    </article>

    <p style="margin-top:56px">
      <a class="back-link" href="/blog.html">←&nbsp;<span data-i18n="blog.back"></span></a>
    </p>
  </div>
</main>

<footer id="site-footer"></footer>

<script src="/assets/js/i18n.js"><\/script>
<script src="/assets/js/site.js"><\/script>
<script src="/assets/js/markdown.js"><\/script>
<script src="/assets/js/pages.js"><\/script>
</body>
</html>
`;
}

function rfc822(dateISO){
  return new Date(dateISO + 'T09:00:00+03:00').toUTCString().replace('GMT', '+0000');
}

function buildFeed(posts){
  const items = posts
    .filter(p => !p.draft)
    .sort((a,b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 25)
    .map(p => {
      const loc = p.tr || p.en || {};
      const url = SITE.url + '/blog/' + p.slug + '.html';
      return `    <item>
      <title>${attr(loc.title || p.slug)}</title>
      <link>${attr(url)}</link>
      <guid isPermaLink="true">${attr(url)}</guid>
      <pubDate>${rfc822(p.date)}</pubDate>
      <description>${attr(loc.summary || '')}</description>
    </item>`;
    }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Bu dosyayi admin paneli uretir; elle duzenleme. -->
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${attr(SITE.name)}</title>
    <link>${SITE.url}/</link>
    <description>Teknoloji, finans ve öğrendiklerim üzerine yazılar.</description>
    <language>tr</language>
    <atom:link href="${SITE.url}/feed.xml" rel="self" type="application/rss+xml"/>

${items}

  </channel>
</rss>
`;
}

function buildSitemap(posts){
  const statics = [
    ['/', '1.0'], ['/projects.html', '0.8'], ['/blog.html', '0.8'],
    ['/about.html', '0.6'], ['/contact.html', '0.5']
  ].map(([p, pr]) => `  <url><loc>${SITE.url}${p}</loc><priority>${pr}</priority></url>`).join('\n');

  const items = posts
    .filter(p => !p.draft)
    .sort((a,b) => String(b.date).localeCompare(String(a.date)))
    .map(p => `  <url><loc>${SITE.url}/blog/${p.slug}.html</loc><lastmod>${attr(p.date)}</lastmod><priority>0.7</priority></url>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Bu dosyayi admin paneli uretir; elle duzenleme. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${statics}
${items}
</urlset>
`;
}

/* ==========================================================================
   Giris
   ========================================================================== */

async function tryLogin(token, owner, repo){
  GH.token = token.trim(); GH.owner = owner.trim(); GH.repo = repo.trim();
  const fullName = await GH.verify();
  localStorage.setItem(KEY.token, GH.token);
  localStorage.setItem(KEY.owner, GH.owner);
  localStorage.setItem(KEY.repo, GH.repo);
  return fullName;
}

function logout(){
  localStorage.removeItem(KEY.token);
  GH.token = '';
  location.reload();
}

/* ==========================================================================
   Otomatik kaydetme (sadece tarayicida; repoya gitmez)
   ========================================================================== */

const draftKey = k => 'admin.draft.' + (k || '__yeni__');
let autosaveTimer = null;

function scheduleAutosave(){
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    if (!editing) return;
    grabEditor();
    try {
      localStorage.setItem(draftKey(editing.original), JSON.stringify({ at: Date.now(), data: editing }));
      const t = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      $('#autosaveNote').textContent = 'taslak kaydedildi · ' + t;
    } catch (e){
      $('#autosaveNote').textContent = 'taslak kaydedilemedi';
    }
  }, 900);
}

function clearDraft(key){
  try { localStorage.removeItem(draftKey(key)); } catch (e) {}
}

function readDraft(key){
  try {
    const raw = localStorage.getItem(draftKey(key));
    return raw ? JSON.parse(raw) : null;
  } catch (e){ return null; }
}

/* ==========================================================================
   Yazilar
   ========================================================================== */

async function loadPosts(){
  const txt = await GH.readFile('content/posts.json');
  postsDoc = txt ? JSON.parse(txt) : { posts: [] };
  if (!Array.isArray(postsDoc.posts)) postsDoc.posts = [];
}

function renderPostList(){
  const box = $('#postList');
  const list = [...postsDoc.posts].sort((a,b) => String(b.date).localeCompare(String(a.date)));

  if (!list.length){
    box.innerHTML = '<div class="empty">Henüz yazı yok. “Yeni yazı” ile başla.</div>';
    return;
  }

  box.innerHTML = '<ul class="adm-list">' + list.map(p => {
    const loc = p.tr || p.en || {};
    const langs = [p.tr && p.tr.file ? 'TR' : '', p.en && p.en.file ? 'EN' : ''].filter(Boolean).join(' · ');
    return '<li class="adm-item">' +
      '<div class="grow">' +
        '<div class="t">' + attr(loc.title || p.slug) +
          (p.draft ? ' <span class="tag">taslak</span>' : '') + '</div>' +
        '<div class="d">' + attr(p.date) + ' · ' + attr(p.slug) + ' · ' + langs + '</div>' +
      '</div>' +
      '<div class="acts">' +
        '<button class="btn btn-ghost btn-sm" data-edit="' + attr(p.slug) + '">Düzenle</button>' +
        '<button class="btn btn-ghost btn-sm danger" data-del="' + attr(p.slug) + '">Sil</button>' +
      '</div>' +
    '</li>';
  }).join('') + '</ul>';

  box.querySelectorAll('[data-edit]').forEach(b =>
    b.addEventListener('click', () => openEditor(b.dataset.edit)));
  box.querySelectorAll('[data-del]').forEach(b =>
    b.addEventListener('click', () => deletePost(b.dataset.del)));
}

async function openEditor(slug){
  editLang = 'tr';
  savedDraft = null;
  $('#restoreBar').hidden = true;
  $('#autosaveNote').textContent = '';

  if (slug){
    const p = postsDoc.posts.find(x => x.slug === slug);
    if (!p) return toast('Yazı bulunamadı: ' + slug, 'err');
    busy(true);
    try {
      const trBody = p.tr && p.tr.file ? (await GH.readFile(p.tr.file.replace(/^\//, '')) || '') : '';
      const enBody = p.en && p.en.file ? (await GH.readFile(p.en.file.replace(/^\//, '')) || '') : '';
      editing = { original: slug, ...JSON.parse(JSON.stringify(p)), body: { tr: trBody, en: enBody } };
    } catch (err){
      busy(false);
      return toast('Yazı okunamadı: ' + err.message, 'err');
    }
    busy(false);
  } else {
    editing = {
      original: null, slug: '', date: todayISO(), draft: false, cover: '', tags: [],
      tr: { title: '', summary: '' }, en: { title: '', summary: '' },
      body: { tr: '', en: '' }
    };
  }

  // Kurtarilacak bir otomatik kayit var mi?
  const d = readDraft(editing.original);
  if (d && d.data && JSON.stringify(d.data) !== JSON.stringify(editing)){
    savedDraft = d.data;
    $('#restoreText').textContent =
      'Bu yazının kaydedilmemiş bir sürümü var (' +
      new Date(d.at).toLocaleString('tr-TR') + '). Geri yüklemek ister misin?';
    $('#restoreBar').hidden = false;
  }

  fillEditor();
  showView('editor');
  window.scrollTo({ top: 0 });
}

function fillEditor(){
  $('#edTitle').textContent = editing.original ? 'Yazıyı düzenle' : 'Yeni yazı';
  $('#fSlug').value  = editing.slug || '';
  $('#fDate').value  = editing.date || todayISO();
  $('#fTags').value  = (editing.tags || []).join(', ');
  $('#fCover').value = editing.cover || '';
  $('#fDraft').checked = !!editing.draft;
  delete $('#fSlug').dataset.touched;
  if (editing.slug) $('#fSlug').dataset.touched = '1';
  syncLangTabs();
  renderPreview();
}

function syncLangTabs(){
  document.querySelectorAll('.lang-tabs button').forEach(b =>
    b.setAttribute('aria-selected', String(b.dataset.lang === editLang)));
  const loc = editing[editLang] || {};
  $('#fTitle').value   = loc.title || '';
  $('#fSummary').value = loc.summary || '';
  $('#fBody').value    = editing.body[editLang] || '';
  $('#bodyLabel').textContent = editLang === 'tr' ? 'İçerik (Türkçe, markdown)' : 'İçerik (İngilizce, markdown)';
}

function grabEditor(){
  editing.slug  = $('#fSlug').value.trim();
  editing.date  = $('#fDate').value;
  editing.cover = $('#fCover').value.trim();
  editing.draft = $('#fDraft').checked;
  editing.tags  = $('#fTags').value.split(',').map(s => s.trim()).filter(Boolean);
  editing[editLang] = editing[editLang] || {};
  editing[editLang].title   = $('#fTitle').value.trim();
  editing[editLang].summary = $('#fSummary').value.trim();
  editing.body[editLang]    = $('#fBody').value;
}

function renderPreview(){
  $('#preview').innerHTML = '<div class="prose">' + MD.render($('#fBody').value) + '</div>';
}

/* ---------- Markdown arac cubugu ---------- */

function wrapSelection(before, after, placeholder){
  const ta = $('#fBody');
  const s = ta.selectionStart, e = ta.selectionEnd;
  const sel = ta.value.slice(s, e) || placeholder || '';
  ta.value = ta.value.slice(0, s) + before + sel + after + ta.value.slice(e);
  ta.focus();
  ta.selectionStart = s + before.length;
  ta.selectionEnd   = s + before.length + sel.length;
  ta.dispatchEvent(new Event('input'));
}

function prefixLines(prefix, numbered){
  const ta = $('#fBody');
  const s = ta.selectionStart, e = ta.selectionEnd;
  const startOfLine = ta.value.lastIndexOf('\n', s - 1) + 1;
  const block = ta.value.slice(startOfLine, e) || 'Metin';
  const out = block.split('\n')
    .map((l, i) => (numbered ? (i + 1) + '. ' : prefix) + l)
    .join('\n');
  ta.value = ta.value.slice(0, startOfLine) + out + ta.value.slice(e);
  ta.focus();
  ta.selectionStart = startOfLine;
  ta.selectionEnd   = startOfLine + out.length;
  ta.dispatchEvent(new Event('input'));
}

function insertAtCursor(text){
  const ta = $('#fBody');
  const s = ta.selectionStart;
  ta.value = ta.value.slice(0, s) + text + ta.value.slice(ta.selectionEnd);
  ta.focus();
  ta.selectionStart = ta.selectionEnd = s + text.length;
  ta.dispatchEvent(new Event('input'));
}

const MD_ACTIONS = {
  bold:   () => wrapSelection('**', '**', 'kalın metin'),
  italic: () => wrapSelection('*', '*', 'italik metin'),
  h2:     () => prefixLines('## '),
  h3:     () => prefixLines('### '),
  ul:     () => prefixLines('- '),
  ol:     () => prefixLines('', true),
  quote:  () => prefixLines('> '),
  code:   () => wrapSelection('`', '`', 'kod'),
  pre:    () => wrapSelection('```\n', '\n```', 'kodun buraya'),
  link:   () => {
    const url = prompt('Bağlantı adresi:', 'https://');
    if (url) wrapSelection('[', '](' + url + ')', 'bağlantı metni');
  },
  table:  () => insertAtCursor(
    '\n| Başlık | Başlık |\n| --- | --- |\n| hücre | hücre |\n| hücre | hücre |\n\n')
};

/* ---------- Yayinlama ---------- */

async function savePost(){
  grabEditor();

  if (!editing.slug) return toast('Kısa ad (slug) boş olamaz.', 'err');
  if (!/^[a-z0-9-]+$/.test(editing.slug))
    return toast('Kısa ad yalnızca küçük harf, rakam ve tire içerebilir.', 'err');
  if (!editing.date) return toast('Tarih boş olamaz.', 'err');
  if (!editing.tr.title && !editing.en.title)
    return toast('En az bir dilde başlık gerekli.', 'err');
  if (!editing.body.tr.trim() && !editing.body.en.trim())
    return toast('En az bir dilde içerik gerekli.', 'err');

  const clash = postsDoc.posts.find(p => p.slug === editing.slug && p.slug !== editing.original);
  if (clash) return toast('Bu kısa ad zaten kullanılıyor: ' + editing.slug, 'err');

  busy(true);
  try {
    const slug = editing.slug;
    const changes = [];

    const entry = {
      slug,
      date: editing.date,
      draft: !!editing.draft,
      cover: editing.cover || '',
      tags: editing.tags || []
    };

    ['tr', 'en'].forEach(l => {
      const body = (editing.body[l] || '').trim();
      const loc  = editing[l] || {};
      if (body || loc.title){
        entry[l] = { title: loc.title || '', summary: loc.summary || '', file: '/content/posts/' + slug + '.' + l + '.md' };
        changes.push({ path: 'content/posts/' + slug + '.' + l + '.md', content: body + '\n' });
      }
    });

    if (!entry.tr && !entry.en) throw new Error('Kaydedilecek dil içeriği yok.');

    const idx = postsDoc.posts.findIndex(p => p.slug === editing.original);

    // Bir dilin icerigi tamamen silindiyse o dilin dosyasi da repodan kalksin
    // (yoksa posts.json'un referans vermedigi oksuz bir .md dosyasi kalir)
    if (idx >= 0){
      const before = postsDoc.posts[idx];
      ['tr', 'en'].forEach(l => {
        if (before[l] && before[l].file && !entry[l]){
          changes.push({ path: before[l].file.replace(/^\//, ''), remove: true });
        }
      });
    }

    if (idx >= 0) postsDoc.posts[idx] = entry; else postsDoc.posts.push(entry);

    // Slug degistiyse eski dosyalari temizle
    if (editing.original && editing.original !== slug){
      changes.push({ path: 'content/posts/' + editing.original + '.tr.md', remove: true });
      changes.push({ path: 'content/posts/' + editing.original + '.en.md', remove: true });
      changes.push({ path: 'blog/' + editing.original + '.html', remove: true });
    }

    changes.push({ path: 'content/posts.json', content: JSON.stringify(postsDoc, null, 2) + '\n' });
    changes.push({ path: 'blog/' + slug + '.html',  content: buildPostPage(entry) });
    changes.push({ path: 'feed.xml',                content: buildFeed(postsDoc.posts) });
    changes.push({ path: 'sitemap.xml',             content: buildSitemap(postsDoc.posts) });

    await GH.commitFiles((editing.original ? 'Yazı güncellendi: ' : 'Yeni yazı: ') + slug, changes);

    clearDraft(editing.original);
    toast('Yayınlandı. GitHub Pages 1 dakika içinde siteyi güncelleyecek.', 'ok', 7000);
    renderPostList();
    showView('list');
  } catch (err){
    toast('Yayınlanamadı: ' + err.message, 'err', 9000);
  } finally {
    busy(false);
  }
}

async function deletePost(slug){
  const p = postsDoc.posts.find(x => x.slug === slug);
  if (!p) return;
  const title = (p.tr && p.tr.title) || (p.en && p.en.title) || slug;
  if (!confirm('"' + title + '" yazısı silinecek.\n\nMarkdown dosyaları ve sayfası repodan kaldırılacak. Emin misin?')) return;

  busy(true);
  try {
    postsDoc.posts = postsDoc.posts.filter(x => x.slug !== slug);
    await GH.commitFiles('Yazı silindi: ' + slug, [
      { path: 'content/posts/' + slug + '.tr.md', remove: true },
      { path: 'content/posts/' + slug + '.en.md', remove: true },
      { path: 'blog/' + slug + '.html',           remove: true },
      { path: 'content/posts.json', content: JSON.stringify(postsDoc, null, 2) + '\n' },
      { path: 'feed.xml',           content: buildFeed(postsDoc.posts) },
      { path: 'sitemap.xml',        content: buildSitemap(postsDoc.posts) }
    ]);
    clearDraft(slug);
    toast('Silindi.', 'ok');
    renderPostList();
  } catch (err){
    toast('Silinemedi: ' + err.message, 'err', 9000);
    await loadPosts();
    renderPostList();
  } finally {
    busy(false);
  }
}

/* ==========================================================================
   Projeler
   ========================================================================== */

async function loadProjects(){
  const txt = await GH.readFile('content/projects.json');
  projectsDoc = txt ? JSON.parse(txt) : { projects: [] };
  if (!Array.isArray(projectsDoc.projects)) projectsDoc.projects = [];
}

const TYPE_LABEL = { game: 'Oyun', web: 'Web', tool: 'Araç', other: 'Diğer' };

function renderProjList(){
  const box = $('#projList');
  const list = [...projectsDoc.projects].sort((a,b) => String(b.date).localeCompare(String(a.date)));

  if (!list.length){
    box.innerHTML = '<div class="empty">Henüz proje yok. “Yeni proje” ile başla.</div>';
    return;
  }

  box.innerHTML = '<ul class="adm-list">' + list.map(p => {
    const loc = p.tr || p.en || {};
    return '<li class="adm-item">' +
      '<div class="grow">' +
        '<div class="t">' + attr(loc.title || p.slug) +
          (p.featured ? ' <span class="tag tag-accent">öne çıkan</span>' : '') + '</div>' +
        '<div class="d">' + attr(p.date || '') + ' · ' + (TYPE_LABEL[p.type] || p.type || '—') +
          ' · ' + attr((p.tags || []).join(', ')) + '</div>' +
      '</div>' +
      '<div class="acts">' +
        '<button class="btn btn-ghost btn-sm" data-pedit="' + attr(p.slug) + '">Düzenle</button>' +
        '<button class="btn btn-ghost btn-sm danger" data-pdel="' + attr(p.slug) + '">Sil</button>' +
      '</div>' +
    '</li>';
  }).join('') + '</ul>';

  box.querySelectorAll('[data-pedit]').forEach(b =>
    b.addEventListener('click', () => openProjEditor(b.dataset.pedit)));
  box.querySelectorAll('[data-pdel]').forEach(b =>
    b.addEventListener('click', () => deleteProject(b.dataset.pdel)));
}

function linkRow(l = {}){
  return '<div class="repeat-row two" data-link>' +
    '<input type="text" data-k="label" placeholder="GitHub" value="' + attr(l.label) + '">' +
    '<input type="text" data-k="url" placeholder="https://..." value="' + attr(l.url) + '">' +
    '<button type="button" class="del" title="Sil">×</button>' +
  '</div>';
}

function openProjEditor(slug){
  const p = slug ? projectsDoc.projects.find(x => x.slug === slug) : null;
  editProj = p
    ? { original: slug, ...JSON.parse(JSON.stringify(p)) }
    : { original: null, slug: '', type: 'game', featured: false, date: '', cover: '', tags: [],
        tr: { title: '', summary: '' }, en: { title: '', summary: '' }, links: [] };

  $('#prTitle').textContent = editProj.original ? 'Projeyi düzenle' : 'Yeni proje';
  $('#jSlug').value     = editProj.slug || '';
  $('#jType').value     = editProj.type || 'game';
  $('#jDate').value     = editProj.date || '';
  $('#jCover').value    = editProj.cover || '';
  $('#jTags').value     = (editProj.tags || []).join(', ');
  $('#jFeatured').checked = !!editProj.featured;
  $('#jTitleTr').value  = (editProj.tr || {}).title || '';
  $('#jTitleEn').value  = (editProj.en || {}).title || '';
  $('#jSumTr').value    = (editProj.tr || {}).summary || '';
  $('#jSumEn').value    = (editProj.en || {}).summary || '';
  $('#jLinks').innerHTML = (editProj.links || []).map(linkRow).join('');
  bindDeletes($('#jLinks'));

  showView('projeditor');
  window.scrollTo({ top: 0 });
}

async function saveProject(){
  const slug = $('#jSlug').value.trim();
  if (!slug) return toast('Kısa ad boş olamaz.', 'err');
  if (!/^[a-z0-9-]+$/.test(slug))
    return toast('Kısa ad yalnızca küçük harf, rakam ve tire içerebilir.', 'err');
  if (!$('#jTitleTr').value.trim() && !$('#jTitleEn').value.trim())
    return toast('En az bir dilde başlık gerekli.', 'err');

  const clash = projectsDoc.projects.find(p => p.slug === slug && p.slug !== editProj.original);
  if (clash) return toast('Bu kısa ad zaten kullanılıyor: ' + slug, 'err');

  const entry = {
    slug,
    type: $('#jType').value,
    featured: $('#jFeatured').checked,
    date: $('#jDate').value.trim(),
    cover: $('#jCover').value.trim(),
    tags: $('#jTags').value.split(',').map(s => s.trim()).filter(Boolean),
    tr: { title: $('#jTitleTr').value.trim(), summary: $('#jSumTr').value.trim() },
    en: { title: $('#jTitleEn').value.trim(), summary: $('#jSumEn').value.trim() },
    links: [...$('#jLinks').querySelectorAll('[data-link]')].map(r => ({
      label: r.querySelector('[data-k=label]').value.trim(),
      url:   r.querySelector('[data-k=url]').value.trim()
    })).filter(l => l.label && l.url)
  };

  busy(true);
  try {
    const idx = projectsDoc.projects.findIndex(p => p.slug === editProj.original);
    if (idx >= 0) projectsDoc.projects[idx] = entry; else projectsDoc.projects.push(entry);

    await GH.commitFiles((editProj.original ? 'Proje güncellendi: ' : 'Yeni proje: ') + slug, [
      { path: 'content/projects.json', content: JSON.stringify(projectsDoc, null, 2) + '\n' }
    ]);
    toast('Kaydedildi.', 'ok');
    renderProjList();
    showView('projects');
  } catch (err){
    toast('Kaydedilemedi: ' + err.message, 'err', 9000);
  } finally {
    busy(false);
  }
}

async function deleteProject(slug){
  const p = projectsDoc.projects.find(x => x.slug === slug);
  if (!p) return;
  const title = (p.tr && p.tr.title) || slug;
  if (!confirm('"' + title + '" projesi listeden kaldırılacak. Emin misin?\n\n(Kapak görseli repoda kalır.)')) return;

  busy(true);
  try {
    projectsDoc.projects = projectsDoc.projects.filter(x => x.slug !== slug);
    await GH.commitFiles('Proje silindi: ' + slug, [
      { path: 'content/projects.json', content: JSON.stringify(projectsDoc, null, 2) + '\n' }
    ]);
    toast('Silindi.', 'ok');
    renderProjList();
  } catch (err){
    toast('Silinemedi: ' + err.message, 'err', 9000);
    await loadProjects();
    renderProjList();
  } finally {
    busy(false);
  }
}

/* ==========================================================================
   Profil
   ========================================================================== */

async function loadProfile(){
  const txt = await GH.readFile('content/profile.json');
  profileDoc = txt ? JSON.parse(txt) : {};
}

function socialRow(s = {}){
  return '<div class="repeat-row" data-social>' +
    '<input type="text" data-k="label" placeholder="Ad (GitHub)" value="' + attr(s.label) + '">' +
    '<select data-k="icon">' +
      ['github','linkedin','x','instagram','youtube','itch','discord','mail','globe']
        .map(i => '<option value="' + i + '"' + (s.icon === i ? ' selected' : '') + '>' + i + '</option>').join('') +
    '</select>' +
    '<input type="text" data-k="url" placeholder="https://..." value="' + attr(s.url) + '">' +
    '<button type="button" class="del" title="Sil">×</button>' +
  '</div>';
}

function skillRow(g = {}){
  const grp = g.group || {};
  return '<div class="repeat-row" data-skill>' +
    '<input type="text" data-k="tr" placeholder="Başlık (TR)" value="' + attr(grp.tr) + '">' +
    '<input type="text" data-k="en" placeholder="Title (EN)" value="' + attr(grp.en) + '">' +
    '<input type="text" data-k="items" placeholder="Unity, C#, Godot" value="' + attr((g.items || []).join(', ')) + '">' +
    '<button type="button" class="del" title="Sil">×</button>' +
  '</div>';
}

function bindDeletes(scope){
  scope.querySelectorAll('.del').forEach(b => {
    b.onclick = () => b.closest('.repeat-row').remove();
  });
}

function renderProfile(){
  const p = profileDoc || {};
  $('#pName').value   = p.name || '';
  $('#pAvatar').value = p.avatar || '';
  $('#pEmail').value  = p.email || '';
  $('#pRoleTr').value = (p.role || {}).tr || '';
  $('#pRoleEn').value = (p.role || {}).en || '';
  $('#pTagTr').value  = (p.tagline || {}).tr || '';
  $('#pTagEn').value  = (p.tagline || {}).en || '';
  $('#pBioTr').value  = (p.bio || {}).tr || '';
  $('#pBioEn').value  = (p.bio || {}).en || '';

  $('#pSocial').innerHTML = (p.social || []).map(socialRow).join('');
  $('#pSkills').innerHTML = (p.skills || []).map(skillRow).join('');
  bindDeletes($('#pSocial'));
  bindDeletes($('#pSkills'));
}

async function saveProfile(){
  const doc = { ...(profileDoc || {}) };
  doc.name    = $('#pName').value.trim();
  doc.avatar  = $('#pAvatar').value.trim();
  doc.email   = $('#pEmail').value.trim();
  doc.role    = { tr: $('#pRoleTr').value.trim(), en: $('#pRoleEn').value.trim() };
  doc.tagline = { tr: $('#pTagTr').value.trim(),  en: $('#pTagEn').value.trim() };
  doc.bio     = { tr: $('#pBioTr').value,          en: $('#pBioEn').value };

  doc.social = [...$('#pSocial').querySelectorAll('[data-social]')].map(r => ({
    label: r.querySelector('[data-k=label]').value.trim(),
    icon:  r.querySelector('[data-k=icon]').value,
    url:   r.querySelector('[data-k=url]').value.trim()
  })).filter(s => s.label && s.url);

  doc.skills = [...$('#pSkills').querySelectorAll('[data-skill]')].map(r => ({
    group: {
      tr: r.querySelector('[data-k=tr]').value.trim(),
      en: r.querySelector('[data-k=en]').value.trim()
    },
    items: r.querySelector('[data-k=items]').value.split(',').map(s => s.trim()).filter(Boolean)
  })).filter(g => g.group.tr || g.group.en);

  busy(true);
  try {
    await GH.commitFiles('Profil güncellendi', [
      { path: 'content/profile.json', content: JSON.stringify(doc, null, 2) + '\n' }
    ]);
    profileDoc = doc;
    toast('Profil kaydedildi.', 'ok');
  } catch (err){
    toast('Kaydedilemedi: ' + err.message, 'err', 9000);
  } finally {
    busy(false);
  }
}

/* ==========================================================================
   Baslatma
   ========================================================================== */

async function enterApp(fullName){
  $('#login').hidden = true;
  $('#app').hidden = false;
  $('#repoBadge').textContent = fullName + ' · ' + GH.branch;

  busy(true);
  try {
    await Promise.all([loadPosts(), loadProjects(), loadProfile()]);
    renderPostList();
    renderProjList();
    renderProfile();
  } catch (err){
    toast('Veri yüklenemedi: ' + err.message, 'err', 9000);
  } finally {
    busy(false);
  }
}

document.addEventListener('DOMContentLoaded', async () => {

  /* --- Giris --- */
  const savedOwner = localStorage.getItem(KEY.owner) || '';
  const savedRepo  = localStorage.getItem(KEY.repo)  || '';
  $('#lOwner').value = savedOwner;
  $('#lRepo').value  = savedRepo || (savedOwner ? savedOwner + '.github.io' : '');

  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('#loginBtn');
    btn.disabled = true; btn.textContent = 'Bağlanıyor...';
    try {
      await enterApp(await tryLogin($('#lToken').value, $('#lOwner').value, $('#lRepo').value));
    } catch (err){
      toast('Bağlanılamadı: ' + err.message, 'err', 9000);
    } finally {
      btn.disabled = false; btn.textContent = 'Bağlan';
    }
  });

  const token = localStorage.getItem(KEY.token);
  if (token && savedOwner && savedRepo){
    GH.token = token; GH.owner = savedOwner; GH.repo = savedRepo;
    try { await enterApp(await GH.verify()); }
    catch (err){ toast('Kayıtlı token çalışmadı: ' + err.message, 'err', 8000); }
  }

  /* --- Ust cubuk --- */
  $('#logoutBtn').addEventListener('click', () => {
    if (confirm('Çıkış yapılacak ve token bu tarayıcıdan silinecek. Emin misin?')) logout();
  });
  $('#admTheme').addEventListener('click', () => Theme.toggle());

  /* --- Sekmeler --- */
  document.querySelectorAll('.adm-tab').forEach(b => {
    b.addEventListener('click', () => { selectTab(b.dataset.view); showView(b.dataset.view); });
  });

  /* --- Yazi islemleri --- */
  $('#newPostBtn').addEventListener('click', () => openEditor(null));
  $('#cancelBtn').addEventListener('click', () => showView('list'));
  $('#saveBtn').addEventListener('click', savePost);
  $('#refreshBtn').addEventListener('click', async () => {
    busy(true);
    try { await loadPosts(); renderPostList(); toast('Liste tazelendi.', 'ok'); }
    catch (err){ toast('Tazelenemedi: ' + err.message, 'err'); }
    finally { busy(false); }
  });

  /* --- Editör --- */
  document.querySelectorAll('.lang-tabs button').forEach(b => {
    b.addEventListener('click', () => {
      grabEditor(); editLang = b.dataset.lang; syncLangTabs(); renderPreview();
    });
  });

  $('#fBody').addEventListener('input', () => { renderPreview(); scheduleAutosave(); });
  ['#fTitle', '#fSummary', '#fSlug', '#fDate', '#fTags', '#fCover', '#fDraft']
    .forEach(sel => $(sel).addEventListener('input', scheduleAutosave));

  $('#fTitle').addEventListener('input', () => {
    if (!editing || editing.original || $('#fSlug').dataset.touched) return;
    if (editLang !== 'tr' && $('#fSlug').value) return;
    $('#fSlug').value = MD.slugify($('#fTitle').value).slice(0, 60);
  });
  $('#fSlug').addEventListener('input', () => { $('#fSlug').dataset.touched = '1'; });

  // Klavye kisayollari
  $('#fBody').addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === 'b'){ e.preventDefault(); MD_ACTIONS.bold(); }
    if (k === 'i'){ e.preventDefault(); MD_ACTIONS.italic(); }
    if (k === 'k'){ e.preventDefault(); MD_ACTIONS.link(); }
  });

  // Arac cubugu
  $('#mdToolbar').addEventListener('click', e => {
    const btn = e.target.closest('[data-md]');
    if (btn && MD_ACTIONS[btn.dataset.md]) MD_ACTIONS[btn.dataset.md]();
  });

  // Gorsel: yaziya ekle
  $('#imgBtn').addEventListener('click', async () => {
    const path = await pickImage(DIR.postImg);
    if (path) insertAtCursor('\n![görsel açıklaması](' + path + ')\n');
  });

  // Gorsel: kapak
  $('#coverUploadBtn').addEventListener('click', async () => {
    const path = await pickImage(DIR.postImg);
    if (path){ $('#fCover').value = path; scheduleAutosave(); }
  });

  // Taslak geri yukleme
  $('#restoreYes').addEventListener('click', () => {
    if (!savedDraft) return;
    editing = savedDraft;
    savedDraft = null;
    $('#restoreBar').hidden = true;
    fillEditor();
    toast('Kaydedilmemiş sürüm geri yüklendi.', 'ok');
  });
  $('#restoreNo').addEventListener('click', () => {
    clearDraft(editing && editing.original);
    savedDraft = null;
    $('#restoreBar').hidden = true;
  });

  /* --- Proje islemleri --- */
  $('#newProjBtn').addEventListener('click', () => openProjEditor(null));
  $('#cancelProjBtn').addEventListener('click', () => showView('projects'));
  $('#saveProjBtn').addEventListener('click', saveProject);
  $('#addLink').addEventListener('click', () => {
    $('#jLinks').insertAdjacentHTML('beforeend', linkRow());
    bindDeletes($('#jLinks'));
  });
  $('#jCoverUploadBtn').addEventListener('click', async () => {
    const path = await pickImage(DIR.projImg);
    if (path) $('#jCover').value = path;
  });

  /* --- Profil islemleri --- */
  $('#addSocial').addEventListener('click', () => {
    $('#pSocial').insertAdjacentHTML('beforeend', socialRow());
    bindDeletes($('#pSocial'));
  });
  $('#addSkill').addEventListener('click', () => {
    $('#pSkills').insertAdjacentHTML('beforeend', skillRow());
    bindDeletes($('#pSkills'));
  });
  $('#avatarUploadBtn').addEventListener('click', async () => {
    const path = await pickImage(DIR.avatar);
    if (path) $('#pAvatar').value = path;
  });
  $('#saveProfileBtn').addEventListener('click', saveProfile);
});

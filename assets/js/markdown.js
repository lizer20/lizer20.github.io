/* ==========================================================================
   Kucuk Markdown motoru — disaridan hicbir kutuphane yuklemez.
   Desteklenenler:
     # Baslik (1-6)      **kalin**  *italik*  ~~ustu cizili*
     - liste / 1. liste  > alinti   ---  (yatay cizgi)
     `kod`               ```dil ... ``` (kod blogu)
     [link](url)         ![gorsel](url)     | tablo | tablo |
   Guvenlik: girdi once HTML olarak kacislanir, yani markdown icine
   yazilan ham HTML calismaz (kasitli). Kendi yazilarin icin fazlasiyla yeterli.
   ========================================================================== */

const MD = (function(){

  function esc(s){
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function isExternal(url){
    return /^https?:\/\//i.test(url) && !url.includes(location.host);
  }

  /** Satir ici bicimlendirme */
  function inline(text){
    let s = esc(text);

    // Kod parcalari once korunur (icindeki * _ [ ] bicimlenmesin)
    const codes = [];
    s = s.replace(/`([^`]+)`/g, (m, c) => {
      codes.push(c);
      return '\u0001C' + (codes.length - 1) + '\u0001';
    });

    // Gorsel
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g,
      (m, alt, src, title) =>
        '<img src="' + src + '" alt="' + alt + '"' + (title ? ' title="' + title + '"' : '') + ' loading="lazy">');

    // Link
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g,
      (m, label, href, title) => {
        const ext = isExternal(href) ? ' target="_blank" rel="noopener noreferrer"' : '';
        return '<a href="' + href + '"' + (title ? ' title="' + title + '"' : '') + ext + '>' + label + '</a>';
      });

    // Cizgi/kalin/italik
    s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    s = s.replace(/(^|[^_\w])_([^_\n]+)_/g, '$1<em>$2</em>');

    // Kod parcalarini geri koy
    s = s.replace(/\u0001C(\d+)\u0001/g, (m, i) => '<code>' + esc(codes[+i]) + '</code>');

    return s;
  }

  function slugify(text){
    return text.toLowerCase()
      .replace(/[ıİ]/g, 'i').replace(/[şŞ]/g, 's').replace(/[ğĞ]/g, 'g')
      .replace(/[üÜ]/g, 'u').replace(/[öÖ]/g, 'o').replace(/[çÇ]/g, 'c')
      .replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
  }

  function renderList(items, ordered){
    const tag = ordered ? 'ol' : 'ul';
    return '<' + tag + '>' + items.map(i => '<li>' + inline(i) + '</li>').join('') + '</' + tag + '>';
  }

  function render(src){
    if (!src) return '';
    src = String(src).replace(/\r\n?/g, '\n');

    // Kod bloklarini once ayikla
    const fences = [];
    src = src.replace(/^```([\w+-]*)[ \t]*\n([\s\S]*?)\n?^```[ \t]*$/gm, (m, lang, code) => {
      fences.push({ lang: lang || '', code: code });
      return '\u0002F' + (fences.length - 1) + '\u0002';
    });

    const lines = src.split('\n');
    const out = [];
    let i = 0;

    while (i < lines.length){
      const line = lines[i];
      const trimmed = line.trim();

      // bos satir
      if (!trimmed){ i++; continue; }

      // kod blogu yer tutucusu
      const fence = trimmed.match(/^\u0002F(\d+)\u0002$/);
      if (fence){
        const f = fences[+fence[1]];
        out.push('<pre><code' + (f.lang ? ' class="language-' + esc(f.lang) + '"' : '') + '>' + esc(f.code) + '</code></pre>');
        i++; continue;
      }

      // yatay cizgi
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)){ out.push('<hr>'); i++; continue; }

      // baslik
      const h = trimmed.match(/^(#{1,6})\s+(.*)$/);
      if (h){
        const level = h[1].length;
        const body = h[2].replace(/\s+#+\s*$/, '');
        out.push('<h' + level + ' id="' + slugify(body) + '">' + inline(body) + '</h' + level + '>');
        i++; continue;
      }

      // alinti
      if (/^>\s?/.test(trimmed)){
        const buf = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])){
          buf.push(lines[i].replace(/^\s*>\s?/, ''));
          i++;
        }
        out.push('<blockquote>' + render(buf.join('\n')) + '</blockquote>');
        continue;
      }

      // tablo
      if (/^\|.*\|$/.test(trimmed) && i + 1 < lines.length && /^\|[\s:|-]+\|$/.test(lines[i + 1].trim())){
        const cells = row => row.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
        const head = cells(lines[i]);
        i += 2;
        const body = [];
        while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())){ body.push(cells(lines[i])); i++; }
        out.push(
          '<table><thead><tr>' + head.map(c => '<th>' + inline(c) + '</th>').join('') + '</tr></thead><tbody>' +
          body.map(r => '<tr>' + r.map(c => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('') +
          '</tbody></table>'
        );
        continue;
      }

      // listeler
      const bullet  = /^[-*+]\s+(.*)$/;
      const numbered = /^\d+[.)]\s+(.*)$/;
      if (bullet.test(trimmed) || numbered.test(trimmed)){
        const ordered = numbered.test(trimmed);
        const rx = ordered ? numbered : bullet;
        const items = [];
        while (i < lines.length){
          const t = lines[i].trim();
          const m = t.match(rx);
          if (m){ items.push(m[1]); i++; }
          else if (t && !bullet.test(t) && !numbered.test(t) && items.length){
            items[items.length - 1] += ' ' + t; i++;   // devam satiri
          } else break;
        }
        out.push(renderList(items, ordered));
        continue;
      }

      // paragraf
      const para = [];
      while (i < lines.length){
        const t = lines[i].trim();
        if (!t || /^(#{1,6})\s/.test(t) || /^>\s?/.test(t) ||
            bullet.test(t) || numbered.test(t) ||
            /^(-{3,}|\*{3,}|_{3,})$/.test(t) || /^\u0002F\d+\u0002$/.test(t)) break;
        para.push(t); i++;
      }
      if (para.length) out.push('<p>' + inline(para.join('\n')).replace(/\n/g, '<br>') + '</p>');
    }

    return out.join('\n');
  }

  /** Yaklasik okuma suresi (dakika) */
  function readingTime(src){
    const words = String(src || '').trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
  }

  return { render, readingTime, escape: esc, slugify };
})();

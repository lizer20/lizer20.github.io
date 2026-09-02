# emrebiltekin.me

Kişisel site + portfolyo + blog. Build adımı yok, bağımlılık yok — saf HTML/CSS/JS.
GitHub Pages üzerinde barınır.

---

## Lokalde çalıştırma

Node gerekmiyor. Proje klasöründe:

```bash
python -m http.server 8080
```

Sonra tarayıcıda `http://localhost:8080` adresini aç.

> Dosyayı çift tıklayıp `file://` ile açma — sayfalar kök yolları (`/assets/...`)
> kullandığı için sadece bir sunucu üzerinden doğru çalışır.

---

## Klasör yapısı

```
/
├── index.html          Ana sayfa (hero + öne çıkan projeler + son yazılar)
├── projects.html       Proje vitrini (filtre + arama)
├── blog.html           Yazı listesi (etiket filtresi + arama)
├── about.html          Hakkımda
├── contact.html        İletişim
├── 404.html            Bulunamadı sayfası
│
├── blog/
│   └── <slug>.html     Her yazının kendi sayfası (SEO/paylaşım etiketleri burada)
│
├── content/            ── TÜM İÇERİK BURADA ──
│   ├── profile.json    Ad, biyografi, yetenekler, sosyal linkler (TR + EN)
│   ├── projects.json   Proje kartları
│   ├── posts.json      Yazı dizini
│   └── posts/
│       ├── <slug>.tr.md
│       └── <slug>.en.md
│
├── assets/
│   ├── css/style.css   Tüm tema — renkler dosyanın en üstünde :root içinde
│   ├── js/
│   │   ├── i18n.js     TR/EN arayüz metinleri
│   │   ├── site.js     Header, footer, ikonlar, yardımcılar
│   │   ├── markdown.js Markdown → HTML (harici kütüphane yok)
│   │   └── pages.js    Sayfa mantığı
│   └── img/
│
├── CNAME               Özel alan adı
├── feed.xml            RSS
├── sitemap.xml
└── robots.txt
```

---

## Sık yapılan işler

### Vurgu rengini değiştirme
`assets/css/style.css` → `:root` → `--accent` satırı. Tek yer, tüm site.

### Yeni proje ekleme
`content/projects.json` içindeki `projects` dizisine yeni bir blok ekle.
Dosyanın başındaki `_alanlar` bölümü hangi alanın ne işe yaradığını anlatıyor.

### Yeni yazı ekleme — admin paneli
`emrebiltekin.me/admin.html` (lokalde `localhost:8080/admin.html`).
Detaylar için aşağıdaki **Yönetim paneli** bölümüne bak.

### Yeni yazı ekleme (elle, panel olmadan)
1. `content/posts/<slug>.tr.md` ve `<slug>.en.md` dosyalarını oluştur
2. `content/posts.json` dizinine kaydı ekle
3. `blog/<slug>.html` sayfasını mevcut bir yazıdan kopyalayıp baştaki 6 satırı güncelle
4. `feed.xml` ve `sitemap.xml` dosyalarına birer satır ekle

### Ziyaretçi sayacı
`assets/js/site.js` → `SITE.goatcounter` alanına GoatCounter kodunu yaz.
Boş bırakılırsa hiçbir script yüklenmez. `localhost`'ta zaten sayılmaz.

### Menüye yeni sayfa ekleme
`assets/js/site.js` → `NAV` dizisi.

### Arayüz metnini değiştirme
`assets/js/i18n.js` → hem `tr` hem `en` nesnesindeki ilgili anahtar.

---

## GitHub Pages'e yayınlama

Bir kereye mahsus kurulum:

```bash
git init
git add .
git commit -m "İlk sürüm"
git branch -M main
git remote add origin https://github.com/<KULLANICI-ADIN>/<KULLANICI-ADIN>.github.io.git
git push -u origin main
```

Sonra GitHub'da: **Settings → Pages → Source: Deploy from a branch → main / (root)**.

Alan adı için **Settings → Pages → Custom domain** alanına `emrebiltekin.me` yaz
(repodaki `CNAME` dosyası zaten hazır) ve alan adı sağlayıcında şu DNS kayıtlarını gir:

| Tip | Ad | Değer |
| --- | --- | --- |
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | `<KULLANICI-ADIN>.github.io` |

DNS yayılınca **Enforce HTTPS** kutusunu işaretle.

---

## Yönetim paneli (`/admin.html`)

Statik bir sitede sunucu yok; panel bu yüzden **doğrudan GitHub API'sine commit atar**.

### Token oluşturma (bir kez)

GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token

| Ayar | Değer |
| --- | --- |
| Repository access | **Only select repositories** → sadece bu repo |
| Repository permissions → **Contents** | **Read and write** |
| Diğer tüm izinler | Dokunma (No access) |
| Expiration | Bir son kullanma tarihi seç |

Token'ı panelin giriş ekranına yapıştır. Token **yalnızca** tarayıcının `localStorage`'ında
tutulur; repoya yazılmaz, GitHub dışında hiçbir sunucuya gönderilmez.

### Bir yazı yayınlandığında ne oluyor?

Tek "Yayınla" tıklaması, tek bir commit'te şunları günceller:

```
content/posts/<slug>.tr.md      yazının Türkçesi
content/posts/<slug>.en.md      yazının İngilizcesi
content/posts.json              dizin kaydı
blog/<slug>.html                yazının sayfası (SEO + paylaşım etiketleriyle)
feed.xml                        RSS
sitemap.xml                     site haritası
```

Hepsi tek commit olduğu için site hiçbir an yarım kalmış bir durumda kalmaz.
GitHub Pages ~1 dakika içinde yeniden yayınlar.

### Güvenlik notları

- Token'ı olan biri bu repoya yazabilir. Ortak bilgisayarda **Çıkış**'a bas.
- Token'ın süresi dolduğunda panel "Bağlanılamadı" der; yeni token üretip yeniden gir.
- Panel arama motorlarına kapalı (`robots.txt` + `noindex`), ama adres gizli değil —
  asıl koruma token'ın kendisi.

### Panelin diğer yetenekleri

| Özellik | Nasıl çalışır |
| --- | --- |
| **Görsel yükleme** | Dosya seç → tarayıcıda 1600px genişliğe küçültülüp WebP'e çevrilir → repoya commit edilir → markdown'a yolu eklenir. GIF ve SVG dokunulmadan yüklenir. |
| **Projeler sekmesi** | `content/projects.json` panelden yönetilir; kart ekle, düzenle, sil, "öne çıkan" işaretle. |
| **Markdown araç çubuğu** | Kalın/italik/başlık/liste/alıntı/link/kod/tablo butonları. Kısayollar: `Ctrl+B`, `Ctrl+I`, `Ctrl+K`. |
| **Otomatik kaydetme** | Yazarken ~1 saniyede bir tarayıcıya yedeklenir. Sekme kazara kapanırsa editörü açtığında geri yükleme teklif edilir. Bu yedek **repoya gitmez**, sadece o tarayıcıda durur. |

Görseller şu klasörlere yüklenir: yazı görselleri `assets/img/posts/`,
proje kapakları `assets/img/projects/`, profil fotoğrafı `assets/img/`.

---

## Notlar

- Site içeriği JavaScript ile çiziliyor. Arama motorları JS'i çalıştırdığı için
  sorun değil; yine de her yazının kendi `blog/<slug>.html` sayfası olduğundan
  başlık ve paylaşım kartı etiketleri HTML'de statik olarak duruyor.
- `markdown.js` içine yazılan ham HTML kasıtlı olarak çalışmaz (kaçışlanır).

# Mobil uyum

Telefon görünümü, Tailwind'in `mobile:` varyantıyla ve `client/src/style.css` içindeki tek bir medya bloğuyla açılır:

```css
@media (max-width: 767.98px), (pointer: coarse) and (max-height: 500px) { … }
```

- 768px'ten dar ekranlar (dikey telefon, katlanabilir) ve kısa yatay dokunmatik ekranlar (yatay telefon) telefon görünümünü alır.
- Fareli masaüstü, pencere hangi boyutta olursa olsun eski görünümünde kalır.

## Harita ekranı
- **Durum paneli küçülür:** portre, seviye, para ve can görünür. Karakter ekranın ortasında açıkta kalır.
- **Düğmeler** (Görevler, Yetenekler, Asalar, Çanta, Oyun seviyesi) sağ kenarda 48px'lik yuvarlak simgeler olur (`.hud-rail`).
  - Yetenek puanı ya da dolu çanta, düğmenin köşesinde rozetle gösterilir.
  - Kısa ekranda yeni sütunlar sola doğru açılır.
- **⚖ düğmesi**, Kara ↔ Ak ibresini ve takip edilen görevleri açar ve kapatır.
- **Hesap rozeti** yalnızca ← ve ⏻ simgeleri olarak görünür. Mini harita 96px olur.
- **Görev şeridi:** dikeyde yön tuşlarının üstüne, yatayda üst ortaya iner.
- **Yön tuşları** yatay telefonda sol alta (başparmağın altına) geçer.

## Paneller
- Çanta, Asalar, Yetenekler, Görevler, Tüccar, Yerdekiler ve Çıkış panelleri telefonda alttan açılan çekmecedir (`.mb-sheet`). Çekmece tam genişlikte açılır ve kendi içinde kayar.
- Karakter ekranında yatay telefonda model ile çanta yan yana durur.

## Savaş
- Çizim ve yer seçme tuvali `dvh` ile ölçeklenir.
- Yatay telefonda açıklama gizlenir; tuval, başlık ve "Bitir" düğmesi ekran yüksekliğine sığar.
- Çizerken ve yer seçerken ses düğmesi gizlenir; "Bitir" ve "Tamam" düğmelerinin üstüne binmez.

## Genel
- **Dokunma alanı:** Bütün düğmeler en az 44×44px.
- **Yazı boyutu:** Giriş alanları 16px; iOS dokununca sayfayı yakınlaştırmaz.
- **Ekran yüksekliği:** `100dvh` kullanılır; adres çubuğu açılıp kapanınca yükseklik doğru kalır.
- **Kaydırma:** Yatay taşma kapalı; sayfa kaymaz ve yakınlaşmaz (`touch-action: none`). Yalnızca `data-scrollable` alanlar parmakla dikey kayar.
- **Güvenli alan:** Çentikli ekranlar için `viewport-fit=cover` ve `env(safe-area-inset-*)` kullanılır (`--sat/--sar/--sab/--sal`). Kenara yapışık öğeler bu payları kullanır.
- **Dokunmatik olaylar:** Dokunmatik ve fare aynı Pointer Events yolundan gider. Parmak yakalanır (`setPointerCapture`), `pointercancel` işlenir; ayrıca `touchstart`/`touchmove` gerekmez.

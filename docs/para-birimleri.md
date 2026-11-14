# Para birimleri (Task 35)

Altın **kalktı**. Yerine dört birim geldi; her biri bir elementin şehrine bağlıdır:

| Birim | Element | Şehir |
|---|---|---|
| **Kor** 🔥 | Ateş | Ignis |
| **Çiy** 💧 | Su | Still Crystal |
| **Tunç** ⛰️ | Toprak | Stone Heart |
| **Tüy** 🪶 | Hava | Abyss |

Kod: `client/src/economy/currency.ts` (birimler, çevirme, bölge birimi), `economy/player.ts` (cüzdan), `ui/merchantUi.ts` (Çevir sekmesi).

## Nerede hangi birim

- **Şehir tüccarı, asacı ve han** kendi şehrinin biriminde alır ve satır. Ticari mal fiyatları da (şehre göre çarpanlarla) o birimdedir.
- **Görev ödülü:** görevi veren şehrin birimi.
- **Boss ödülü:** bölümün şehrinin birimi; köyse iki birimden biri rastgele.
- **Düşman, maden ve sandık ganimeti:** bulunduğun noktaya en yakın şehrin birimi (`currencyAt`).
- **Köyde** kazanılan para iki birimden biridir (rastgele).
- **Yenilgi cezası:** bulunduğun bölgenin biriminden düşer (seviyeye göre %6-25, bkz. [olum-ve-ekonomi.md](olum-ve-ekonomi.md)).
- **Yetenek sıfırlama:** dört birimden her biri toplam bedelin dörtte birini öder (seviye başına 25 değer → birim başına seviye × 25 / 4, yukarı yuvarlanır); dördünde de yeterli para olmalı.
- Sığmayan görev ödülü eşyaları değerinin yarısı kadar, görevin biriminde paraya çevrilir.

## Çevirme

Tüccarın **Çevir** sekmesinde: çevrilecek birim, tutar ve hedef birim seçilir. Her çevirmede **%25 kayıp** vardır (100 Kor → 75 Çiy, aşağı yuvarlanır). Önizleme tutarı yazdıkça görünür. Gidip gelmek kaybettirir, yani para birimi arbitrajı yoktur.

## Arayüz

- Sol üstteki durum panelinde dört bakiye yan yana görünür.
- Tüccar ekranının üstünde dört bakiye, o şehrin birimi vurgulu görünür.

## Kayıt

Kayıt **sürüm 8**: `gold` yerine `wallet: { kor, ciy, tunc, tuy }` (her biri 0-9.999.999). Eski kayıtlarda (sürüm 1-7) altın **Kor**'a çevrilir (sunucuda ve istemcide). Bkz. [backend.md](backend.md).

## Bilinen sınırlar

- Ticari mal fiyatları hâlâ eski sayılarla; bir şehirde alıp başka bir şehirde satmak farklı birimde gelir, sonra çevirmek %25 kaybettirir. Dengesi Task 46'da.
- Görev ödülleri ve düşman parası sayıları değişmedi (yalnız birimi değişti); ganimet yeniden yazılınca (Task 37) ayarlanır.

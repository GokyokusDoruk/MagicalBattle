# Düşman yetenekleri (Task 45b)

Dünya düşmanları artık kendi elementlerinin yeteneklerini **sana karşı** kullanır: yakar, yavaşlatır, sis ve çamur döker, sersemletir, yara izi ve sarsıntı koyar.
Savaş motoru zaten iki taraf için aynı çalıştığından sadece düşmana yetenek seti verildi (`enemies/skills.ts`).

## Kademeye göre güç

| Kademe | Düşman | Yetenek sayısı | Seviye |
|---|---|---|---|
| 1 | düşük | 2 | Sv 1 |
| 2 | orta | 3 | Sv 2 |
| 3 | orta-yüksek | elementin hepsi | Sv 2 |
| 4 | yüksek ("Kadim") | elementin hepsi | Sv 3 |

Yetenek sırası (ilk gelenler ekran engelleri ve yanma gibi görünür etkilerdir):

- **Ateş (Köz Cini):** Közleyen Alev, Yanık İzi, Kalkan Kıran, Kıvılcım Saçması, Alev Zinciri
- **Su (Dalga Hayaleti):** Sis Perdesi, Buz Nefesi, Yansıyan Dalga, Şifa Kabarcıkları
- **Toprak (Taş Bekçi):** Çamur Yaması, Sarsıntı, Dağ Kalkanı, Taş Kabuk
- **Hava (Fırtına Kurdu):** Sarsıntılı Rüzgâr, Fırtına Nefesi, Geri Esen Rüzgâr, Keskin Esinti

Örnek: kademe 1 ateş düşmanı %15 ihtimalle 6 hasarlık yanma verir ve saldırı ekranında 1 yara izi bırakır; kademe 4 Kadim Köz Cini %40 / 12 hasar yakar, 3 yara izi koyar, kalkanını kırar, zincir kurar.

Notlar:

- Düşman başka elementin büyüsünü seçerse (bot ara sıra seçer) o turda yetenekleri işlemez; yalnızca pasifler (Yanık İzi, Sarsıntılı Rüzgâr) her zaman geçerlidir.
- Savaş öncesi panelde düşmanın yetenekleri ve seviyeleri yazar.
- Bosslar ve ana hikâye bu turda değişmedi (boss gücü statik kalıyor); denge turunda (Task 46) boss yetenekleri ayrıca ele alınır.

# Diyalog, ahlak seçimleri ve Elysia

Kod: `client/src/dialogue/` (diyalog motoru), `client/src/morality/` (seçimler, puan, etkiler, final), `client/src/battle/flow/elysia.ts` (Elysia yapay zekâsı), `client/src/story/elysia.ts` (hikâyedeki seyri), `client/src/ui/dialogueUi.ts` (ekran). Hikâye ve seçim listesi: [hikaye.md](hikaye.md).

## Oyunda nasıl çalışıyor

- Bölümün ana görev sahnesi bitince (atlansa da) o bölümün **2 ahlak seçimi** sırayla çıkar. Altta durumu anlatan satırlar, sonra iki seçenek gelir (iyi / kötü, **tarafsız seçenek yok**). Seçince tepki satırı gösterilir.
- Seçimler **atlanamaz** (Esc ya da dışarı tıklama seçimi geçmez). Satırlar dokunma / Boşluk / Enter ile ilerler; seçenekler tıklanarak ya da **1 / 2** tuşlarıyla seçilir. Satırlar seslendirilir (ses kapalıysa sessiz).
- Seçim yapılınca bildirim çıkar ("Ahlak puanın: +12 (Düzen Bekçisi I)"), sol üstte **☯ durum etiketi** (örn. "Düzen Bekçisi II (+55)") sürekli görünür.
- Her seçim **yalnız bir kez** yapılır; bölüm tekrar oynansa da yeniden sorulmaz.
- **Bölüm 8**'in iki seçiminden sonra **final sahnesi** gelir: puan 0 ve üstüyse Düzen Bekçisi yolu, altındaysa Karanlık Büyücü yolu; sahnenin sert ya da yumuşak olması kademeye göre değişir (8 farklı metin).

## Puan ve kademeler

Puan **-100 ile +100** arası, 0 ile başlar. 16 seçimin her biri iyi yönde **+ağırlık**, kötü yönde **-ağırlık** değiştirir (ağırlıklar 5-15, `morality/catalog.ts`). Hepsi iyi ya da hepsi kötü seçilirse ±100 sınırına ulaşılır.

Puan kayıtta **tutulmaz**, yapılan seçimlerden **hesaplanır**; böylece puan ile seçimler hiç tutarsız olmaz.

| Kademe | Puan | Düzen Bekçisi (+) | Karanlık Büyücü (-) |
|---|---|---|---|
| Yok | -19..+19 | etki yok | etki yok |
| I | ±20..49 | tüccardan alış %5 indirim, görev altını +%10 | satış değeri +%5, düşme oranı +%10 |
| II | ±50..79 | %10 indirim, görev altını +%20 | satış +%10, düşme oranı +%20 |
| III | ±80..100 | %15 indirim, görev altını +%30 | satış +%15, düşme oranı +%30 |

Bağlantılar:
- **Tüccar fiyatları:** `MerchantUi.priceMultipliers` ahlaktan beslenir (alış ve satış).
- **Görev altını:** `QuestEngine.goldMultiplier` ahlaktan beslenir; yalnızca altını etkiler, XP'yi etkilemez.
- **Ganimet düşme oranı** (`dropRateMultiplier`) hazır; düşmanlardan ganimet gelince (Task 19) kullanılacak.
- Efekt renkleri (altın/mavi, mor/siyah) görsel katman olarak sonraki işlerde.

## Diyalog motoru

`dialogue/engine.ts`, arayüzden bağımsız:

- **Düğümler:** `line` (konuşan, metin, sonraki) ve `choice` (seçenekler).
- **Seçenek:** `next` (yoksa diyalog biter), `effect` (`moral`: ahlak seçimi uygular, `flag`: bayrak koyar) ve `requires` (koşul).
- **Koşul:** ahlak puanı aralığı (`minScore`, `maxScore`) ve bayraklar (`flag`, `notFlag`). Koşulu sağlanmayan seçenek listelenmez ve seçilemez.
- `validateTree` olmayan başlangıcı, kırık bağlantıları, seçeneksiz seçimi ve tekrarlı seçenek kimliklerini yakalar; geçersiz ağaçla motor kurulamaz. Sonsuz döngü 500 adımda kesilir.
- 16 seçim, `dialogue/moralDialogues.ts` ile bu ağaçlara çevrilir (durum satırları → iki seçenek → tepki). Yeni diyalog eklemek için bir ağaç yazıp `DialogueUi.run(tree, ctx)` çağırmak yeterli.

## Elysia

**Hikâyedeki seyri** (`story/elysia.ts`, [hikaye.md](hikaye.md) bölüm 6): 1. bölümde tanışma, 2'de yok, 3'te katılır (ilk 2v2), 4'te yakalanır, 5-6'da yok, 7'de kurtarılır, 8'de Düzen Bekçisi yolunda 2v2, Karanlık yolda ihanete uğrar. `elysiaFightsAlongside(bölüm, yol)` boss savaşının 2v2 olup olmadığını söyler (Task 19 kullanacak).

**Savaştaki yapay zekâsı** (`battle/flow/elysia.ts`): neşeli ama çabuk sinirlenen.
- Sakinken çoğunlukla **Hava** seçer (~%55) ve dengeli çizer.
- **Hasar yedikçe öfkelenir** (canının üçte biri tek vuruşta sinirli yapar). Sinirliyken **Ateş**'e de yönelir, **daha büyük ve daha uzun** çizer (güçlü vurur), ama savunma becerisi %30'a kadar düşer ve büyüyü bozma ihtimali artar.
- Her saldırısından sonra **yatışır**.
- Savaş denemesinde 2v2 modunda takım arkadaşın Elysia'dır. Sayılar `ELYSIA` sabitinde.

## Kayıt

Kayıt dosyası **sürüm 5**: `choices` (seçim kimliği → `good` ya da `bad`). Eski (v1-v4) kayıtlar boş seçimlerle yükseltilir. Sunucu en çok 16 kayıt, kimlik biçimi ve yalnızca `good`/`bad` değerini doğrular (bkz. [backend.md](backend.md)). İstemci yüklerken bilinmeyen seçimleri atar.

Seçimler de diğer değişiklikler gibi şehre girince kaydedilir ("● Kaydedilmedi" uyarısı).

## Ayarlar

Seçim metinleri ve ağırlıkları: `morality/catalog.ts`. Kademe eşikleri ve etki yüzdeleri: `morality/morality.ts`. Final metinleri: `morality/final.ts`. Elysia: `ELYSIA` sabiti.

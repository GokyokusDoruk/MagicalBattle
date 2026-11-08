# Boss savaşları

Kod: `client/src/boss/bosses.ts` (boss verisi, savaşçı kurulumu), `client/src/boss/simulate.ts` (denge simülasyonu), `client/src/ui/bossFight.ts` (savaş öncesi panel ve yeniden deneme), akış `client/src/game.ts` içinde `playChapter`. Hikâye: [hikaye.md](hikaye.md).

## Bölüm akışı

Bölümün sarı işaretçisine girince:

1. **Hikâye sahnesi** (bir kez; yenilgiden sonra tekrar denerken baştan oynamaz).
2. **Boss konuşması** (bossun meydan okuması).
3. **Savaş öncesi panel:** boss adı, düşmanlar ve canları, varsa özel mekanik uyarısı, önerilen seviye. **Savaşa gir** ya da **Geri çekil**.
4. **Savaş** (sıra tabanlı, çizimli, [savas-akisi.md](savas-akisi.md)).
5. **Zafer:** altın ve XP ödülü, yan görevlerin `battleWon` olayı tetiklenir, ardından o bölümün **ahlak seçimleri**, sonra **bölüm tamamlanır** (kapı açılır, sonraki görev belirir).
6. **Yenilgi / geri çekilme:** bölüm tamamlanmaz. Savaş sonunda **Tekrar dene** ya da **Geri çekil** seçersin. Geri çekilince işaretçiye tekrar girerek denersin. "Tekrar dene" cezasızdır; "Pes et" ölüm sayılır: altın kaybı ve en yakın köyde ayılma ([olum-ve-ekonomi.md](olum-ve-ekonomi.md)).

**Bölüm 8 farklı:** önce seçimler ve final sahnesi gelir (final yolu seçimlere göre belirlenir), sonra Malakor savaşı.

Sahne, savaş ve seçimler sürerken dünya durur.

## Oyuncunun savaşçısı

- **Can:** 300 + seviye başına 10 (30. seviyede 590).
- **Zırh ve büyü süresi:** giyilen zırh parçaları ve yüzükten gelir; seçtiğin büyünün elementine göre hesaplanır, aynı elementteki parçalar %50 daha güçlüdür ([ekipman.md](ekipman.md)).
- **Yetenekler** ve **asa** savaşçıya bağlanır (asa çizim süresini de uzatır) ([yetenek-agaci.md](yetenek-agaci.md), [asalar.md](asalar.md)); artık dünyadaki gerçek savaşlarda da etkililer.
- **Elysia** yalnız 3. bölümde ve Düzen Bekçisi yolunda 8. bölümde yanındadır (2v2), kendi yapay zekâsıyla ([diyalog-ve-ahlak.md](diyalog-ve-ahlak.md)).

## Bosslar

| Bölüm | Boss | Can | Güç | Zırh | Savunma becerisi | Öne çıkan | Ödül | Hedef sv. |
|---|---|---|---|---|---|---|---|---|
| 1 | General Vael | 260 | 115 | 0 | 0.25 | Kaba kuvvet: büyük ve güçlü vurur, savunması zayıf. Yalnız ateş | 120 altın, 110 XP | 1 |
| 2 | Ambargo Komutanı | 300 | 85 | %20 | 0.70 | Savunma ağırlıklı (toprak, su) | 160, 150 | 4 |
| 3 | Tapınak Bekçisi + Rüzgâr Çırağı | 420 + 320 | 110 / 100 | %15 / %5 | 0.55 / 0.50 | **2v2**, Elysia yanında. Hava ağırlıklı | 220, 200 | 5 |
| 4 | Soylu Şampiyonu | 540 | 85 | %35 | 0.55 | Zırhı güçlü, yavaş vurur | 280, 250 | 7 |
| 5 | General Kaelen | 580 | 95 | %25 | 0.60 | Sağlam, uzun savaş (60 döngü) | 360, 330 | 10 |
| 6 | Cadı Morga | 560 | 110 | %15 | 0.60 | **Sis:** savunurken gelen saldırıyı göremezsin | 420, 400 | 12 |
| 7 | General Morwenna | 560 | 108 | %20 | 0.65 | **Zihin kontrolü:** 3. döngüden sonra çizim tuvali bulanıklaşır | 500, 480 | 17 |
| 8 | Malakor (+ Gölge) | 760 (+340) | 115 / 95 | %20 / %10 | 0.75 / 0.55 | Dört elementi kullanır. **Düzen yolu: Elysia ile 2v2.** **Karanlık yol: tek başına, Malakor tek** (560 can) | 900, 900 | 20 |

"Güç" büyünün taban gücüdür (oyuncununki 100). "Savunma becerisi" botun gelen saldırıyı ne kadar iyi kapattığıdır. Ödüller yalnız ilk zaferde verilir (bölüm tamamlanınca işaretçi kapanır).

## Denge

Sayılar tahmindir; denge testi (`boss/bosses.test.ts`) oyuncunun yerine geçen bir **vekil bot** kullanır: seviyeye göre makul bir donanım (ekipman/yetenekten verilen hasar seviye başına +%1.5, zırh seviye başına %1.2, her 6 seviyede bir nadirliği artan bir **saldırı asası**) ve orta beceri (0.6). Test şunları doğrular:

- Hedef seviyede boss **yenilebilir ama kolay değil** (kazanma %30-99).
- 4. bölümden sonrası 1. seviyede neredeyse imkânsız (<%20); 1. boss 1. seviyede yenilebilir (≥%70).
- Seviye arttıkça kazanma oranı artar.

Vekil gerçek bir insan değildir; gerçek denge oyuncu testiyle (senin denemelerinle) ayarlanmalı. Sayılar tek yerde: `BOSSES` dizisi.

## Genişletme

- Yeni mekanik: `BossGimmick` (şu an `hideGhost`, `blurFromCycle`).
- Düşman ayarları: `BotProfile` (element tercihi, beceri, saldırı büyüklüğü) `battle/flow/bot.ts`.
- Yan görevlerde "savaş kazan" türü artık gerçekten tetiklenir.

# Ölüm ve ekonomi

Kod: `client/src/economy/death.ts` (altın kaybı, şifacılar, en yakın şifacı), akış `client/src/game.ts` içinde `handleDeath`.

## Ne zaman ölürsün

Bir **boss savaşında yenilince** savaş sonu ekranı iki seçenek verir:

- **Tekrar dene:** aynı savaşı baştan başlatır, **ceza yok**.
- **Pes et (altın kaybı):** ölüm sayılır, ceza uygulanır ve en yakın köyde ayılırsın.

Savaş öncesi panelde **Geri çekil** dersen savaşa hiç girmediğin için ceza yoktur. Yan görev, alışveriş ve gezinti sırasında ölüm yoktur (şimdilik tek can kaybı kaynağı boss savaşlarıdır).

## Ceza

**Yalnızca altın** gider: eldeki altının bir oranı, **seviyeye göre artar**.

| Seviye | Kayıp oranı |
|---|---|
| 1 | %6 |
| 5 | %10 |
| 10 | %15 |
| 15 | %20 |
| 20 ve üstü | %25 (üst sınır) |

Formül: `min(%25, %5 + seviye × %1)`. Sonuç aşağı yuvarlanır, eldeki altını aşmaz. Altının yoksa kayıp 0'dır.

**Korunanlar:** XP, seviye, yetenekler, çanta, asalar, ekipman, görevler ve ahlak puanı. Boss yenilmediği için bölüm de tamamlanmaz (işaretçiye tekrar girince denersin; sahne bu oturumda tekrar oynamaz).

Yüksek seviyede daha çok altın gitmesi, çok altın biriktirip ölümden korkmadan boss'a dalmayı önler. Dengeyi `LOSS_BASE`, `LOSS_PER_LEVEL`, `LOSS_CAP` ile ayarlarsın.

## Şifacılar ve ayılma

Her köyde bir şifacı vardır (köyler her zaman açıktır):

| Köy | Şifacı |
|---|---|
| Ash Kanyon | Şifacı Hatice |
| Vine Surları | Şifacı Yasemin |
| Sisli Bataklık | Şifacı Tuna |

Öldüğün yere **en yakın köyün merkezinde** ayılırsın (düz çizgi mesafesi). Kısa bir diyalog çıkar: nerede uyandığın, kaybedilen altın ve şifacının sözü. Savaşlar zaten tam canla başladığı için ayrıca iyileşmek gerekmez; şifacı hikâye ve ayılma noktasıdır.

Ödül ve ceza da diğer değişiklikler gibi **şehre girince** kaydedilir ("● Kaydedilmedi" uyarısı).

## Bilinen sınırlar

- Ölüm yalnızca boss savaşlarında var. Düşmanlarla dünyada rastgele karşılaşma gelirse aynı `handleDeath` kullanılabilir.
- Kaydedilmemiş ilerleme varken tarayıcıyı kapatmak, ödülü ya da cezayı geri alır (kayıt yalnızca şehirlerde yapılır). Bu bilinçli bir tasarımdır, ayrıntısı [backend.md](backend.md) içinde.

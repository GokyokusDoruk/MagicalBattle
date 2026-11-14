# Savaş akışı (sıra tabanlı)

Kod: `client/src/battle/flow/` (kurallar) ve `client/src/ui/battleScreen.ts` (ekran). Denemek için oyunun adresine `?lab=battle` ekle (örn. `https://magicalbattle.dorukplays.com/?lab=battle`). Giriş gerekmez.

## Bir döngü ve tur nasıl geçer

**Tur elementi:** Her **döngünün başında** canlı herkes **gizlice, aynı anda, birbirini görmeden TEK element** seçer ve elementler birlikte açılır. Seçtiğin element o döngüde **hem saldırının hem savunmanın elementidir**: ateşle saldırdıysan o döngü ateşle savunursun. Ekipmanın (zırh, yüzük) ve asanın element bonusları da bu elemente göre hesaplanır. Sonra döngünün turları oynanır:

1. **Sıra belirlenir:** kim saldırıyor, kim savunuyor. Bu turun element ilişkisi gösterilir: saldıranın elementi savunanınkine üstünse hasar ×1.5, savunan üstünse ×0.5 (ateş ⚔ hava gibi).
2. **Saldıran çizer** (3 sn + asa ve yüzük süresi). Çizim çok küçükse "Büyü yapamadı!": savunmaya gerek kalmaz, hasar yok, sıra rakibe geçer.
3. **Savunan çizer** (3 sn + asa ve yüzük süresi). Gelen saldırıyı soluk "hayalet" olarak görür (ayarlanabilir). Çizemezse saldırının tamamı hasar verir.
4. **Hasar hesaplanır** ([hasar-hesabi.md](hasar-hesabi.md)), can düşer, büyü arenada oynatılır.

**Üstünlük iki yönde işler:** 1v1'de A su, B ateş seçtiyse A'nın saldırısı B'ye ×1.5 vurur, B'nin saldırısı A'ya ×0.5 vurur. Yani doğru elementi tahmin etmek hem hasarını artırır hem aldığını azaltır. Aynı element ya da etkisiz çift (ateş–toprak, su–hava) ×1.

## Tur sırası

Bir **döngüde** her savaşçı bir kez saldırır: önce takım 0, sonra takım 1.

| Mod | Bir döngünün turları |
|---|---|
| 1v1 | A saldırır / B savunur, sonra B saldırır / A savunur |
| 2v2 | T1-K1 saldırır / T2-K1 savunur, T1-K2 / T2-K2, sonra T2-K1 / T1-K1, T2-K2 / T1-K2 |

- **Ölen savaşçının saldırı sırası atlanır.** Ölen takım daha az hamle yapar (dezavantajlı olur), rakip bunun için bir bonus ya da ceza almaz.
- **Savunmaya**, normalde karşısındaki (aynı sıradaki) rakip geçer. O ölmüşse hayatta kalan takım arkadaşı savunur, ek bir bonus yoktur.
- Bir takımın tamamı ölünce savaş biter. Aynı anda herkes ölürse berabere.
- **Döngü sınırı:** 40 döngüde bitmezse, can toplamı fazla olan takım kazanır (eşitse berabere).

## Bot rakipler

Elementi rastgele seçer, hazır şekilleri (daire, yıldız, spiral, dalga, zikzak) biraz bozarak çizer. Ara sıra (~%6) çok küçük çizer ve "büyü yapamadı" der. Savunmada gelen saldırının bir kısmını taklit eder; **zorluk**, ne kadarını ve ne kadar isabetle kapattığını belirler (ortalama savunulan oran):

| Zorluk | Savunulan |
|---|---|
| Kolay | ~%33 |
| Orta | ~%55 |
| Zor | ~%75 |

Savunmasız bir saldırı ortalama ~79 hasar verir; can 300'dür.

## Ayarlar

`client/src/battle/flow/config.ts`: başlangıç canı (300), taban güç (100), döngü sınırı (40) ve "savunan saldırıyı görsün mü".

## Koddaki yapı

- `engine.ts`: sıra, can, ölüm, kazanan. Arayüzden bağımsız, testli.
- `controller.ts`: `runBattle(engine, io)`. Tur akışını yürütür; arayüz `BattleIO` ile bağlanır (çizim, döngü başı element seçimi, oynatma). Bot, gerçek ekran ve testler aynı akışı kullanır.
- `bot.ts`, `shapes.ts`: bot rakip.

Çok oyunculu arena (Task 21) aynı akışı kullanacak: `BattleIO` ağ üzerinden bağlanacak.

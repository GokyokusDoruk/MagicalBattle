# Karşılaşmalar ve rüşvet (Task 40)

Kod: `client/src/enemies/zones.ts` (çalılık karşılaşması), `enemies/bribe.ts` (rüşvet bedeli), `ui/worldFight.ts` (panel), `game.ts` (`fightSpot`, `bribeOption`).

## Çalılıkta karşılaşma

- Düşmanla rastgele karşılaşma **yalnızca çalılıkta** olur: çalılıkta yürürken her **yeni karoya** girişte (adım bitince) **%10** şans. Çimen, kumsal, yol, su, şehir ve köy güvenlidir: çalılıktan kaçınan huzurla yürür.
- Savaştan (zafer, kaçış, rüşvet ya da ölüm) sonra **5 saniye** karşılaşma olmaz.
- Düşmanın elementi, çalılığa **en yakın şehrin** elementidir (Ignis ateş, Abyss hava, Stone Heart toprak, Still Crystal su); kademe başlangıca uzaklığa göre (uzak çalılık daha zor). Panelden önce "Bir düşman büyücü ortaya çıktı!" animasyonu oynar.

## Sabit düşmanlar

Haritada 88 sabit düşman durur (Task 39). Düşmanın karosuna girince ya da **yan karodan** (üst, alt, sağ, sol; çaprazdan değil) yaklaşınca savaş paneli açılır; yenilince ya da rüşvetle ayrılınca **4 dakika** sonra geri gelir.

## Rüşvet

- Savaş panelinde **Savaş**, **Kaç** ve **Rüşvet ver (N birim)** seçenekleri vardır. Rüşvet verirsen savaş olmaz ve düşman haritadan kaybolur (sabit düşman 4 dakika sonra geri gelir; çalılık karşılaşması hiç olmamış sayılır).
- **Bedel:** düşmanın ganimet parasının **3 katı** (en az 10): kademe 1 düşman ~36, kademe 4 ~144. Bulunduğun bölgenin (en yakın şehrin) para biriminden ödenir; yeterli paran yoksa düğme kapalıdır.
- **Rüşvet verilemeyenler:** boss savaşları, maden ve sandık muhafızları.

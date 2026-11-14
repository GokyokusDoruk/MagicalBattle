# Han, kalıcı can ve can iksirleri (Task 27)

## Kalıcı can

Can artık savaştan savaşa taşınır.

- **Azami can** seviyeyle artar: 300 + 10 × (seviye − 1) (`economy/health.ts`).
- Savaş bitince kalan can oyuncuya yazılır (`PlayerState.setHp`). Kayıtta `hp` olarak durur (kayıt sürümü 7; `null` = tam dolu).
- **Boss mevcut canla karşılar:** oyuncu şu anki canıyla savaşa girer, boss her zaman tam canıyla başlar. "Tekrar dene" savaşa girilen canla başlar.
- Seviye atlayınca azami can artar, **eksik can aynı kalır** (seviye atlamak canı doldurmaz).
- Ölünce şifacıda can **tamamen dolar** (altın kaybı kuralı değişmedi, bkz. [olum-ve-ekonomi.md](olum-ve-ekonomi.md)).
- Can hiçbir zaman 0'a inmiş olarak kaydedilmez: en az 1'dir; yenilgi doğrudan ölüm akışına gider.
- Boss savaşından önce panelde canın, iksirlerin ve "Han'da dinlenip gelebilirsin" uyarısı görünür.

## Han

Her şehirde (Ignis, Abyss, Stone Heart, Still Crystal) bir **hancı** vardır; surların içinde, tüccarla asacının arasında üst tarafta durur. Üç sekmesi vardır:

- **Dinlen:** canı **bedavaya** tamamen doldurur. Şehrin kapısına girebildiğin için şehir zaten açıktır; kapısı kilitli bir şehirde han kullanılamaz (içeri girilemez).
- **İksirler:** üç can iksiri (Küçük +60, Normal +150, Büyük +300) satın alınır, içilir ya da değerinin yarısına satılır. Ahlak çarpanları uygulanır.
- **Görevler:** yan görevler (eskiden tüccardaydı). Hedef bitince ödül kendiliğinden gelir.

## Can iksirleri

- **Çanta ekranında** (B) iksirin yanındaki **Kullan** düğmesiyle istediğin an içilir; han ekranında da **İç** düğmesi var.
- Boss savaşı öncesi panelden de içilebilir.
- Can doluysa iksir harcanmaz; fazla can boşa gider (örn. 290/300 canda +60 iksir yalnızca +10 yeniler ama yine de harcanır).
- İksirler çantada **eşya** yeri kaplar.
- **Savaşın içinde iksir içilmez** (savaş turlarını bozmaması için). İstenirse sonra eklenir.

## Durum çubuğu

Sol üstteki panelde seviye ve altının altında **❤ Can** çubuğu görünür (düşükse sarı).

## Dikkat

Can boss savaşlarında ve dünya düşmanlarıyla savaşlarda ([dunya-dusmanlari.md](dunya-dusmanlari.md)) azalır. Han bedava ve şehirlerde olduğu için can doldurmak kolaydır; yolda iksir taşımak önem kazanır.

## Kod

`economy/health.ts`, `economy/player.ts` (hp, heal, usePotion), `economy/merchants.ts` (hancılar), `ui/merchantUi.ts` (han ekranı), `ui/bossFight.ts` (savaş öncesi can paneli), `ui/bagUi.ts` (Kullan), `ui/statusBar.ts` (can çubuğu), sunucu: `server/src/save/saveData.ts` (`hp`).

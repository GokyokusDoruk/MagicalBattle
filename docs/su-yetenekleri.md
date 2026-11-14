# Su yetenekleri (Task 43)

Yetenek sistemi [ateş yetenekleri belgesindeki](ates-yetenekleri.md) gibi: her yeteneğin 3 seviyesi, açmak ve her seviye 1 puan.
Su 4 yetenek = 12 puan. Sayılar ilk önerimdir, Task 46 denge turunda ayarlanır.

| Yetenek | Ne yapar | Sv 1 | Sv 2 | Sv 3 |
|---|---|---|---|---|
| **Buz Nefesi** | Su saldırısı rakibi yavaşlatabilir; yavaşlayan rakibin bir sonraki büyü çizim süresi kısalır (bir kez, birikmez) | %25 / -0.3 sn | %40 / -0.5 sn | %55 / -0.7 sn |
| **Şifa Kabarcıkları** | Su saldırısının verdiği hasarın bir kısmı can olarak döner (kabarcık animasyonu, yeşil +HP) | %8 | %14 | %20 |
| **Yansıyan Dalga** | Su savunmasında kalkanın tuttuğu hasarın bir kısmı saldırana yansır | %15 | %25 | %35 |
| **Sis Perdesi** | Su saldırısı rakibin savunma ekranını sisle kaplar | 1 bulut | 2 bulut | 3 bulut |

Kurallar:

- Buz Nefesi, Şifa Kabarcıkları ve Sis Perdesi yalnızca **su saldırısında**, Yansıyan Dalga yalnızca **su savunmasında** işler.
- **Buz Nefesi:** insan rakibin tuvali kısalan süreyle açılır; bot rakibin çizim süresinden aynı kadar düşülür (zayıf vuruş). Yavaşlama sonraki ilk çizimde (saldırı ya da savunma) harcanır.
- **Yansıyan Dalga:** yansıyan hasar = (savunma olmasaydı verilecek hasar − verilen hasar) × oran. Savunma yapılamadıysa yansıma yoktur. Yansıma saldıranı yenebilir.
- **Sis Perdesi:** insan savunmacının ekranında bulutlar çizimi ve saldırının hayaletini örter. Bot savunmacıda bulut başına savunmanın %10'u geçer (en çok %50). Savunma yapılamadıysa etki yoktur.
- Sınırlar: tutuşma/yavaşlatma en çok %70, can çalma en çok %30, yansıma en çok %50, sis en çok 3 bulut.

Kod: `skills/catalog.ts` ve `resolver.ts` (etkiler, `FOG_BOT_BYPASS`), `battle/flow/controller.ts` (yavaşlatma, yansıma, sis), `engine.ts` (`chill`),
`ui/drawingCanvas.ts` (`placeFog`, sis çizimi), `ui/battleScreen.ts` (kabarcıklar, duyurular).

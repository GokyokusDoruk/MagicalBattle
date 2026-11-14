# Toprak yetenekleri (Task 44)

Kurallar [ateş](ates-yetenekleri.md) ve [su](su-yetenekleri.md) ile aynı: her yeteneğin 3 seviyesi, açmak ve her seviye 1 puan; toprak 4 yetenek = 12 puan.
Sayılar ilk önerimdir, Task 46 denge turunda ayarlanır.

| Yetenek | Ne yapar | Sv 1 | Sv 2 | Sv 3 |
|---|---|---|---|---|
| **Taş Kabuk** | Her toprak savunmanda kalıcı zırh kazanırsın; savaş bitene kadar birikir ve her büyüye karşı işler | +%2 | +%3 | +%4 |
| **Sarsıntı** | Toprak saldırın savunmayı %80 ve üstü aşarsa rakibin sıradaki saldırısı atlanır | %35 | %55 | %80 |
| **Dağ Kalkanı** | Toprak savunmasında alınan hasar azalır | -%10 | -%18 | -%26 |
| **Çamur Yaması** | Toprak saldırısı rakibin savunma ekranına çamur yamaları döker; içlerine çizilemez | 1 yama | 2 yama | 3 yama |

Kurallar:

- Taş Kabuk, Dağ Kalkanı toprak **savunmasında**; Sarsıntı ve Çamur Yaması toprak **saldırısında** işler.
- **Taş Kabuk:** zırh yalnızca savunma gerçekten çizildiyse kazanılır; toplam bonus en çok %30. Kazanılan zırh, o turdaki hasara değil sonraki turlara işler.
- **Sarsıntı:** "savunmayı %80 aştı" = savunmanın tuttuğu oran en çok %20. Savunma yapılamadıysa da geçerlidir. Sersemlik birikmez, yalnızca bir saldırı sırasını atlatır; atlanan sırada bir şey çizilmez, savaş ekranı "sırasını kaçırdı" yazar.
- **Çamur Yaması:** insan savunmacı çamura girince çizgi kesilir, çıkınca yeni çizgi başlar (çamurun içi korumasız kalır). Botlarda yama başına savunmanın %8'i geçer (sisle birlikte en çok %50).

Kod: `skills/catalog.ts`, `resolver.ts` (`STUN_HIT_RATIO`, `MUD_BOT_BYPASS`, sınırlar), `battle/flow/controller.ts` (zırh, sersemletme, çamur, `announceStun`),
`engine.ts` (`armorBonus`, `stunned`), `ui/drawingCanvas.ts` (çamur çizimi ve kesme), `ui/battleScreen.ts` (duyurular).

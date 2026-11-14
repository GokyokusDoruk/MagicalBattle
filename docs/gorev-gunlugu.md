# Görev günlüğü ve aktif görev (Task 41)

Kod: `client/src/quests/tracking.ts` (görev girişleri, hedef konum, özet, yön oku; saf), `ui/questLogUi.ts` (günlük), `ui/questHud.ts` (üst orta gösterge), `ui/statusBar.ts` (düğme), `game.ts` (bağlantı, `trackEntries`).

## Görev günlüğü

- Sol üstteki durum panelinde **📜 Görevler (J)** düğmesi (ya da **J** tuşu) günlüğü açar.
- **Aktif** görevlerin hepsi listelenir: ana görev(ler) (★) ve devam eden yan görevler (▸, ilerlemeyle). Altında **Tamamlanan** yan görevler.
- Birini seçince sağda ayrıntısı görünür: anlatım, hedef özeti, yer, ödül. **Takip et** ile aktif görev yapılır.
- Takip edilen görev tarayıcıda hatırlanır (`localStorage`, yalnızca bu cihazda bir kolaylık; yoksa oturum boyunca tutulur). Takip edilen görev biterse ya da yoksa **ana görev**, o da yoksa ilk yan görev takip edilir.

## Üst orta gösterge ve ok

- Haritanın **üst ortasında** takip edilen görevin özeti yazar: "★ Ana görev: Köle İsyanı ve Lav Bacası Sabotajı" ya da "▸ Madeni Temizle: bir madeni temizle (0/1)".
- Hedefi olan görevlerde yanında hedefe dönen küçük bir **ok** ve **karo uzaklığı** görünür; hedefin 1 karo yakınına gelince "📍 burada". Ok her yeni karoda güncellenir.

| Görev türü | Okun gösterdiği yer |
|---|---|
| Ana görev | sarı ! işareti |
| Konum ve teslimat | ilgili şehir |
| Maden | en yakın maden |
| Sandık | en yakın **kapalı** sandık (açılan atlanır) |
| Savaş kazanma | hedef yok (ok çıkmaz) |

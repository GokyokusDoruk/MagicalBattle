# Asa seviyesine bağlı savaş pasifleri (Task 63)

**Yanık İzi** (ateş) ve **Sarsıntılı Rüzgâr** (hava) artık yetenek puanıyla alınmaz ya da geliştirilmez. İlgili elementin asasını kuşanınca
(ve asanın seviyesi sana yetiyorsa) kendiliğinden gelir; asanın seviyesi arttıkça 3 kademede güçlenir:

| Asa seviyesi | Kademe | Yanık İzi (ateş asası) | Sarsıntılı Rüzgâr (hava asası) |
|---|---|---|---|
| 1-9 | 1 | 1 yara izi | şiddet 1 |
| 10-19 | 2 | 2 yara izi | şiddet 2 |
| 20+ | 3 | 3 yara izi | şiddet 3 |

- Yetenek ekranında her elementin sekmesinin altında **"Pasifler (puan harcamaz, asayla gelir)"** bölümü vardır: o elementin asa pasifi
  (ateş: eşya düşme şansı +%10, su: saniyede azami canın %0.5'i kadar can yenileme, toprak: taşıma kapasitesi +%25, hava: yürüme hızı +%25)
  ve ateş ile havada savaş pasifi (kademe tablosuyla). Kuşanılı asa o elementten ve kullanılabilirse **AKTİF** rozeti çıkar, geçerli kademe vurgulanır.
- Puan hesabı: ateş 4 yetenek (12 puan), su 4 (12), toprak 4 (12), hava 3 (9); taşıyıcı 6. Seviye 30'da 58 puan olduğundan hepsi alınabilir ve puan artar.
- Eski kayıtlarda bu iki pasife harcanmış puanlar iade olur.
- Düşmanlar pasifleri yine kendi yetenek setiyle kullanır (Task 45b); değişmedi.

Kod: `skills/catalog.ts` (`passiveTierForWandLevel`), `skills/tree.ts`, `wands/passives.ts` (`wandBattlePassives`), `ui/skillTreeUi.ts`, `game.ts`, `boss/simulate.ts` (kit ateş asasından pasif alır).

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

## Güncelleme: Sis Perdesi ve Çamur Yaması da asa pasifi (Task 64)

**Sis Perdesi** (su) ve **Çamur Yaması** (toprak) da artık yetenek puanıyla alınmaz; su asası kuşanınca Sis Perdesi, toprak asası kuşanınca Çamur Yaması gelir
ve asa seviyesine göre 3 kademede güçlenir (asa Sv 1-9: 1 bulut/yama, 10-19: 2, 20+: 3).

| Asa elementi | Savaş pasifi | Kademe 1 / 2 / 3 |
|---|---|---|
| Ateş | Yanık İzi | 1 / 2 / 3 yara izi |
| Su | Sis Perdesi | 1 / 2 / 3 sis bulutu |
| Toprak | Çamur Yaması | 1 / 2 / 3 çamur yaması |
| Hava | Sarsıntılı Rüzgâr | şiddet 1 / 2 / 3 |

- Sis ve çamur artık **hangi büyüyü seçersen seç**, sen saldırırken rakibin **savunma ekranında** belirir (eskiden yalnızca su/toprak saldırısında).
  Botlarda bulut/yama başına savunma zayıflar (sis %10, çamur %8, toplam en çok %50).
- Puanla alınan yetenekler: ateş 4 (12 puan), su 3 (9), toprak 3 (9), hava 3 (9), taşıyıcı 6; puanla alınanların toplamı 39 (+6 taşıyıcı).
- Düşmanlar ve bosslar da bu pasifleri kendi setiyle kullanır; Ambargo Komutanı gibi bosslar değişmedi.

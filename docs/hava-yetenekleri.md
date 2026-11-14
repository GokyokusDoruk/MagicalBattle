# Hava yetenekleri (Task 45)

Kurallar ateş/su/toprak ile aynı: her yeteneğin 3 seviyesi, açmak ve her seviye 1 puan; hava 4 yetenek = 12 puan (böylece 15 + 12 + 12 + 12 = 51).
Sayılar ilk önerimdir, Task 46 denge turunda ayarlanır.

| Yetenek | Ne yapar | Sv 1 | Sv 2 | Sv 3 |
|---|---|---|---|---|
| **Fırtına Nefesi** | Hava büyülerini çizmek için daha çok zaman (saldırıda ve savunmada) | +0.3 sn | +0.5 sn | +0.8 sn |
| **Keskin Esinti** | Hava saldırılarında kritik vuruş (×1.5) şansı artar | +%8 | +%14 | +%20 |
| **Geri Esen Rüzgâr** | Hava savunmasında, kalkanın tuttuğu hasarın bir kısmı şansla saldırana geri savrulur | %50 / %6 | %65 / %8 | %80 / %10 |
| **Sarsıntılı Rüzgâr** (pasif) | Rakip saldırı çizerken ekranı sarsılır | şiddet 1 | şiddet 2 | şiddet 3 |

Kurallar:

- Kritik şansı (ekipman + yetenek) en çok %75'te kalır. Yetenek bonusu en çok %30, süre bonusu en çok 1 sn.
- **Geri Esen Rüzgâr:** savunma yapılamadıysa işlemez. Su'daki Yansıyan Dalga ile aynı mantıkla hesaplanır (savunmanın tuttuğu hasar) ve yansıma toplamına eklenir; saldıranı yenebilir.
- **Sarsıntılı Rüzgâr** büyü elementinden bağımsız pasiftir (Yanık İzi gibi). İnsan saldırgan ekranında tuval her karede şiddet × 2.5 piksel titrer; bot saldırgan şiddet başına 0.15 sn çizim süresi kaybeder.

Kod: `skills/catalog.ts`, `resolver.ts` (`Passives.shake`), `battle/flow/controller.ts` (süre, kritik, geri savurma, bot cezası, `rebounded`), `ui/drawingCanvas.ts` (sarsıntı), `ui/battleScreen.ts` (duyuru).

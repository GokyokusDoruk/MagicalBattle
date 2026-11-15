# Savaş sonucu ekranı (Task 51)

Çarpışmada artık hesap tablosu çıkmaz; her saldırıdan sonra sade bir akış oynar:

1. **"%X bloklandı" ve etki seviyesi** (2 saniye): çok etkisiz saldırı, etkisiz saldırı, normal saldırı, etkili saldırı, çok etkili saldırı.
2. **Hasar sayısı** (2 saniye sonra, büyük yazıyla): `-103 hasar`.
3. **Detay / Devam:** Devam'a basınca (ya da ~2.5 sn dokunulmazsa) tur biter. Detay'a basınca hasarın neyden geldiği açılır; Devam'a basana kadar bekler.

## Etki seviyeleri (bloklanmayan orana göre)

| Seviye | Bloklanmayan | Bloklanan |
|---|---|---|
| Çok etkili | %90 ve üstü | %10'dan az |
| Etkili | %70-90 | %10-30 |
| Normal | %45-70 | %30-55 |
| Etkisiz | %20-45 | %55-80 |
| Çok etkisiz | %20'den az | %80 ve üstü |

Savunma yapılamadıysa saldırı her zaman "çok etkili" (%0 bloklandı).

## Detay ekranı

Büyü gücü → bloklanmayan kısım (%) → baş vuruşu → element → her çarpan **ayrı satır** (Ekipman çarpanı, Kuşanılan eşyalar (kendi elementinden bonus),
Saldırı yetenekleri, Alev Zinciri, Savunanın yetenek ve asası) → kritik → zırh → toplam hasar. Her satırda o adımdan sonraki değer yazar.

Kod: `battle/damage/explain.ts` (seviyeler, `blockedPercent`, detay satırları), `calculate.ts` (`multiplierParts`), `controller.ts` (çarpan kaynakları), `ui/battleScreen.ts` (akış ve detay paneli).

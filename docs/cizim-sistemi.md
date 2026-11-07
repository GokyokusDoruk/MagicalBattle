# Büyü çizim sistemi

Savaşta büyü, tuvale çizilir. Saldıran ve savunan **aynı sabit tuvalde** çizer; çizimler sonra üst üste konup karşılaştırılacak (Task 10). Kod: `client/src/battle/gesture/`.

## Denemek için

Oyunun adresine `?lab=draw` ekle (örn. `https://magicalbattle.dorukplays.com/?lab=draw`). Giriş gerekmez. İki mod var:

- **Tek çizim:** Bir büyü çiz, sistemin çizimini nasıl ölçtüğünü ve yoğunluk haritasını gör.
- **Saldırı & savunma:** Önce saldırı, sonra savunma çiz; kaçta kaçının savunulduğunu ve hasarın nereden geleceğini gör.

## Kurallar

- **Süre:** İlk dokunuştan itibaren **3 saniye** (süre dolunca tur kendiliğinden biter, "Bitir" ile erken de bitirilebilir). Hiç dokunulmazsa 8 saniye sonra tur "büyü yapamadı" ile biter.
- **Çok çizgili:** Parmak kalkınca yeni çizgi başlatılabilir, 3 saniye hepsini kapsar.
- **Sabit tuval, ölçek yok:** Çizim 256×256'lık mantıksal tuvalde tutulur, ekran boyutundan bağımsızdır. Çizimin **büyüklüğü** önemlidir, küçültülüp büyütülmez.
- **Yoğunluk haritası (32×32 hücre):** Her hücrede çizerken **harcanan süre** tutulur. Bir noktada fazla durmak o noktanın ağırlığını artırır. Toplam ağırlık çizim süresine eşittir. Basılı tutarken hareket etmesen bile süre birikir.
- **Kaplanan alan hızdan bağımsızdır:** Çabuk çizilen büyük bir daire de aynı alanı kaplar; hız yalnızca ağırlığı değiştirir.

## Minimum hacim ("Büyü yapamadı!")

Çizim şu iki şartı birden sağlamalı, yoksa büyü sayılmaz ve sıra rakibe geçer (savunmada da geçerli):

| Şart | Varsayılan |
|---|---|
| Kaplanan alan | en az **24 hücre** (tuvalin ~%2,3'ü) |
| Çizimin en uzun kenarı | en az **64 birim** (tuvalin %25'i) |

Tek nokta, basılı tutma ve küçük karalamalar bu yüzden geçersizdir. Uzun bir düz çizgi geçerlidir.

## Savunma eşleşmesi (Task 10)

Kod: `client/src/battle/match/defense.ts`. Saldırı ve savunma yoğunluk haritaları aynı tuvalde üst üste konur:

- Saldırının her hücredeki **ağırlığı** (orada harcanan süre), savunmanın o hücredeki **korumasıyla** azalır.
- **Korunan kısım savunulmuştur, korunmayan kısım hasar verir.** `savunulan + hasar verecek = saldırı` her hücrede korunur.
- Savunma izinin içindeki hücreler tam, kenarından **2 hücreye** kadar uzaktakiler kademeli olarak korunur (küçük kaymalar cezalandırılmaz).
- Saldırıda çok vakit harcanan nokta daha ağırdır: orayı savunmak, hafif bir noktayı savunmaktan çok daha değerlidir.
- Savunmanın **kendi** hızı ve süresi sonucu değiştirmez, yalnızca nereyi kapattığı önemlidir. Saldırıdan geniş çizmek %100'ü geçmez.
- Savunma yapılamadıysa (minimum hacim altı) hiçbir şey savunulmaz, saldırının tamamı hasar verir.

Gerçek değerlerden örnekler (saldırı: yarıçapı 70 olan daire):

| Savunma | Savunulan |
|---|---|
| Aynı daire | %100 |
| Aynı daire, 8 birim (1 hücre) kaymış | %92 |
| Aynı daire, 24 birim kaymış | %47 |
| Yarıçapı 60 olan daire | %79 |
| Yarıçapı 50 olan daire | %16 |
| Yarım çember | %55 |

`savunulmayan` haritası, Task 11'de baş bölgesi çarpanı (×1.5) ve diğer hasar adımlarına girdi olacak.

## Ayarlar

Çizim için `client/src/battle/gesture/config.ts` (süreler, ızgara boyutu, fırça yarıçapı, minimum hacim eşikleri), eşleşme için `DEFENSE_SOFT_EDGE_CELLS` (`battle/match/defense.ts`). Eşikleri laboratuvar sayfasında deneyerek ayarla.

## Sonraki adımlar

- **Task 11:** Hasar hesabı; çizim gücü (büyüklük ve süre ağırlığı) burada kullanılır.

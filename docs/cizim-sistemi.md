# Büyü çizim sistemi

Savaşta büyü, tuvale çizilir. Saldıran ve savunan **aynı sabit tuvalde** çizer; çizimler sonra üst üste konup karşılaştırılacak (Task 10). Kod: `client/src/battle/gesture/`.

## Denemek için

Oyunun adresine `?lab=draw` ekle (örn. `https://magicalbattle.dorukplays.com/?lab=draw`). Giriş gerekmez. Bir büyü çiz, sistemin çizimini nasıl ölçtüğünü ve yoğunluk haritasını gör.

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

## Ayarlar

Hepsi `client/src/battle/gesture/config.ts` içinde: süreler, ızgara boyutu, fırça yarıçapı ve minimum hacim eşikleri. Eşikleri laboratuvar sayfasında deneyerek ayarla.

## Sonraki adımlar

- **Task 10:** Saldırı ve savunma yoğunluk haritalarının eşleşmesi (eşleşen kısım savunulmuş sayılır).
- **Task 11:** Hasar hesabı; çizim gücü (büyüklük ve süre ağırlığı) burada kullanılır.

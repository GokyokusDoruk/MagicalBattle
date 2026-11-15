# Dövüş matematiği (Task 52)

Amaç: rastgele karalama çok vurmasın, ama az çizilen büyü de az vursun; savunma bedelsiz olmasın. Eşikler bilerek **gevşek** başladı
(temiz şekiller hiç ceza almaz) ve hepsi `battle/gesture/quality.ts` ile `battle/damage/config.ts` içinde ayarlanabilir.

## 1. Güç eğrisi (alan)

- Tam güç için kaplanan alan tuvalin %18'i. Altında güç artık doğrusal değil: `(alan / %18) ^ 1.3` (yarım alan ≈ %41 güç, eskiden %50).
- Tam alanın %160'ına kadar tam güç; tuvali neredeyse dolduran çizimde güç en çok %15 kesilir.

## 2. Çizim kalitesi

- **Karalama:** `verim = kaplanan alan / (çizgi uzunluğu × fırça kalınlığı)`. Temiz şekillerde 0.76-1.07; aynı yerleri defalarca geçen karalamada 0.3'ün altı.
  Verim 0.55'in üstündeyse ceza yok, 0.22'nin altında çarpan en düşük (×0.6), arası doğrusal. Temiz daire, yıldız, spiral, dalga ve zikzak (58-92 boyutlarında) hiç ceza almaz.
- **Dağılım:** tuval 4×4 bölgeye ayrılır; büyü ≥6 bölgeye yayılırsa tam güç, tek bölgeye yığılırsa ×0.8.
- Toplam kalite = karalama × dağılım (en az ×0.48) ve **gücü çarpar**.
- Bir noktada beklemeyle biriken ağırlık sınırlıdır: bir hücrenin ağırlığı, dolu hücrelerin ortalamasının en çok 3 katı sayılır.

## 3. Savunma bütçesi

- Savunma karalama cezasını da alır (aynı verim formülü).
- **Fazla kaplama:** savunma tuvalin %35'ine kadar tam güçte; %70'ine kadar doğrusal incelir; en ince hâli ×0.45.
  Yani tuvali boydan boya karalayan savunma yaklaşık yarı yarıya bloklar, saldırıyı ölçülü kapatan savunma tam bloklar.

## 4. Göstergeler

- Çizdikten sonra kalite düşükse küçük bir yazı çıkar: "Çizim kalitesi ×0.7: karalama gücü düşürdü" (ya da "büyü tuvalin küçük bir yerine yığıldı").
- Detay ekranında ayrı satırlar: **Çizim kalitesi (karalama / dağılım)** ve **Savunma inceldi (karalama / fazla kaplama)**.

## 5. Seçimlerin yanında kazanç yazısı

- **Hikâye seçimleri** (ahlak): her seçeneğin altında puan değişimi, yeni kademe ve kazançları, final yolu değişimi yazar.
  Örn. "Ahlak puanı +10 → +22 (iyi yol, +12) · Yeni: Düzen Bekçisi I: alışverişte %5 indirim, görev ödülü +%10".
- **Element seçimi** (her döngü): her elementin altında "Üstün: ... ×1.25 / Zayıf: ... ×0.75" ve o element için kaç yeteneğin işlediği yazar.

## Denge etkisi (vekil oyuncu, tohumlu)

Botlar temiz şekil çizdiği için karalama cezası almaz; yalnızca küçük şekillerin güç eğrisi etkiledi. Boss kazanma: 1. %85, 2. %68, 3. %82, 4. %75,
5. %52, 6. %50, 7. %65, 8. %50 (önceki tur: 87/72/82/75/55/52/60/57). Dünya düşmanları: kademe 1 %100/kayıp %21, 2 %100/%38, 3 %91/%62, 4 %72/%72.
Gerçek oyuncunun çizimiyle eşikler oynayarak ayarlanacak.

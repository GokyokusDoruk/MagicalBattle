# Alan büyüsü ve kolye (Faz 6)

Herkesin kullanabildiği bir büyü biçimi: çizgin kendine değip (ya da çizgilerin birleşip) **kapalı bir bölge** çevirirse, o bölgenin içi
büyünün parçası olabilir.

## Nasıl çalışır?

- **Alan gücü** (hücre; tuval 32×32 = 1024 hücre): taban **24** + **asa** + **kolye**.
  - Asa: nadirliğe göre Sıradan 30, Gelişmiş 45, Nadir 60, Destansı 78, Efsanevi 98, Mistik 120 (seviye başına +%1).
  - Kolye: Sıradan 12 … Mistik 64 (seviyeyle ölçeklenir). Kolye ayrıca eskisi gibi büyü süresi ve kritik şansı verir.
- **Çizerken** kapalı bölgeler canlı gösterilir: gücün yettiği bölgeler **yeşil** (dolacak), yetmeyenler **kırmızı** (boş kalacak).
  Kırmızı bölgenin içinden yeni bir çizgi geçirip onu ikiye bölerek küçültebilirsin; tuvalin altında alan gücün yazar.
- **Büyü bitince** gücün yettiği en büyük toplam doldurulur (bir ya da birkaç bölge). Dolan hücreler çizilmiş hücrelerin ortalama
  ağırlığının **%60**'ı kadar ağırlık alır.
- **Saldırıda** dolu alan da vurur (silüete göre baş/gövde/sıyırma/ıska), **savunmada** dolu alan da korur. Dolu alanın dışındaki
  çizgiler eskisi gibi vurur ya da bloklar.
- 3D arenada büyünün ve kalkanın içi dolu, parlayan bir yüzey olarak görünür. Dolunca kısa bir bildirim çıkar.

## Denge
Alan büyüsü oyuncuyu güçlendirdi; Cadı Morga'nın canı 570 → 700 yapıldı, diğer hedefler aynen geçiyor.

Kod: `client/src/battle/gesture/area.ts` (`enclosedRegions`, `chooseRegions`, `applyArea`), `battle/flow/controller.ts`
(`BASE_AREA_CELLS`), `wands/catalog.ts` (`WAND_AREA_BY_RARITY`), `economy/equipment.ts` (`NECKLACE_AREA`), `ui/drawingCanvas.ts` (önizleme).

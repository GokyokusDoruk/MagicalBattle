# Yeni harita ve kare kare hareket (Task 39)

Kod: `client/src/world/smoothTerrain.ts` (yumuşak arazi çizici), `world/terrainTexture.ts` (parça parça çizim), `world/bootWorld.ts` ("Dünya oluşturuluyor"), `world/gridMove.ts` (kare kare hareket), `world/generateMap.ts`, `world/locations.ts`, `world/WorldScene.ts`.

## Harita

- **136×136** karo (eskiden 96×96); başlangıç ortada (68, 68). Şehir ve köyler **yerini korur**: hepsi 20 karo kaydırıldı (`MAP_OFFSET`). Yeni dış halka (eski haritanın dışı) yeni arazi ve daha uzak, daha tehlikeli bölgelerdir.
- **Çalılık** (`Tile.Thicket`): geçilebilir yeni zemin. Orman geçilmez kalır. Düşman karşılaşmaları çalılıkta olacak (Task 40, bkz. [karsilasmalar-ve-rusvet.md](karsilasmalar-ve-rusvet.md)).
- Düşman sayısı 32 → **88**, sandık 12 → **28**; kademeler kotayla dağıtılır (yakın alan küçük olduğu için rastgele yerleşim hep zor düşman verirdi). Madenler (şehir başına 4) aynı.
- **Kayıt sürümü 9:** eski (v1-v8) kayıtlarda kayıt noktası yeni haritaya +20 karo kaydırılır (sunucuda ve istemcide).

## Yumuşak görünüm

Mantık karolu kalır (hareket, çarpışma, karşılaşmalar). Görünüm yumuşak arazi görselidir:
- Her pikselde komşu karoların türleri yumuşak ağırlıklarla karışır ve gürültüyle dalgalandırılır: sınırlar organik, kutu kutu değil.
- Dokular: çim tutamları, su dalgaları ve kıyı köpüğü, tek tek ağaç tepeleri, çalılık yumakları ve kırmızı meyveler, kum benekleri, çakıllı yol ve koyu yol kenarı.
- Sur ve kapı keskin kalır (taş).
- Görsel karo başına 12 piksel çizilir (1632×1632), oyunda doğrusal süzmeyle büyütülür. Açılışta parça parça çizilir ("Dünya oluşturuluyor", ilerleme çubuğuyla); yaklaşık 3-5 saniye sürer.

## Kare kare hareket

- Karakter karo karo, yalnızca **yukarı, aşağı, sağ, sol** gider; çapraz girdide baskın eksen seçilir (eşitlikte yatay). Tuşa basılı tutulunca adımlar peş peşe akar; engel varsa dönmeye devam eder ama yürümez.
- Bir adım yaklaşık 190 ms (`STEP_MS`, hız çarpanı 1). Ayakkabı ve hava asası adımı kısaltır.
- Dokunmatik joystick de aynı kuralla (baskın eksen) çalışır.
- Tile karşılaşması artık **adım bitince** (yeni karoya varınca) tetiklenir.

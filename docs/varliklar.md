# Dış varlıklar (lisans)

Oyunda kullanılan dış görsel varlıklar ve lisansları. Yalnızca **CC0** (kamu malı, atıf gerekmez) kaynaklar kullanılır.

| Dosya | Kaynak | Yazar | Lisans | Nerede |
|---|---|---|---|---|
| `client/src/assets/textures/brown_mud_02.jpg` | [Poly Haven: Brown Mud 02](https://polyhaven.com/a/brown_mud_02) | Rob Tuytel | CC0 | Çamur yaması (çizim tuvali) |
| `client/src/assets/textures/burned_ground_01.jpg` | [Poly Haven: Burned Ground 01](https://polyhaven.com/a/burned_ground_01) | Rob Tuytel | CC0 | Ateş yarası, ateş seçim bölmesinin zemini |
| `client/src/assets/textures/rock_06.jpg` | [Poly Haven: Rock 06](https://polyhaven.com/a/rock_06) | Rob Tuytel | CC0 | Toprak seçim bölmesi, toprak kalemi |

Hepsi 1K renk (diffuse) haritasından 256×256'ya küçültülüp JPEG olarak sıkıştırıldı (toplam ~48 KB).

## 3D modeller

| Dosya | Kaynak | Yazar | Lisans | Nerede |
|---|---|---|---|---|
| `client/src/assets/models/wizard.glb` | [Quaternius: RPG Characters (Nov 2020), Wizard](https://quaternius.com/packs/rpgcharacters.html) | Quaternius | CC0 | Savaştaki büyücüler, haritadaki karakter ve düşman görselleri |
| `client/src/assets/models/wizard_texture.jpg`, `wizard_staff_texture.jpg` | aynı paket | Quaternius | CC0 | Büyücünün dokusu (kıyafet oyunda element rengine boyanır) ve asası |

Model FBX'ten projenin kendi three.js'i (FBXLoader + GLTFExporter) ile GLB'ye çevrildi; yalnızca kullanılan 5 animasyon
(Idle_Weapon, Spell1, Idle_Attacking, RecieveHit, Death) tutuldu (~970 KB, sıkıştırılmış ~250 KB). Dokular 1024/512 JPEG.

## Harita (harita kalitesi)

| Dosya | Kaynak | Yazar | Lisans | Nerede |
|---|---|---|---|---|
| `client/src/assets/world/ground_grass.jpg` | [Poly Haven: Leafy Grass](https://polyhaven.com/a/leafy_grass) | Poly Haven | CC0 | Çim karoları (renk ayarlı, daha canlı yeşil) |
| `client/src/assets/world/ground_path.jpg` | [Poly Haven: Cobblestone Floor 04](https://polyhaven.com/a/cobblestone_floor_04) | Poly Haven | CC0 | Patika (arnavut kaldırımı) |
| `client/src/assets/world/ground_sand.jpg` | [Poly Haven: Coast Sand 01](https://polyhaven.com/a/coast_sand_01) | Poly Haven | CC0 | Kum |
| `client/src/assets/world/ground_wall.jpg` | [Poly Haven: Stone Wall](https://polyhaven.com/a/stone_wall) | Poly Haven | CC0 | Şehir surları |
| `client/src/assets/world/ground_gate.jpg` | [Poly Haven: Wood Planks](https://polyhaven.com/a/wood_planks) | Poly Haven | CC0 | Şehir kapısı |
| `client/src/assets/world/tree_1..5.png`, `bush_1..4.png` | [KayKit Forest Nature Pack](https://kaylousberg.itch.io/kaykit-forest) | Kay Lousberg | CC0 | Orman ve çalılık karoları (3D modellerin render'ı) |
| `client/src/assets/world/mine_*.png` | [KayKit Medieval Hexagon Pack](https://kaylousberg.itch.io/kaykit-medieval-hexagon) (`building_mine`) | Kay Lousberg | CC0 | Maden girişleri (2×2 karo; fener rengi elemente göre) |

Modeller projenin kendi three.js'iyle (GLTFLoader) tarayıcıda 3/4 üstten, ışıklı ve şeffaf zeminli olarak çizilip PNG'ye çevrildi (toplam ~250 KB).
Zemin dokuları 256×256 JPEG; harita karo başına 20 pikselle çizilir, doku karolar boyunca kesintisiz akar.

## Oyuncu ve boss modelleri (Faz 7)

| Dosya | Kaynak | Yazar | Lisans | Nerede |
|---|---|---|---|---|
| `client/src/assets/models/mage.glb` | [KayKit Adventurers (Mage)](https://kaylousberg.itch.io/kaykit-adventurers) | Kay Lousberg | CC0 | Oyuncunun büyücüsü (savaş, harita görseli, portre, karakter ekranı); şapka, pelerin, değnek, büyük asa ve animasyonlar |
| `client/src/assets/models/knight.glb` | aynı paket (Knight) | Kay Lousberg | CC0 | General Vael, Kaelen, Morwenna, Tapınak Bekçisi |
| `client/src/assets/models/barbarian.glb` | aynı paket (Barbarian) | Kay Lousberg | CC0 | Ambargo Komutanı, Soylu Şampiyonu |
| `client/src/assets/models/rogue_hooded.glb` | aynı paket (Rogue_Hooded) | Kay Lousberg | CC0 | Cadı Morga, Rüzgâr Çırağı, Gölge |

Dört model aynı iskeleti paylaşır; animasyonlar (Idle, Spellcast_Shoot, Spellcast_Long, Blocking, Hit_A, Death_A …) yalnız `mage.glb`'de
durur ve hepsine uygulanır. Dosyalar projenin three.js'iyle (GLTFLoader + GLTFExporter) kullanılmayan animasyonlardan arındırıldı.

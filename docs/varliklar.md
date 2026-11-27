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

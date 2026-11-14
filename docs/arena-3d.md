# 3D arena

Kod: `client/src/battle/arena/`. Three.js ile düello arenası; her şey koda çizilir (düşük poligon, telifsiz), parçacık sayısı sabit tutulur, telefonda da hafiftir.

## Denemek için

Oyunun adresine `?lab=arena` ekle (örn. `https://magicalbattle.dorukplays.com/?lab=arena`). Giriş gerekmez.

- **Mod:** 1v1 ya da 2v2 yerleşim.
- **Sen / Rakip:** element seç (cüppe, asa ışığı ve büyü rengi buna göre değişir).
- **Demo çizim:** daire, yıldız, spiral ya da dalga ile saldırı dene.
- **Saldırı / Rakip saldırır / Başa vuruş / Yarım savunma / Tam savunma:** büyü görsellerini, kalkanı ve vuruş efektlerini izle. Yarım ve tam savunma, gerçek hasar hesabını kullanır.
- **Çiz ve savaş:** önce saldırı çiz, sonra savunma çiz (saldırı soluk görünür). Çizimlerin arenada oynar ve altta hasar yazar. Yani çizim, eşleşme, hasar ve arena birlikte çalışır.
- **Yenil / Sıfırla:** yenilgi animasyonu.

## Neler var

| Parça | Ne yapar |
|---|---|
| Arena | Taş platform, rün halkaları, orta çizgi, sütunlar, süzülen kristaller, yıldızlar |
| Büyücüler | Cüppe, kafa, şapka, asa; bekleme, büyü çekme, savunma duruşu, vuruş tepkisi, yenilgi |
| Büyü | Çizdiğin çizgiler parlayan tüplere dönüşür, havada **çizildiği sırayla** belirir, yüklenir, rakibe fırlar |
| Kalkan | Savunanın çizdiği mühür, saldırının önüne kalkan olarak kurulur |
| Vuruş | Element renginde kıvılcım, ışık patlaması, savrulma, kamera sarsıntısı, hasar yazısı (başa vuruşta "BAŞ!") |
| Kamera | Boştayken arenayı süzer; büyüde çekene, fırlayışta büyüyü takip eder, vuruşta hedefe yaklaşır |
| Ekran | Dikey telefonda kamera oyuncunun arkasına geçer (iki büyücü üst üste görünür) |

## Savaş akışı için arayüz (Task 13'te kullanılacak)

```ts
const arena = new ArenaView(container);
arena.setTeams([[{ name: 'Sen', element: 'fire' }], [{ name: 'Rakip', element: 'water' }]]);

await arena.showShield(defender, attacker, defenseStrokes);   // varsa kalkan kur
await arena.castSpell(attacker, defender, attackStrokes, 'fire');
await arena.impact(defender, attacker, { damage, blockedRatio, head, element });
arena.defeat(defender);
```

`defender` / `attacker`: `{ team: 0 | 1, index }`. 2v2'de `index` 0 ya da 1.

## Mantık testleri

Three.js'ten bağımsız parçalar birim testlidir: takım yerleşimi, çizgiden 3D yola çevirme, zamanlayıcı (`Tweens`), parçacık havuzu ve kamera (yumuşatma, sarsıntı, dikey ekran). Görseller tarayıcıda denenir.

## Asa modeli (Task 29b)

Büyücülerin asası artık gerçek bir 3D modeldir (`battle/arena/models/wand.obj`, yaklaşık 2000 köşe, 386 KB; `wandModel.ts` bir kez çözer ve tüm savaşçılar paylaşır). Ucundaki element küresi eskisi gibi parlar. Model dokusuz, düz ahşap rengiyle çizilir.

### Değerlendirilen ve kullanılmayan varlıklar

- **Cadı ve süpürge** (`Witch_store_upload.zip`): rig'li FBX (5,3 MB) ama dokuları çok ağır (normal harita 32 MB). Küçültülürse Morga/Elysia için uygun; şimdilik kullanılmadı.
- **Erkek insan** (`Male_Human.obj`, 16 bin köşe): dokuları klasörde yok, düz renkli kalırdı. Kullanılmadı.
- **3Demon asa baskı dosyaları** (OBJ/STL, 18-180 MB): web için çok ağır, ayrıca tanınmış bir filmin karakter asaları olduğu için telif riski var. Kullanılmadı.
- Lisans: dosyaların lisansı doğrulanmadı; yayından önce kaynaklarını kontrol et.

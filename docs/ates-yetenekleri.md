# Ateş yetenekleri ve yeni yetenek sistemi (Task 42)

Eski yetenek ağacı (Güç / Hassasiyet / Kalkan dalları, 36 yetenek, uyum bonusu) tamamen kalktı. Yerine her elementin
kendi yetenekleri geldi. Bu görevde **ateş** yazıldı; su, toprak ve hava sırayla Task 43-45'te gelecek (arayüzde "yakında").

## Puan kuralı

- Her karakter seviyesi (2'den itibaren) **2 puan** verir; 30. seviyede toplam **58** puan.
- Bir yeteneği **açmak 1 puan**, her seviye artışı **1 puan**; her yeteneğin **3 seviyesi** var (tam yetenek = 3 puan).
- Ateşte 5 yetenek = 15 puan. Diğer elementler 4'er yetenek = 12'şer puan; toplam 51. Taşıyıcı dalı (6 puan) aynen kaldı.
- Eski kayıttaki yetenekler tanınmadığı için atılır, harcanan puanlar otomatik iade olur (kayıt sürümü değişmedi).
- Kayıtta yetenek kimliği `<yetenek>-<seviye>` biçimindedir (örn. `fire-burn-2`); sunucu doğrulaması zaten `a-z0-9-` ve en çok 39 karakter kabul ediyor.

## Ateş yetenekleri (ilk sayılar, denge turunda ayarlanacak)

| Yetenek | Ne yapar | Sv 1 | Sv 2 | Sv 3 |
|---|---|---|---|---|
| **Közleyen Alev** | Ateş saldırısı rakibi tutuşturabilir; yanan rakip her döngü başında hasar yer, savaş bitene kadar sürer, birikmez | %15 / 6 hasar | %25 / 9 | %40 / 12 |
| **Kalkan Kıran** | Ateş saldırısı rakibin savunmasını kırabilir; kırılınca savunmanın %60'ı yok sayılır | %20 | %35 | %50 |
| **Alev Zinciri** | Art arda ateş saldırısı yapınca son vuruş güçlenir (önceki her ateş vuruşu için bonus, en çok 3 yığın) | +%8 | +%12 | +%16 |
| **Kıvılcım Saçması** | Büyünün bir kısmı savunmaya takılmadan geçer (ateş parçaları saçılır) | %15 | %25 | %35 |
| **Yanık İzi** (pasif) | Rakip saldırı çizerken ekranında kırmızı yara izleri belirir; dokunursa ekran kızarır ve 0.2 sn süre kaybeder | 1 iz | 2 iz | 3 iz |

Notlar:

- Közleyen Alev, Kalkan Kıran, Alev Zinciri ve Kıvılcım Saçması yalnızca **ateş saldırısında** işler. Yanık İzi pasiftir:
  hangi büyüyü seçersen seç, sen savunurken rakibin saldırı çizim ekranına yara izi koyar.
- Yaralar her zaman vardır (şansa bağlı değil); konumları her çizimde rastgeledir.
- **Botlar** yara izini görmez: her iz için %50 ihtimalle denk gelirler ve çizim süresinden 0.2 sn kaybederler.
- Kalkan kırma ve saçma aynı mekanizmayı kullanır (hasar hesabında `defenseBypass`): `1 − (1 − saçma) × (1 − kırıldıysa 0.6)`.
  Savunma hiç yapılamadıysa kalkan kırılmaz (zaten korunacak bir şey yok).
- Zar sırası: kritik, kalkan kırma, tutuşma. Zarlar yalnızca ilgili yetenek varsa atılır.
- Yanma hasarı döngü başında uygulanır ve savaşı bitirebilir; savaş ekranında savaşçının canının yanında 🔥 görünür.

## Kod

- `client/src/skills/catalog.ts`: yetenekler, seviye etkileri, Türkçe açıklamalar. `resolver.ts`: büyü etkileri ve pasifler (`resolvePassives`).
- `client/src/skills/tree.ts`: `SkillTree` seviye tabanlı (`level(id)`, `learn` hem açar hem seviye artırır, `passives`).
- `client/src/battle/flow/engine.ts`: savaşçıda `burn`, `fireChain`, `passives`; `ignite`, döngü başı yanma (`takeBurnEvents`).
- `client/src/battle/flow/controller.ts`: zincir, kalkan kırma, tutuşma, bot yara izi cezası; `BattleIO.announceBurn` ve `draw(..., extras)`.
- `client/src/battle/damage/calculate.ts`: `defenseBypass`.
- `client/src/ui/drawingCanvas.ts`: yara izleri (çizim, dokunma, kızarma, süre cezası). `ui/battleScreen.ts`: duyurular. `ui/skillTreeUi.ts`: kartlı arayüz.

# Esnaf isimleri ve yürürken asa (Task 61)

## Yeni esnaf isimleri

Türkçe isimler kalktı; her isim şehrin elementine uygun, fantastik bir isim. Roller Türkçe kalır (Tüccar, Asacı, Hancı).

| Şehir (element) | Tüccar | Asacı | Hancı |
|---|---|---|---|
| Ignis (ateş) | Ignatius | Cinderra | Embria |
| Abyss (hava) | Zephyron | Aelwyn | Nimbra |
| Stone Heart (toprak) | Granitus | Terravin | Obsidra |
| Still Crystal (su) | Marenus | Aquilla | Lirien |

Köy görev verenleri: Ash Kanyon: Bekçi **Cindrak**, Vine Surları: Muhtar **Zephrin**, Sisli Bataklık: Kılavuz **Mirelda**.
Hancılar şifacı olarak da çalışır: yenilince onların yanında ayılırsın (Task 55). Kimlikler (`tuccar-kazim` gibi) değişmedi, kayıtlar bozulmaz.
Görev açıklamalarındaki isimler de güncellendi.

## Yürürken asa

Asa artık karakterin dokusunun parçası değil, **ayrı bir sprite**: yürürken aşağı yukarı sallanır (±3 piksel) ve hafifçe yalpalar; dururken çok yavaş salınır.
Yürüme başlayıp bitince salınım yumuşakça açılıp kapanır (zıplama yok). Karakter sola bakınca asa soldaki ele geçer.

Kod: `economy/merchants.ts`, `quests/catalog.ts`, `world/textures.ts` (`STAFF_KEY`), `world/WorldScene.ts` (`placeStaff`).

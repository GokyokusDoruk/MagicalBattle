# Yetenek ağacı ve büyü sinerjisi

Kod: `client/src/skills/` (katalog, ağaç, çözücü), `client/src/ui/skillTreeUi.ts` (ekran).

## Oyunda nasıl çalışıyor

- **K tuşu** (ya da sol üstteki durum çubuğundaki **✦ Yetenekler** düğmesi) yetenek ağacını açar; Esc ya da dışarı tıklayınca kapanır. Açıkken karakter durur. Harcanmamış puan varsa düğmede yazar.
- Puan **karakter seviyesinden** gelir: 2. seviyeden itibaren **her seviye 2 puan** (30. seviyede toplam 58).
- Ağaçta **4 element × 3 dal × 3 kademe = 36 yetenek** var. Kademe bedeli: **Seviye 1 = 1 puan, Seviye 2 = 2 puan, Ustalık = 3 puan** (bir dal toplam 6, ağacın tamamı 72). 58 puan hepsine yetmediği için seçim yapmak gerekir.
- Bir dalda kademeler **sırayla** alınır (Seviye 1 → Seviye 2 → Ustalık).
- **Sıfırlama**: tüm puanlar geri gelir, bedeli **seviye başına 25 altın** (hiç yetenek yoksa bedava).

## Dallar

| Dal | Ne zaman işler | Ne verir |
|---|---|---|
| **Güç** | büyüyü **atarken** | verilen hasar, aceleyle çizilen büyünün gücü |
| **Hassasiyet** | büyüyü **atarken** | baş vuruşunu güçlendirir, rakibin zırhını deler |
| **Kalkan** | **savunurken** | alınan hasarı azaltır, yediği hasarın bir kısmını saldırana yansıtır |

Her dal **elementine** bağlıdır: Ateş yeteneği yalnızca ateş büyüsünü etkiler. Yani oyuncu hangi elementle saldırıyor/savunuyorsa o elementin yetenekleri işler (başka elementlerin yetenekleri o büyüye etki etmez).

### Elementin karakteri

| Element | Güç | Hassasiyet | Kalkan | Ek |
|---|---|---|---|---|
| Ateş | güçlü | normal | zayıf | Güç ustalığı zırhı biraz deler |
| Su | zayıf | normal | güçlü | Güç ustalığı **can çalar** (verdiği hasarın %8'i) |
| Toprak | zayıf | zayıf | **çok güçlü** | - |
| Hava | normal | güçlü | zayıf | Hassasiyet ustalığı aceleyle çizimi güçlendirir |

Yetenek adları ve tam etkiler oyunda ağaç ekranında yazar (katalog: `skills/catalog.ts`).

## Sinerji (tek büyü için uyum)

Bir elementin **üç dalında da en az Seviye 1** varsa o elementin büyüleri **uyum** kazanır:

- **Temel uyum:** saldırırken **+%4 verilen hasar**, savunurken **-%4 alınan hasar**
- **Tam uyum** (üç dal da Ustalık): toplam **+%10 / -%10**

Yani yeteneklerini tek elemente yığarsan o elementte çok güçlü olursun, ama rakip seni element üstünlüğüyle (ör. suyla ateşi) cezalandırabilir.

## Savaşta nasıl hesaplanır

Çözücü `skills/resolver.ts` içindeki `resolveSpell(sahip_olunanlar, element, rol)`. Bir savaşçı `spells` ile bir `SpellResolver` alır. Her turda iki kez çağrılır: saldıran için `(saldırı elementi, 'attack')`, savunan için `(savunma elementi, 'defense')`. Sonuç `SpellEffects`:

| Etki | Nereye bağlanır |
|---|---|
| `dealtMultiplier` | verilen hasar çarpanı (ekipman çarpanıyla çarpılır) |
| `takenMultiplier` | alınan hasar çarpanı (en çok -%60) |
| `armorPierce` | rakibin toplam zırhının yok sayılan kısmı (en çok %60) |
| `headBonus` | baş çarpanına eklenir (x1.5 → x1.6 gibi, en çok +0.6) |
| `effortBonus` | aceleyle çizimde güç tabanını yükseltir (%40 → %50 gibi, en çok +0.5) |
| `reflect` | savunanın yediği hasarın saldırana yansıyan kısmı (en çok %30) |
| `lifesteal` | verilen hasarın saldıranın canına dönen kısmı (en çok %30) |

Hepsi **genel** çarpandır; bölgesel değildir (baş vuruşu, mevcut kuraldaki gibi yalnızca savunulmayan kısım rakibin başına düşünce işler). Sıra: can çalma önce, yansıma sonra uygulanır; yansıma saldıranı yenebilir (savaş ekranında "yansımayla yenildi" yazar).

Hasar hesabının diğer adımları için bkz. [hasar-hesabi.md](hasar-hesabi.md).

## Kayıt

Kayıt dosyası **sürüm 3**: `skills` alanı eklendi (alınan yeteneklerin kimlikleri, ör. `["fire-power-1", "fire-power-2"]`). Sürüm 1 ve 2 kayıtlar açılırken boş yeteneklerle yükseltilir. Sunucu kimlik biçimini ve en çok 36 yetenek kuralını doğrular, tekrarları atar (bkz. [backend.md](backend.md)).

Yüklerken (`SkillTree.restore`) bilinmeyen kimlikler, kademe atlayanlar ve puanı aşanlar atılır; ucuz kademeler önce işlendiği için geçerli bir kayıt bire bir geri gelir. Yetenek alma/sıfırlama da diğer değişiklikler gibi **şehre girince** kaydedilir; o zamana kadar durum çubuğunda "● Kaydedilmedi" uyarısı çıkar.

## Denemek için

`?lab=battle` ekranında **Seviye** seçip (Sv 1/5/10/20/30) **✦ Yetenek ağacı** ile puanlarını dağıtabilir, sonra botlara karşı savaşabilirsin. Yetenekler "Sen"in büyülerine uygulanır. Denemede sıfırlama bedavadır.

## Ayarlar ve genişletme

- Yetenek etkilerini ve adlarını değiştirmek: `skills/catalog.ts` (şablon `TEMPLATE`, element karakteri `FLAVOR`, ek etkiler `EXTRAS`, adlar `NAMES`).
- Sınırlar ve sinerji değerleri: `skills/resolver.ts` (`LIMITS`, `SYNERGY`).
- Puan kuralı: `SP_PER_LEVEL`, `TIER_COST` (catalog.ts); sıfırlama bedeli `RESET_GOLD_PER_LEVEL` (tree.ts).
- Dünyadaki savaşlar (Task 19) gelince oyuncunun savaşçısına `spells: skillTree.resolver` verilecek; bu şu an yalnızca savaş denemesinde bağlı.

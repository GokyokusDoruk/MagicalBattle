# Çarpanlar ve asa pasifleri (Task 38)

Kod: `client/src/battle/damage/config.ts` (çarpanlar), `wands/catalog.ts` (`ELEMENT_MATCH`), `wands/passives.ts` (pasifler), `inventory/carry.ts` (kapasite çarpanı), `game.ts` (hız, can yenileme, düşme şansı bağlantıları), `ui/wandUi.ts` (pasif satırı).

## Çarpanlar (±%25)

| Kural | Eski | Yeni |
|---|---|---|
| Element üstünlüğü (saldıran üstün) | ×1.5 | **×1.25** |
| Element dezavantajı (savunan üstün) | ×0.5 | **×0.75** |
| Asa elementi = seçilen büyü elementi (yalnız saldırı hasarı) | ×1.5 | **×1.25** |

Ekipmanın element kuralı bunlardan bağımsızdır ([ekipman-v3.md](ekipman-v3.md)). Bir saldırı hem üstünlüğü hem asa eşleşmesini alırsa ikisi çarpılır (×1.25 × ×1.25 = ×1.56).

## Asa pasifleri

Kuşanılı asanın **elementi** oyuncuya pasif verir. Asa seviye şartını karşılıyorsa (kullanılabilirse) geçerlidir; nadirlik ve seviyeden bağımsızdır, bir elementin pasifi hep aynıdır.

| Asa | Pasif | Bağlantı |
|---|---|---|
| **Hava** | yürüme hızı **+%25** | ayakkabı ve şehir bonusuyla toplanır |
| **Su** | her saniye azami canın **%0.5**'i kadar can yenilenir | hareket etmek gerekmez; savaş, boss, maden ve sandık sırasında işlemez; kesirler birikir (can tam sayıdır) |
| **Ateş** | eşya düşme şansı **+%10** | ahlak yolu çarpanıyla çarpılır; düşman ganimeti ve sandıkta geçerli |
| **Toprak** | taşıma kapasitesi **+%25** | asa, eşya ve kuşanılabilir kapasitelerin toplamına uygulanır, aşağı yuvarlanır (3 asa → 3, 20 eşya → 25) |

Asa ekranında (W) kuşanılı asanın altında yeşil "Pasif: ..." satırı görünür; asanın seviyesi yetmiyorsa "(seviyen yetmiyor)" der.

## Boss dengesi

Çarpanlar düştüğü için hasar biraz azaldı; benzetimle (`boss/simulate.ts`) ölçülen hedef seviyedeki kazanma oranları: bölüm 1 %90, 2 %50, 3 %67, **4 %37**, 5 %37, 6 %60, 7 %93, 8 %60. Bölüm 4 (Soylu Şampiyonu) hedef seviyede %20'ye düştüğü için canı 540'tan 510'a, zırhı 0.35'ten 0.30'a indirildi. Genel denge turu Task 46'da.

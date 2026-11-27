# Hasar hesabı

Kod: `client/src/battle/damage/`. Saf TypeScript, ekrandan bağımsız; savaş akışı (Task 13) ve sunucu aynı kodu kullanabilir. Denemek için `?lab=draw` → "Saldırı & savunma": çizdikten sonra alttaki hasar panelinde her adımı görür, element, güç, skill ve zırh değerlerini değiştirip anında yeniden hesaplatabilirsin.

## Faz 3: "çok değil, doğru çiz"

Çizim tuvalinde artık **rakibin büyücü silüeti** görünür (savunurken kendi silüetin), `battle/damage/target.ts`.

- **Karartı:** silüet tek parça, kenarları bulanık bir gölgedir (rakip kırmızımsı, kendin mavimsi). Baş, şapka ve cüppe aynı gölgede
  erir; başın, kolların, ayakların tam yeri kestirilemez. Tuvalde hiçbir yazı yoktur. (Baş bölgesi hesapta yine vardır, ×1.25.)
- **Hacim sabit, yer değişir:** silüet her zaman aynı büyüklüktedir (`TARGET_SCALE` 1.2: tuval boyunun ~%80'i, tuvalin ~%20'si); kimse
  kendini küçültüp bir köşeye sıkıştıramaz. Silüet tuvalin dışına taşamaz (`POSITION_BOUNDS`).
- **Savunan yerini seçer:** her saldırıdan önce savunan, silüetini sürükleyip yerini seçer ("Yerini seç", 7 sn, `ui/positionPicker.ts`).
  Saldıran o yeri görür ve nişan alır. Botlar rastgele bir yer seçer. Seçim yapılmazsa (simülasyon) sıradaki duruş kullanılır (`targetPoseFor`).

## Adımlar

```
Hasar = Taban güç × Büyüklük × Süre × Şekil isabeti × Özel şekil × Karalama   (1) çizim gücü
        × Savunmadan geçen kısım                                              (2)
        × Silüete isabet (baş 1.25, gövde 1, sıyırma 0.2, ıska 0.1)            (3)
        × Element çarpanı                                                     (4)
        × Skill/ekipman çarpanları (× kritik 1.5)                             (5)
        × (1 − Toplam zırh)                                                   (6)
```

Sonuç yuvarlanır (tam sayı, en az 0). Yuvarlama yalnızca en sonda yapılır.

### 1) Çizim gücü
- **Büyüklük:** kaplanan alan / `FULL_POWER_COVERAGE` (**%7,5**), en fazla 1; altında sert düşer (üs 1,3). Silüetin gövdesini dolduran
  bir şekil (yarıçap ~50) neredeyse tam güç alır; yarıçap 40 → ~%64, yarıçap 30 → ~%43. **Az çizen tam güç alamaz.**
- **Süre:** `0,75 + 0,25 × (çizilen süre / tanınan süre)`. Acele etmek en çok %25 güç keser (eskiden %60). Süre artık önemli değil.
- **Şekil isabeti (yeni):** çizim o turun özel şekline ne kadar benziyorsa (`shapeMatch` uzaklığı) güç o kadar tam:
  uzaklık ≤ 0,07 → ×1; ≥ 0,22 → **×0,6**; arası doğrusal. Şekli hiç andırmayan bir karalama en çok %60 güç verir.
- **Özel şekil tuttu:** uzaklık eşiğin (0,115) altındaysa ayrıca **×1,5** (eskiden ×1,25 yazıyordu ama hesaba hiç girmiyordu; düzeltildi).
- **Karalama:** aynı yerlerin üstünden defalarca geçmek (çizgi uzunluğuna göre küçük alan) gücü **×0,45'e kadar** keser (eskiden 0,6).
  Bir noktada beklemek de ağırlık yığmaz (`WEIGHT_CAP_MULTIPLE`). "Dağılım" cezası kalktı: silüet küçük olabilir, oraya toplu çizmek doğrudur.

Örnek çizim gücü (taban 100, tam süre):

| Çizim | Büyüklük | Şekil | Özel | Güç |
|---|---|---|---|---|
| Özel şekil, gövdeyi dolduruyor, kusursuz | 1 | 1 | ×1,5 | **150** |
| Özel şekil, biraz yamuk (uzaklık 0,1) | 1 | 0,92 | ×1,5 | 138 |
| Rastgele başka bir şekil, aynı büyüklükte | 1 | 0,6 | ×1 | 60 |
| Özel şekil ama küçük (yarıçap 30) | 0,43 | 1 | ×1,5 | 64 |
| Tuvali karalayarak doldurmak | 1 | 0,6 | ×1 | ×0,45 → 27 (silüet dışı da ıska) |

### 2) Savunma
Savunmanın kapatamadığı kısım (Task 10) hasar verir; kapatılan kısım hiç vurmaz. Savunan da kendi silüetini görür: saldırının oraya
geleceğini bilir. Kolay seviyede saldırının çizgileri ayrıca soluk görünür (Faz 2).

### 3) Silüete isabet (yeni)
Savunmayı geçen kısmın her hücresi silüete göre çarpılır:

| Nereye düştü | Çarpan |
|---|---|
| Baş (baş ve şapka) | **×1,25** (+ yeteneklerden baş bonusu) |
| Gövde (cüppe) | ×1 |
| Sıyırma (silüet kenarına tuvalin ~%6'sı kadar yakın) | **×0,2** |
| Iska (daha uzak) | **×0,1** |

Yani büyük çizip silüetin dışına taşmak boşa gider; silüetin üstüne doğru şekli çizmek en çok hasarı verir.

### 4) Element
Döngü: **Ateş < Su < Toprak < Hava < Ateş**. Üstün ×1,25, zayıf ×0,75, etkisiz ×1 (`ELEMENT_ADVANTAGE`, `ELEMENT_DISADVANTAGE`).

### 5) Skill, ekipman ve kritik
Verilen ve alınan hasar çarpanları genel olarak çarpılır; kritik vuruş ×1,5.

### 6) Zırh
Savunanın toplam zırhı tek bir hasar azaltma yüzdesidir. Üst sınır **%75** (`ARMOR_CAP`).

## Detay ekranı
"Detay" düğmesi hesabı adım adım yazar: *Büyü gücü (büyüklük ve süre) → Şekil isabeti ×0,8 → Özel şekil tuttu ×1,5 → Karalama →
Savunmayı geçen %60 → Silüete isabet (baş %20, gövde %60, sıyırma %10, ıska %10) ×1,01 → element → ekipman → zırh → Hasar*.

## Denge
Botlar da silüete nişan alır (beceri düştükçe nişan hatası artar) ve savunurken kendi silüetini korur. Denge vekili buna göre ayarlandı;
dünya düşmanı ve boss hedefleri aynı kaldı. Silüet büyüyünce vurmak kolaylaştı; bazı boss canları yeniden ayarlandı:
General Vael 250 → 470 (güç 115 → 135), Soylu Şampiyonu 624 → 700, General Kaelen 718 → 880, Cadı Morga 730 → 570 (sisli savunma zorlaştı),
Malakor 1322 → 1720, Gölge 591 → 680.

## Ayarlar
`client/src/battle/damage/config.ts` (tam güç alanı, süre tabanı, şekil isabeti ve özel şekil, element, zırh) ve `client/src/battle/damage/target.ts` (silüet duruşları, bölge çarpanları, sıyırma mesafesi).

## Sonra gelecekler
- **Taban güç** asadan gelir (Task 17, bkz. [asalar.md](asalar.md)): saldırı asası taban gücü, savunma asası alınan hasarı çarpar. Skill çarpanları yetenek ağacından gelir (Task 16, bkz. [yetenek-agaci.md](yetenek-agaci.md)): verilen/alınan hasar çarpanı genel çarpana katılır; ayrıca zırh delme (`attackerArmorPierce`), baş bonusu (`attackerHeadBonus`) ve çaba tabanı (`attackerEffortBonus`) hesaba girer. Yansıma ve can çalma hasar hesabından sonra, savaş akışında uygulanır.
- **Savaş akışı** (Task 13) bu hesabı sırayla çağıracak, can düşecek ve ölüm işlenecek.

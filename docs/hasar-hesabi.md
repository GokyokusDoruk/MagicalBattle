# Hasar hesabı

Kod: `client/src/battle/damage/`. Saf TypeScript, ekrandan bağımsız; savaş akışı (Task 13) ve sunucu aynı kodu kullanabilir. Denemek için `?lab=draw` → "Saldırı & savunma": çizdikten sonra alttaki hasar panelinde her adımı görür, element, güç, skill ve zırh değerlerini değiştirip anında yeniden hesaplatabilirsin.

## Adımlar

```
Hasar = Taban güç × Çizim gücü                     (1)
        × Savunmadan geçen kısım, baş bölgesi ×1.5  (2)
        × Element çarpanı                           (3)
        × Skill/ekipman çarpanları                  (4)
        × (1 − Toplam zırh)                         (5)
```

Sonuç yuvarlanır (tam sayı, en az 0). Yuvarlama yalnızca en sonda yapılır.

### 1) Çizim gücü
Büyüklük ve çizime harcanan süre birlikte güç belirler:
- **Boyut:** kaplanan alan / `FULL_POWER_COVERAGE` (varsayılan %18), en fazla 1. Daha büyük çizim fazladan güç vermez.
- **Efor:** `0.4 + 0.6 × (çizilen süre / 3 sn)`. Aceleyle çizilen büyü en kötü %40 güçte kalır, 3 saniyeyi dolduran tam güç alır.
- `Çizim gücü = boyut × efor` (0 ile 1 arası).

| Çizim | Güç |
|---|---|
| Daire (yarıçap 70), 2,8 sn | 0,75 |
| Aynı daire, 1 sn | 0,47 |
| Aynı daire, 0,2 sn | 0,34 |
| Daire (yarıçap 40), 2,8 sn | 0,40 |
| Uzun düz çizgi, 2,5 sn | 0,29 |

### 2) Savunma ve bölge
Savunmanın kapatamadığı kısım (Task 10) hasar verir. Bu kısmın **rakibin başına düşen** parçası (tuvalin üstten %30'u) **×1.5** vurur, gövdeye düşen ×1.0. Savunulan kısım hiç vurmaz. Tuvalde baş bölgesi kesikli çizgi ve "BAŞ ×1.5" yazısıyla gösterilir.

### 3) Element
Döngü: **Ateş < Su < Toprak < Hava < Ateş** (su ateşi, toprak suyu, hava toprağı, ateş havayı yener).

| | Çarpan |
|---|---|
| Saldıran üstün | ×1.5 |
| Savunan üstün | ×0.5 |
| Etkisiz (ateş–toprak, su–hava, aynı element) | ×1.0 |

Element seçimi kör ve eşzamanlıdır (iki oyuncu da gizlice seçer, sonra açılır). Savunanın elementi, kullandığı savunma asasından gelir.

### 4) Skill ve ekipman
Genel çarpanlardır, bölgeye bağlı değildir:
- Saldıranın **verilen hasar** çarpanı (örn. +%20 → ×1.2)
- Savunanın **alınan hasar** çarpanı (örn. −%10 → ×0.9)

### 5) Zırh
Savunanın **toplam zırhı** tek bir hasar azaltma yüzdesidir. Baş/gövde ayrımı yoktur. Üst sınır **%75** (`ARMOR_CAP`).

## Örnek (lab'dan)
Daire (yarıçap 70) saldırı, savunma yok, taban güç 100:
- Güç ×0,85 → **85,2**
- Savunmadan %100 geçti, %39'u başa düştü → ×1,19 → **101,6**
- Ateş → Su (dezavantaj) ×0,5 → **50,8**
- Verilen hasar +%20 → **61,0**
- Zırh %50 → **30,5** → **Hasar: 30**

## Ayarlar
Hepsi `client/src/battle/damage/config.ts`: baş bölgesi büyüklüğü, baş çarpanı, element çarpanları, zırh üst sınırı, tam güç için alan oranı ve en düşük efor çarpanı.

## Sonra gelecekler
- **Taban güç** asadan gelecek (Task 17). Skill çarpanları yetenek ağacından gelir (Task 16, bkz. [yetenek-agaci.md](yetenek-agaci.md)): verilen/alınan hasar çarpanı genel çarpana katılır; ayrıca zırh delme (`attackerArmorPierce`), baş bonusu (`attackerHeadBonus`) ve çaba tabanı (`attackerEffortBonus`) hesaba girer. Yansıma ve can çalma hasar hesabından sonra, savaş akışında uygulanır.
- **Savaş akışı** (Task 13) bu hesabı sırayla çağıracak, can düşecek ve ölüm işlenecek.

# MagicalBattle

dorukplays.com oyunu. Canlı adres: **https://magicalbattle.dorukplays.com** (henüz yayında değil).

## Yayın
Diğer oyunlar gibi **Cloudflare Pages** bu depoya bağlanacak; `main`'e birleşen her değişiklik siteyi kendiliğinden günceller.

Bir kerelik kurulum:
1. Cloudflare → Workers & Pages → *Create* → *Pages* → *Connect to Git* → `GokyokusDoruk/MagicalBattle`, üretim dalı `main`.
2. Derleme ayarları oyunun yapısına göre (şimdilik derleme yok, çıktı klasörü deponun kökü).
3. Pages projesi → *Custom domains* → `magicalbattle.dorukplays.com`.
4. Yayına girince `dorukplays` deposunda MagicalBattle kartını `<a class="game" href="https://magicalbattle.dorukplays.com">` yap.

## Yerelde bakmak
```powershell
python -m http.server 8090
```

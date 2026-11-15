# Asalar penceresi (Task 59)

Sade yeni tasarım (Q):

- Üstte tek satır not: "Asanın seviyesi senin seviyenden (N) büyük olamaz."
- **Kuşanılan asa:** tek satırlık kart (asa adı solda, **seviye sağda**) ve altında yeşil pasif satırı. "Çıkar" düğmesi kartın sağında.
- **Sahip olduğun diğer asalar:** aynı biçimde satırlar; adet birden fazlaysa "×2". "Kuşan" düğmesi sağda; seviyesi yetmeyen asanın seviyesi kırmızıdır, soluktur, düğmesi kapalıdır.
- Uzun açıklama satırları kalktı; ayrıntı (çarpanlar, süre) satırın üstüne gelince ipucu olarak görünür.

## Renkler

- **Yazı rengi elementi belirler:** ateş kırmızı, su mavi, hava beyaz, toprak kahverengi.
- **Arka fon okunurluğa göre:** ateş koyu bordo, su koyu lacivert, hava koyu gri; **toprak asaları açık krem fonda** (kahverengi koyu fonda okunmaz).
- **Çerçeve nadirlik rengindedir** (Sıradan gri, Gelişmiş yeşil, Nadir mavi, Destansı mor, Efsanevi altın, Mistik pembe); Destansı ve üstünde hafif parıltı.

Kod: `ui/wandUi.ts` (`WAND_TEXT`, `rowHtml`, `render`).

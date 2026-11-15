# Ekipman seviye uyarısı (Task 65)

Çantada seviyesi seninkinden yüksek bir ekipman varsa satırın altında kırmızı bir uyarı çıkar:
**"⚠ Yetersiz seviye: 7. seviye gerekir (sende 1)"** ve **Kuşan** düğmesi soluk ve kapalı olur (üzerine gelince "Yetersiz seviye" yazar).
Seviyen yetince uyarı kendiliğinden kalkar ve düğme açılır. Başka bir yoldan kuşanmaya çalışılırsa üstteki mesaj da artık
"Yetersiz seviye: bu eşya 7. seviye ister (şu an 1)." der.

Kod: `ui/bagUi.ts` (`tooHigh`, satır uyarısı), `economy/player.ts` (engel nedeni).

# Ganimet ekranı (Task 57)

Zaferden sonra **açık dünyaya dönmeden**, savaş ekranının üstünde bir panel açılır: **🎁 Ganimetler toplandı**.

- Başlık altında "Köz Cini yenildi".
- **+para (bölgenin birimi) ve +XP**.
- Seviye atladıysan altın şeritte "Seviye atladın! Seviye N · yetenek puanın: X (K)".
- Çantaya giren **eşyalar** ikonuyla (elementin rengi, nadirliğin süsü) ve **nadirlik renginde** adıyla, seviyesi ve adediyle; ticari mallar da burada.
- **Asalar** elementinin rengindeki noktayla, nadirlik renginde adı ve seviyesiyle.
- Hiçbir şey düşmediyse "Bu sefer eşya düşmedi."
- Çanta dolduysa "Çantan dolu: N parça yere düştü, 10 dakika içinde alabilirsin."
- **Devam**'a basınca dünyaya dönersin. Eski kısa bildirim yazıları (toast) kalktı.

Aynı panel **korumalı sandık** açılınca ("Sandık açıldı") ve maden/sandık muhafızı zaferlerinde de çıkar.

Kod: `ui/lootPanel.ts` (panel), `ui/worldFight.ts` (`onWon`: zaferde, savaş ekranı kapanmadan çağrılır), `game.ts` (`fightSpot`, `lootView`, sandık).

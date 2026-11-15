# Köy görev verenleri ve yeni yan görevler (Task 47)

Köylerde han yoktur; her köye yalnızca **yan görev veren bir kişi** eklendi. Şehir hanlarına da küçük görevler eklendi.
Görev verenin yanına gidip konuşunca tek sekmeli bir "Görevler" paneli açılır (han paneli gibi; iksir/dinlenme yok).

| Köy | Görev veren | Ödül birimi | Görevler |
|---|---|---|---|
| Ash Kanyon (sv 2+) | Kanyon Bekçisi Cindrak | Kor | Kanyon Nöbeti (2 savaş), Baharat Çuvalı (3 Kor Baharatı → Abyss), Kanyondaki Sandık (1 korumalı sandık) |
| Vine Surları (sv 4+) | Muhtar Zephrin | Tüy | Yol Güvenliği (3 savaş), İpek Siparişi (3 Bulut İpeği → Stone Heart), Sarmaşık Madeni (1 maden) |
| Sisli Bataklık (sv 6+) | Bataklık Kılavuzu Mirelda | Tunç | Sis Avı (4 savaş), Cevher Siparişi (3 Taş Cevheri → Still Crystal), Batık Sandık (1 korumalı sandık) |

Şehir hanlarına eklenen görevler: Ignis: Ash Kanyon'a Selam; Abyss: İpek Sevkiyatı (4 Bulut İpeği → Ignis); Stone Heart: Sur Nöbeti (4 savaş);
Still Crystal: Bataklığa Haber. Her şehirde artık 3-4, her köyde 3 görev var.

Kurallar:

- Köy görevleri küçüktür (60-140 para, 45-110 XP). Ödül, köyün **ilk elementinin** para biriminde ödenir; iki elementli köylerde artık rastgele değil
  (`questCurrency`), böylece görev kartındaki ödül ile ödenen birim aynıdır.
- Görevler de görev günlüğüne, takibe ve yönlendirme okuna girer; ödül hedef bitince kendiliğinden gelir.
- Köy görev vereni köy alanında, merkezin 2-3 karo yanında durur (yürünebilir karoda).

Kod: `economy/merchants.ts` (`questgiver` türü), `world/merchantSpots.ts`, `ui/merchantUi.ts`, `quests/catalog.ts`, `economy/currency.ts` (`questCurrency`).

Ayrıca: boss simülasyonundaki zarlar artık tohumlu (`random: rand`); denge testi kararlı.

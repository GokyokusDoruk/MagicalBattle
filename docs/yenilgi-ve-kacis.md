# Yenilgi, kaçış ve doğrudan savaş (Task 55)

## Savaş öncesi panel kalktı

Düşmana yaklaşınca **savaş hemen başlar**; "Savaş / Kaç / Rüşvet ver" paneli yok. Savaşın başında ortada kısa bir not görünür:
düşmanın adı, elementi, seviyesi, yetenekleri ve (sabit düşmanda) "Kazanırsan: ... ganimet" satırı.

## Savaşın içinde Kaç ve Rüşvet

Sol altta iki düğme durur (savaş sürerken, element seçerken ve çizerken de):

- **🏃 Kaç:** savaştan çıkarsın, düşman yerinde kalır.
- **💰 Rüşvet (N birim):** bedel bulunduğun bölgenin parasından ödenir (para yetmiyorsa düğme kapalı); düşman çekilir (eskisi gibi bir süre sonra geri gelir).

Düğmeler yalnızca **sabit düşmanlarda** çıkar. **Çalılık karşılaşması, maden, sandık muhafızı ve boss savaşında** çıkış yoktur: doğrudan savaşılır.

## Yenilgi

- "Tekrar dene" yok (düşman, maden, sandık, boss hepsinde). Yenilince tek düğme "Devam" olur ve ölüm akışı başlar.
- **Ölüm:** bulunduğun bölgenin parasından seviyene göre bir kısım kaybolur (%5 + seviye×%1, en çok %25), canın dolar.
- **Şehirde doğarsın:** en yakın şehrin kapısının önünde, hancının yanında ayılırsın (eskiden köy şifacısı). Şifacılar artık şehir hancılarıdır (Embria, Nimbra, Obsidra, Lirien).

Kod: `ui/worldFight.ts` (panel kalktı, `WorldFightOptions`), `ui/battleScreen.ts` (`escape`, `escaped`, `intro`, `noAgain`), `ui/bossFight.ts`, `economy/death.ts`, `game.ts`.

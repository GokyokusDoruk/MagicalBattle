# Bölge savaşları (Task 29)

Açık zeminde yürürken her **yeni karoya** girdiğinde **%10 şansla** düşman çıkar ("Yolda ... çıktı!"). Savaş paneli dünya düşmanlarıyla aynıdır ([dunya-dusmanlari.md](dunya-dusmanlari.md)): Savaş ya da Kaç; zaferde aynı ganimet.

- **Koruma:** her savaştan sonra (zafer, kaçış, ölüm) **5 saniye** karşılaşma olmaz.
- **Güvenli yerler:** yollar, şehirlerin ve köylerin alanı, su, orman ve duvarlar. Yalnızca çimen ve kumsalda karşılaşma olur.
- **Element zemine göre** (`enemies/zones.ts`):

| Zemin | Düşman elementi |
|---|---|
| Kumsal (su kenarı) | Su |
| Ignis çevresi çimen (köz), 18 karoya kadar | Ateş |
| Abyss çevresi çimen (rüzgâr) | Hava |
| Still Crystal çevresi çimen | Su |
| Stone Heart çevresi ve diğer yeşillik | Toprak |

- **Kademe** düşman yerleşimindeki gibi başlangıca uzaklığa göre belirlenir.
- Haritada yaklaşık 3900 karo uygundur: toprak 2407, su 757, hava 460, ateş 308.
- Karşılaşma düşmanı tek kullanımlıktır (haritada sabit yeri yoktur, geri gelme süresi yok).

Kod: `enemies/zones.ts` (`zoneElementAt`, `EncounterGuard`, `zoneEncounter`), `world/WorldScene.ts` (`onTileEnter`), `game.ts` (`fightSpot`).

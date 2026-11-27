# Bitiriş (Faz 5)

Eski uzun bitiriş sahnesi (ışık sütunu, mühür) kaldırıldı. Artık son büyü de **her zamanki gibi** oynar:

1. Büyü fırlar, kamera onunla ilerler.
2. Savunmaya çarpan kısmı saçılıp söner, kalanı rakibe gider.
3. Çarptığı an rakip **arkaya devrilip yere yığılır** (`Combatant.defeat('backward')`), zaman bir an yavaşlar, yer tozu kalkar.
4. İnsan tarafı kazandıysa ekranda büyük **"KAZANDIN!"** yazısı belirir; sonra zafer ekranı gelir.

Kod: `client/src/battle/arena/arenaView.ts` (`impact`, `fatal`), `client/src/battle/arena/combatant.ts`, `client/src/ui/battleScreen.ts` (`showVictoryBanner`).

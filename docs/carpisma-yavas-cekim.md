# Çarpışma yavaş çekimi (Task 54)

Savunma varken saldırı ve savunma büyüsü artık **arenanın tam ortasında, aynı noktada ve aynı boyda** buluşur:

1. Saldırı büyüsü fırlarken savunma kalkanı da ortaya ilerler (iki büyü aynı anda hareket eder).
2. Çarpışmaya yaklaşırken zaman yavaşlamaya başlar (uçuşun son %40'ında hız ×1 → ×0.35).
3. Çarpışmada zaman ×0.09'a düşer (~3.5 sn), kamera yandan yaklaşıp çarpışma noktasına bakar; iki büyü üst üste biner, hafif titreşir ve kıvılcımlar saçar.
   Eskiden ×0.2 ve ~1.6 sn idi.
4. Sonra vuruş efektleri ve sonuç ekranı (Task 51) gelir.

Savunma yapılamadıysa eski, kısa yavaş çekim aynen sürer (büyü hedefe gider).

Kod: `battle/arena/arenaView.ts` (`castSpell`). Tarayıcıda arena laboratuvarında ("Tam savunma") iki mührün çakıştığı görüldü.

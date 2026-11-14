import type { QuestDef } from './catalog';

/**
 * Testler için sabit görev kataloğu (eski yan görevlerin ticari mallarla yazılmış hali). Gerçek katalog değişince
 * (Task 37) motor testleri bundan etkilenmesin diye ayrı tutulur; oyunda kullanılmaz.
 */
export const TEST_QUESTS: readonly QuestDef[] = [
  { id: 'ash-ot-toplama', title: 'Mal Toplama', giver: 'ignis', description: 'Beş taş cevheri topla; ödülün yoluna düşecek.', objective: { type: 'collect', itemId: 'tas-cevheri', count: 5 }, reward: { money: 60, xp: 40 } },
  { id: 'ash-ignis-yolu', title: "Ignis'in Surlarını Gör", giver: 'abyss', description: "Surların içine gir, gözünle gör ki köy haberi öğrensin.", objective: { type: 'visit', locationId: 'ignis' }, reward: { money: 90, xp: 60, items: [{ id: 'kor-baharati', count: 2 }] } },
  { id: 'vine-kristal-avi', title: 'İnci Avı', giver: 'abyss', description: 'Üç derin inci bulursan iyi para ederim.', objective: { type: 'collect', itemId: 'derin-inci', count: 3 }, reward: { money: 120, xp: 70 } },
  { id: 'vine-abyss-haberi', title: 'Tapınağın Sessizliği', giver: 'ignis', description: 'Abyss tapınağının kapısından geçip bir kez gör.', objective: { type: 'visit', locationId: 'abyss' }, minLevel: 2, reward: { money: 150, xp: 90, items: [{ id: 'bulut-ipegi', count: 1 }] } },
  { id: 'marsh-ot-sepeti', title: 'Büyük Sepet', giver: 'stone-heart', description: 'Sekiz taş cevheri topla; ödülün yoluna düşecek.', objective: { type: 'collect', itemId: 'tas-cevheri', count: 8 }, minLevel: 2, reward: { money: 100, xp: 80, items: [{ id: 'kor-baharati', count: 2 }] } },
  { id: 'marsh-kristal-sehri', title: 'Kristalin Şehri', giver: 'stone-heart', description: "Su altındaki Still Crystal'ı bir kez gör, sonra bize de anlat.", objective: { type: 'visit', locationId: 'still-crystal' }, minLevel: 3, reward: { money: 220, xp: 140 } },
];

export type Objective =
  /** `count` adet toplanınca tamamlanır. Kabul anında çantadakiler sayılır; eşyayı sonradan satmak ilerlemeyi geri almaz. */
  | { type: 'collect'; itemId: string; count: number }
  /** Konuma varınca tamamlanır (şehirde surların içine, köyde köy alanına) */
  | { type: 'visit'; locationId: string }
  /** Savaş kazanılınca (savaşlar dünyaya bağlanınca, Task 19) */
  | { type: 'battleWon'; count: number };

export interface QuestReward {
  gold: number;
  xp: number;
  items?: { id: string; count: number }[];
}

export interface QuestDef {
  id: string;
  title: string;
  /** Görevi veren tüccarın köyü */
  giver: string;
  /** Metin tabanlı görev anlatımı */
  description: string;
  objective: Objective;
  minLevel?: number;
  reward: QuestReward;
}

/**
 * Yan görevler: tüccarın "Görevler" sekmesinden kabul edilir. Hedef bitince ödül (altın, XP, eşya)
 * **kendiliğinden** envantere yatar, geri dönüp teslim etmek gerekmez.
 */
export const SIDE_QUESTS: readonly QuestDef[] = [
  {
    id: 'ash-ot-toplama',
    title: 'Şifalı Ot Toplama',
    giver: 'ash',
    description:
      'Ambargodan beri köyde ilaç yapacak ot kalmadı. Yolların kenarında biten şifalı otlardan beş tane topla, geri dönmene gerek yok, ödülün yoluna düşecek.',
    objective: { type: 'collect', itemId: 'sifali-ot', count: 5 },
    reward: { gold: 60, xp: 40 },
  },
  {
    id: 'ash-ignis-yolu',
    title: "Ignis'in Surlarını Gör",
    giver: 'ash',
    description:
      "Kervancılar Ignis'in kapılarının açıldığını söylüyor ama kimse inanmıyor. Surların içine gir, gözünle gör ki köy haberi öğrensin.",
    objective: { type: 'visit', locationId: 'ignis' },
    reward: { gold: 90, xp: 60, items: [{ id: 'ates-tozu', count: 2 }] },
  },
  {
    id: 'vine-kristal-avi',
    title: 'Kristal Avı',
    giver: 'vine',
    description:
      'Kumsallarda ışık saçan kristal parçaları çıkıyor. Soylular için süs yapacağım, üç tane bulursan iyi para ederim.',
    objective: { type: 'collect', itemId: 'kristal-parcasi', count: 3 },
    reward: { gold: 120, xp: 70 },
  },
  {
    id: 'vine-abyss-haberi',
    title: 'Tapınağın Sessizliği',
    giver: 'vine',
    description:
      "Abyss Tapınağı'ndan haber alınamıyor. İçeri girebilirsen köyün büyükleri rahatlayacak.",
    objective: { type: 'visit', locationId: 'abyss' },
    minLevel: 2,
    reward: { gold: 150, xp: 90, items: [{ id: 'kurt-postu', count: 1 }] },
  },
  {
    id: 'marsh-ot-sepeti',
    title: 'Sis Otları Sepeti',
    giver: 'marsh',
    description:
      'Bataklığın şifacısı sekiz tane taze ot istiyor. Sisin içinde yol bulmak zor ama otlar yolların kenarında.',
    objective: { type: 'collect', itemId: 'sifali-ot', count: 8 },
    minLevel: 2,
    reward: { gold: 100, xp: 80, items: [{ id: 'ates-tozu', count: 2 }] },
  },
  {
    id: 'marsh-kristal-sehri',
    title: 'Kristalin Şehri',
    giver: 'marsh',
    description: "Su altındaki Still Crystal'ın efsanesi anlatılır durur. Sur kapısından geçip bir kez gör, sonra bize de anlat.",
    objective: { type: 'visit', locationId: 'still-crystal' },
    minLevel: 3,
    reward: { gold: 220, xp: 140 },
  },
];

export function getQuest(id: string): QuestDef | undefined {
  return SIDE_QUESTS.find((q) => q.id === id);
}

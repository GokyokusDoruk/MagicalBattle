export type Objective =
  /** `count` adet toplanınca tamamlanır. Kabul anında çantadakiler sayılır; eşyayı sonradan satmak ilerlemeyi geri almaz. */
  | { type: 'collect'; itemId: string; count: number }
  /** Konuma varınca tamamlanır (şehirde surların içine, köyde köy alanına) */
  | { type: 'visit'; locationId: string }
  /** Savaş kazanılınca (düşman, bölge savaşı, maden ya da sandık muhafızı) */
  | { type: 'battleWon'; count: number }
  /** Bir maden tamamen temizlenince (3 düşman da yenilince) */
  | { type: 'mine'; count: number }
  /** Korumalı sandık açılınca */
  | { type: 'chest'; count: number }
  /** Teslimat: `count` adet malı `locationId` şehrine götür. Mal çantandan alınır; oraya varınca (yeterince taşıyorsan) görev biter. */
  | { type: 'deliver'; itemId: string; count: number; locationId: string };

export interface QuestReward {
  money: number;
  xp: number;
  items?: { id: string; count: number }[];
}

export interface QuestDef {
  id: string;
  title: string;
  /** Görevi veren tüccarın şehri (Task 27: görevler şehir hanlarında verilir) */
  giver: string;
  /** Metin tabanlı görev anlatımı */
  description: string;
  objective: Objective;
  minLevel?: number;
  reward: QuestReward;
}

/**
 * Yan görevler: hancının "Görevler" sekmesinden kabul edilir. Hedef bitince ödül (para, XP, eşya)
 * **kendiliğinden** envantere yatar, geri dönüp teslim etmek gerekmez.
 */
export const SIDE_QUESTS: readonly QuestDef[] = [
  // --- Ignis (Kor) ---
  {
    id: 'ignis-kor-avi',
    title: 'Köz Avı',
    giver: 'ignis',
    description: 'Surların dışındaki köz yaratıkları kervanlarımızı yoluyor. Yolda ya da çalılıklarda karşına çıkan üç düşmanı yen, ödülün yoluna düşecek.',
    objective: { type: 'battleWon', count: 3 },
    reward: { money: 90, xp: 60 },
  },
  {
    id: 'ignis-baharat-teslimat',
    title: 'Baharat Sevkiyatı',
    giver: 'ignis',
    description: "Abyss'in rahipleri Kor Baharatı bekliyor. Ignis'te ucuza satılan baharattan 5 tane al, Abyss Tapınağı'na götür. Kapı kilitliyse önce ana görevi yap.",
    objective: { type: 'deliver', itemId: 'kor-baharati', count: 5, locationId: 'abyss' },
    minLevel: 2,
    reward: { money: 160, xp: 90 },
  },
  // --- Abyss (Tüy) ---
  {
    id: 'abyss-ignis-yolu',
    title: "Ignis'in Surlarını Gör",
    giver: 'abyss',
    description: "Kervancılar Ignis'in kapılarının açıldığını söylüyor ama kimse inanmıyor. Surların içine gir, gözünle gör ki köy haberi öğrensin.",
    objective: { type: 'visit', locationId: 'ignis' },
    reward: { money: 90, xp: 60 },
  },
  {
    id: 'abyss-sandik',
    title: 'Muhafızlı Sandık',
    giver: 'abyss',
    description: 'Rüzgârlı yamaçlarda eski kervanlardan kalma, bekçilerle korunan sandıklar var. Bir tanesini aç; içindekileri sen al.',
    objective: { type: 'chest', count: 1 },
    minLevel: 3,
    reward: { money: 150, xp: 100 },
  },
  // --- Stone Heart (Tunç) ---
  {
    id: 'stone-maden',
    title: 'Madeni Temizle',
    giver: 'stone-heart',
    description: 'Kalenin çevresindeki madenlere yaratıklar yerleşti, cevher çıkaramıyoruz. Bir madenin üç bekçisini de yen ve madeni temizle.',
    objective: { type: 'mine', count: 1 },
    minLevel: 3,
    reward: { money: 220, xp: 140 },
  },
  {
    id: 'stone-cevher-teslimat',
    title: 'Cevher Sevkiyatı',
    giver: 'stone-heart',
    description: "Still Crystal'ın demircileri Taş Cevheri istiyor. Kalede ucuza satılan cevherden 4 tane al, Still Crystal'a götür.",
    objective: { type: 'deliver', itemId: 'tas-cevheri', count: 4, locationId: 'still-crystal' },
    minLevel: 3,
    reward: { money: 190, xp: 110 },
  },
  // --- Still Crystal (Çiy) ---
  {
    id: 'crystal-dalga-avi',
    title: 'Dalga Avı',
    giver: 'still-crystal',
    description: 'Sahildeki yaratıklar dalgıçlarımızı korkutuyor. Üç düşmanı yen, ödülün yoluna düşecek.',
    objective: { type: 'battleWon', count: 3 },
    minLevel: 3,
    reward: { money: 150, xp: 120, items: [{ id: 'iksir-orta', count: 1 }] },
  },
  {
    id: 'crystal-inci-teslimat',
    title: 'İnci Sevkiyatı',
    giver: 'still-crystal',
    description: "Stone Heart'ın kuyumcuları Derin İnci arıyor. Still Crystal'ın dalgıçlarından 3 inci al, Stone Heart Kalesi'ne götür.",
    objective: { type: 'deliver', itemId: 'derin-inci', count: 3, locationId: 'stone-heart' },
    minLevel: 2,
    reward: { money: 170, xp: 100 },
  },
  {
    id: 'crystal-tas-haberi',
    title: "Stone Heart'a Haber",
    giver: 'still-crystal',
    description: "Derin incilerimizi satacak yeni alıcı arıyoruz. Stone Heart Kalesi'ne git, surların içine gir.",
    objective: { type: 'visit', locationId: 'stone-heart' },
    minLevel: 2,
    reward: { money: 130, xp: 90 },
  },
];

export function getQuest(id: string): QuestDef | undefined {
  return SIDE_QUESTS.find((q) => q.id === id);
}

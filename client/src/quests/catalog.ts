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
  /** Görevi veren konum: şehirde han, köyde görev veren kişi (Task 47) */
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
  {
    id: 'ignis-ash-haberi',
    title: "Ash Kanyon'a Selam",
    giver: 'ignis',
    description: "Doğudaki Ash Kanyon'un bekçisi Dara kervanlardan haber bekliyor. Köye var, ona Ignis'in selamını götür.",
    objective: { type: 'visit', locationId: 'ash' },
    reward: { money: 70, xp: 50 },
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
  {
    id: 'abyss-ipek-teslimat',
    title: 'İpek Sevkiyatı',
    giver: 'abyss',
    description: "Ignis'in terzileri Bulut İpeği istiyor. Abyss'in dokumacılarından 4 ipek al, Ignis Surları'na götür.",
    objective: { type: 'deliver', itemId: 'bulut-ipegi', count: 4, locationId: 'ignis' },
    minLevel: 2,
    reward: { money: 140, xp: 90 },
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
  {
    id: 'stone-kalkan-avi',
    title: 'Sur Nöbeti',
    giver: 'stone-heart',
    description: 'Kale surlarının altında dolaşan yaratıklar nöbetçileri yoruyor. Dört düşmanı yen, ödülün yoluna düşecek.',
    objective: { type: 'battleWon', count: 4 },
    minLevel: 4,
    reward: { money: 180, xp: 130 },
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
  {
    id: 'crystal-marsh-haberi',
    title: 'Bataklığa Haber',
    giver: 'still-crystal',
    description: "Sisli Bataklık'ın kılavuzu Mert, kıyıdan haber bekliyor. Bataklık köyüne var, ona selamımızı ilet.",
    objective: { type: 'visit', locationId: 'marsh' },
    minLevel: 4,
    reward: { money: 110, xp: 80 },
  },
  // --- Köyler (Task 47): küçük işler, küçük ödüller; ödül köyün ilk elementinin biriminde ---
  // Ash Kanyon (Kor)
  {
    id: 'ash-koz-avi',
    title: 'Kanyon Nöbeti',
    giver: 'ash',
    description: 'Kanyonun taşları arasında köz yaratıkları dolaşıyor. İki düşmanı yen, ödülün yoluna düşecek.',
    objective: { type: 'battleWon', count: 2 },
    minLevel: 2,
    reward: { money: 60, xp: 45 },
  },
  {
    id: 'ash-baharat-teslimat',
    title: 'Baharat Çuvalı',
    giver: 'ash',
    description: "Abyss rahipleri kanyonun baharatını seviyor. Ignis'ten 3 Kor Baharatı al, Abyss Tapınağı'na götür.",
    objective: { type: 'deliver', itemId: 'kor-baharati', count: 3, locationId: 'abyss' },
    minLevel: 2,
    reward: { money: 90, xp: 60 },
  },
  {
    id: 'ash-sandik',
    title: 'Kanyondaki Sandık',
    giver: 'ash',
    description: 'Kanyonun yamaçlarında bekçili eski bir sandık duruyor. Bir korumalı sandığı aç; içindekiler senin.',
    objective: { type: 'chest', count: 1 },
    minLevel: 3,
    reward: { money: 80, xp: 70 },
  },
  // Vine Surları (Tüy)
  {
    id: 'vine-yol-nobeti',
    title: 'Yol Güvenliği',
    giver: 'vine',
    description: 'Surların önündeki yol yaratıklarla dolu. Üç düşmanı yen, ödülün yoluna düşecek.',
    objective: { type: 'battleWon', count: 3 },
    minLevel: 4,
    reward: { money: 90, xp: 70 },
  },
  {
    id: 'vine-ipek-teslimat',
    title: 'İpek Siparişi',
    giver: 'vine',
    description: "Stone Heart'ın örücüleri Bulut İpeği bekliyor. Abyss'ten 3 ipek al, Stone Heart Kalesi'ne götür.",
    objective: { type: 'deliver', itemId: 'bulut-ipegi', count: 3, locationId: 'stone-heart' },
    minLevel: 4,
    reward: { money: 120, xp: 80 },
  },
  {
    id: 'vine-maden',
    title: 'Sarmaşık Madeni',
    giver: 'vine',
    description: 'Köyün eski madenine yaratıklar yerleşti. Bir madeni temizle.',
    objective: { type: 'mine', count: 1 },
    minLevel: 4,
    reward: { money: 130, xp: 100 },
  },
  // Sisli Bataklık (Tunç)
  {
    id: 'marsh-sis-avi',
    title: 'Sis Avı',
    giver: 'marsh',
    description: 'Bataklıkta sisin içinden çıkan yaratıklar kılavuzları korkutuyor. Dört düşmanı yen.',
    objective: { type: 'battleWon', count: 4 },
    minLevel: 6,
    reward: { money: 120, xp: 100 },
  },
  {
    id: 'marsh-cevher-teslimat',
    title: 'Cevher Siparişi',
    giver: 'marsh',
    description: "Still Crystal'ın demircileri bataklık demiri için Taş Cevheri istiyor. Stone Heart'tan 3 cevher al, Still Crystal'a götür.",
    objective: { type: 'deliver', itemId: 'tas-cevheri', count: 3, locationId: 'still-crystal' },
    minLevel: 6,
    reward: { money: 140, xp: 100 },
  },
  {
    id: 'marsh-sandik',
    title: 'Batık Sandık',
    giver: 'marsh',
    description: 'Bataklığın kıyısında batmış bir kervandan kalma korumalı sandıklar var. Bir tanesini aç.',
    objective: { type: 'chest', count: 1 },
    minLevel: 6,
    reward: { money: 130, xp: 110 },
  },
];

export function getQuest(id: string): QuestDef | undefined {
  return SIDE_QUESTS.find((q) => q.id === id);
}

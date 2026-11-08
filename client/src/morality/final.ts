import type { ChoiceLine } from './catalog';
import { effectsFor, finalPathFor, type FinalPath, type Tier } from './morality';

/**
 * Bölüm 8 seçimleri bittikten sonra gösterilen final sahnesi. Yol puanın işaretinden, işlenişin gücü
 * kademeden gelir (docs/hikaye.md bölüm 5, "Final").
 */

const ORDER: Record<Tier, string> = {
  0: 'Terazi hafifçe iyiye eğildi. Elysia yanında durdu; bu savaşı birlikte vereceksiniz.',
  1: 'Yolun boyunca bıraktığın merhamet, Sis Geçidi’ndeki insanların gözlerinde yaşıyor. Elysia omzuna dokundu: "Seninle gurur duyuyorum."',
  2: 'Geçit seni alkışlarla karşıladı. Dört şehrin gönüllüleri arkanda dizildi; Elysia’nın rüzgârı bayrakları dalgalandırdı.',
  3: 'Gökyüzü altın bir ışıkla yarıldı. Kurtardığın herkes sana yürüyor gibiydi. Elysia gülümsedi: "Düzen Bekçileri geri döndü."',
};

const DARK: Record<Tier, string> = {
  0: 'Terazi hafifçe karanlığa eğildi. Elysia mesafe koydu; bu savaşı tek başına vereceksin.',
  1: 'Yol boyunca verdiğin kararlar peşinden gölge gibi geliyor. Elysia sana baktı ve yüzünü çevirdi.',
  2: 'Geçit sessizliğe gömüldü. İnsanlar gözlerini kaçırdı. Elysia ihanetini hissetti: "Sana güvenmiştim."',
  3: 'Gölgeler seni sardı, ışık geri çekildi. Elysia’nın sesi uzaktan geldi: "Artık tanımıyorum seni." Mutlak tiranlığın eşiğindesin.',
};

const SETUP: Record<FinalPath, string> = {
  order: 'Malakor’la yüzleşme vakti. Düzen Bekçisi yolundasın: Elysia ile 2v2 savaşacaksın.',
  dark: 'Malakor’la yüzleşme vakti. Karanlık Büyücü yolundasın: Elysia’ya ihanet ettin, tek başına savaşacaksın.',
};

/** Final sahnesinin satırları: yol, kademe ve savaşın nasıl olacağı. */
export function finalLines(score: number): ChoiceLine[] {
  const path = finalPathFor(score);
  const tier = effectsFor(score).tier;
  const text = path === 'order' ? ORDER[tier] : DARK[tier];
  return [
    { speaker: 'Anlatıcı', text },
    { speaker: 'Anlatıcı', text: SETUP[path] },
  ];
}

/** Hasar hesabı ayarları. Denge için ayarlanabilir; testler kuralın davranışını doğrular. */

/**
 * Faz 3: baş bölgesi artık tuvalin üst şeridi değil, **rakip silüetinin başıdır** (`target.ts`). Çarpan ×1.5 → ×1.25.
 * Silüete göre bölge çarpanları: baş ×1.25, gövde ×1, sıyırma ×0.2, ıska ×0.1.
 */
export { HEAD_MULTIPLIER as HEADSHOT_MULTIPLIER } from './target';

/**
 * Faz 3: şeklin önemi. Çizimin özel büyü şekline benzerliği gücü çarpar: uzaklık `SHAPE_PERFECT` ve altıysa ×1,
 * `SHAPE_WORST` ve üstüyse ×`SHAPE_FLOOR` (arası doğrusal). Şekil tutarsa (eşik altı) ayrıca ×`SPECIAL_SHAPE_BONUS`.
 */
export const SHAPE_PERFECT = 0.07;
export const SHAPE_WORST = 0.22;
export const SHAPE_FLOOR = 0.6;
export const SPECIAL_SHAPE_BONUS = 1.5;

/** Element üstünlüğü: saldıran üstünse hasar artar, savunan üstünse azalır */
export const ELEMENT_ADVANTAGE = 1.25;
export const ELEMENT_DISADVANTAGE = 0.75;

/** Toplam zırhın sağlayabileceği en yüksek hasar azaltma (0-1) */
export const ARMOR_CAP = 0.75;

/** Kritik vuruş: şans üst sınırı (ekipman ve yetenekler toplanır) ve hasar çarpanı */
export const CRIT_CAP = 0.75;
export const CRIT_MULTIPLIER = 1.5;

/**
 * Tam güç için gereken kaplanan alan oranı (tuvale göre). Daha büyük çizim fazladan güç vermez.
 * Faz 3: 0.145 → 0.075. Rakip silüeti tuvalin bir kısmıdır; gövdeyi dolduran bir şekil (yarıçap ~50) neredeyse tam güç alır,
 * daha küçük çizim sert düşer (yarıçap 40: ~%64, 30: ~%43). Silüetin dışına taşan kısım ise sıyırma/ıska olur.
 */
export const FULL_POWER_COVERAGE = 0.075;
/** Küçük büyü doğrusaldan daha sert düşer: güç = (alan / tam alan) ^ bu üs (1 = doğrusal) */
export const SIZE_EXPONENT = 1.3;
/** Tuvalin aşırı kaplanması (karalayarak doldurma) hafif güç keser: tam alanın bu katından sonra güç düşmeye başlar... */
export const OVERFILL_START = 1.6;
/** ...ve en çok bu çarpana kadar iner */
export const OVERFILL_FLOOR = 0.85;
/** Savunma bütçesi: savunma tuvalin bu oranından fazlasını kaplarsa kalkan incelir (herkesin her şeyi karalamasını engeller) */
export const DEFENSE_OVERFILL_START = 0.28;
/** Savunma tuvalin bu oranını kaplayınca kalkan en ince hâlindedir */
export const DEFENSE_OVERFILL_FULL = 0.56;
/** En ince kalkanın gücü (çarpan) */
export const DEFENSE_STRENGTH_FLOOR = 0.45;
/** Saldırıda tek hücrenin ağırlığı, dolu hücrelerin ortalama ağırlığının en çok bu katı sayılır (bir noktada bekleyerek ağırlık yığılmaz) */
export const WEIGHT_CAP_MULTIPLE = 3;
/**
 * Çizime ayrılan sürenin ne kadarı kullanılırsa tam güç alınır. Aceleyle çizilen büyü, en kötü
 * bu orana kadar zayıflar. Faz 3: süre önemini yitirdi ("çok değil doğru çiz"): 0.4 → 0.75 (en kötü %75 güç).
 */
export const MIN_EFFORT_FACTOR = 0.75;

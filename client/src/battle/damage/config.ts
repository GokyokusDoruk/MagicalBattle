/** Hasar hesabı ayarları. Denge için ayarlanabilir; testler kuralın davranışını doğrular. */

/** Tuvalin üstten bu kadarlık kısmı rakibin başıdır (0-1). Savunulmayan büyü buraya düşerse daha çok hasar verir. */
export const HEAD_ZONE_FRACTION = 0.3;
/** Savunulmayan büyü başa denk gelirse o kısmın çarpanı (+%50) */
export const HEADSHOT_MULTIPLIER = 1.5;

/** Element üstünlüğü: saldıran üstünse hasar artar, savunan üstünse azalır */
export const ELEMENT_ADVANTAGE = 1.25;
export const ELEMENT_DISADVANTAGE = 0.75;

/** Toplam zırhın sağlayabileceği en yüksek hasar azaltma (0-1) */
export const ARMOR_CAP = 0.75;

/** Kritik vuruş: şans üst sınırı (ekipman ve yetenekler toplanır) ve hasar çarpanı */
export const CRIT_CAP = 0.75;
export const CRIT_MULTIPLIER = 1.5;

/** Tam güç için gereken kaplanan alan oranı (tuvale göre). Daha büyük çizim fazladan güç vermez. */
export const FULL_POWER_COVERAGE = 0.145;
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
 * bu orana kadar zayıflar (0.4 = aceleyle çizilen büyü %40 güçte kalır).
 */
export const MIN_EFFORT_FACTOR = 0.4;

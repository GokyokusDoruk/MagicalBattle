/** Savaş akışı ayarları. Denge için ayarlanabilir. */

/** Savaşçının başlangıç canı */
export const MAX_HP = 300;
/** Büyünün taban gücü (asalar gelene kadar herkes için aynı; Task 17'de asadan gelecek) */
export const BASE_POWER = 100;
/** Bir döngü: her savaşçı bir kez saldırır. Bu kadar döngüde bitmezse can toplamı fazla olan takım kazanır. */
export const MAX_CYCLES = 40;
/** Savunan oyuncu, gelen saldırıyı soluk "hayalet" olarak görür mü (savunmayı bir beceri oyununa çevirir) */
export const SHOW_ATTACK_TO_DEFENDER = true;

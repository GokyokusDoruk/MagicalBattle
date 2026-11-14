import { MAX_HP } from '../battle/flow/config';

/**
 * Oyuncunun canı (Task 27): azami can seviyeyle artar. Savaşlar arasında can **kalıcıdır**; han'da bedava dolar,
 * can iksiriyle yenilenir, ölünce şifacıda dolar.
 */

/** Savaşta oyuncunun azami canı: seviye başına +10 */
export const HP_PER_LEVEL = 10;

export const playerMaxHp = (level: number): number => MAX_HP + HP_PER_LEVEL * (Math.max(1, Math.floor(level)) - 1);

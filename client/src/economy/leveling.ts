export const MAX_LEVEL = 30;

/** Bir seviyeye ulaşmak için gereken toplam XP: seviye 2 = 100, 3 = 300, 4 = 600, ... */
export function xpToReach(level: number): number {
  const l = Math.min(MAX_LEVEL, Math.max(1, Math.floor(level)));
  return 50 * (l - 1) * l;
}

/** Toplam XP'den seviye (1 ile MAX_LEVEL arası). */
export function levelForXp(xp: number): number {
  const safe = Number.isFinite(xp) ? Math.max(0, xp) : 0;
  let level = 1;
  while (level < MAX_LEVEL && safe >= xpToReach(level + 1)) level++;
  return level;
}

export interface LevelProgress {
  level: number;
  /** Bu seviyede kazanılan XP */
  into: number;
  /** Sonraki seviye için gereken XP; son seviyede 0 */
  needed: number;
  /** 0-1 */
  ratio: number;
}

export function levelProgress(xp: number): LevelProgress {
  const level = levelForXp(xp);
  if (level >= MAX_LEVEL) return { level, into: 0, needed: 0, ratio: 1 };
  const base = xpToReach(level);
  const needed = xpToReach(level + 1) - base;
  const into = Math.max(0, Math.floor(xp) - base);
  return { level, into, needed, ratio: Math.min(1, into / needed) };
}

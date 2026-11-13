import { getItem, itemCategory, type CarryBonus } from '../economy/items';
import type { PlayerState } from '../economy/player';
import { getWand } from '../wands/catalog';
import type { WandInventory } from '../wands/inventory';
import type { GroundLoot, GroundPile } from '../world/groundLoot';
import { CATEGORIES, type CarryCategory } from './carry';

/**
 * Şehirden (ya da köyden) çıkarken çanta küçülebilir: kendi elementinin çantasındaki %50 bonus gider. Taşıdıkların yeni
 * kapasiteye sığmıyorsa oyuncuya "hangilerini bırakmak istiyorsun?" diye sorulur; bırakılanlar çıkış noktasında yere düşer
 * (10 dakika kalır). Bu modül seçimin hesabını yapar (arayüzden bağımsız).
 */

export interface DropCandidate {
  /** Anahtar: `item:<kimlik>` ya da `wand:<kimlik>` */
  key: string;
  kind: 'item' | 'wand';
  id: string;
  category: CarryCategory;
  /** Bırakılabilecek en çok adet (giyilen / kuşanılı kopya hariç) */
  max: number;
  /** Eşyanın değeri (bırakma önerisi için: en ucuzlar önce) */
  value: number;
}

/** Bırakma seçimi: aday anahtarı → adet */
export type DropSelection = Record<string, number>;

/** Bırakılabilecek her şey: ticari eşya, iksir, giyilmeyen ekipman ve kuşanılı olmayan asalar. */
export function dropCandidates(player: PlayerState, wands: WandInventory): DropCandidate[] {
  const out: DropCandidate[] = [];
  for (const { id, count } of player.inventory()) {
    const item = getItem(id);
    if (!item) continue;
    const max = count - (player.isEquipped(id) ? 1 : 0); // giyilen kopya çantada değildir
    if (max > 0) out.push({ key: `item:${id}`, kind: 'item', id, category: itemCategory(item) === 'goods' ? 'goods' : 'gear', max, value: item.price });
  }
  for (const { id, count } of wands.owned()) {
    const wand = getWand(id);
    if (!wand) continue;
    const max = count - (wands.isEquipped(id) ? 1 : 0);
    if (max > 0) out.push({ key: `wand:${id}`, kind: 'wand', id, category: 'wands', max, value: 0 });
  }
  return out;
}

/** Her kategoride seçilen toplam adet */
export function selectedByCategory(candidates: readonly DropCandidate[], selection: DropSelection): CarryBonus {
  const total: CarryBonus = { wands: 0, goods: 0, gear: 0 };
  for (const c of candidates) total[c.category] += Math.max(0, Math.min(c.max, Math.floor(selection[c.key] ?? 0)));
  return total;
}

/** Seçim, fazlalığı karşılıyor mu (her kategoride seçilen ≥ fazlalık)? */
export function resolves(overflow: CarryBonus, candidates: readonly DropCandidate[], selection: DropSelection): boolean {
  const sel = selectedByCategory(candidates, selection);
  return CATEGORIES.every((c) => sel[c] >= overflow[c]);
}

/** Kategori başına hâlâ bırakılması gereken adet */
export function remaining(overflow: CarryBonus, candidates: readonly DropCandidate[], selection: DropSelection): CarryBonus {
  const sel = selectedByCategory(candidates, selection);
  return { wands: Math.max(0, overflow.wands - sel.wands), goods: Math.max(0, overflow.goods - sel.goods), gear: Math.max(0, overflow.gear - sel.gear) };
}

/**
 * Varsayılan öneri: her kategoride en değersiz (ucuz) eşyalardan başlayarak fazlalık kadar seçer. Oyuncu istediği gibi
 * değiştirebilir. Fazlalığı karşılayacak kadar aday yoksa (olmaz) eldeki hepsi seçilir.
 */
export function suggestDrop(overflow: CarryBonus, candidates: readonly DropCandidate[]): DropSelection {
  const selection: DropSelection = {};
  for (const cat of CATEGORIES) {
    let need = overflow[cat];
    const list = candidates.filter((c) => c.category === cat).sort((a, b) => a.value - b.value || a.id.localeCompare(b.id));
    for (const c of list) {
      if (need <= 0) break;
      const take = Math.min(c.max, need);
      selection[c.key] = take;
      need -= take;
    }
  }
  return selection;
}

/**
 * Seçilenleri çantadan çıkarıp (tileX, tileY) karosuna bırakır. Fazlalığı karşılamayan seçimde hiçbir şey yapılmaz (null).
 * Bırakılan yığını döndürür.
 */
export function applyDrop(
  player: PlayerState,
  wands: WandInventory,
  overflow: CarryBonus,
  selection: DropSelection,
  ground: GroundLoot,
  tileX: number,
  tileY: number,
): GroundPile | null {
  const candidates = dropCandidates(player, wands);
  if (!resolves(overflow, candidates, selection)) return null;
  const items: Record<string, number> = {};
  const wandsOut: Record<string, number> = {};
  for (const c of candidates) {
    const n = Math.max(0, Math.min(c.max, Math.floor(selection[c.key] ?? 0)));
    if (n === 0) continue;
    if (c.kind === 'item') {
      if (player.removeItem(c.id, n)) items[c.id] = n;
    } else if (wands.remove(c.id, n)) wandsOut[c.id] = n;
  }
  return ground.drop(tileX, tileY, { items, wands: wandsOut });
}

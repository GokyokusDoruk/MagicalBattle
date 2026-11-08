import { SLOT_NAMES, type ItemDef } from '../economy/items';
import { ELEMENT_NAMES } from '../battle/damage/elements';
import { RARITY_COLORS, RARITY_NAMES } from '../wands/catalog';

const pct = (v: number): string => `%${Math.round(v * 100)}`;

/** Eşyanın kısa açıklaması: yuva, etki ve (ekipmansa) element */
export function describeItem(item: ItemDef): string {
  if (item.slot) {
    const slot = SLOT_NAMES[item.slot];
    const el = item.element ? ` · ${ELEMENT_NAMES[item.element]}` : '';
    let effect = '';
    if (item.carry) effect = `+${item.carry.wands} asa, +${item.carry.goods} eşya, +${item.carry.gear} kuşanılabilir`;
    else if (item.armor !== undefined) effect = `+${pct(item.armor)} zırh`;
    else if (item.speed !== undefined) effect = `yürüme hızı +${pct(item.speed)}`;
    else if (item.timeBonus !== undefined) effect = `büyü süresi +${item.timeBonus.toFixed(2)} sn`;
    return `${slot}${el} · ${effect}`;
  }
  if (item.heal) return `Can iksiri · +${item.heal} can`;
  return 'Ticari eşya';
}

/** Eşya adı, nadirlik renginde (ekipmansa) */
export function itemNameHtml(item: ItemDef): string {
  const esc = item.name.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  return item.rarity ? `<span style="color:${RARITY_COLORS[item.rarity]}">${esc}</span>` : esc;
}

export const rarityLabel = (item: ItemDef): string => (item.rarity ? RARITY_NAMES[item.rarity] : '');

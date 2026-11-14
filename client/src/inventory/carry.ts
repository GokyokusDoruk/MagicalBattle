import type { Element } from '../battle/damage/elements';
import { LOCATION_BONUS, matchesLocation } from '../economy/gearEffects';
import { NO_BONUS, getItem, itemCategory, type CarryBonus, type GearSlot } from '../economy/items';
import type { PlayerState } from '../economy/player';
import type { WandInventory } from '../wands/inventory';

/**
 * Envanter ağırlığı: üç ayrı kapasite, hepsi tam sayı (adet).
 *  - asalar: taşınan asa sayısı (kuşanılı asalar sayılmaz)
 *  - goods: ticari eşya ve can iksirleri
 *  - gear: çantada taşınan (giyilmeyen) ekipman; giyilen ekipman sayılmaz
 * Altın ağırlık yapmaz. Başlangıç kapasitesine kuşanılan çanta ve Taşıyıcı yetenekleri eklenir.
 */

export type CarryCategory = keyof CarryBonus;

/** Çantasız başlangıç kapasitesi: 3 asa, 20 eşya, 2 kuşanılabilir. Sık sık şehre gidip satmak gerekir. */
export const BASE_CAPACITY: CarryBonus = { wands: 3, goods: 20, gear: 2 };

export const CATEGORY_NAMES: Record<CarryCategory, string> = { wands: 'Asa', goods: 'Eşya', gear: 'Kuşanılabilir' };
export const CATEGORIES: readonly CarryCategory[] = ['wands', 'goods', 'gear'];

const add = (a: CarryBonus, b: CarryBonus): CarryBonus => ({ wands: a.wands + b.wands, goods: a.goods + b.goods, gear: a.gear + b.gear });

/**
 * Oyuncunun taşıdıkları ile kapasitesini hesaplar ve kuralları oyuncuya ve asa envanterine bağlar (`install`).
 * Kapasite yetmezse eklenemez; kapasite sonradan düşerse (çanta çıkarılırsa) eldekiler kalır ama yenisi alınamaz.
 */
export class Carry {
  constructor(
    private readonly player: PlayerState,
    private readonly wands: WandInventory,
    /** Taşıyıcı yeteneklerinden gelen ek kapasite */
    private readonly skillBonus: () => CarryBonus = () => NO_BONUS,
    /** Bulunulan konumun elementleri (şehir/köy); kendi elementinin çantası burada %50 daha geniştir. Dışarıda boş. */
    private readonly elementsHere: () => readonly Element[] = () => [],
    /** Kapasite çarpanı: toprak asasının pasifi (+%25) toplam kapasiteyi artırır; tam sayıya aşağı yuvarlanır. */
    private readonly capacityMultiplier: () => number = () => 1,
  ) {}

  /** Kuralları bağlar: eşya ekleme, ekipman değiştirme ve asa ekleme artık kapasiteye bakar. */
  install(): void {
    this.player.setGuards({
      room: (id) => this.roomForItem(id),
      canChangeGear: (slot, newId) => this.canChangeGear(slot, newId),
    });
    this.wands.setLimit((carried) => carried <= this.capacity().wands);
  }

  /**
   * Verilen çanta (ya da çantasızlık) ile toplam kapasite, `elements` konumunda. Çantanın elementi konumun
   * elementlerinden biriyse çantanın kattığı kapasite %50 artar (tam sayıya yuvarlanır). Başlangıç kapasitesi ve
   * yetenek bonusu konuma bağlı değildir.
   */
  capacityIn(elements: readonly Element[], bagId: string | null | undefined = this.player.equipped.bag): CarryBonus {
    const item = bagId ? getItem(bagId) : undefined;
    let bag = item?.carry ?? NO_BONUS;
    if (item && matchesLocation(item.element, elements)) {
      bag = { wands: Math.round(bag.wands * LOCATION_BONUS), goods: Math.round(bag.goods * LOCATION_BONUS), gear: Math.round(bag.gear * LOCATION_BONUS) };
    }
    const total = add(add(BASE_CAPACITY, bag), this.skillBonus());
    const k = this.capacityMultiplier();
    if (k === 1) return total;
    return { wands: Math.floor(total.wands * k), goods: Math.floor(total.goods * k), gear: Math.floor(total.gear * k) };
  }

  /** Şu anki konumdaki kapasite (şehir bonusu dahil). */
  capacity(bagId: string | null | undefined = this.player.equipped.bag): CarryBonus {
    return this.capacityIn(this.elementsHere(), bagId);
  }

  /** Şehir bonusu OLMADAN kapasite (şehirden çıkınca geçerli olan). */
  capacityOutside(bagId: string | null | undefined = this.player.equipped.bag): CarryBonus {
    return this.capacityIn([], bagId);
  }

  /** Şu anki konumdaki kapasiteye göre fazlalık (kategori başına, negatif olmaz). */
  overflow(): CarryBonus {
    const cap = this.capacity();
    const use = this.usage();
    return { wands: Math.max(0, use.wands - cap.wands), goods: Math.max(0, use.goods - cap.goods), gear: Math.max(0, use.gear - cap.gear) };
  }

  /** Şehirden çıkınca sığmayacak fazlalık (kategori başına, negatif olmaz). */
  overflowOutside(): CarryBonus {
    const cap = this.capacityOutside();
    const use = this.usage();
    return { wands: Math.max(0, use.wands - cap.wands), goods: Math.max(0, use.goods - cap.goods), gear: Math.max(0, use.gear - cap.gear) };
  }

  /** Şu an taşınanlar. */
  usage(): CarryBonus {
    let goods = 0;
    let gear = 0;
    for (const { id, count } of this.player.inventory()) {
      const item = getItem(id);
      if (!item) continue;
      if (itemCategory(item) === 'goods') goods += count;
      else gear += count - (this.player.isEquipped(id) ? 1 : 0); // giyilen kopya yer kaplamaz
    }
    return { wands: this.wands.carried, goods, gear };
  }

  /** Bir kategoride kalan yer (negatif olmaz). */
  room(category: CarryCategory): number {
    return Math.max(0, this.capacity()[category] - this.usage()[category]);
  }

  /** Bu eşyadan kaç tane daha taşınabilir. */
  roomForItem(id: string): number {
    const item = getItem(id);
    if (!item) return 0;
    return this.room(itemCategory(item) === 'goods' ? 'goods' : 'gear');
  }

  /** Herhangi bir kategoride kapasiteyi aşıyor mu (çanta çıkarılınca olabilir)? */
  isOverloaded(): boolean {
    const cap = this.capacity();
    const use = this.usage();
    return CATEGORIES.some((c) => use[c] > cap[c]);
  }

  /**
   * Ekipman değiştirmek (kuşan ya da çıkar) kapasiteye uyuyor mu? Kuşanınca eşya çantadan çıkar (yer açılır),
   * çıkarınca çantaya girer (yer gerekir). Çanta değişince kapasite de değişir. Uymuyorsa Türkçe neden, uyuyorsa null.
   */
  canChangeGear(slot: GearSlot, newId: string | null): string | null {
    const equipped = this.player.equipped;
    const oldId = equipped[slot] ?? null;
    const usage = this.usage();
    // Yeni eşya çantadan çıkar (zaten çantadaydı), eski eşya çantaya döner
    if (newId) usage.gear -= 1;
    if (oldId) usage.gear += 1;
    const cap = this.capacity(slot === 'bag' ? newId : equipped.bag);
    for (const c of CATEGORIES) {
      if (usage[c] > cap[c]) {
        if (slot === 'bag') return `Çantan bu çantaya sığmıyor: ${CATEGORY_NAMES[c]} ${usage[c]}/${cap[c]}. Önce fazlalığı sat ya da at.`;
        return 'Çantanda kuşanılabilir eşya için yer yok. Önce bir şey sat ya da at.';
      }
    }
    return null;
  }
}

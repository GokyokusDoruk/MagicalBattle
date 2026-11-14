import type { SoundEngine } from '../audio/sfx/engine';
import { getItem, isGear } from '../economy/items';
import type { GearStock } from '../economy/gearStock';
import { itemIconSvg } from './itemIcon';
import { describeItem, itemNameHtml, rarityLabel } from './itemText';
import { getMerchant, wandPriceFactorOf, type MerchantDef } from '../economy/merchants';
import { TRADE_GOODS, buyGood, cityGoodMultiplier, isTradeGood, sellGood, tradeBuyPrice, tradeSellPrice } from '../economy/trade';
import { sellWand, wandBuyPrice, wandSellPrice } from '../wands/shop';
import type { PlayerState } from '../economy/player';
import { buyPrice, sell, sellPrice } from '../economy/shop';
import type { QuestDef } from '../quests/catalog';
import type { QuestCompletion, QuestEngine } from '../quests/engine';
import { LOCATIONS, getLocation } from '../world/locations';
import { ELEMENT_NAMES } from '../battle/damage/elements';
import { ELEMENT_COLORS, RARITY_COLORS, RARITY_NAMES, ROLE_NAMES, describeWand, getWand } from '../wands/catalog';
import type { WandInventory } from '../wands/inventory';
import type { WandStock } from '../wands/stock';

export interface MerchantUiDeps {
  player: PlayerState;
  quests: QuestEngine;
  /** Asa envanteri */
  wands: WandInventory;
  /** Tüccarın 5 dakikada bir yenilenen asa stoğu */
  wandStock: (merchantId: string) => WandStock;
  /** Tüccarın 5 dakikada bir yenilenen ekipman stoğu */
  gearStock: (merchantId: string) => GearStock;
  sfx: SoundEngine;
  /** Görev kabulüyle hedef hemen tamamlandıysa */
  onQuestCompletion: (completion: QuestCompletion) => void;
  /** Alım, satım, kuşanma ya da görev kabulü oldu (kaydedilmemiş değişiklik) */
  onChanged: () => void;
  /** Ahlak sistemi (Task 18) için fiyat çarpanları; verilmezse 1 */
  priceMultipliers?: () => { buy: number; sell: number };
}

type Tab = 'shop' | 'trade' | 'wands' | 'quests';

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const pct = (v: number): string => `%${Math.round(v * 100)}`;

function objectiveText(q: QuestDef): string {
  const o = q.objective;
  if (o.type === 'collect') return `${getItem(o.itemId)?.name ?? o.itemId} topla (${o.count})`;
  if (o.type === 'visit') return `${LOCATIONS.find((l) => l.id === o.locationId)?.name ?? o.locationId} konumuna var`;
  return `${o.count} savaş kazan`;
}

function rewardText(q: QuestDef): string {
  const parts = [`${q.reward.gold} altın`, `${q.reward.xp} XP`];
  for (const it of q.reward.items ?? []) parts.push(`${it.count} ${getItem(it.id)?.name ?? it.id}`);
  return parts.join(', ');
}

/**
 * Tüccar ekranı: "Alışveriş" (ekipman al, ganimet sat, kuşan) ve "Görevler" (yan görevleri kabul et).
 * Görev hedefi bitince ödül kendiliğinden envantere yatar; geri dönüp teslim etmek gerekmez.
 */
export class MerchantUi {
  readonly element: HTMLDivElement;
  private merchant: MerchantDef | null = null;
  private tab: Tab = 'shop';
  private message = '';

  constructor(private readonly deps: MerchantUiDeps) {
    this.element = document.createElement('div');
    this.element.className = 'fixed inset-0 z-[55] hidden items-center justify-center bg-black/70 p-3';
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-modal', 'true');
    this.element.addEventListener('click', (e) => this.onClick(e));
    window.addEventListener('keydown', (e) => {
      if (this.isOpen && e.code === 'Escape') this.close();
    });
    // Panel açıkken altın, çanta ve görevler değişirse yeniden çiz
    deps.player.onChange(() => this.isOpen && this.render());
    deps.quests.onChange(() => this.isOpen && this.render());
    deps.wands.onChange(() => this.isOpen && this.render());
    // Geri sayımı her saniye günceller; stok yenilenince (5 dakikada bir) paneli yeniden çizer
    window.setInterval(() => this.tick(), 1000);
  }

  get isOpen(): boolean {
    return this.merchant !== null;
  }

  private renderedRotation = '';

  /** Stok yenileme dönemi (sekme ve tüccara göre); değişince panel yeniden çizilir. */
  private rotationKey(): string {
    const m = this.merchant;
    if (!m) return '';
    if (this.tab === 'shop') return `shop:${this.deps.gearStock(m.id).rotationIndex}`;
    if (this.tab === 'wands') return `wands:${this.deps.wandStock(m.id).rotationIndex}`;
    return this.tab;
  }

  private tick(): void {
    if (!this.merchant) return;
    if (this.rotationKey() !== this.renderedRotation) return this.render();
    const left = this.tab === 'shop' ? this.deps.gearStock(this.merchant.id).timeLeftMs() : this.tab === 'wands' ? this.deps.wandStock(this.merchant.id).timeLeftMs() : null;
    const clock = this.element.querySelector('[data-clock]');
    if (left !== null && clock) clock.textContent = this.clockText(left);
  }

  private clockText(ms: number): string {
    const left = Math.ceil(ms / 1000);
    return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  }

  open(merchantId: string): void {
    const merchant = getMerchant(merchantId);
    if (!merchant || this.isOpen) return;
    this.merchant = merchant;
    this.tab = merchant.kind === 'wandsmith' ? 'wands' : 'shop';
    this.message = merchant.greeting;
    this.element.classList.remove('hidden');
    this.element.classList.add('flex');
    this.render();
  }

  close(): void {
    this.merchant = null;
    this.element.classList.add('hidden');
    this.element.classList.remove('flex');
    this.element.innerHTML = '';
  }

  // --- Çizim -------------------------------------------------------------------------------

  private render(): void {
    const m = this.merchant;
    if (!m) return;
    this.renderedRotation = this.rotationKey();
    const { player } = this.deps;
    const tabBtn = (id: Tab, label: string): string =>
      `<button type="button" role="tab" data-action="tab" data-id="${id}" aria-selected="${this.tab === id}" class="flex-1 rounded px-3 py-2 text-sm ${this.tab === id ? 'bg-amber-300 font-bold text-slate-900' : 'bg-slate-800 text-slate-200'}">${label}</button>`;

    this.element.innerHTML = `
      <div class="flex max-h-full w-full max-w-md flex-col gap-3 rounded-xl border border-amber-300/40 bg-slate-950 p-4 text-amber-50 shadow-2xl">
        <div class="flex items-start justify-between gap-2">
          <div><h2 class="text-lg font-bold text-amber-300">${esc(m.name)} <span class="text-xs font-normal text-slate-400">· ${esc(getLocation(m.locationId).name)}</span></h2>
            <p class="text-xs italic text-slate-300" data-message>${esc(this.message)}</p></div>
          <button type="button" data-action="close" class="rounded bg-white/10 px-2 py-1 text-sm hover:bg-white/20" aria-label="Kapat">✕</button>
        </div>
        <div class="flex items-center justify-between rounded bg-black/40 px-3 py-1 text-sm">
          <span>🪙 <b>${player.gold}</b></span><span>Seviye <b>${player.level}</b></span><span>Zırh <b>${pct(player.armor)}</b></span>
        </div>
        ${m.kind === 'wandsmith' ? '' : `<div role="tablist" class="flex gap-2">${tabBtn('shop', 'Alışveriş')}${tabBtn('trade', 'Ticaret')}${tabBtn('quests', 'Görevler')}</div>`}
        <div data-scrollable style="touch-action:pan-y" class="min-h-0 flex-1 overflow-y-auto pr-1">${this.tab === 'shop' ? this.shopHtml(m) : this.tab === 'trade' ? this.tradeHtml(m) : this.tab === 'wands' ? this.wandsHtml() : this.questsHtml(m)}</div>
      </div>`;
  }

  private shopHtml(m: MerchantDef): string {
    const { player } = this.deps;
    const mult = this.deps.priceMultipliers?.() ?? { buy: 1, sell: 1 };
    const stock = this.deps.gearStock(m.id);

    const forSale = stock
      .entries()
      .map((e) => {
        const item = getItem(e.itemId)!;
        const price = buyPrice(e.price, mult.buy);
        const cant = e.sold || player.gold < price || player.roomFor(item.id) < 1;
        return `<li data-stock="${e.slot}" class="flex items-center justify-between gap-2 rounded bg-slate-900 p-2 ${e.sold ? 'opacity-50' : ''}">
          <div class="flex min-w-0 items-center gap-2"><span class="shrink-0">${itemIconSvg(item, 40)}</span>
            <div class="min-w-0"><div class="font-bold">${itemNameHtml(item)}${e.rare ? ' <span class="text-[11px] text-sky-300">(nadir, pahalı)</span>' : ''}</div>
              <div class="text-[11px] text-slate-400">${esc(rarityLabel(item))} · ${esc(describeItem(item))}</div>
              <div class="text-[11px] text-slate-500">${esc(item.description)}</div></div></div>
          <button type="button" data-action="buy" data-id="${e.slot}" ${cant ? 'disabled' : ''}
            class="shrink-0 rounded bg-amber-300 px-3 py-1 text-sm font-bold text-slate-900 disabled:opacity-40">${e.sold ? 'Satıldı' : `🪙 ${price}`}</button></li>`;
      })
      .join('');

    const bag = player.inventory().filter(({ id }) => !isTradeGood(id));
    const mine = bag
      .map(({ id, count }) => {
        const item = getItem(id)!;
        const equipped = player.isEquipped(id);
        const each = sellPrice(item.price, mult.sell);
        const lastEquipped = equipped && count < 2;
        const actions = isGear(item)
          ? `<button type="button" data-action="${equipped ? 'unequip' : 'equip'}" data-id="${id}" class="rounded bg-sky-400 px-2 py-1 text-xs font-bold text-slate-900">${equipped ? 'Çıkar' : 'Kuşan'}</button>
             <button type="button" data-action="sell" data-id="${id}" ${lastEquipped ? 'disabled' : ''} class="rounded bg-slate-700 px-2 py-1 text-xs disabled:opacity-40">Sat 🪙 ${each}</button>`
          : `<button type="button" data-action="sell" data-id="${id}" class="rounded bg-slate-700 px-2 py-1 text-xs">Sat 🪙 ${each}</button>
             ${count > 1 ? `<button type="button" data-action="sell-all" data-id="${id}" class="rounded bg-slate-700 px-2 py-1 text-xs">Hepsini sat 🪙 ${each * count}</button>` : ''}`;
        return `<li class="flex flex-wrap items-center justify-between gap-2 rounded bg-slate-900 p-2">
          <div class="flex items-center gap-2"><span class="shrink-0">${itemIconSvg(item, 32)}</span><div><span class="font-bold">${itemNameHtml(item)}</span> <span class="text-slate-400">×${count}</span>${equipped ? ' <span class="text-[11px] text-sky-300">(kuşanılı)</span>' : ''}
            <div class="text-[11px] text-slate-400">${esc(describeItem(item))}</div></div></div>
          <div class="flex gap-1">${actions}</div></li>`;
      })
      .join('');

    return `<p class="mb-2 text-xs text-slate-400">Stok <b data-clock>${this.clockText(stock.timeLeftMs())}</b> sonra yenilenir. En çok bir <b>Nadir</b> eşya bulunur (pahalı), diğerleri Sıradan ya da Gelişmiş. Aynı elementteki zırh ve yüzük, o elementin büyüsünde %50 daha güçlüdür.</p>
      <h3 class="mb-1 text-sm font-bold text-amber-200">Satılık</h3><ul class="flex flex-col gap-2">${forSale}</ul>
      <h3 class="mb-1 mt-4 text-sm font-bold text-amber-200">Çantan</h3>
      ${mine ? `<ul class="flex flex-col gap-2">${mine}</ul>` : '<p class="text-sm text-slate-400">Satacak bir şeyin yok. Yollarda ot ve kumsalda kristal bulabilirsin; tüccar fiyatın yarısını öder. Ticari mallar "Ticaret" sekmesinde.</p>'}`;
  }

  private tradeHtml(m: MerchantDef): string {
    const { player } = this.deps;
    const mult = this.deps.priceMultipliers?.() ?? { buy: 1, sell: 1 };
    const rows = TRADE_GOODS.map((g) => {
      const item = getItem(g.id)!;
      const own = player.count(g.id);
      const cm = cityGoodMultiplier(m.locationId, g.id);
      const buy = tradeBuyPrice(m.locationId, g.id, mult.buy);
      const sellEach = tradeSellPrice(m.locationId, g.id, mult.sell);
      const tag = cm < 1 ? '<span class="text-emerald-300">ucuz</span>' : cm > 1 ? '<span class="text-red-300">pahalı</span>' : '<span class="text-slate-400">normal</span>';
      const cantBuy = player.gold < buy || player.roomFor(g.id) < 1;
      return `<li data-good="${g.id}" class="flex flex-wrap items-center justify-between gap-2 rounded bg-slate-900 p-2">
        <div class="flex min-w-0 items-center gap-2"><span class="shrink-0">${itemIconSvg(item, 36)}</span>
          <div class="min-w-0"><div class="font-bold">${esc(item.name)} <span class="text-slate-400">×${own}</span> <span class="text-[11px]">${tag} (×${cm.toFixed(1)})</span></div>
            <div class="text-[11px] text-slate-500">${esc(item.description)}</div></div></div>
        <div class="flex gap-1"><button type="button" data-action="buy-good" data-id="${g.id}" ${cantBuy ? 'disabled' : ''} class="rounded bg-amber-300 px-2 py-1 text-xs font-bold text-slate-900 disabled:opacity-40">Al 🪙 ${buy}</button>
          <button type="button" data-action="sell-good" data-id="${g.id}" ${own < 1 ? 'disabled' : ''} class="rounded bg-slate-700 px-2 py-1 text-xs disabled:opacity-40">Sat 🪙 ${sellEach}</button>
          ${own > 1 ? `<button type="button" data-action="sell-good-all" data-id="${g.id}" class="rounded bg-slate-700 px-2 py-1 text-xs">Hepsini sat 🪙 ${sellEach * own}</button>` : ''}</div></li>`;
    }).join('');
    return `<p class="mb-2 text-xs text-slate-400">Her şehir kendi elementinin malını ucuza satar, uzaktaki elementin malını pahalıya alır. Ucuza al, uzak şehirde sat. Mallar çantada <b>eşya</b> yeri kaplar. Tüccar malı, fiyatının %80'ine alır.</p>
      <ul class="flex flex-col gap-2">${rows}</ul>`;
  }

  private wandsHtml(): string {
    const { player, wands } = this.deps;
    const m = this.merchant!;
    const stock = this.deps.wandStock(m.id);
    const mult = this.deps.priceMultipliers?.() ?? { buy: 1, sell: 1 };
    const factor = wandPriceFactorOf(m);
    const clock = this.clockText(stock.timeLeftMs());

    const rows = stock
      .entries()
      .map((e) => {
        const w = getWand(e.wandId)!;
        const price = wandBuyPrice(e.price, factor, mult.buy);
        const tooHigh = w.level > player.level;
        const cant = e.sold || player.gold < price || !wands.canAdd(e.wandId, 1);
        return `<li data-stock="${e.slot}" class="flex items-center justify-between gap-2 rounded bg-slate-900 p-2 ${e.sold ? 'opacity-50' : ''}">
          <div class="min-w-0">
            <div class="font-bold"><span style="color:${ELEMENT_COLORS[w.element]}">●</span> <span style="color:${RARITY_COLORS[w.rarity]}">${esc(w.name)}</span> <span class="${tooHigh ? 'text-red-300' : 'text-slate-300'}">Sv ${w.level}</span>${e.rare ? ' <span class="text-[11px] text-sky-300">(nadir, pahalı)</span>' : ''}</div>
            <div class="text-[11px] text-slate-400">${esc(ELEMENT_NAMES[w.element])} · ${esc(ROLE_NAMES[w.role])} · ${esc(RARITY_NAMES[w.rarity])}</div>
            <div class="text-[11px] text-slate-500">${esc(describeWand(w).join(' · '))}</div>
            ${tooHigh ? `<div class="text-[11px] text-red-300">${w.level}. seviyeye gelene kadar kullanamazsın</div>` : ''}</div>
          <button type="button" data-action="buy-wand" data-id="${e.slot}" ${cant ? 'disabled' : ''}
            class="shrink-0 rounded bg-amber-300 px-3 py-1 text-sm font-bold text-slate-900 disabled:opacity-40">${e.sold ? 'Satıldı' : `🪙 ${price}`}</button></li>`;
      })
      .join('');

    const mine = wands
      .owned()
      .map(({ id, count }) => {
        const w = getWand(id)!;
        const equipped = wands.isEquipped(id);
        const cantSell = equipped && count < 2;
        return `<li data-own-wand="${id}" class="flex flex-wrap items-center justify-between gap-2 rounded bg-slate-900 p-2">
          <div class="min-w-0"><div class="font-bold"><span style="color:${ELEMENT_COLORS[w.element]}">●</span> <span style="color:${RARITY_COLORS[w.rarity]}">${esc(w.name)}</span> <span class="text-slate-300">Sv ${w.level}</span> ${count > 1 ? `<span class="text-slate-400">×${count}</span>` : ''}${equipped ? ' <span class="text-[11px] text-sky-300">(kuşanılı)</span>' : ''}</div>
            <div class="text-[11px] text-slate-500">${esc(describeWand(w).join(' · '))}</div></div>
          <button type="button" data-action="sell-wand" data-id="${id}" ${cantSell ? 'disabled' : ''} class="rounded bg-slate-700 px-2 py-1 text-xs disabled:opacity-40">Sat 🪙 ${wandSellPrice(id, factor, mult.sell)}</button></li>`;
      })
      .join('');

    const diff =
      factor === 1
        ? 'Bu şehirde asa fiyatları normal.'
        : `Bu şehirde asa fiyatları normalden %${Math.round(Math.abs(factor - 1) * 100)} ${factor > 1 ? 'pahalı' : 'ucuz'}.`;
    return `<p class="mb-2 text-xs text-slate-400">Stok <b data-clock>${clock}</b> sonra yenilenir. En çok bir <b>Nadir</b> asa bulunur, diğerleri Sıradan ya da Gelişmiş. Asa, seviyene gelene kadar kullanılamaz. ${diff} Asacı, asanın değerinin yarısını öder.</p>
      <h3 class="mb-1 text-sm font-bold text-amber-200">Satılık</h3><ul class="flex flex-col gap-2">${rows}</ul>
      <h3 class="mb-1 mt-4 text-sm font-bold text-amber-200">Asaların</h3>
      ${mine ? `<ul class="flex flex-col gap-2">${mine}</ul>` : '<p class="text-sm text-slate-400">Hiç asan yok.</p>'}`;
  }

  private questsHtml(m: MerchantDef): string {
    const { quests } = this.deps;
    const list = quests.forGiver(m.locationId);
    const section = (title: string, views: string[], render: (q: QuestDef) => string): string => {
      const items = list.filter((q) => views.includes(quests.view(q.id)));
      return items.length ? `<h3 class="mb-1 mt-3 text-sm font-bold text-amber-200">${title}</h3><ul class="flex flex-col gap-2">${items.map(render).join('')}</ul>` : '';
    };
    const card = (q: QuestDef, extra: string, state?: string): string => `
      <li class="rounded bg-slate-900 p-2 ${state === 'done' ? 'opacity-60' : ''}">
        <div class="font-bold">${esc(q.title)}</div>
        <p class="my-1 text-xs text-slate-300">${esc(q.description)}</p>
        <div class="text-[11px] text-sky-300">Hedef: ${esc(objectiveText(q))}</div>
        <div class="text-[11px] text-emerald-300">Ödül: ${esc(rewardText(q))}</div>
        ${extra}</li>`;

    const html =
      section('Aktif', ['active'], (q) => {
        const p = quests.progress(q.id);
        return card(q, `<div class="mt-1 text-xs font-bold text-amber-200">İlerleme: ${p.value}/${p.target}</div>`);
      }) +
      section('Alabileceğin görevler', ['available'], (q) =>
        card(q, `<button type="button" data-action="accept" data-id="${q.id}" class="mt-2 rounded bg-amber-300 px-3 py-1 text-sm font-bold text-slate-900">Kabul et</button>`),
      ) +
      section('Kilitli', ['locked'], (q) => card(q, `<div class="mt-1 text-xs text-red-300">${q.minLevel}. seviye gerekli</div>`)) +
      section('Tamamlanan', ['completed'], (q) => card(q, '<div class="mt-1 text-xs text-emerald-300">✓ Tamamlandı</div>', 'done'));

    return `<p class="mb-1 text-xs text-slate-400">Görev hedefi bitince ödül <b>kendiliğinden</b> çantana yatar, geri dönüp teslim etmen gerekmez.</p>${html || '<p class="text-sm text-slate-400">Bu tüccarın verecek görevi yok.</p>'}`;
  }

  // --- Eylemler ----------------------------------------------------------------------------

  private onClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (target === this.element) return this.close(); // boş alana tıklayınca kapanır
    const btn = target.closest<HTMLElement>('[data-action]');
    if (!btn || !this.merchant) return;
    const { action, id = '' } = btn.dataset;
    const { player, quests, sfx } = this.deps;
    const mult = this.deps.priceMultipliers?.() ?? { buy: 1, sell: 1 };

    switch (action) {
      case 'close':
        return this.close();
      case 'tab':
        this.tab = id as Tab;
        break;
      case 'buy': {
        const gs = this.deps.gearStock(this.merchant.id);
        const entry = gs.entries().find((e) => e.slot === Number(id));
        const r = gs.buy(Number(id), player, mult.buy);
        this.message = r.ok ? `Satın alındı: ${getItem(entry!.itemId)!.name} (-${r.price} altın)` : r.reason;
        if (r.ok) this.changed('pick');
        break;
      }
      case 'buy-wand': {
        const r = this.deps.wandStock(this.merchant.id).buy(Number(id), this.deps.wands, { balance: () => player.gold, spend: (n) => player.spendGold(n) }, wandPriceFactorOf(this.merchant) * mult.buy);
        this.message = r.ok ? `Satın alındı: ${getWand(r.wandId)!.name} (-${r.price} altın)` : r.reason;
        if (r.ok) this.changed('pick');
        break;
      }
      case 'buy-good': {
        const r = buyGood(player, this.merchant.locationId, id, 1, mult.buy);
        this.message = r.ok ? `Satın alındı: ${getItem(id)!.name} (-${r.price} altın)` : r.reason;
        if (r.ok) this.changed('pick');
        break;
      }
      case 'sell-good':
      case 'sell-good-all': {
        const count = action === 'sell-good-all' ? player.count(id) : 1;
        const r = sellGood(player, this.merchant.locationId, id, count, mult.sell);
        this.message = r.ok ? `Satıldı: ${getItem(id)!.name} ×${count} (+${r.price} altın)` : r.reason;
        if (r.ok) this.changed('pick');
        break;
      }
      case 'sell-wand': {
        const r = sellWand(this.deps.wands, { add: (n) => player.addGold(n) }, id, wandPriceFactorOf(this.merchant), mult.sell);
        this.message = r.ok ? `Satıldı: ${getWand(id)!.name} (+${r.price} altın)` : r.reason;
        if (r.ok) this.changed('pick');
        break;
      }
      case 'sell':
      case 'sell-all': {
        const count = action === 'sell-all' ? player.count(id) : 1;
        const r = sell(player, id, count, mult.sell);
        this.message = r.ok ? `Satıldı: ${getItem(id)!.name} ×${count} (+${r.price} altın)` : r.reason;
        if (r.ok) this.changed('pick');
        break;
      }
      case 'equip':
        if (player.equip(id)) {
          this.message = `Kuşandın: ${getItem(id)!.name}`;
          this.changed('shieldUp');
        } else if (player.lastBlockReason) this.message = player.lastBlockReason;
        break;
      case 'unequip': {
        const slot = getItem(id)?.slot;
        if (slot && player.unequip(slot)) {
          this.message = `Çıkardın: ${getItem(id)?.name ?? id}`;
          this.changed('pick');
        } else if (player.lastBlockReason) this.message = player.lastBlockReason;
        break;
      }
      case 'accept': {
        const r = quests.accept(id);
        this.message = r.ok ? `Görev kabul edildi: ${quests.forGiver(this.merchant.locationId).find((q) => q.id === id)?.title}` : r.reason;
        if (r.ok) {
          sfx.play('turn');
          this.deps.onChanged();
          if (r.completion) this.deps.onQuestCompletion(r.completion);
        }
        break;
      }
    }
    this.render();
  }

  private changed(sound: 'pick' | 'shieldUp'): void {
    this.deps.sfx.play(sound);
    this.deps.onChanged();
  }
}

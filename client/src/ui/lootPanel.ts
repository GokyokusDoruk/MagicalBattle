import { getItem } from '../economy/items';
import { ELEMENT_COLORS, RARITY_COLORS, getWand } from '../wands/catalog';
import { itemIconSvg } from './itemIcon';

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export interface LootView {
  /** Başlığın altındaki satır ("Köz Cini yenildi") */
  subtitle?: string;
  money: number;
  moneyName: string;
  xp: number;
  /** Seviye atlandıysa yeni seviye ve boş yetenek puanı */
  levelUp?: { level: number; skillPoints: number };
  /** Çantaya giren eşyalar ve asalar: kimlik ve adet */
  items: { id: string; count: number }[];
  wands: { id: string; count: number }[];
  /** Çantaya sığmayıp yere düşen eşya sayısı */
  dropped: number;
}

/**
 * Ganimet paneli (Task 57): zaferden sonra dünyaya dönmeden önce kazanılanlar listelenir ("Ganimetler toplandı").
 * Eşyalar ikonuyla ve nadirlik renginde, asalar elementinin rengiyle gösterilir. Devam'a basınca kapanır.
 */
export function showLootPanel(parent: HTMLElement, view: LootView): Promise<void> {
  const itemRows = view.items.map(({ id, count }) => {
    const def = getItem(id);
    const color = def?.rarity ? RARITY_COLORS[def.rarity] : '#e2e8f0';
    const icon = def ? `<span class="shrink-0">${itemIconSvg(def, 36)}</span>` : '';
    return `<li class="flex items-center gap-2 rounded bg-slate-900 p-2" data-item="${esc(id)}">${icon}<span class="min-w-0 flex-1 truncate font-bold" style="color:${color}">${esc(def?.name ?? id)}</span>${def?.level ? `<span class="text-xs text-slate-300">Sv ${def.level}</span>` : ''}<span class="text-sm text-slate-200">×${count}</span></li>`;
  });
  const wandRows = view.wands.map(({ id, count }) => {
    const w = getWand(id);
    const label = w
      ? `<span style="color:${ELEMENT_COLORS[w.element]}">●</span> <span class="font-bold" style="color:${RARITY_COLORS[w.rarity]}">${esc(w.name)}</span> <span class="text-xs text-slate-300">Sv ${w.level}</span>`
      : 'Asa';
    return `<li class="flex items-center gap-2 rounded bg-slate-900 p-2" data-wand="${esc(id)}"><span class="text-xl">🪄</span><span class="min-w-0 flex-1 truncate">${label}</span><span class="text-sm text-slate-200">×${count}</span></li>`;
  });
  const empty = itemRows.length + wandRows.length === 0;

  const panel = document.createElement('div');
  panel.className = 'fixed inset-0 z-[75] flex items-center justify-center bg-black/90 p-4';
  panel.setAttribute('role', 'dialog');
  panel.innerHTML = `
    <div class="flex max-h-full w-full max-w-sm flex-col gap-3 rounded-xl border border-amber-400/50 bg-slate-950 p-5 text-amber-50 shadow-2xl">
      <div class="text-center">
        <h2 class="text-xl font-bold text-amber-300" data-title>🎁 Ganimetler toplandı</h2>
        ${view.subtitle ? `<p class="text-sm text-slate-300">${esc(view.subtitle)}</p>` : ''}
      </div>
      <div class="flex justify-center gap-6 rounded bg-slate-900 p-2 text-base font-bold">
        <span class="text-emerald-300" data-money>+${view.money} ${esc(view.moneyName)}</span><span class="text-sky-300" data-xp>+${view.xp} XP</span>
      </div>
      ${view.levelUp ? `<p class="rounded bg-amber-300 px-3 py-1 text-center text-sm font-bold text-slate-900" data-levelup>Seviye atladın! Seviye ${view.levelUp.level} · yetenek puanın: ${view.levelUp.skillPoints} (K)</p>` : ''}
      <ul class="flex min-h-0 flex-col gap-1 overflow-y-auto" data-scrollable style="max-height:40vh;max-height:40dvh;touch-action:pan-y">${[...itemRows, ...wandRows].join('') || ''}</ul>
      ${empty ? '<p class="text-center text-sm text-slate-400">Bu sefer eşya düşmedi.</p>' : ''}
      ${view.dropped > 0 ? `<p class="text-center text-xs text-amber-300" data-dropped>Çantan dolu: ${view.dropped} parça yere düştü, 10 dakika içinde alabilirsin.</p>` : ''}
      <button data-ok type="button" class="rounded bg-amber-300 px-4 py-3 font-bold text-slate-900">Devam</button>
    </div>`;
  parent.appendChild(panel);
  return new Promise((resolve) => {
    panel.querySelector('[data-ok]')!.addEventListener('click', () => {
      panel.remove();
      resolve();
    });
  });
}

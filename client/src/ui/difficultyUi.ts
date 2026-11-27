import { DIFFICULTIES, DIFFICULTY_NAMES, DIFFICULTY_PROFILES, type Difficulty } from '../settings/difficulty';

const ICONS: Record<Difficulty, string> = { easy: '🌱', normal: '⚔️', hard: '💀' };

/**
 * Oyun seviyesi seçimi (Faz 2): üç büyük kart. Seçilince seçilen seviye, vazgeçilirse (arka plan ya da Kapat) null döner.
 * Seviye her an değiştirilebilir; etkisi bir sonraki savaştan ve ganimetten itibaren geçerlidir.
 */
export function chooseDifficulty(current: Difficulty): Promise<Difficulty | null> {
  const root = document.createElement('div');
  root.setAttribute('data-scrollable', '');
  root.style.touchAction = 'pan-y';
  root.className = 'fixed inset-0 z-[75] flex items-center justify-center overflow-y-auto bg-black/70 p-4';
  root.innerHTML = `
    <div class="w-full max-w-md rounded-2xl bg-slate-900 p-5 shadow-2xl ring-1 ring-amber-200/30">
      <h2 class="text-center text-xl font-bold text-amber-300">Oyun seviyesi</h2>
      <p class="mt-1 text-center text-sm text-slate-400">İstediğin an değiştirebilirsin. Bir sonraki savaştan itibaren geçerli olur.</p>
      <div class="mt-4 flex flex-col gap-3">
        ${DIFFICULTIES.map(
          (d) => `<button type="button" data-pick="${d}" class="flex items-center gap-3 rounded-xl px-4 py-3 text-left ring-2 ${d === current ? 'bg-amber-300/15 ring-amber-300' : 'bg-slate-800 ring-transparent hover:bg-slate-700'}">
            <span class="text-3xl" aria-hidden="true">${ICONS[d]}</span>
            <span class="flex-1"><b class="block text-base text-amber-50">${DIFFICULTY_NAMES[d]}${d === current ? ' <span class="text-xs font-normal text-amber-300">(şu an)</span>' : ''}</b>
            <span class="block text-xs leading-snug text-slate-300">${DIFFICULTY_PROFILES[d].summary}</span></span>
          </button>`,
        ).join('')}
      </div>
      <button type="button" data-close class="mt-4 w-full rounded-lg bg-white/10 py-2 text-sm text-slate-200 hover:bg-white/20">Kapat</button>
    </div>`;
  document.body.appendChild(root);
  return new Promise((resolve) => {
    const done = (d: Difficulty | null): void => {
      root.remove();
      resolve(d);
    };
    root.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const pick = t.closest<HTMLElement>('[data-pick]')?.dataset.pick as Difficulty | undefined;
      if (pick) done(pick);
      else if (t === root || t.closest('[data-close]')) done(null);
    });
  });
}

/**
 * Bölge savaşı girişi: ekran birkaç kez yanıp söner, dünya küçülüp tekrar büyür ve
 * "Bir düşman büyücü ortaya çıktı!" yazar; ardından savaş paneline geçilir.
 */

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export async function playEncounterIntro(enemyName: string, flashColor = '#ffffff'): Promise<void> {
  const world = document.querySelector<HTMLElement>('#world');
  const overlay = document.createElement('div');
  overlay.className = 'pointer-events-none fixed inset-0 z-[69] flex items-center justify-center';
  overlay.innerHTML = `<div data-flash class="absolute inset-0" style="background:${flashColor};opacity:0"></div>
    <div data-text class="relative max-w-[90%] rounded-lg bg-black/75 px-5 py-3 text-center text-amber-50 shadow-2xl" style="opacity:0">
      <div class="text-xl font-bold text-amber-300 sm:text-2xl">Bir düşman büyücü ortaya çıktı!</div>
      <div class="mt-1 text-sm text-slate-200">${esc(enemyName)}</div></div>`;
  document.body.appendChild(overlay);
  const flash = overlay.querySelector<HTMLElement>('[data-flash]')!;
  const text = overlay.querySelector<HTMLElement>('[data-text]')!;
  try {
    // 1) Ekran üç kez yanıp söner
    await flash.animate(
      [{ opacity: 0 }, { opacity: 0.85 }, { opacity: 0 }, { opacity: 0.85 }, { opacity: 0 }, { opacity: 0.85 }, { opacity: 0 }],
      { duration: 700, easing: 'ease-in-out' },
    ).finished;
    // 2) Dünya küçülür, yazı belirir, sonra dünya tekrar büyür
    const shrink = world?.animate(
      [
        { transform: 'scale(1)', filter: 'brightness(1)' },
        { transform: 'scale(0.4) rotate(-2deg)', filter: 'brightness(0.6)', offset: 0.4 },
        { transform: 'scale(0.4) rotate(-2deg)', filter: 'brightness(0.6)', offset: 0.7 },
        { transform: 'scale(1)', filter: 'brightness(1)' },
      ],
      { duration: 1600, easing: 'ease-in-out' },
    );
    text.animate([{ opacity: 0, transform: 'scale(0.7)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 350, fill: 'forwards', delay: 350 });
    await sleep(1700);
    await shrink?.finished.catch(() => undefined);
    await text.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: 'forwards' }).finished;
  } finally {
    overlay.remove();
  }
}

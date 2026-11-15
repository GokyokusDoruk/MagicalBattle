/**
 * Bölge savaşı girişi (Task 56): ekran iki kez yanıp söner, dünya **ekranın tam ortasına** doğru küçülür (parlaklığı kısılır), "Bir düşman
 * büyücü ortaya çıktı!" yazar, ardından ekran yumuşakça kararır. Savaş ekranı kararmanın üstüne açılır; hiçbir soru sorulmaz.
 * `release()` çağrılınca dünya eski hâline döner (savaş ekranının arkasında) ve karartma kalkar.
 */

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export interface EncounterIntroHandle {
  /** Dünyayı eski hâline döndürür ve karartmayı yumuşakça kaldırır (savaş ekranı açıldıktan sonra çağrılır). */
  release(): void;
}

/** Yumuşak geçiş eğrisi (başta ve sonda yavaş) */
const EASE = 'cubic-bezier(0.45, 0, 0.2, 1)';

export async function playEncounterIntro(enemyName: string, flashColor = '#ffffff'): Promise<EncounterIntroHandle> {
  const world = document.querySelector<HTMLElement>('#world');
  const overlay = document.createElement('div');
  overlay.className = 'pointer-events-none fixed inset-0 z-[69] flex items-center justify-center';
  overlay.innerHTML = `<div data-flash class="absolute inset-0" style="background:${flashColor};opacity:0"></div>
    <div data-black class="absolute inset-0 bg-black" style="opacity:0"></div>
    <div data-text class="relative max-w-[90%] rounded-lg bg-black/75 px-5 py-3 text-center text-amber-50 shadow-2xl" style="opacity:0">
      <div class="text-xl font-bold text-amber-300 sm:text-2xl">Bir düşman büyücü ortaya çıktı!</div>
      <div class="mt-1 text-sm text-slate-200">${esc(enemyName)}</div></div>`;
  document.body.appendChild(overlay);
  const flash = overlay.querySelector<HTMLElement>('[data-flash]')!;
  const black = overlay.querySelector<HTMLElement>('[data-black]')!;
  const text = overlay.querySelector<HTMLElement>('[data-text]')!;
  // Küçülme ekranın tam ortasından olsun: dönüşüm merkezi ekranın ortasıdır
  if (world) {
    world.style.transformOrigin = '50% 50%';
    world.style.willChange = 'transform, filter';
  }
  try {
    // 1) Ekran iki kez yanıp söner
    await flash.animate([{ opacity: 0 }, { opacity: 0.8 }, { opacity: 0 }, { opacity: 0.8 }, { opacity: 0 }], { duration: 560, easing: 'ease-in-out' }).finished;
    // 2) Dünya ortaya doğru küçülür, yazı belirir
    const zoom = world?.animate(
      [
        { transform: 'scale(1)', filter: 'brightness(1)' },
        { transform: 'scale(0.42)', filter: 'brightness(0.55)' },
      ],
      { duration: 800, easing: EASE, fill: 'forwards' },
    );
    text.animate([{ opacity: 0, transform: 'scale(0.8)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 420, fill: 'forwards', delay: 350, easing: EASE });
    await Promise.all([zoom?.finished.catch(() => undefined), sleep(800)]);
    await sleep(650);
    // 3) Yazı söner ve ekran yumuşakça kararır; savaş ekranı karanlığın üstüne açılır
    text.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 280, fill: 'forwards' });
    await black.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 420, fill: 'forwards', easing: EASE }).finished;
  } catch {
    // animasyon iptal edilirse sessizce devam
  }
  let released = false;
  return {
    release(): void {
      if (released) return;
      released = true;
      // Dünya eski hâline döner (savaş ekranının arkasında görünmez), karartma yumuşakça kalkar
      world?.getAnimations().forEach((a) => a.cancel());
      if (world) {
        world.style.transformOrigin = '';
        world.style.willChange = '';
      }
      const fade = overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 350, easing: 'ease-out', fill: 'forwards' });
      void fade.finished.then(() => overlay.remove(), () => overlay.remove());
    },
  };
}

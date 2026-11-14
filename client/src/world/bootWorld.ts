import * as Phaser from 'phaser';
import { buildTerrainCanvas } from './terrainTexture';
import { WorldScene, type WorldContext } from './WorldScene';

/**
 * Dünyayı başlatır: önce yumuşak arazi görselini çizer ("Dünya oluşturuluyor" yazısıyla), sonra oyunu açar.
 * Arazi görseli bir kez çizilir; harita değişmediği sürece yeniden çizilmez.
 */
export async function bootWorld(parent: HTMLElement, ctx: Omit<WorldContext, 'terrain'>): Promise<Phaser.Game> {
  const note = document.createElement('div');
  note.className = 'fixed inset-0 z-[90] flex items-center justify-center bg-[#111426] text-amber-200';
  note.innerHTML = '<div class="text-center"><div class="text-lg font-bold">Dünya oluşturuluyor…</div><div class="mt-2 h-1.5 w-56 overflow-hidden rounded bg-white/15"><div data-bar class="h-full w-0 bg-amber-300"></div></div></div>';
  document.body.appendChild(note);
  const bar = note.querySelector<HTMLElement>('[data-bar]')!;
  try {
    const terrain = await buildTerrainCanvas(ctx.map, (r) => (bar.style.width = `${Math.round(r * 100)}%`));
    return new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      backgroundColor: '#111426',
      pixelArt: true,
      scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
      scene: [new WorldScene({ ...ctx, terrain })],
    });
  } finally {
    note.remove();
  }
}

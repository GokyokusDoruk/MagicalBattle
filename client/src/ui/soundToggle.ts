import type { SoundEngine } from '../audio/sfx/engine';

/**
 * Tarayıcılar sesi, kullanıcı sayfayla etkileşene kadar engeller. İlk dokunuş, tıklama ya da tuşta ses
 * motorunu açar (bir kez), sonra dinleyicileri kaldırır.
 */
export function installAudioUnlock(engine: SoundEngine): void {
  const events = ['pointerdown', 'touchstart', 'keydown'] as const;
  const unlock = (): void => {
    engine.unlock();
    for (const e of events) window.removeEventListener(e, unlock, true);
  };
  for (const e of events) window.addEventListener(e, unlock, { capture: true, passive: true });
}

/** Sağ altta küçük bir ses aç/kapat düğmesi. Tercih yalnızca bu oturumda tutulur (hiçbir şey saklanmaz). */
export function createSoundToggle(engine: SoundEngine): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className =
    'fixed bottom-3 right-3 z-30 rounded-full bg-black/60 px-3 py-2 text-lg leading-none text-amber-50 shadow hover:bg-black/80';
  const render = (): void => {
    button.textContent = engine.isMuted ? '🔇' : '🔊';
    button.setAttribute('aria-label', engine.isMuted ? 'Sesi aç' : 'Sesi kapat');
  };
  button.addEventListener('click', () => {
    engine.unlock();
    engine.setMuted(!engine.isMuted);
    render();
    if (!engine.isMuted) engine.play('pick');
  });
  render();
  return button;
}

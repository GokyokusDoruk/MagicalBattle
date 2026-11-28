import { createHomeLink } from './homeLink';

/**
 * Sol üstte "← dorukplays" bağlantısı, oyuncu adı ve "Çıkış" düğmesi. `onLogout` null ise
 * çıkış düğmesi yoktur.
 */
export function createUserBadge(label: string, onLogout: (() => void) | null): HTMLDivElement {
  const el = document.createElement('div');
  el.className =
    'fixed left-3 top-3 z-40 flex items-center gap-2 rounded-lg bg-black/60 px-3 py-1.5 text-sm text-amber-100 shadow mobile:left-[calc(0.5rem+var(--sal))] mobile:top-[calc(0.5rem+var(--sat))] mobile:gap-1.5 mobile:px-1.5 mobile:py-1';
  el.appendChild(
    createHomeLink(
      'rounded bg-white/15 px-2 py-0.5 text-xs text-amber-200 no-underline hover:bg-white/30 mobile:inline-flex mobile:items-center mobile:justify-center mobile:text-sm',
      "dorukplays'e dönülsün mü? Son kayıt noktasından sonraki ilerleme kaybolabilir.",
    ),
  );
  const name = document.createElement('span');
  name.textContent = label;
  name.className = 'mobile:hidden';
  el.appendChild(name);

  if (onLogout) {
    const button = document.createElement('button');
    button.type = 'button';
    button.innerHTML = '<span class="hud-only-desktop">Çıkış</span><span class="hud-only-mobile" aria-hidden="true">⏻</span>';
    button.setAttribute('aria-label', 'Çıkış');
    button.className = 'rounded bg-white/15 px-2 py-0.5 text-xs hover:bg-white/30 mobile:text-base';
    button.addEventListener('click', onLogout);
    el.appendChild(button);
  }
  return el;
}

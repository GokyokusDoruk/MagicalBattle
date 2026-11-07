/** Sol üstte oyuncu adı ve "Çıkış" düğmesi. `onLogout` null ise (kayıtsız mod) çıkış düğmesi yoktur. */
export function createUserBadge(label: string, onLogout: (() => void) | null): HTMLDivElement {
  const el = document.createElement('div');
  el.className =
    'fixed left-3 top-3 z-40 flex items-center gap-2 rounded-lg bg-black/60 px-3 py-1.5 text-sm text-amber-100 shadow';
  const name = document.createElement('span');
  name.textContent = label;
  el.appendChild(name);

  if (onLogout) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Çıkış';
    button.className = 'rounded bg-white/15 px-2 py-0.5 text-xs hover:bg-white/30';
    button.addEventListener('click', onLogout);
    el.appendChild(button);
  }
  return el;
}

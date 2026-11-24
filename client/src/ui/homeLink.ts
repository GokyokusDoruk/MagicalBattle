/** dorukplays oyun listesinin adresi */
export const DORUKPLAYS_URL = 'https://dorukplays.com';

/**
 * "← dorukplays" bağlantısı. `confirmLeave` verilirse çıkmadan önce sorulur (oyun içinde son kayıt
 * noktasından sonraki ilerleme kaybolabilir).
 */
export function createHomeLink(className: string, confirmLeave?: string): HTMLAnchorElement {
  const a = document.createElement('a');
  a.href = DORUKPLAYS_URL;
  a.textContent = '← dorukplays';
  a.title = "dorukplays'e dön";
  a.setAttribute('aria-label', "dorukplays'e dön");
  a.className = className;
  if (confirmLeave) {
    a.addEventListener('click', (e) => {
      if (!window.confirm(confirmLeave)) e.preventDefault();
    });
  }
  return a;
}

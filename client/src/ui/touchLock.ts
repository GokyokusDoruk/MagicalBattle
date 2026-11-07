/**
 * Dokunmatikte sayfanın kaymasını, yakınlaştırmasını ve uzun basma menüsünü engeller.
 * Kaydırılması gereken bir alan olursa o elemente `data-scrollable` eklenir.
 */
export function lockTouchScroll(): void {
  const allowScroll = (target: EventTarget | null): boolean =>
    target instanceof Element && target.closest('[data-scrollable]') !== null;

  document.addEventListener(
    'touchmove',
    (e) => {
      if (!allowScroll(e.target)) e.preventDefault();
    },
    { passive: false },
  );
  // iOS Safari iki parmakla yakınlaştırma
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('contextmenu', (e) => {
    if (!allowScroll(e.target)) e.preventDefault();
  });
}

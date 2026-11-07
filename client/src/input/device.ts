/** Ana işaretçi dokunmatikse (telefon/tablet) true. Fare veya dokunmatik yüzeyli bilgisayarda false. */
export function isTouchDevice(): boolean {
  if (window.matchMedia('(pointer: coarse)').matches) return true;
  return navigator.maxTouchPoints > 0 && !window.matchMedia('(pointer: fine)').matches;
}

/** Cihaz türü değişirse (örn. klavye takılırsa) haber verir. Çağrıldığında hemen de çalışır. */
export function watchTouchDevice(callback: (isTouch: boolean) => void): void {
  const query = window.matchMedia('(pointer: coarse)');
  query.addEventListener('change', () => callback(isTouchDevice()));
  callback(isTouchDevice());
}

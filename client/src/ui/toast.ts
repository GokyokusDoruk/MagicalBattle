const VISIBLE_MS = 3200;

/** Ekranın üstünde kısa süre görünen bildirim. Yeni mesaj eskisinin yerine geçer. */
export class Toast {
  readonly element: HTMLDivElement;
  private timer: number | undefined;

  constructor() {
    this.element = document.createElement('div');
    this.element.className =
      'pointer-events-none fixed left-1/2 top-4 z-50 max-w-[80vw] -translate-x-1/2 rounded-lg bg-black/75 px-4 py-2 text-center text-sm text-amber-100 shadow-lg transition-opacity duration-300';
    this.element.style.opacity = '0';
    this.element.setAttribute('role', 'status');
  }

  show(message: string): void {
    this.element.textContent = message;
    this.element.style.opacity = '1';
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.element.style.opacity = '0';
    }, VISIBLE_MS);
  }
}

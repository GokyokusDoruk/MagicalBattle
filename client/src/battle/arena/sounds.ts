import type { Element } from '../damage/elements';

/**
 * Arenanın ses çıkışı. Arena hangi anda ne olduğunu söyler, sesi kim çalacağı dışarıdan verilir
 * (ses motoru ya da testlerde sahte). Verilmezse arena sessiz çalışır.
 */
export interface ArenaSounds {
  /** Büyü havada çizilmeye başlarken */
  charge(element: Element): void;
  /** Büyü rakibe fırlarken */
  launch(element: Element): void;
  /** Vuruş: `intensity` 0-1 (hasara göre), `head` başa vuruş mu */
  impact(element: Element, intensity: number, head: boolean): void;
  shieldUp(): void;
  /** `ratio`: saldırının savunulan oranı (0-1) */
  shieldBlock(ratio: number): void;
  shieldBreak(): void;
  /** Büyü yapılamadı */
  fizzle(): void;
  defeat(): void;
}

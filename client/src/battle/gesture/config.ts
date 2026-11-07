/**
 * Büyü çizimi ayarları. Hepsi denge için ayarlanabilir; değer değişince testler
 * kuralın davranışını (not: sayıları değil) doğrular.
 */

/** Çizim tuvalinin mantıksal boyutu. Ekran boyutundan bağımsızdır: saldıran ve savunan aynı alanı görür. */
export const LOGICAL_SIZE = 256;
/** Yoğunluk haritasının bir kenarındaki hücre sayısı */
export const GRID = 32;
export const CELL = LOGICAL_SIZE / GRID;
/** Fırça yarıçapı (mantıksal birim): çizgi bu kadar kalınlık sayılır */
export const BRUSH_RADIUS = 10;

/** Bir büyüyü çizmek için verilen süre (ilk dokunuştan itibaren) */
export const DRAW_TIME_MS = 3000;
/** Hiç dokunulmazsa tur bu süre sonunda "büyü yapamadı" ile biter */
export const IDLE_TIMEOUT_MS = 8000;
/** İki örnek arası bu süreyi aşarsa (olay kaybı) fazlası ağırlığa katılmaz */
export const MAX_SEGMENT_DT_MS = 200;
/** Basılı tutulurken ağırlığın birikmesi için örnekleme aralığı */
export const DWELL_SAMPLE_MS = 30;

/** Minimum hacim: kaplanan hücre sayısı (toplam GRID*GRID) */
export const MIN_INKED_CELLS = 24;
/** Minimum hacim: çizimin en uzun kenarı (mantıksal birim) */
export const MIN_EXTENT = 64;

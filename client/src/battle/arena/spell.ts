import * as THREE from 'three';
import { pathLength, type PlanePoint } from './strokeMap';

interface Piece {
  curve: THREE.CatmullRomCurve3;
  core: THREE.Mesh;
  glow: THREE.Mesh;
  length: number;
  start: number;
}

const CORE_RADIUS = 0.05;
const GLOW_RADIUS = 0.12;
const GLOW_OPACITY = 0.32;

/**
 * Çizilen büyünün 3D hali: her çizgi parlayan bir tüp olur. `setReveal` çizgileri çizildiği sırayla
 * ilerletir (büyü havada çiziliyor gibi). Çizim düzlemi yerel x-y düzlemindedir.
 */
export class SpellVisual {
  readonly group = new THREE.Group();
  private readonly pieces: Piece[] = [];
  private readonly total: number;
  private readonly coreMaterial: THREE.MeshBasicMaterial;
  private readonly glowMaterial: THREE.MeshBasicMaterial;
  private tip: THREE.Vector3 | null = null;
  /** Faz 6: alan büyüsünün dolu yüzeyi (doldurulan hücreler), yoksa null */
  private fill: THREE.Mesh | null = null;
  private fillMaterial: THREE.MeshBasicMaterial | null = null;

  constructor(paths: readonly PlanePoint[][], color: number, glowColor: number) {
    this.coreMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.4),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.glowMaterial = new THREE.MeshBasicMaterial({
      color: glowColor,
      transparent: true,
      opacity: GLOW_OPACITY,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    let start = 0;
    for (const path of paths) {
      if (path.length < 2) continue;
      const curve = new THREE.CatmullRomCurve3(path.map((p) => new THREE.Vector3(p.x, p.y, 0)), false, 'catmullrom', 0.3);
      const segments = Math.min(160, Math.max(12, path.length * 3));
      const core = new THREE.Mesh(new THREE.TubeGeometry(curve, segments, CORE_RADIUS, 5, false), this.coreMaterial);
      const glow = new THREE.Mesh(new THREE.TubeGeometry(curve, segments, GLOW_RADIUS, 5, false), this.glowMaterial);
      const length = Math.max(1e-6, pathLength(path));
      this.pieces.push({ curve, core, glow, length, start });
      start += length;
      this.group.add(core, glow);
    }
    this.total = Math.max(1e-6, start);
    this.setReveal(0);
  }

  /**
   * Faz 6: alan büyüsü: doldurulan hücreler (tuvalin `grid`×`grid` ızgarasında) mühür düzleminde parlayan yarı saydam bir yüzey olur.
   * `size` mührün dünyadaki genişliği (strokesToPaths ile aynı).
   */
  setFill(cells: readonly number[], grid: number, color: number, size: number): void {
    if (this.fill) {
      this.group.remove(this.fill);
      this.fill.geometry.dispose();
    }
    if (cells.length === 0) return;
    const step = size / grid;
    const pos = new Float32Array(cells.length * 18);
    cells.forEach((k, i) => {
      const x0 = (k % grid) * step - size / 2;
      const y0 = size / 2 - (Math.floor(k / grid) + 1) * step;
      const q = [x0, y0, x0 + step, y0, x0 + step, y0 + step, x0, y0, x0 + step, y0 + step, x0, y0 + step];
      for (let j = 0; j < 6; j++) {
        pos[i * 18 + j * 3] = q[j * 2];
        pos[i * 18 + j * 3 + 1] = q[j * 2 + 1];
        pos[i * 18 + j * 3 + 2] = -0.01;
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.fillMaterial ??= new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.fill = new THREE.Mesh(geo, this.fillMaterial);
    this.group.add(this.fill);
  }

  get isEmpty(): boolean {
    return this.pieces.length === 0;
  }

  /** 0-1: büyünün ne kadarının çizildiği. Çizginin uç noktası `tipWorld` ile alınır. */
  setReveal(fraction: number): void {
    const target = Math.min(1, Math.max(0, fraction)) * this.total;
    this.tip = null;
    for (const piece of this.pieces) {
      const share = Math.min(1, Math.max(0, (target - piece.start) / piece.length));
      for (const mesh of [piece.core, piece.glow]) {
        const count = mesh.geometry.index!.count;
        mesh.geometry.setDrawRange(0, Math.floor((count * share) / 3) * 3);
        mesh.visible = share > 0;
      }
      if (share > 0 && share < 1) this.tip = piece.curve.getPoint(share);
    }
    if (!this.tip && fraction >= 1 && this.pieces.length > 0) {
      this.tip = this.pieces[this.pieces.length - 1].curve.getPoint(1);
    }
  }

  /** Şu an çizilen ucun dünya konumu (kıvılcım saçmak için); çizim bitmişse ya da başlamamışsa null. */
  tipWorld(): THREE.Vector3 | null {
    return this.tip ? this.group.localToWorld(this.tip.clone()) : null;
  }

  /** Şeffaflık çarpanı (0-1): doğarken ve sönerken. */
  setOpacity(v: number): void {
    const o = Math.min(1, Math.max(0, v));
    this.coreMaterial.opacity = o;
    this.glowMaterial.opacity = GLOW_OPACITY * o;
    if (this.fillMaterial) this.fillMaterial.opacity = 0.45 * o;
  }

  dispose(): void {
    for (const p of this.pieces) {
      p.core.geometry.dispose();
      p.glow.geometry.dispose();
    }
    this.coreMaterial.dispose();
    this.glowMaterial.dispose();
    this.fill?.geometry.dispose();
    this.fillMaterial?.dispose();
  }
}

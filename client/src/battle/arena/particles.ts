import * as THREE from 'three';

export interface EmitOptions {
  color: number;
  count: number;
  /** Başlangıç hızı (birim/sn); parçacık başına rastgele 0.5-1 katı */
  speed: number;
  /** Ömür (sn); parçacık başına rastgele 0.6-1 katı */
  life: number;
  /** Yön verilirse parçacıklar o yönde koni içinde saçılır, verilmezse her yöne */
  direction?: THREE.Vector3;
  /** Koni açısı (0-1, 1 = her yön) */
  spread?: number;
  gravity?: number;
}

/** Yumuşak, ışıyan nokta dokusu (tarayıcıda). Testlerde `document` yoksa dokusuz çalışır. */
function glowTexture(): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (!g) return null;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/**
 * Havuzlu parçacık sistemi (tek `Points`): kıvılcım, iz ve patlama efektleri için.
 * Kapasite dolunca en eski parçacığın üzerine yazılır, bellek ve çizim yükü sabit kalır.
 */
export class ParticleSystem {
  readonly points: THREE.Points;
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly baseColors: Float32Array;
  private readonly velocities: Float32Array;
  private readonly life: Float32Array;
  private readonly maxLife: Float32Array;
  private readonly gravity: Float32Array;
  private cursor = 0;

  constructor(
    readonly capacity = 500,
    private readonly rand: () => number = Math.random,
  ) {
    this.positions = new Float32Array(capacity * 3);
    this.colors = new Float32Array(capacity * 3);
    this.baseColors = new Float32Array(capacity * 3);
    this.velocities = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity).fill(1);
    this.gravity = new Float32Array(capacity);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    const map = glowTexture();
    const material = new THREE.PointsMaterial({
      size: 0.32,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      ...(map ? { map } : {}),
    });
    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
  }

  get aliveCount(): number {
    let n = 0;
    for (let i = 0; i < this.capacity; i++) if (this.life[i] > 0) n++;
    return n;
  }

  emit(origin: THREE.Vector3, o: EmitOptions): void {
    const color = new THREE.Color(o.color);
    const spread = o.spread ?? 1;
    const dir = o.direction?.clone().normalize();
    for (let n = 0; n < o.count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.capacity;

      // Rastgele yön: tüm küre ya da verilen yönün etrafında koni
      const v = new THREE.Vector3(this.rand() * 2 - 1, this.rand() * 2 - 1, this.rand() * 2 - 1);
      if (v.lengthSq() < 1e-6) v.set(0, 1, 0);
      v.normalize();
      if (dir) v.lerp(dir, 1 - spread).normalize();
      v.multiplyScalar(o.speed * (0.5 + this.rand() * 0.5));

      this.positions.set([origin.x, origin.y, origin.z], i * 3);
      this.velocities.set([v.x, v.y, v.z], i * 3);
      this.baseColors.set([color.r, color.g, color.b], i * 3);
      this.colors.set([color.r, color.g, color.b], i * 3);
      this.maxLife[i] = o.life * (0.6 + this.rand() * 0.4);
      this.life[i] = this.maxLife[i];
      this.gravity[i] = o.gravity ?? 0;
    }
    this.flag();
  }

  update(dt: number): void {
    for (let i = 0; i < this.capacity; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const k = i * 3;
      if (this.life[i] <= 0) {
        this.colors[k] = this.colors[k + 1] = this.colors[k + 2] = 0; // sönük = görünmez (toplamalı karışım)
        continue;
      }
      this.velocities[k + 1] -= this.gravity[i] * dt;
      this.positions[k] += this.velocities[k] * dt;
      this.positions[k + 1] += this.velocities[k + 1] * dt;
      this.positions[k + 2] += this.velocities[k + 2] * dt;
      const fade = this.life[i] / this.maxLife[i];
      this.colors[k] = this.baseColors[k] * fade;
      this.colors[k + 1] = this.baseColors[k + 1] * fade;
      this.colors[k + 2] = this.baseColors[k + 2] * fade;
    }
    this.flag();
  }

  clear(): void {
    this.life.fill(0);
    this.colors.fill(0);
    this.flag();
  }

  dispose(): void {
    this.points.geometry.dispose();
    (this.points.material as THREE.PointsMaterial).map?.dispose();
    (this.points.material as THREE.PointsMaterial).dispose();
  }

  private flag(): void {
    const g = this.points.geometry;
    (g.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (g.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
  }
}

import { wandGeometry } from './wandModel';
import * as THREE from 'three';
import type { Element } from '../damage/elements';
import { ELEMENT_COLORS } from './palette';

const SKIN = 0xf0c8a0;
const FLASH = new THREE.Color(0xffffff);

/**
 * Düşük poligonlu büyücü: cüppe, kafa, şapka ve ucunda element küresi olan asa.
 * Hepsi koda çizilir. Animasyonlar (bekleme, büyü, savunma, vuruş, yenilgi) zamanla `update` ile ilerler.
 */
export class Combatant {
  /** Arenadaki yeri ve yönü bu grup üzerinden verilir */
  readonly group = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly staff = new THREE.Group();
  private readonly orbMaterial: THREE.MeshLambertMaterial;
  private readonly flashMaterials: THREE.MeshLambertMaterial[] = [];
  private readonly baseColors: THREE.Color[] = [];
  private readonly disposables: { dispose(): void }[] = [];

  private time = Math.random() * 10;
  private castLeft = 0;
  private castTotal = 1;
  private defendLeft = 0;
  private hitLeft = 0;
  private hitStrength = 0;
  private defeatedAmount = 0;
  private defeated = false;

  constructor(
    readonly name: string,
    readonly element: Element,
  ) {
    const colors = ELEMENT_COLORS[element];
    const cloak = this.material(colors.main, 0.12);
    const trim = this.material(new THREE.Color(colors.main).multiplyScalar(0.55).getHex(), 0.05);
    const skin = this.material(SKIN, 0.4);
    const wood = this.material(0xb07a42, 0.12);
    this.orbMaterial = this.material(colors.glow, 0.9);

    const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh => {
      this.disposables.push(geo);
      return new THREE.Mesh(geo, mat);
    };

    const robe = mesh(new THREE.ConeGeometry(0.78, 1.9, 8), cloak);
    robe.position.y = 0.95;
    const sash = mesh(new THREE.CylinderGeometry(0.5, 0.52, 0.14, 8), trim);
    sash.position.y = 1.25;
    const head = mesh(new THREE.SphereGeometry(0.32, 8, 6), skin);
    head.position.y = 2.15;
    const hat = mesh(new THREE.ConeGeometry(0.46, 0.95, 8), trim);
    hat.position.y = 2.82;
    hat.rotation.z = 0.12;
    const brim = mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.07, 10), trim);
    brim.position.y = 2.42;

    // Gerçek asa modeli (paylaşılan geometri, atılmaz); ucunda element küresi parlar
    const rod = new THREE.Mesh(wandGeometry(), wood);
    const orb = mesh(new THREE.SphereGeometry(0.15, 8, 6), this.orbMaterial);
    orb.position.y = 2.62;
    this.staff.add(rod, orb);
    this.staff.position.set(0.72, 0, 0.25);

    // Ayak halkası: element renginde zemin işareti
    const ring = mesh(
      new THREE.RingGeometry(0.85, 1.05, 24),
      new THREE.MeshBasicMaterial({ color: colors.glow, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    this.disposables.push(ring.material as THREE.Material);

    this.body.add(robe, sash, head, hat, brim, this.staff);
    this.group.add(this.body, ring);
  }

  /** Vuruş parlaması için renkleri izlenen yarı parlak malzeme. */
  private material(color: number, emissive: number): THREE.MeshLambertMaterial {
    const m = new THREE.MeshLambertMaterial({ color, flatShading: true });
    m.emissive = new THREE.Color(color).multiplyScalar(emissive);
    this.flashMaterials.push(m);
    this.baseColors.push(m.emissive.clone());
    this.disposables.push(m);
    return m;
  }

  /** Büyü çekme hareketi: asa yukarı kalkar, orb parlar. */
  cast(durationSec = 1.3): void {
    this.castTotal = durationSec;
    this.castLeft = durationSec;
  }

  /** Savunma duruşu: geriye yaslanır, asayı öne uzatır. */
  defend(durationSec = 2): void {
    this.defendLeft = durationSec;
  }

  endDefend(): void {
    this.defendLeft = 0;
  }

  /** Vuruş tepkisi: beyaz parlama, geri savrulma. `strength` 0-1. */
  hit(strength: number): void {
    this.hitStrength = Math.min(1, Math.max(0.15, strength));
    this.hitLeft = 0.5;
  }

  defeat(): void {
    this.defeated = true;
  }

  reset(): void {
    this.defeated = false;
    this.defeatedAmount = 0;
    this.castLeft = this.defendLeft = this.hitLeft = 0;
  }

  get isDefeated(): boolean {
    return this.defeated;
  }

  update(dt: number): void {
    this.time += dt;
    this.castLeft = Math.max(0, this.castLeft - dt);
    this.defendLeft = Math.max(0, this.defendLeft - dt);
    this.hitLeft = Math.max(0, this.hitLeft - dt);
    this.defeatedAmount = THREE.MathUtils.clamp(this.defeatedAmount + (this.defeated ? dt / 0.8 : -dt / 0.4), 0, 1);

    // Bekleme: hafif süzülme
    let y = Math.sin(this.time * 2) * 0.06;
    let lean = 0;
    let staffZ = 0;
    let staffX = 0;
    let orbGlow = 0.9;

    if (this.castLeft > 0) {
      const p = 1 - this.castLeft / this.castTotal; // 0→1
      const bump = Math.sin(Math.min(1, p) * Math.PI); // yukarı kalk, geri in
      staffZ = -bump * 1.0;
      staffX = bump * 0.25;
      lean = bump * 0.18;
      y += bump * 0.12;
      orbGlow = 0.9 + bump * 2.2;
    }
    if (this.defendLeft > 0) {
      lean -= 0.22;
      staffX = 0.9;
      staffZ = 0.15;
      orbGlow = 2.2;
    }

    let knock = 0;
    let flash = 0;
    if (this.hitLeft > 0) {
      const k = this.hitLeft / 0.5;
      knock = k * 0.7 * this.hitStrength;
      flash = k * this.hitStrength;
      lean -= k * 0.3 * this.hitStrength;
    }

    const f = this.defeatedAmount;
    this.body.position.set(0, y - f * 0.45, -knock);
    this.body.rotation.set(lean + f * 0.4, 0, f * (Math.PI / 2.2));
    this.staff.rotation.set(staffX, 0, staffZ);
    this.orbMaterial.emissive.set(ELEMENT_COLORS[this.element].glow).multiplyScalar(orbGlow);

    this.flashMaterials.forEach((m, i) => {
      if (m === this.orbMaterial) return;
      m.emissive.copy(this.baseColors[i]).lerp(FLASH, flash * 0.8);
    });
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}

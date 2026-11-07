import * as THREE from 'three';

export function bootBattle(parent: HTMLElement): void {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  parent.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.z = 3;

  const mesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1, 0),
    new THREE.MeshNormalMaterial({ flatShading: true }),
  );
  scene.add(mesh);

  const resize = (): void => {
    const { clientWidth: w, clientHeight: h } = parent;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(parent);
  resize();

  renderer.setAnimationLoop(() => {
    mesh.rotation.x += 0.01;
    mesh.rotation.y += 0.014;
    renderer.render(scene, camera);
  });
}

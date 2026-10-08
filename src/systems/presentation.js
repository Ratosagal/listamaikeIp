import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// Batch immovable surfaces by material and district; retain small culling bounds.
export function batchStatic(scene, meshes) {
  scene.updateMatrixWorld(true);
  const batches = new Map();
  const position = new THREE.Vector3();
  for (const mesh of meshes) {
    if (!mesh.isMesh || mesh.isInstancedMesh || Array.isArray(mesh.material))
      continue;
    mesh.getWorldPosition(position);
    const key = `${mesh.material.uuid}:${Math.floor(position.x / 32)}:${Math.floor(position.z / 32)}`;
    if (!batches.has(key))
      batches.set(key, { material: mesh.material, meshes: [] });
    batches.get(key).meshes.push(mesh);
  }
  let removed = 0;
  for (const batch of batches.values()) {
    if (batch.meshes.length < 2) continue;
    const geometries = batch.meshes.map((mesh) => {
      const geometry = mesh.geometry.index
        ? mesh.geometry.toNonIndexed()
        : mesh.geometry.clone();
      return geometry.applyMatrix4(mesh.matrixWorld);
    });
    const merged = mergeGeometries(geometries);
    geometries.forEach((g) => g.dispose());
    if (!merged) continue;
    merged.computeBoundingSphere();
    const surface = new THREE.Mesh(merged, batch.material);
    surface.castShadow = batch.meshes.some((m) => m.castShadow);
    surface.receiveShadow = true;
    surface.name = "district-surface";
    scene.add(surface);
    for (const mesh of batch.meshes) mesh.removeFromParent();
    removed += batch.meshes.length - 1;
  }
  return removed;
}
export function architecturalTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#c6ccc6";
  ctx.fillRect(0, 0, 256, 256);
  // Deterministic weathering, mortar, streaks and chipped paint.
  let seed = 711;
  const random = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 6000; i++) {
    const shade = 120 + random() * 100;
    ctx.fillStyle = `rgba(${shade},${shade},${shade},.13)`;
    ctx.fillRect(
      random() * 256,
      random() * 256,
      1 + random() * 3,
      1 + random() * 4,
    );
  }
  ctx.strokeStyle = "#89969040";
  ctx.lineWidth = 1;
  for (let y = 0; y < 256; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }
  for (let i = 0; i < 28; i++) {
    ctx.fillStyle = "#3e524618";
    ctx.fillRect(random() * 256, 0, 1 + random() * 5, 10 + random() * 140);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  return texture;
}
export function createAtmosphere(scene) {
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(200, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color(0x233b52) },
        bottom: { value: new THREE.Color(0xb4c0b9) },
      },
      vertexShader:
        "varying vec3 direction; void main(){direction=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
      fragmentShader:
        "varying vec3 direction; uniform vec3 top; uniform vec3 bottom; void main(){float h=clamp(normalize(direction).y,0.0,1.0);gl_FragColor=vec4(mix(bottom,top,pow(h,.65)),1.0);\n #include <tonemapping_fragment>\n #include <colorspace_fragment>\n}",
    }),
  );
  sky.name = "atmosphere";
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  scene.add(sky);
  const fill = new THREE.DirectionalLight(0x8eafcb, 0.7);
  fill.position.set(-25, 20, -35);
  scene.add(fill);
  const dayTop = new THREE.Color(0x506c87),
    nightTop = new THREE.Color(0x0d182b),
    dayHorizon = new THREE.Color(0xb7c1b2),
    nightHorizon = new THREE.Color(0x263544);
  const update = (phase, player, ambient, sun, fog) => {
    const daylight = Math.max(0, Math.sin(phase * Math.PI * 2)),
      dusk = 1 - Math.min(1, daylight * 3);
    sky.position.set(player.x, 0, player.z);
    sky.material.uniforms.top.value.copy(nightTop).lerp(dayTop, daylight);
    sky.material.uniforms.bottom.value
      .copy(nightHorizon)
      .lerp(dayHorizon, daylight);
    fog.color.copy(sky.material.uniforms.bottom.value);
    fog.density = 0.0105 + dusk * 0.003;
    ambient.intensity = 0.55 + daylight * 0.85;
    sun.intensity = 0.45 + daylight * 2.25;
    sun.color.set(daylight > 0.4 ? 0xffdfaf : 0xa5b9d0);
    fill.intensity = 0.35 + daylight * 0.45;
  };
  return { update };
}
export function streetDetails(scene) {
  const concrete = new THREE.MeshStandardMaterial({
    color: 0x78837d,
    roughness: 0.9,
  });
  const road = new THREE.MeshStandardMaterial({
    color: 0x252f35,
    roughness: 0.77,
  });
  const make = (w, h, d, x, y, z, mat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.receiveShadow = true;
    scene.add(m);
    return m;
  };
  // Sidewalks and curbs leave the central streets open for travel and construction.
  for (const x of [15.6, 32.4]) {
    make(1.7, 0.06, 184, x, 0.015, 0, concrete);
    for (let z = -88; z < 90; z += 6)
      make(0.16, 0.1, 5.8, x + (x < 24 ? 0.8 : -0.8), 0.045, z, concrete);
  }
  for (const z of [-32.1, -17.9]) make(185, 0.06, 1.8, 0, 0.018, z, concrete);
  for (let i = 0; i < 16; i++)
    make(0.16, 0.015, 1.8, 18 + i * 0.75, 0.055, -25, concrete);
  // Shallow wet asphalt patches: restrained highlights, no reflective render pass.
  const wet = new THREE.MeshStandardMaterial({
    color: 0x344b53,
    roughness: 0.16,
    metalness: 0.25,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  for (let i = 0; i < 12; i++) {
    const puddle = new THREE.Mesh(new THREE.CircleGeometry(1, 18), wet);
    puddle.rotation.x = -Math.PI / 2;
    puddle.scale.set(1.2 + (i % 3), 0.5 + (i % 2) * 0.6, 1);
    puddle.position.set(i % 2 ? 22 : 27, 0.062, -65 + i * 12);
    scene.add(puddle);
  }
  // Keep a consistent darker street palette under the new lighting.
  scene.traverse((o) => {
    if (
      o.isMesh &&
      o.geometry.parameters?.width === 15 &&
      o.geometry.parameters?.depth === 190
    )
      o.material = road;
  });
}

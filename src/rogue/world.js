import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { pillarsFor, REGIONS } from "./simulation.js";
const palette = [
  {
    floor: 0x263c3b,
    stone: 0x50625b,
    trim: 0xa79669,
    leaf: 0x496458,
    glow: 0x7ed7bd,
    void: 0x101b22,
  },
  {
    floor: 0x293347,
    stone: 0x586378,
    trim: 0x9c9ab6,
    leaf: 0x615775,
    glow: 0xa8b8f0,
    void: 0x121924,
  },
  {
    floor: 0x382a38,
    stone: 0x66545e,
    trim: 0xaf8e74,
    leaf: 0x76505d,
    glow: 0xf0a0b4,
    void: 0x20151f,
  },
];
const mats = new Map(),
  geos = new Map(),
  glows = new Map();
export function mat(color, roughness = 0.85, metalness = 0) {
  const key = `${color}:${roughness}:${metalness}`;
  if (!mats.has(key))
    mats.set(
      key,
      new THREE.MeshStandardMaterial({ color, roughness, metalness }),
    );
  return mats.get(key);
}
export function mesh(parent, geometry, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(
    geometry,
    typeof material === "number" ? mat(material) : material,
  );
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}
export function box(parent, w, h, d, color, x = 0, y = h / 2, z = 0) {
  const k = `b${w},${h},${d}`;
  if (!geos.has(k)) geos.set(k, new THREE.BoxGeometry(w, h, d));
  return mesh(parent, geos.get(k), color, x, y, z);
}
export function orb(parent, r, color, x = 0, y = 0, z = 0) {
  const k = `s${r}`;
  if (!geos.has(k)) geos.set(k, new THREE.SphereGeometry(r, 12, 8));
  return mesh(parent, geos.get(k), color, x, y, z);
}
export function cylinder(parent, r, h, color, x = 0, y = h / 2, z = 0) {
  const k = `c${r},${h}`;
  if (!geos.has(k)) geos.set(k, new THREE.CylinderGeometry(r, r * 1.08, h, 12));
  return mesh(parent, geos.get(k), color, x, y, z);
}
export function glow(color) {
  if (!glows.has(color))
    glows.set(
      color,
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 1.6,
        roughness: 0.35,
      }),
    );
  return glows.get(color);
}
function floorTexture(region) {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const ctx = c.getContext("2d");
  ctx.fillStyle = ["#71827a", "#6b7387", "#82707c"][region];
  ctx.fillRect(0, 0, 512, 512);
  let seed = 1029;
  const random = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 11000; i++) {
    const shade = 80 + random() * 110;
    ctx.fillStyle = `rgba(${shade},${shade},${shade},.12)`;
    ctx.fillRect(
      random() * 512,
      random() * 512,
      1 + random() * 3,
      1 + random() * 3,
    );
  }
  ctx.strokeStyle = "#17252b88";
  ctx.lineWidth = 2;
  for (let y = 0; y < 512; y += 128)
    for (let x = 0; x < 512; x += 128) {
      ctx.strokeRect(x + 2, y + 2, 124, 124);
      if (random() > 0.4) {
        ctx.beginPath();
        ctx.moveTo(x + random() * 128, y);
        ctx.lineTo(x + 60, y + 60);
        ctx.lineTo(x + random() * 128, y + 128);
        ctx.stroke();
      }
    }
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 2.4);
  return texture;
}
export function buildStage(scene, region = 0, hub = false, room = 0) {
  const colors = palette[region],
    group = new THREE.Group();
  scene.add(group);
  scene.background = new THREE.Color(colors.void);
  scene.fog = new THREE.Fog(colors.void, 38, 80);
  const floorMaterial = mat(colors.floor).clone();
  floorMaterial.map = floorTexture(region);
  floorMaterial.color.setHex([0x778c83, 0x7d8ca6, 0x8b7681][region]);
  box(group, 26, 0.65, 20, floorMaterial, 0, -0.36, 0);
  for (const sign of [-1, 1]) {
    box(group, 26, 0.3, 0.45, colors.trim, 0, -0.03, sign * 9.65);
    box(group, 0.45, 0.3, 20, colors.trim, sign * 12.65, -0.03, 0);
    box(group, 27, 0.9, 0.55, colors.stone, 0, -0.8, sign * 10.1);
  }
  const center = mesh(
    group,
    new THREE.RingGeometry(3.7, 3.77, 64),
    mat(colors.trim, 0.4, 0.4),
    0,
    0.01,
    0,
  );
  center.rotation.x = -Math.PI / 2;
  const inner = mesh(
    group,
    new THREE.RingGeometry(3.15, 3.18, 64),
    mat(colors.trim, 0.4, 0.4),
    0,
    0.012,
    0,
  );
  inner.rotation.x = -Math.PI / 2;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const rune = box(
      group,
      0.07,
      0.015,
      0.27,
      colors.trim,
      Math.sin(a) * 3.4,
      0.015,
      Math.cos(a) * 3.4,
    );
    rune.rotation.y = a;
  }
  for (const p of pillarsFor(room)) {
    cylinder(group, 1.15, 0.25, colors.stone, p.x, 0.1, p.z);
    cylinder(group, 0.74, 3.5, colors.stone, p.x, 1.9, p.z);
    cylinder(group, 0.88, 0.2, colors.trim, p.x, 3.55, p.z);
    cylinder(group, 0.87, 0.25, colors.stone, p.x, 3.75, p.z);
    for (let a = 0; a < 8; a++) {
      const angle = (a / 8) * Math.PI * 2;
      cylinder(
        group,
        0.055,
        3.2,
        mat(colors.trim),
        p.x + Math.cos(angle) * 0.73,
        1.85,
        p.z + Math.sin(angle) * 0.73,
      );
    }
    if (region === 0)
      for (let i = 0; i < 4; i++) {
        const leaf = orb(
          group,
          0.3,
          colors.leaf,
          p.x + Math.sin(i * 2) * 0.85,
          1 + i * 0.5,
          p.z + Math.cos(i * 2) * 0.85,
        );
        leaf.scale.set(1, 0.35, 0.6);
      }
  }
  for (let i = 0; i < 12; i++) {
    const x = (i % 2 ? 1 : -1) * (11.8 + (i % 3) * 0.3),
      z = -8 + Math.floor(i / 2) * 3;
    box(group, 0.6, 0.25, 0.9, colors.stone, x, 0.1, z).rotation.y = i * 0.8;
  }
  // Light wells, bronze braziers and broken steps around the suspended arena.
  const flames = [];
  for (const x of [-11, 11])
    for (const z of [-7, 7]) {
      cylinder(group, 0.43, 0.3, colors.trim, x, 0.15, z);
      cylinder(group, 0.18, 1.1, colors.stone, x, 0.8, z);
      const bowl = mesh(
        group,
        new THREE.TorusGeometry(0.37, 0.09, 6, 20),
        mat(colors.trim, 0.4, 0.5),
        x,
        1.45,
        z,
      );
      bowl.rotation.x = Math.PI / 2;
      const flame = orb(group, 0.24, glow(colors.glow), x, 1.65, z);
      flame.scale.y = 1.7;
      flames.push(flame);
      const point = new THREE.PointLight(colors.glow, 6, 6, 2);
      point.position.set(x, 2, z);
      group.add(point);
    }
  for (const z of [-12, 12])
    for (let x = -15; x <= 15; x += 3.5) {
      const height = 1.2 + ((Math.abs(x * 7 + z) % 7) / 7) * 3;
      box(group, 1.9, height, 2.4, colors.stone, x, -1 - height / 2, z);
    }
  const gates = [];
  for (const x of hub ? [0] : [-4, 4]) {
    const gate = new THREE.Group();
    gate.position.set(x, 0, -8.4);
    group.add(gate);
    box(gate, 0.35, 3.7, 0.6, colors.stone, -1.2, 1.8, 0);
    box(gate, 0.35, 3.7, 0.6, colors.stone, 1.2, 1.8, 0);
    const arch = mesh(
      gate,
      new THREE.TorusGeometry(1.2, 0.19, 6, 24, Math.PI),
      mat(colors.trim),
      0,
      3.5,
      0,
    );
    arch.rotation.z = 0;
    const energy = mesh(
      gate,
      new THREE.PlaneGeometry(2.1, 3.3),
      new THREE.MeshBasicMaterial({
        color: x < 0 ? 0xe8c38b : colors.glow,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
      0,
      1.7,
      0.05,
    );
    gates.push(energy);
  }
  const altar = new THREE.Group();
  group.add(altar);
  cylinder(altar, 0.62, 0.6, colors.stone, 0, 0.3, 0);
  const crystal = mesh(
    altar,
    new THREE.OctahedronGeometry(0.4, 0),
    glow(0xe6bf83),
    0,
    1.2,
    0,
  );
  const npcs = [];
  if (hub) {
    for (const [i, x] of [-5, 0, 5].entries()) {
      const npc = new THREE.Group();
      npc.position.set(x, 0, -2);
      group.add(npc);
      const robe = mesh(
        npc,
        new THREE.ConeGeometry(0.42, 1.6, 12),
        mat([0x546f70, 0x806650, 0x5f5275][i]),
        0,
        0.85,
        0,
      );
      orb(npc, 0.22, 0xc6ad94, 0, 1.8, 0);
      const hood = orb(
        npc,
        0.26,
        [0x293d47, 0x46362c, 0x403346][i],
        0,
        1.9,
        0.07,
      );
      hood.scale.z = 0.8;
      cylinder(npc, 0.025, 2, colors.trim, 0.48, 1, 0);
      orb(npc, 0.07, glow(colors.glow), 0.48, 2, 0);
      npcs.push(npc);
    }
  }
  // Batch static details locally. Animated glow and actors retain their own transforms.
  group.updateMatrixWorld(true);
  const exclude = new Set([...flames, ...gates, crystal]);
  altar.traverse((o) => exclude.add(o));
  for (const npc of npcs) npc.traverse((o) => exclude.add(o));
  const sharedGeometry = new Set(geos.values()),
    sharedMaterials = new Set([...mats.values(), ...glows.values()]);
  const ownedGeometry = new Set(),
    ownedMaterials = new Set();
  group.traverse((o) => {
    if (o.geometry && !sharedGeometry.has(o.geometry))
      ownedGeometry.add(o.geometry);
    if (
      o.material &&
      !sharedMaterials.has(o.material) &&
      o.material !== floorMaterial
    )
      ownedMaterials.add(o.material);
  });
  const batches = new Map();
  group.traverse((o) => {
    if (o.isMesh && !exclude.has(o) && !o.material.transparent) {
      if (!batches.has(o.material)) batches.set(o.material, []);
      batches.get(o.material).push(o);
    }
  });
  const temporaryGeometry = [];
  for (const [material, meshes] of batches) {
    if (meshes.length < 2) continue;
    const copies = meshes.map((m) => {
      const geo = m.geometry.index
        ? m.geometry.toNonIndexed()
        : m.geometry.clone();
      return geo.applyMatrix4(m.matrixWorld);
    });
    const geometry = mergeGeometries(copies);
    copies.forEach((g) => g.dispose());
    if (geometry) {
      const combined = mesh(group, geometry, material);
      temporaryGeometry.push(geometry);
      for (const m of meshes) m.removeFromParent();
    }
  }
  return {
    group,
    colors,
    altar,
    gates,
    npcs,
    update(time, phase) {
      altar.visible = phase === "cleared";
      crystal.rotation.y = time;
      crystal.position.y = 1.2 + Math.sin(time * 2) * 0.1;
      for (const [i, f] of flames.entries())
        f.scale.y = 1.6 + Math.sin(time * 6 + i) * 0.12;
      for (const gate of gates) {
        gate.visible = ["hub", "exit", "shop"].includes(phase);
        gate.material.opacity = 0.15 + Math.sin(time * 2) * 0.04;
      }
    },
    dispose() {
      scene.remove(group);
      floorMaterial.map.dispose();
      floorMaterial.dispose();
      temporaryGeometry.forEach((g) => g.dispose());
      ownedGeometry.forEach((g) => g.dispose());
      ownedMaterials.forEach((m) => m.dispose());
      group.traverse((o) => {
        if (o.isPointLight) o.dispose();
      });
    },
  };
}
export function enemyModel(scene, e, region) {
  const group = new THREE.Group();
  scene.add(group);
  const color =
      e.type === "boss"
        ? [0x596c68, 0x565c7e, 0x785266][region]
        : e.type === "brute"
          ? 0x726974
          : e.type === "archer"
            ? 0x71627b
            : 0x45696a,
    eye = glow(e.type === "boss" ? 0xf3b690 : 0xe8a4ba),
    body = new THREE.Group();
  group.add(body);
  group.userData.body = body;
  const legs = [],
    arms = [];
  if (e.type === "wisp") {
    const core = orb(body, 0.48, eye, 0, 0.95, 0);
    mesh(
      body,
      new THREE.TorusGeometry(0.65, 0.04, 6, 20),
      mat(color),
      0,
      0.95,
      0,
    ).rotation.x = Math.PI / 2;
    group.userData.legs = [];
    return group;
  }
  const scale = e.type === "boss" ? 2.0 : e.type === "brute" ? 1.25 : 1;
  group.scale.setScalar(scale);
  const cloak = mesh(
    body,
    new THREE.ConeGeometry(0.42, 0.9, 8),
    mat(color),
    0,
    0.9,
    0,
  );
  cloak.rotation.z = Math.PI;
  orb(body, 0.24, color, 0, 1.65, 0);
  for (const sign of [-1, 1]) {
    orb(body, 0.045, eye, sign * 0.1, 1.67, -0.22);
    const leg = new THREE.Group();
    leg.position.set(sign * 0.17, 0.65, 0);
    body.add(leg);
    cylinder(leg, 0.1, 0.58, 0x243139, 0, -0.27, 0);
    box(leg, 0.21, 0.14, 0.33, 0x29363d, 0, -0.58, -0.03);
    legs.push(leg);
    const arm = new THREE.Group();
    arm.position.set(sign * 0.36, 1.3, 0);
    body.add(arm);
    cylinder(arm, 0.08, 0.6, color, 0, -0.29, 0);
    orb(arm, 0.09, 0x526266, 0, -0.64, 0);
    arms.push(arm);
  }
  if (e.type === "brute" || (e.type === "boss" && region === 0)) {
    box(body, 0.85, 0.22, 0.52, mat(0xaaa18b, 0.4, 0.5), 0, 1.4, 0);
    const weapon = box(arms[1], 0.18, 1.4, 0.18, 0x8a8f84, 0, -0.6, -0.2);
    box(arms[1], 0.65, 0.35, 0.25, 0xa6a58d, 0, -1.22, -0.2);
  }
  if (e.type === "archer" || (e.type === "boss" && region > 0)) {
    cylinder(arms[1], 0.035, 1.4, 0x9b8c78, 0, -0.4, 0);
    orb(arms[1], 0.12, eye, 0, 0.35, 0);
  }
  if (e.type === "boss" && region === 1)
    for (const sign of [-1, 1]) {
      const wing = mesh(
        body,
        new THREE.ConeGeometry(0.5, 1.8, 4),
        mat(color),
        sign * 0.8,
        1.2,
        0.3,
      );
      wing.rotation.z = sign * -0.55;
    }
  if (e.type === "boss" && region === 2) {
    const crown = mesh(
      body,
      new THREE.TorusGeometry(0.43, 0.04, 6, 24),
      eye,
      0,
      2.05,
      0,
    );
    crown.rotation.x = Math.PI / 2;
  }
  group.userData.legs = legs;
  group.userData.arms = arms;
  return group;
}
export function floorRing(scene, color, r = 1) {
  const ring = mesh(
    scene,
    new THREE.RingGeometry(0.93, 1, 48),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
    0,
    0.03,
    0,
  );
  ring.rotation.x = -Math.PI / 2;
  ring.scale.setScalar(r);
  ring.castShadow = false;
  return ring;
}

export function disposeActor(object) {
  const shared = new Set(geos.values());
  object.traverse((o) => {
    if (o.geometry && !shared.has(o.geometry)) o.geometry.dispose();
  });
  object.removeFromParent();
}

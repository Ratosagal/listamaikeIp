import * as THREE from "three";
import "./style.css";
import { createSurvivor, poseSurvivor } from "../systems/character.js";
import {
  architecturalTexture,
  batchStatic,
  createAtmosphere,
} from "../systems/presentation.js";
import { Feedback } from "../systems/effects.js";
import { Soundscape } from "../systems/audio.js";
import {
  loadPreferences,
  storePreferences,
  clampPreferences,
} from "../systems/preferences.js";
import {
  Defense,
  PLANTS,
  BEDS,
  LANES,
  KEY,
  freshState,
  restore,
} from "./simulation.js";
const $ = (id) => document.getElementById(id),
  settings = clampPreferences(loadPreferences());
let state = freshState(),
  recovered = false;
try {
  const raw = localStorage.getItem(KEY);
  if (raw) state = restore(raw);
  else if (!localStorage.getItem(KEY + "-migrated")) {
    localStorage.setItem(KEY + "-migrated", "yes");
    const old = JSON.parse(localStorage.getItem("vigilia-v1") || "null");
    if (old?.inventory) {
      const { wood, stone, scrap, arrows, ammo } = old.inventory;
      state = freshState({
        wood: wood || 15,
        stone: stone || 10,
        scrap: scrap || 12,
        arrows: arrows || 12,
        ammo: ammo || 0,
      });
    }
  }
} catch {
  recovered = true;
  try {
    localStorage.setItem(KEY + "-recovery", localStorage.getItem(KEY) || "");
  } catch {}
}
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7d9699);
scene.fog = new THREE.FogExp2(0x7d9699, 0.012);
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: $("world"), antialias: true });
} catch {
  $("menu").innerHTML =
    '<div class="intro"><h1>WebGL indisponível</h1><p>Ative a aceleração gráfica do navegador para explorar a cidade.</p></div>';
  throw Error("WebGL indisponível");
}
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.type = THREE.PCFShadowMap;
const camera = new THREE.PerspectiveCamera(
  60,
  innerWidth / innerHeight,
  0.1,
  250,
);
const ambient = new THREE.HemisphereLight(0xc1d3d9, 0x28392d, 1);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xffddb1, 2);
sun.position.set(-20, 45, 15);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.normalBias = 0.04;
Object.assign(sun.shadow.camera, {
  left: -42,
  right: 42,
  top: 42,
  bottom: -42,
});
scene.add(sun);
scene.add(sun.target);
const atmosphere = createAtmosphere(scene),
  audio = new Soundscape(settings),
  fx = new Feedback(scene, settings);
const materials = new Map(),
  geometries = new Map(),
  buildings = [],
  cameraWalls = [];
function material(color, roughness = 0.82, metalness = 0) {
  const key = `${color}:${roughness}:${metalness}`;
  if (!materials.has(key))
    materials.set(
      key,
      new THREE.MeshStandardMaterial({ color, roughness, metalness }),
    );
  return materials.get(key);
}
function piece(geometry, color, parent = scene, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(
    geometry,
    typeof color === "number" ? material(color) : color,
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function box(w, h, d, color, parent = scene, x = 0, y = h / 2, z = 0) {
  const key = `b:${w},${h},${d}`;
  if (!geometries.has(key)) geometries.set(key, new THREE.BoxGeometry(w, h, d));
  return piece(geometries.get(key), color, parent, x, y, z);
}
function ball(radius, color, parent = scene, x = 0, y = 0, z = 0) {
  const key = `s:${radius}`;
  if (!geometries.has(key))
    geometries.set(key, new THREE.SphereGeometry(radius, 14, 10));
  return piece(geometries.get(key), color, parent, x, y, z);
}
function cylinder(top, bottom, h, color, parent, x, y, z) {
  const key = `c:${top},${bottom},${h}`;
  if (!geometries.has(key))
    geometries.set(key, new THREE.CylinderGeometry(top, bottom, h, 12));
  return piece(geometries.get(key), color, parent, x, y, z);
}
box(95, 0.3, 110, 0x354c43, scene, 0, -0.2, -8);
for (const x of LANES) {
  box(6, 0.05, 82, 0x293a40, scene, x, 0.01, -8);
  for (const side of [-1, 1])
    box(0.65, 0.12, 80, 0x84918b, scene, x + side * 3.3, 0.04, -8);
  for (let z = -45; z < 24; z += 6)
    box(0.1, 0.01, 1.8, 0xd5cfaa, scene, x, 0.043, z);
}
box(85, 0.04, 6, 0x2b3c42, scene, 0, 0.02, 23);
const facade = architecturalTexture();
for (const x of [-31, -6, 6, 31])
  for (const z of [-32, -10, 12]) {
    const w = Math.abs(x) > 20 ? 12 : 5,
      d = 12,
      h = 8 + ((Math.round(x + z) + 120) % 4) * 1.5;
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    scene.add(group);
    const mat = material(Math.abs(x) > 20 ? 0x717d76 : 0x597375).clone();
    mat.map = facade;
    const body = box(w, h, d, mat, group);
    cameraWalls.push(
      new THREE.Box3(
        new THREE.Vector3(x - w / 2, -0.1, z - d / 2),
        new THREE.Vector3(x + w / 2, h, z + d / 2),
      ),
    );
    buildings.push({ x, z, w, d, h });
    box(w + 0.5, 0.3, d + 0.5, 0x283f43, group, 0, h, 0);
    for (let floor = 2; floor < h; floor += 2.6)
      for (let col = -w / 2 + 1; col < w / 2; col += 2.1) {
        box(
          1.1,
          1.4,
          0.08,
          material(0x233a44, 0.3, 0.3),
          group,
          col,
          floor,
          d / 2 + 0.04,
        );
        box(1.2, 0.07, 0.2, 0xadb5a4, group, col, floor - 0.7, d / 2 + 0.1);
      }
    for (let floor = 2; floor < h; floor += 2.6)
      for (const side of [-1, 1])
        for (let rz = -4; rz < 5; rz += 3)
          box(
            0.09,
            1.4,
            1.2,
            material(0x28444a, 0.3, 0.3),
            group,
            side * (w / 2 + 0.05),
            floor,
            rz,
          );
    box(1.5, 2.4, 0.08, 0x293b37, group, 0, 1.2, d / 2 + 0.08);
    box(2.3, 0.15, 1.4, 0x637b76, group, 0, 2.6, d / 2 + 0.5);
    box(1.6, 0.9, 1.4, 0x71807d, group, w * 0.2, h + 0.6, 0);
    cylinder(0.18, 0.22, 1.1, 0x526768, group, -w * 0.2, h + 0.6, 2);
  }
for (const x of [-20, 20])
  for (let z = -40; z < 29; z += 14) {
    cylinder(0.2, 0.32, 3.8, 0x60533f, scene, x, 1.9, z);
    const crown = ball(2.1, 0x456847, scene, x, 4.2, z);
    crown.scale.set(1, 1.25, 1);
    ball(1.7, 0x607c4d, scene, x + 0.7, 3.8, z - 0.5);
  }
const lampMat = new THREE.MeshStandardMaterial({
  color: 0xf3d0a4,
  emissive: 0xd6b583,
  emissiveIntensity: 1,
});
for (const x of [-16, 16])
  for (let z = -38; z < 24; z += 20) {
    cylinder(0.055, 0.09, 4.5, 0x384e55, scene, x, 2.25, z);
    box(1.3, 0.09, 0.1, 0x384e55, scene, x + 0.6, 4.4, z);
    box(0.5, 0.12, 0.3, lampMat, scene, x + 1.1, 4.3, z);
  }
const wet = material(0x48616a, 0.15, 0.35);
for (let i = 0; i < 12; i++) {
  const puddle = piece(
    new THREE.CircleGeometry(1, 18),
    wet,
    scene,
    LANES[i % 3] + 1,
    0.046,
    -38 + Math.floor(i / 3) * 17,
  );
  puddle.rotation.x = -Math.PI / 2;
  puddle.scale.set(1.5, 0.6, 1);
}
// The courtyard is the fixed destination for all three streets.
const refuge = new THREE.Group();
scene.add(refuge);
refuge.position.z = 29;
box(16, 3.2, 6, 0x425c53, refuge);
box(17, 0.35, 7, 0x283e43, refuge, 0, 3.25, 0);
box(3, 2.5, 0.15, 0x1f333c, refuge, 0, 1.25, -3.1);
for (const x of [-6, 6]) box(2, 1.1, 0.12, lampMat, refuge, x, 1.9, -3.12);
for (const b of BEDS) {
  box(3, 0.18, 3, 0x756750, scene, b.x, 0.1, b.z);
  box(2.7, 0.12, 2.7, 0x302e23, scene, b.x, 0.2, b.z);
  for (const side of [-1, 1]) {
    box(3, 0.15, 0.12, 0xadb0a0, scene, b.x, 0.25, b.z + side * 1.5);
    box(0.12, 0.15, 3, 0xadb0a0, scene, b.x + side * 1.5, 0.25, b.z);
  }
}
const staticMeshes = [];
scene.traverse((o) => {
  if (o.isMesh) staticMeshes.push(o);
});
batchStatic(scene, staticMeshes);
const player = createSurvivor(scene),
  plantViews = new Map(),
  zombieViews = new Map(),
  shotViews = new Map();
const weaponMount = new THREE.Group();
player.userData.rig.hands[1].add(weaponMount);
box(0.075, 0.72, 0.11, material(0xcad5d3, 0.25, 0.6), weaponMount, 0, -0.5, 0);
box(0.28, 0.06, 0.14, 0xc8a66a, weaponMount, 0, -0.1, 0);
box(0.09, 0.19, 0.1, 0x76553b, weaponMount, 0, 0.015, 0);
const gun = box(
  0.15,
  0.15,
  0.5,
  material(0x839a9f, 0.25, 0.7),
  player.userData.rig.hands[1],
  0,
  0,
  -0.2,
);
gun.visible = false;
const bow = piece(
  new THREE.TorusGeometry(0.4, 0.025, 6, 20, Math.PI),
  0xc3a577,
  player.userData.rig.hands[1],
  0,
  0,
  -0.15,
);
bow.rotation.z = Math.PI / 2;
bow.visible = false;
function plantModel(p) {
  const spec = PLANTS[p.kind],
    g = new THREE.Group();
  scene.add(g);
  const b = BEDS.find((b) => b.id === p.slot);
  g.position.set(b.x, 0, b.z);
  const stem = cylinder(0.07, 0.12, 1, 0x4b8353, g, 0, 0.75, 0);
  for (const side of [-1, 1]) {
    const leaf = ball(0.4, 0x5f975e, g, side * 0.3, 0.6, 0.06);
    leaf.scale.set(1, 0.25, 0.5);
    leaf.rotation.z = side * 0.35;
  }
  const head = new THREE.Group();
  head.position.y = 1.35;
  g.add(head);
  g.userData.head = head;
  if (p.kind === "wall") {
    stem.visible = false;
    const shell = ball(0.9, spec.color, g, 0, 1, 0);
    shell.scale.set(0.85, 1.1, 0.7);
    for (const x of [-0.35, 0, 0.35])
      box(0.025, 1.2, 0.03, 0x80664c, g, x, 1, -0.6);
  } else if (p.kind === "solar") {
    ball(0.34, 0x745939, head);
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2,
        petal = ball(
          0.22,
          spec.color,
          head,
          Math.sin(angle) * 0.42,
          Math.cos(angle) * 0.42,
          -0.07,
        );
      petal.scale.set(0.7, 1.25, 0.25);
      petal.rotation.z = -angle;
    }
  } else if (p.kind === "bomb") {
    const fruit = ball(0.52, spec.color, head);
    fruit.scale.set(0.9, 1.15, 0.9);
    cylinder(0.03, 0.035, 0.3, 0x483d2e, head, 0, 0.6, 0);
    ball(0.08, 0xffdc98, head, 0, 0.78, 0);
  } else {
    ball(0.47, spec.color, head);
    const muzzle = cylinder(0.18, 0.14, 0.45, spec.color, head, 0, 0, -0.49);
    muzzle.rotation.x = Math.PI / 2;
    const hole = cylinder(0.12, 0.12, 0.012, 0x304538, head, 0, 0, -0.72);
    hole.rotation.x = Math.PI / 2;
    if (p.kind === "frost")
      for (let i = 0; i < 5; i++)
        box(0.05, 0.27, 0.05, 0xd5edec, head, (i - 2) * 0.15, 0.49, 0);
  }
  for (const side of [-1, 1]) {
    ball(0.065, 0x172e2c, head, side * 0.16, 0.12, -0.4);
    ball(0.018, 0xf1e8d2, head, side * 0.16 - 0.015, 0.14, -0.457);
  }
  return g;
}
function zombieModel() {
  const g = new THREE.Group();
  scene.add(g);
  const legs = [],
    arms = [];
  const torso = ball(0.43, 0x49615e, g, 0, 1.25, 0);
  torso.scale.set(0.8, 1.15, 0.55);
  ball(0.25, 0x91a480, g, 0, 1.94, 0);
  for (const side of [-1, 1]) {
    ball(0.035, 0xddbe7c, g, side * 0.1, 1.98, -0.23);
    const leg = new THREE.Group();
    leg.position.set(side * 0.16, 0.86, 0);
    g.add(leg);
    cylinder(0.105, 0.08, 0.72, 0x2d4144, leg, 0, -0.35, 0);
    box(0.22, 0.15, 0.33, 0x263539, leg, 0, -0.73, -0.03);
    legs.push(leg);
    const arm = new THREE.Group();
    arm.position.set(side * 0.34, 1.6, 0);
    g.add(arm);
    cylinder(0.08, 0.075, 0.65, 0x52695f, arm, 0, -0.3, 0);
    ball(0.08, 0x91a480, arm, 0, -0.7, 0);
    arm.rotation.x = -1;
    arms.push(arm);
  }
  g.userData = { legs, arms };
  return g;
}
const resources = [];
for (let i = 0; i < 12; i++) {
  const kind = ["wood", "stone", "scrap"][i % 3],
    x = i % 2 ? -19 : 19,
    z = -26 + Math.floor(i / 2) * 9;
  const mesh = piece(
    new THREE.DodecahedronGeometry(0.65, 1),
    kind === "wood"
      ? 0x8a6c46
      : kind === "stone"
        ? 0x839594
        : material(0x7a918a, 0.4, 0.5),
    scene,
    x,
    0.65,
    z,
  );
  mesh.scale.set(kind === "wood" ? 1.3 : 1, 0.8, 1);
  resources.push({ id: i, x, z, kind, mesh });
}
const ring = piece(
  new THREE.RingGeometry(1.6, 1.7, 32),
  new THREE.MeshBasicMaterial({
    color: 0xc7dca2,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
    depthWrite: false,
  }),
  scene,
  0,
  0.32,
  17,
);
ring.rotation.x = -Math.PI / 2;
let running = false,
  panel = null,
  yaw = 0,
  pitch = 0.32,
  zoom = 6.8,
  selected = "shooter",
  selectedBed = null,
  held = false,
  swing = 0,
  attackDelay = 0,
  vertical = 0,
  saveTimer = 0,
  hudTimer = 0,
  noticeTimer = 0;
const keys = {},
  velocity = new THREE.Vector2(),
  focus = new THREE.Vector3(0, 1.6, 20),
  desired = new THREE.Vector3(),
  ray = new THREE.Ray(),
  hit = new THREE.Vector3();
function notify(message) {
  $("notice").textContent = message;
  $("notice").style.opacity = 1;
  noticeTimer = 4;
}
function emit(event, data) {
  if (event === "plant") {
    audio.play("craft");
    fx.burst({ ...data, y: 0.8 }, PLANTS[data.kind].color, 12);
  }
  if (event === "hit") fx.burst({ ...data, y: 1.2 }, 0xb5d397, 5);
  if (event === "kill") fx.text(data, "+12 energia", "#e9cd88");
  if (event === "energy") {
    fx.text(data, "+15 energia", "#e9cd88");
    audio.play("collect");
  }
  if (event === "explode") fx.burst({ ...data, y: 1 }, 0xffc58c, 32);
  if (event === "hurt" || event === "breach") {
    fx.hurt();
    audio.play("hurt");
  }
  if (event === "breach")
    notify("Um zumbi alcançou o refúgio! −35 integridade.");
  if (event === "respawn") {
    vertical = 0;
    velocity.set(0, 0);
    notify("Você voltou ao refúgio. Seu inventário permanece protegido.");
  }
  if (event === "wave") {
    audio.play("horde");
    notify(`Onda ${state.wave.number} · proteja as três ruas!`);
  }
  if (event === "cleared") {
    audio.play("evolve");
    notify("Onda vencida · +50 energia e +8 sucatas. Prepare suas defesas.");
    save();
  }
  if (event === "lost") notify("Uma planta foi destruída. Reforce a rua.");
  if (event === "defeat") {
    save();
    showModal("defeat");
  }
}
const defense = new Defense(state, emit);
defense.canHit = (a, b) => {
  const distance = Math.hypot(a.x - b.x, a.z - b.z),
    steps = Math.ceil(distance * 2);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (blocked(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false;
  }
  return true;
};
function blocked(x, z) {
  return (
    Math.abs(x) > 42 ||
    z < -48 ||
    z > 24 ||
    buildings.some(
      (b) =>
        Math.abs(x - b.x) < b.w / 2 + 0.45 &&
        Math.abs(z - b.z) < b.d / 2 + 0.45,
    )
  );
}
if (blocked(state.player.x, state.player.z))
  state.player = { x: 0, z: 20, y: 0 };
function nearestBed() {
  return BEDS.slice().sort(
    (a, b) =>
      Math.hypot(a.x - state.player.x, a.z - state.player.z) -
      Math.hypot(b.x - state.player.x, b.z - state.player.z),
  )[0];
}
function save() {
  if (!running) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    notify("Não foi possível salvar no navegador.");
  }
}
function plantAt(slot, personal = false) {
  const message = defense.plant(slot, selected, personal);
  notify(message || `${PLANTS[selected].name} plantada!`);
  save();
  sync();
  updateHUD();
  if (panel === "tablet") drawTablet();
}
function manage(slot, action) {
  notify(defense.manage(slot, action) || "Canteiro atualizado.");
  save();
  sync();
  updateHUD();
  if (panel === "tablet") drawTablet();
}
function interact() {
  const b = nearestBed();
  if (Math.hypot(b.x - state.player.x, b.z - state.player.z) < 3.6) {
    plantAt(b.id, true);
    return;
  }
  const resource = resources.find(
    (r) =>
      !state.collected.includes(r.id) &&
      Math.hypot(r.x - state.player.x, r.z - state.player.z) < 2.7,
  );
  if (resource) {
    state.collected.push(resource.id);
    state.inventory[resource.kind] += 5;
    audio.play("collect");
    fx.text(resource, "+5 recursos");
    save();
    sync();
    updateHUD();
    return;
  }
  notify(
    "Aproxime-se de um canteiro para plantar ou de recursos para coletar.",
  );
}
function attack() {
  if (attackDelay > 0 || panel || !running) return;
  const message = defense.attack(yaw);
  if (message) {
    notify(message);
    held = false;
    return;
  }
  attackDelay = state.weapon === "gun" ? 0.3 : 0.55;
  swing = 1;
  audio.play(state.weapon);
}
function sync() {
  for (const [id, view] of plantViews)
    if (!state.plants.some((p) => p.slot === id)) {
      scene.remove(view);
      plantViews.delete(id);
    }
  for (const p of state.plants) {
    if (!plantViews.has(p.slot)) plantViews.set(p.slot, plantModel(p));
    const view = plantViews.get(p.slot);
    view.scale.setScalar(1 + (p.level - 1) * 0.12);
    view.userData.head.rotation.z =
      Math.sin(state.time * 2 + BEDS.find((b) => b.id === p.slot).lane) * 0.06;
  }
  for (const [id, view] of zombieViews)
    if (!state.zombies.some((z) => z.id === id)) {
      scene.remove(view);
      zombieViews.delete(id);
    }
  for (const z of state.zombies) {
    if (!zombieViews.has(z.id)) zombieViews.set(z.id, zombieModel());
    const view = zombieViews.get(z.id);
    view.position.set(z.x, 0, z.z);
    view.rotation.y = Math.PI;
    view.userData.legs.forEach(
      (leg, i) => (leg.rotation.x = Math.sin(z.phase + i * Math.PI) * 0.45),
    );
    view.userData.arms.forEach(
      (arm, i) => (arm.rotation.x = -1 + Math.sin(z.phase + i) * 0.12),
    );
  }
  for (const [shot, mesh] of shotViews)
    if (!defense.shots.includes(shot)) {
      scene.remove(mesh);
      shotViews.delete(shot);
    }
  for (const shot of defense.shots) {
    if (!shotViews.has(shot)) shotViews.set(shot, ball(0.1, shot.color));
    shotViews.get(shot).position.set(shot.x, shot.y, shot.z);
  }
  for (const r of resources) r.mesh.visible = !state.collected.includes(r.id);
}
function plantIcon(kind) {
  const shapes = {
    shooter:
      '<path d="M12 21V12M12 16C5 18 3 13 3 13S10 11 12 16"/><circle cx="12" cy="8" r="5"/><path d="M15 6h6v4h-6"/>',
    wall: '<path d="M5 20V9a7 7 0 0 1 14 0v11zM9 6v11M14 6v11"/>',
    bomb: '<circle cx="12" cy="14" r="7"/><path d="M12 7V3h4M18 3l2-2M19 6h3"/>',
    frost:
      '<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M8 4l4 3 4-3M8 20l4-3 4 3"/>',
    solar:
      '<circle cx="12" cy="12" r="4"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3M4 4l2 2M18 18l2 2M4 20l2-2M18 6l2-2"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${shapes[kind]}</svg>`;
}
function seedButtons(container) {
  $(container).innerHTML = Object.entries(PLANTS)
    .map(
      ([kind, p], i) =>
        `<button class="seed ${selected === kind ? "selected" : ""}" data-seed="${kind}" aria-pressed="${selected === kind}" style="--plant:#${p.color.toString(16)}"><span class="icon">${plantIcon(kind)}</span><span><b>${p.name}</b><small>${p.role} · ${p.cost} ⚡</small></span></button>`,
    )
    .join("");
  $(container)
    .querySelectorAll("[data-seed]")
    .forEach(
      (button) =>
        (button.onclick = () => {
          selected = button.dataset.seed;
          seedButtons("seeds");
          if (panel === "tablet") drawTablet();
          notify(
            `${PLANTS[selected].name} selecionada · ${PLANTS[selected].cost} energia.`,
          );
        }),
    );
}
function updateHUD() {
  $("life").textContent = `${Math.ceil(state.health)} / 100`;
  $("healthBar").style.width = state.health + "%";
  $("baseLife").textContent = `${state.baseHealth} / 500`;
  $("baseBar").style.width = state.baseHealth / 5 + "%";
  $("energy").textContent = `⚡ ${state.energy}`;
  $("stock").textContent =
    `Madeira ${state.inventory.wood} · Pedra ${state.inventory.stone} · Sucata ${state.inventory.scrap}\nFlechas ${state.inventory.arrows} · Munição ${state.inventory.ammo}`;
  $("waveInfo").textContent =
    state.wave.phase === "prepare"
      ? `ONDA ${state.wave.number + 1} / PREPARO ${Math.ceil(state.wave.timer)}s`
      : `ONDA ${state.wave.number} / ${state.zombies.length + state.wave.queue} AMEAÇAS`;
  $("startWave").disabled = state.wave.phase !== "prepare";
  const b = nearestBed(),
    p = state.plants.find((p) => p.slot === b.id),
    near = Math.hypot(b.x - state.player.x, b.z - state.player.z) < 3.6;
  ring.visible = near && state.player.y < 1;
  if (near) {
    ring.position.set(b.x, 0.32, b.z);
    ring.material.color.set(
      p
        ? 0xe9c56d
        : state.energy >= PLANTS[selected].cost
          ? 0xc7dca2
          : 0xc78373,
    );
  }
  $("hint").textContent = near
    ? p
      ? `${PLANTS[p.kind].name} · ${Math.ceil(p.hp)} PV · Nível ${p.level} · R melhorar / F reparar`
      : `E plantar ${PLANTS[selected].name} · ${PLANTS[selected].cost} energia`
    : "Explore canteiros · Tab planejar · E coletar recursos · C fabricar no refúgio";
}
function mapPoint(b) {
  return { x: (b.x + 22) * 10, y: (b.z + 42) * 10 };
}
function drawTablet() {
  $("tabletEnergy").textContent = `⚡ ${state.energy}`;
  seedButtons("tabletSeeds");
  $("tabletWave").disabled = state.wave.phase !== "prepare";
  const b = BEDS.find((b) => b.id === selectedBed),
    range = b
      ? PLANTS[state.plants.find((p) => p.slot === b.id)?.kind || selected]
          .range
      : 0;
  const mapBuildings = buildings
    .filter((o) => Math.abs(o.x) < 22)
    .map(
      (o) =>
        `<rect x="${mapPoint(o).x - o.w * 5}" y="${mapPoint(o).y - o.d * 5}" width="${o.w * 10}" height="${o.d * 10}" rx="3" fill="#283d40" stroke="#78908460"/>`,
    )
    .join("");
  const fog = BEDS.filter((o) => !state.explored.includes(o.id))
    .map(
      (o) =>
        `<rect x="${mapPoint(o).x - 35}" y="${mapPoint(o).y - 40}" width="70" height="80" fill="#0a1a28aa"/>`,
    )
    .join("");
  $("mapArt").innerHTML =
    `<defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#6e8c7430"/></pattern></defs><rect width="440" height="720" fill="url(#grid)"/>${LANES.map((x) => `<rect x="${(x + 22) * 10 - 22}" y="0" width="44" height="670" fill="#51656a"/><path d="M${(x + 22) * 10} 0V650" stroke="#d5c79170" stroke-width="2" stroke-dasharray="12 15"/><text x="${(x + 22) * 10}" y="27" fill="#d6e0d0" font-size="12" text-anchor="middle">ROTA ${LANES.indexOf(x) + 1} ↓</text>`).join("")}${mapBuildings}${fog}<rect x="25" y="672" width="390" height="45" rx="5" fill="#9eaf83"/><text x="220" y="700" text-anchor="middle" fill="#163329" font-size="14">REFÚGIO · ${state.baseHealth} PV</text>${b && range ? `<circle cx="${mapPoint(b).x}" cy="${mapPoint(b).y}" r="${range * 10}" fill="#d5df9a18" stroke="#e1c57f" stroke-dasharray="6 6"/>` : ""}${state.zombies
      .filter((z) =>
        BEDS.some(
          (b) =>
            state.explored.includes(b.id) &&
            Math.hypot(b.x - z.x, b.z - z.z) < 12,
        ),
      )
      .map((z) => {
        const at = mapPoint(z);
        return `<circle cx="${at.x}" cy="${at.y}" r="5" fill="#e99376"/>`;
      })
      .join(
        "",
      )}<circle cx="${mapPoint(state.player).x}" cy="${mapPoint(state.player).y}" r="7" fill="#f1d8a6" stroke="#ffffff"/>`;
  $("mapBeds").innerHTML = BEDS.map((b) => {
    const p = state.plants.find((p) => p.slot === b.id),
      explored = state.explored.includes(b.id);
    return `<button class="bed ${selectedBed === b.id ? "chosen" : ""} ${explored ? "" : "locked"}" style="left:${((b.x + 22) / 44) * 100}%;top:${((b.z + 42) / 72) * 100}%" data-slot="${b.id}" aria-label="Rota ${b.lane + 1}, canteiro ${b.row + 1}${p ? ", " + PLANTS[p.kind].name : ""}${!explored ? ", não explorado" : ""}" ${!explored ? "disabled" : ""}>${p ? plantIcon(p.kind) : explored ? "+" : "▧"}</button>`;
  }).join("");
  $("mapBeds")
    .querySelectorAll("[data-slot]")
    .forEach(
      (button) =>
        (button.onclick = () => {
          selectedBed = button.dataset.slot;
          drawTablet();
          $("confirmPlant")?.focus();
        }),
    );
  if (!b) {
    $("inspector").innerHTML =
      '<span class="eyebrow">PLANEJAMENTO</span><h3>Seu jardim,<br>sua defesa.</h3><p>Os zumbis avançam de cima para baixo. Selecione um canteiro para ver os custos e o alcance.</p>';
    return;
  }
  const p = state.plants.find((p) => p.slot === b.id),
    spec = PLANTS[p?.kind || selected];
  $("inspector").innerHTML =
    `<span class="eyebrow">ROTA ${b.lane + 1} / CANTEIRO ${b.row + 1}</span><h3>${spec.name}</h3><p>${spec.role}</p><div class="detail">${p ? `Nível ${p.level}/3<br>${Math.ceil(p.hp)} / ${spec.hp * p.level} PV` : `Custo: ${spec.cost} energia<br>Vida: ${spec.hp} PV`}<br>Alcance: ${spec.range} m</div>${p ? `<button id="upgradePlant" ${p.level >= 3 ? "disabled" : ""}>Melhorar · ${Math.ceil(spec.cost * 0.7 * p.level)} ⚡</button><button id="repairPlant">Reparar · 10 ⚡ + 2 madeiras</button><button id="removePlant">Remover · recuperar ${Math.floor(spec.cost * 0.4)} ⚡</button>` : `<button id="confirmPlant" class="primary" ${state.energy < spec.cost ? "disabled" : ""}>Plantar ${spec.name} · ${spec.cost} ⚡</button>`}<p>Plantio remoto e pessoal usam os mesmos custos.</p>`;
  if (p) {
    $("upgradePlant").onclick = () => manage(b.id, "upgrade");
    $("repairPlant").onclick = () => manage(b.id, "repair");
    $("removePlant").onclick = () => manage(b.id, "remove");
  } else $("confirmPlant").onclick = () => plantAt(b.id);
}
function openTablet() {
  if (!running || state.wave.phase === "defeat") return;
  panel = "tablet";
  held = false;
  velocity.set(0, 0);
  document.exitPointerLock?.();
  save();
  $("tablet").hidden = false;
  drawTablet();
  $("closeTablet").focus();
}
function closePanel() {
  for (const k of Object.keys(keys)) keys[k] = false;
  panel = null;
  $("tablet").hidden = true;
  $("modal").hidden = true;
  $("tabletButton").focus();
  save();
}
const recipes = {
  arrows: {
    name: "12 flechas",
    cost: { wood: 3, stone: 1 },
    produce: "arrows",
    amount: 12,
  },
  ammo: {
    name: "12 munições",
    cost: { scrap: 5, stone: 2 },
    produce: "ammo",
    amount: 12,
  },
  sword: {
    name: "Afiar espada (+10 dano)",
    cost: { scrap: 3, wood: 2 },
    produce: null,
  },
  gun: { name: "Pistola", cost: { scrap: 15, wood: 3 }, produce: "gun" },
};
function craft(kind) {
  const r = recipes[kind];
  if (Math.hypot(state.player.x, state.player.z - 20) > 10)
    return notify("Volte ao refúgio para usar a bancada.");
  if (Object.entries(r.cost).some(([k, v]) => state.inventory[k] < v))
    return notify("Recursos insuficientes. Colete materiais nas áreas verdes.");
  if (kind === "sword" && state.bladeLevel >= 3)
    return notify("A espada já está no nível máximo.");
  if (kind === "gun" && state.weapons.includes("gun"))
    return notify("Você já possui uma pistola.");
  for (const [k, v] of Object.entries(r.cost)) state.inventory[k] -= v;
  if (kind === "gun") state.weapons.push("gun");
  else if (r.produce) state.inventory[r.produce] += r.amount;
  else if (kind === "sword") state.bladeLevel++;
  audio.play("craft");
  notify(`${r.name} fabricada.`);
  save();
  updateHUD();
  showModal("craft");
}
function showModal(mode) {
  panel = mode;
  held = false;
  velocity.set(0, 0);
  document.exitPointerLock?.();
  save();
  $("modal").hidden = false;
  $("modalTitle").textContent =
    mode === "craft"
      ? "Bancada do refúgio"
      : mode === "defeat"
        ? "O refúgio caiu."
        : "Respire. Planeje. Volte.";
  if (mode === "craft")
    $("modalBody").innerHTML =
      "<p>Armas e munições usam materiais coletados. As sementes usam energia.</p>" +
      Object.entries(recipes)
        .map(
          ([k, r]) =>
            `<button data-craft="${k}">${r.name} · ${Object.entries(r.cost)
              .map(
                ([k, v]) =>
                  `${v} ${k === "wood" ? "madeiras" : k === "stone" ? "pedras" : "sucatas"}`,
              )
              .join(" + ")}</button>`,
        )
        .join("") +
      "<button data-resume>Voltar ao jogo</button>";
  else if (mode === "defeat")
    $("modalBody").innerHTML =
      `<p>Você resistiu até a onda ${state.wave.number}. ${state.kills} zumbis derrotados. Recomece e experimente novas combinações de plantas.</p><button id="restart" class="primary">Nova expedição</button>`;
  else
    $("modalBody").innerHTML =
      '<p>Tab: tablet · E: plantar/coletar · R: melhorar · F: reparar · 1–3: armas. O tablet pausa a partida. Explore para revelar novos canteiros.</p><label class="settings-row">Qualidade gráfica <select id="quality"><option value="low">Leve</option><option value="medium">Equilibrada</option><option value="high">Alta</option></select></label><button id="soundToggle">Alternar áudio</button><button data-resume class="primary">Retomar expedição</button><button id="toMenu">Salvar e voltar ao menu</button>';
  $("modalBody")
    .querySelectorAll("[data-craft]")
    .forEach((b) => (b.onclick = () => craft(b.dataset.craft)));
  $("modalBody")
    .querySelector("[data-resume]")
    ?.addEventListener("click", closePanel);
  if ($("restart"))
    $("restart").onclick = () => {
      localStorage.removeItem(KEY);
      location.reload();
    };
  if ($("quality")) {
    $("quality").value = settings.quality;
    $("quality").onchange = (e) => {
      settings.quality = e.target.value;
      applyQuality();
      storePreferences(settings);
    };
    $("soundToggle").onclick = () => {
      settings.music = settings.music ? 0 : 0.3;
      settings.effects = settings.effects ? 0 : 0.6;
      audio.apply();
      storePreferences(settings);
    };
    $("toMenu").onclick = () => {
      save();
      closePanel();
      running = false;
      $("hud").hidden = true;
      $("menu").hidden = false;
      audio.suspend();
      $("play").textContent = "CONTINUAR EXPEDIÇÃO ↗";
    };
  }
  $("modalBody").querySelector("button")?.focus();
}
function applyQuality() {
  const high = settings.quality === "high",
    low = settings.quality === "low";
  renderer.setPixelRatio(
    Math.min(devicePixelRatio, low ? 1 : high ? 1.6 : 1.25),
  );
  renderer.setSize(innerWidth, innerHeight);
  const changed = renderer.shadowMap.enabled !== !low;
  renderer.shadowMap.enabled = !low;
  sun.castShadow = !low;
  sun.shadow.map?.dispose();
  sun.shadow.map = null;
  sun.shadow.mapSize.set(high ? 2048 : 1024, high ? 2048 : 1024);
  if (changed)
    scene.traverse((o) => {
      if (o.material?.isMeshStandardMaterial) o.material.needsUpdate = true;
    });
}
$("play").onclick = () => {
  running = true;
  $("menu").hidden = true;
  $("hud").hidden = false;
  audio.start().catch(() => {});
  if (state.wave.phase === "defeat") showModal("defeat");
  else
    notify(
      recovered
        ? "Save antigo inválido preservado para recuperação. Nova expedição iniciada."
        : "Proteja as três ruas. E planta no canteiro próximo; Tab abre o tablet.",
    );
};
$("tabletButton").onclick = openTablet;
$("closeTablet").onclick = closePanel;
$("pause").onclick = () => showModal("pause");
$("startWave").onclick = () => {
  defense.startWave();
  save();
  updateHUD();
};
$("tabletWave").onclick = () => {
  defense.startWave();
  save();
  drawTablet();
  updateHUD();
};
addEventListener("keydown", (e) => {
  if (e.target.matches("input,select") && !["Escape", "Tab"].includes(e.code))
    return;
  if (e.code === "Tab" && running && !panel) {
    e.preventDefault();
    openTablet();
    return;
  }
  if (e.code === "KeyT" && running) {
    if (panel === "tablet") closePanel();
    else if (!panel) openTablet();
    return;
  }
  if (e.code === "Escape") {
    if (panel && panel !== "defeat") closePanel();
    else if (running && !panel) showModal("pause");
    return;
  }
  if (!running || panel) return;
  if (["Space", "KeyW", "KeyS", "KeyA", "KeyD"].includes(e.code))
    e.preventDefault();
  keys[e.code] = true;
  if (e.repeat) return;
  if (e.code === "Space" && state.player.y <= 0) vertical = 7;
  if (e.code === "KeyE") interact();
  if (e.code === "KeyT") openTablet();
  if (e.code === "KeyC") showModal("craft");
  if (e.code === "KeyQ") {
    const list = Object.keys(PLANTS);
    selected = list[(list.indexOf(selected) + 1) % list.length];
    seedButtons("seeds");
    updateHUD();
  }
  if (e.code === "KeyR" || e.code === "KeyF") {
    const b = nearestBed();
    if (Math.hypot(b.x - state.player.x, b.z - state.player.z) > 3.6)
      return notify("Aproxime-se da planta.");
    manage(b.id, e.code === "KeyR" ? "upgrade" : "repair");
  }
  const weapon = { Digit1: "sword", Digit2: "bow", Digit3: "gun" }[e.code];
  if (weapon && state.weapons.includes(weapon)) state.weapon = weapon;
});
addEventListener("keyup", (e) => (keys[e.code] = false));
addEventListener("mouseup", () => (held = false));
addEventListener("mousemove", (e) => {
  if (!running || panel || !(document.pointerLockElement || e.buttons === 2))
    return;
  yaw -=
    THREE.MathUtils.clamp(e.movementX, -150, 150) *
    0.0025 *
    settings.sensitivity;
  pitch = THREE.MathUtils.clamp(pitch + e.movementY * 0.002, 0.1, 0.8);
});
$("world").addEventListener("contextmenu", (e) => e.preventDefault());
$("world").addEventListener("mousedown", (e) => {
  if (e.button !== 0 || !running || panel) return;
  held = true;
  try {
    $("world")
      .requestPointerLock()
      ?.catch(() => {});
  } catch {}
  attack();
});
$("world").addEventListener(
  "wheel",
  (e) => {
    if (running && !panel)
      zoom = THREE.MathUtils.clamp(zoom + e.deltaY * 0.004, 3.5, 10);
  },
  { passive: true },
);
function pauseOnBlur() {
  held = false;
  for (const k of Object.keys(keys)) keys[k] = false;
  if (running && !panel) showModal("pause");
}
addEventListener("blur", pauseOnBlur);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pauseOnBlur();
});
addEventListener("beforeunload", save);
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
// Keep keyboard focus within dialogs. T is an alternative to Tab when using keyboard navigation.
addEventListener("keydown", (e) => {
  if (e.code !== "Tab" || !panel) return;
  const container = panel === "tablet" ? $("tablet") : $("modal");
  const controls = [
    ...container.querySelectorAll("button:not(:disabled),select"),
  ];
  const i = controls.indexOf(document.activeElement);
  if (e.shiftKey && i <= 0) {
    e.preventDefault();
    controls.at(-1)?.focus();
  } else if (!e.shiftKey && i === controls.length - 1) {
    e.preventDefault();
    controls[0]?.focus();
  }
});
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.08, (now - (animate.last || now)) / 1000);
  animate.last = now;
  if (running && !panel) {
    const p = state.player,
      f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0),
      s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0),
      input = new THREE.Vector2(
        -Math.sin(yaw) * f + Math.cos(yaw) * s,
        -Math.cos(yaw) * f - Math.sin(yaw) * s,
      );
    if (input.lengthSq() > 0) input.normalize();
    const speed = keys.ShiftLeft ? 7 : 4.5;
    velocity.lerp(input.multiplyScalar(speed), 1 - Math.exp(-dt * 12));
    for (let elapsed = 0; elapsed < dt;) {
      const step = Math.min(1 / 120, dt - elapsed);
      elapsed += step;
      if (!blocked(p.x + velocity.x * step, p.z)) p.x += velocity.x * step;
      else velocity.x = 0;
      if (!blocked(p.x, p.z + velocity.y * step)) p.z += velocity.y * step;
      else velocity.y = 0;
    }
    vertical -= dt * 16;
    p.y = Math.max(0, p.y + vertical * dt);
    if (p.y === 0) vertical = 0;
    attackDelay = Math.max(0, attackDelay - dt);
    swing = Math.max(0, swing - dt * 3);
    if (held) attack();
    defense.step(dt);
    const facing =
      swing > 0 || state.weapon !== "sword"
        ? yaw
        : velocity.length() > 0.3
          ? Math.atan2(-velocity.x, -velocity.y)
          : player.rotation.y;
    player.rotation.y +=
      Math.atan2(
        Math.sin(facing - player.rotation.y),
        Math.cos(facing - player.rotation.y),
      ) *
      (1 - Math.exp(-dt * 14));
    poseSurvivor(player, {
      speed: velocity.length(),
      dt,
      time: state.time,
      attack: swing,
      airborne: state.player.y > 0,
      vertical,
      weapon: state.weapon,
    });
    weaponMount.visible = state.weapon === "sword";
    gun.visible = state.weapon === "gun";
    bow.visible = state.weapon === "bow";
    sync();
    saveTimer += dt;
    if (saveTimer > 8) {
      saveTimer = 0;
      save();
    }
    hudTimer += dt;
    if (hudTimer > 0.15) {
      hudTimer = 0;
      updateHUD();
    }
  }
  const p = state.player;
  player.position.set(p.x, p.y, p.z);
  focus.lerp(new THREE.Vector3(p.x, p.y + 1.6, p.z), 1 - Math.exp(-dt * 18));
  desired.set(
    focus.x + Math.sin(yaw) * zoom * Math.cos(pitch) + Math.cos(yaw) * 0.5,
    focus.y + 0.35 + Math.sin(pitch) * zoom,
    focus.z + Math.cos(yaw) * zoom * Math.cos(pitch) - Math.sin(yaw) * 0.5,
  );
  ray.origin.copy(focus);
  ray.direction.copy(desired).sub(focus).normalize();
  let distance = focus.distanceTo(desired);
  for (const bounds of cameraWalls)
    if (ray.intersectBox(bounds, hit))
      distance = Math.min(distance, Math.max(0.8, focus.distanceTo(hit) - 0.3));
  if (distance < focus.distanceTo(desired))
    camera.position.copy(focus).addScaledVector(ray.direction, distance);
  else camera.position.lerp(desired, 1 - Math.exp(-dt * 14));
  camera.lookAt(
    focus.x - Math.sin(yaw) * 3,
    focus.y - 0.2,
    focus.z - Math.cos(yaw) * 3,
  );
  camera.updateMatrixWorld();
  atmosphere.update(
    0.2 + ((state.time % 900) / 900) * 0.15,
    p,
    ambient,
    sun,
    scene.fog,
  );
  sun.position.set(p.x - 20, 45, p.z + 15);
  sun.target.position.set(p.x, 0, p.z);
  sun.target.updateMatrixWorld();
  fx.update(dt, camera);
  noticeTimer -= dt;
  if (noticeTimer <= 0) $("notice").style.opacity = 0;
  renderer.render(scene, camera);
}
seedButtons("seeds");
sync();
updateHUD();
applyQuality();
camera.position.set(5, 5, 28);
$("saveInfo").textContent = localStorage.getItem(KEY)
  ? `Progresso salvo · onda ${state.wave.number} · ${state.plants.length} plantas`
  : "Progresso salvo automaticamente neste navegador.";
window.vigiliaDefense = {
  ready: true,
  snapshot: () => JSON.parse(JSON.stringify(state)),
  view: () => ({
    camera: camera.position.toArray(),
    render: { ...renderer.info.render },
    quality: settings.quality,
    panel,
    selected,
    plants: plantViews.size,
  }),
  beds: () => BEDS.map((b) => ({ ...b })),
  plants: () => PLANTS,
};
requestAnimationFrame(animate);

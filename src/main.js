import * as THREE from "three";
import "./style.css";
import { Soundscape } from "./systems/audio.js";
import { Feedback } from "./systems/effects.js";
import { dressWorld } from "./systems/scenery.js";
import { findPath } from "./systems/navigation.js";
import {
  loadPreferences,
  storePreferences,
  clampPreferences,
} from "./systems/preferences.js";
const settings = clampPreferences(loadPreferences());
const audio = new Soundscape(settings);
let fx,
  modalMode = null,
  modalReturn = null,
  focusReturn = null,
  hudElapsed = 0,
  healthPrevious = 100,
  invulnerability = 0,
  swing = 0,
  noiseTimer = 0,
  noiseRange = 0,
  velocity = { x: 0, z: 0 };

const $ = (id) => document.getElementById(id),
  rand = (a, b) => a + worldRandom() * (b - a),
  dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
let worldSeed = 73821;
function worldRandom() {
  worldSeed = (Math.imul(worldSeed, 1664525) + 1013904223) >>> 0;
  return worldSeed / 4294967296;
}
const TYPES = [
  { name: "Brasa", color: 0xf5ad7e, power: "Chama em área", range: 13 },
  { name: "Faísca", color: 0xdcd688, power: "Choque paralisante", range: 16 },
  { name: "Seixo", color: 0x9dacb9, power: "Guardião de pedra", range: 6 },
];
const recipes = {
  sword: { name: "Espada", cost: { wood: 3, scrap: 5 } },
  bow: { name: "Arco", cost: { wood: 8, scrap: 2 } },
  gun: { name: "Pistola", cost: { scrap: 18, stone: 5 } },
  arrows: { name: "10 flechas", cost: { wood: 3, stone: 2 } },
  ammo: { name: "10 munições", cost: { scrap: 5, stone: 2 } },
  capsules: { name: "3 cápsulas", cost: { scrap: 6, stone: 3 } },
};
const builds = {
  wall: { name: "Muralha", cost: { wood: 8, stone: 3 } },
  gate: { name: "Portão", cost: { wood: 10, scrap: 3 } },
  bench: { name: "Bancada", cost: { wood: 10, stone: 5 } },
  tower: { name: "Torre", cost: { wood: 15, stone: 8 } },
  bed: { name: "Cama / renascimento", cost: { wood: 10 } },
};
const names = {
  wood: "Madeira",
  stone: "Pedra",
  scrap: "Sucata",
  arrows: "Flechas",
  ammo: "Munição",
  capsules: "Cápsulas",
};
let saved,
  corruptSave = false;
try {
  const raw = localStorage.getItem("vigilia-v1");
  if (raw) {
    const data = JSON.parse(raw);
    const point = (p) =>
      p &&
      Number.isFinite(p.x) &&
      Number.isFinite(p.z) &&
      Math.abs(p.x) <= 100 &&
      Math.abs(p.z) <= 100;
    if (
      !data ||
      !point(data.player) ||
      !point(data.base) ||
      !Number.isFinite(data.time) ||
      data.time < 0 ||
      !Number.isFinite(data.health) ||
      !data.inventory ||
      !Array.isArray(data.creatures) ||
      !Array.isArray(data.structures) ||
      !Array.isArray(data.weapons)
    )
      throw new Error("Invalid save");
    data.creatures = data.creatures
      .filter(
        (c) =>
          point(c) &&
          [0, 1, 2].includes(c.type) &&
          Number.isFinite(c.hp) &&
          ["companion", "guardian", "tower"].includes(c.role),
      )
      .slice(0, 60);
    data.structures = data.structures
      .filter(
        (c) =>
          point(c) && c.kind in builds && Number.isFinite(c.hp) && c.hp > 0,
      )
      .slice(0, 250);
    data.weapons = data.weapons.filter((w) =>
      ["sword", "bow", "gun"].includes(w),
    );
    if (!data.weapons.length) data.weapons = ["sword"];
    for (const k of Object.keys(names))
      data.inventory[k] = Math.max(
        0,
        Math.min(99999, Number(data.inventory[k]) || 0),
      );
    data.health = Math.max(0, Math.min(100, data.health));
    data.weapon = data.weapons.includes(data.weapon)
      ? data.weapon
      : data.weapons[0];
    saved = data;
  }
} catch {
  corruptSave = true;
  try {
    localStorage.setItem(
      "vigilia-recovery",
      localStorage.getItem("vigilia-v1") || "",
    );
  } catch {}
}
// Serializable simulation state is separate from rendering, to permit a future authoritative server.
const state = saved || {
  time: 180,
  health: 100,
  player: { x: 0, z: 0 },
  base: { x: 0, z: 0 },
  inventory: {
    wood: 15,
    stone: 10,
    scrap: 12,
    arrows: 0,
    ammo: 0,
    capsules: 3,
  },
  weapons: ["sword"],
  weapon: "sword",
  creatures: [
    { type: 0, hp: 100, x: 1, z: 0, role: "companion", level: 1, xp: 0 },
  ],
  structures: [],
  lastHorde: 0,
  kills: 0,
};
state.deaths ||= 0;
state.hordesCleared ||= 0;
if (
  !state.horde ||
  !Number.isFinite(state.horde.day) ||
  !Number.isFinite(state.horde.defeated)
)
  state.horde = null;
state.collected ||= 0;
state.equipment = Object.fromEntries(
  state.weapons.map((w) => [
    w,
    Math.max(1, Math.min(999, Number(state.equipment?.[w]) || 1)),
  ]),
);
state.depleted = Array.isArray(state.depleted) ? state.depleted : [];
state.removedWild = Array.isArray(state.removedWild) ? state.removedWild : [];
for (const c of state.creatures) {
  c.level = c.level === 2 ? 2 : 1;
  c.xp = Math.max(0, Number(c.xp) || 0);
  c.hp = Math.max(0, Math.min(c.level === 2 ? 150 : 100, c.hp));
}
let running = false,
  paused = false,
  yaw = 0.6,
  pitch = 0.36,
  attackTimer = 0,
  saveTimer = 0,
  spawnTimer = 0,
  panelMode = null,
  building = null,
  noticeTimer = 0;
const keys = {},
  zombies = [],
  wild = [],
  resources = [],
  effects = [],
  solid = [];
const scene = new THREE.Scene();
const occluders = [];
const materialCache = new Map(),
  geometryCache = new Map();
scene.background = new THREE.Color(0x859795);
scene.fog = new THREE.FogExp2(0x859795, 0.017);
let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas: $("world"),
    antialias: true,
  });
} catch (error) {
  $("unsupported").classList.remove("hidden");
  $("menu").classList.add("hidden");
  throw error;
}
fx = new Feedback(scene, settings);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const camera = new THREE.PerspectiveCamera(
  60,
  innerWidth / innerHeight,
  0.1,
  220,
);
const ambient = new THREE.HemisphereLight(0xc9ddda, 0x303d31, 2);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xffdfb4, 2.4);
sun.position.set(25, 45, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.04;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
Object.assign(sun.shadow.camera, {
  left: -65,
  right: 65,
  top: 65,
  bottom: -65,
});
scene.add(sun);
function mesh(geo, color, parent = scene, x = 0, y = 0, z = 0) {
  if (!materialCache.has(color))
    materialCache.set(
      color,
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.85,
        flatShading: true,
      }),
    );
  const m = new THREE.Mesh(geo, materialCache.get(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function box(w, h, d, c, p = scene, x = 0, y = h / 2, z = 0) {
  const key = `box:${w}:${h}:${d}`;
  if (!geometryCache.has(key))
    geometryCache.set(key, new THREE.BoxGeometry(w, h, d));
  return mesh(geometryCache.get(key), c, p, x, y, z);
}
function orb(r, c, p = scene, x = 0, y = 0, z = 0) {
  const key = `orb:${r}`;
  if (!geometryCache.has(key))
    geometryCache.set(key, new THREE.SphereGeometry(r, 12, 8));
  return mesh(geometryCache.get(key), c, p, x, y, z);
}
const ground = box(210, 0.3, 210, 0x455746, scene, 0, -0.2, 0);
box(15, 0.04, 190, 0x394344, scene, 24, 0.01, 0);
box(190, 0.04, 12, 0x394344, scene, 0, 0.02, -25);
for (let i = -85; i < 90; i += 8) {
  box(0.25, 0.05, 3, 0x9b9d80, scene, 24, 0.06, i);
  box(3, 0.05, 0.25, 0x9b9d80, scene, i, 0.06, -25);
}
function house(x, z, w, d, h) {
  const g = new THREE.Group();
  scene.add(g);
  g.position.set(x, 0, z);
  const buildingBody = box(
    w,
    h,
    d,
    Math.round(x + z) % 2 ? 0x657b77 : 0x7b8174,
    g,
  );
  occluders.push(buildingBody);
  box(w + 0.15, 0.7, d + 0.15, 0x394c4d, g, 0, 0.35, 0);
  box(w, 0.16, d + 0.2, 0xaeb5a0, g, 0, h * 0.55, 0);
  box(w + 0.5, 0.45, d + 0.5, 0x303b3d, g, 0, h, 0);
  for (let a = -1; a <= 1; a += 2) {
    box(1.3, 1.5, 0.06, 0x1c3034, g, a * w * 0.28, 2.7, d / 2 + 0.04);
    box(0.06, 1.5, 1.3, 0x1c3034, g, w / 2 + 0.04, 2.7, a * d * 0.25);
  }
  box(1.5, 2.7, 0.07, 0x263331, g, 0, 1.35, d / 2 + 0.05);
  solid.push({ x, z, w, d });
  for (let floor = 2.7; floor < h - 1; floor += 2.8) {
    for (let col = -w * 0.32; col < w * 0.4; col += 2.7) {
      box(1.4, 1.6, 0.12, 0x243b43, g, col, floor, d / 2 + 0.07);
      box(0.08, 1.7, 0.15, 0x95a39a, g, col, floor, d / 2 + 0.16);
    }
  }
  box(1.8, 0.16, 1.2, 0x4a6260, g, 0, 2.85, d / 2 + 0.5);
  for (let i = 0; i < 4; i++)
    box(
      rand(0.4, 1.3),
      rand(0.2, 0.6),
      rand(0.4, 1),
      0x6d7266,
      scene,
      x + rand(-w, w),
      0.2,
      z + d / 2 + rand(1, 3),
    );
}
for (let i = 0; i < 14; i++) {
  const x = i % 2 ? 44 : 5,
    z = -75 + Math.floor(i / 2) * 22;
  if (Math.hypot(x, z) > 18) house(x, z, rand(9, 13), rand(8, 12), rand(5, 10));
}
for (let i = 0; i < 100; i++) {
  const x = rand(-92, 92),
    z = rand(-92, 92);
  if (
    Math.abs(x - 24) < 12 ||
    Math.abs(z + 25) < 9 ||
    solid.some((s) => dist(s, { x, z }) < 11) ||
    Math.hypot(x, z) < 10
  )
    continue;
  const g = new THREE.Group();
  scene.add(g);
  g.position.set(x, 0, z);
  box(0.6, 4, 0.6, 0x69523d, g);
  mesh(new THREE.ConeGeometry(rand(2, 3), 5, 7), 0x293f34, g, 0, 5, 0);
  mesh(new THREE.ConeGeometry(2.2, 3.2, 7), 0x3c5d4c, g, 0, 4.2, 0);
  resources.push({ x, z, kind: "wood", mesh: g, amount: 5 });
}
for (let i = 0; i < 65; i++) {
  const x = rand(-80, 80),
    z = rand(-80, 80);
  if (solid.some((s) => dist(s, { x, z }) < 10)) continue;
  const kind = i % 3 ? "stone" : "scrap",
    m = mesh(
      new THREE.DodecahedronGeometry(kind === "stone" ? 0.8 : 0.65),
      kind === "stone" ? 0x7e8b88 : 0x9d7663,
      scene,
      x,
      0.5,
      z,
    );
  resources.push({ x, z, kind, mesh: m, amount: kind === "stone" ? 4 : 5 });
}
// Stylized original characters built from geometry, without external game assets.
function human(zombie = false) {
  const g = new THREE.Group();
  scene.add(g);
  g.userData.legs = [];
  g.userData.arms = [];
  box(0.68, 0.9, 0.42, zombie ? 0x516c63 : 0x365868, g, 0, 1.24, 0);
  box(0.7, 0.14, 0.45, 0x293d42, g, 0, 0.87, 0);
  orb(0.28, zombie ? 0x99ab7a : 0xd4b08b, g, 0, 1.95, 0);
  if (!zombie) {
    orb(0.29, 0x304248, g, 0, 2.07, 0.035);
    box(0.38, 0.08, 0.18, 0x304248, g, 0, 2.06, -0.23);
    box(0.48, 0.6, 0.32, 0x967958, g, 0, 1.35, 0.34);
    box(0.5, 0.1, 0.34, 0xd3b582, g, 0, 1.58, 0.34);
  } else {
    orb(0.045, 0xeac083, g, -0.11, 1.99, -0.25);
    orb(0.045, 0xeac083, g, 0.11, 1.99, -0.25);
    box(0.16, 0.12, 0.06, 0x393a32, g, 0, 1.82, -0.27);
  }
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.2, 0.86, 0);
    g.add(leg);
    box(0.24, 0.6, 0.26, zombie ? 0x394b46 : 0x283f4b, leg, 0, -0.3, 0);
    box(0.26, 0.18, 0.38, 0x23353a, leg, 0, -0.72, -0.055);
    g.userData.legs.push(leg);
    const arm = new THREE.Group();
    arm.position.set(side * 0.46, 1.65, 0);
    g.add(arm);
    box(0.23, 0.63, 0.24, zombie ? 0x5c7567 : 0x557779, arm, 0, -0.3, 0);
    orb(0.12, zombie ? 0x99ab7a : 0xd4b08b, arm, 0, -0.69, 0);
    g.userData.arms.push(arm);
  }
  return g;
}
const player = human();
const weaponViews = {};
const hand = player.userData.arms[1];
const sword = new THREE.Group();
hand.add(sword);
box(0.07, 0.9, 0.13, 0xd1ddd7, sword, 0, -0.83, -0.4);
box(0.28, 0.07, 0.13, 0xba9d63, sword, 0, -0.37, -0.4);
weaponViews.sword = sword;
const bow = new THREE.Group();
hand.add(bow);
const bowLine = new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, -0.2, -0.2),
    new THREE.Vector3(0.25, -0.7, -0.2),
    new THREE.Vector3(0, -1.2, -0.2),
  ]),
  new THREE.LineBasicMaterial({ color: 0xd1b483 }),
);
bow.add(bowLine);
weaponViews.bow = bow;
const gun = new THREE.Group();
hand.add(gun);
box(0.16, 0.16, 0.52, 0xa1aaa4, gun, 0, -0.7, -0.32);
box(0.13, 0.26, 0.12, 0x373f3e, gun, 0, -0.85, -0.1);
weaponViews.gun = gun;
player.position.set(state.player.x, 0, state.player.z);
function creatureModel(type) {
  const g = new THREE.Group();
  scene.add(g);
  const c = TYPES[type].color;
  orb(0.62, c, g, 0, 0.65, 0);
  orb(0.45, c, g, 0, 1.18, -0.25);
  for (const s of [-1, 1]) {
    const ear = mesh(
      new THREE.ConeGeometry(0.19, type === 1 ? 0.8 : 0.4, 8),
      c,
      g,
      s * 0.28,
      1.7,
      -0.2,
    );
    ear.rotation.z = s * 0.25;
    orb(0.065, 0x182724, g, s * 0.18, 1.26, -0.66);
    orb(0.035, 0xffffff, g, s * 0.18 - 0.015, 1.285, -0.704);
    orb(0.16, c, g, s * 0.36, 0.22, -0.2);
  }
  orb(0.075, 0x714b50, g, 0, 1.1, -0.71);
  const tail = orb(0.25, c, g, 0, 0.7, 0.65);
  g.userData.tail = tail;
  orb(0.22, 0xf4dec0, g, 0, 0.6, -0.45);
  if (type === 0) {
    mesh(new THREE.ConeGeometry(0.16, 0.45, 5), 0xffcb76, g, 0, 0.94, 0.72);
  }
  if (type === 1) {
    for (const side of [-1, 1])
      mesh(
        new THREE.ConeGeometry(0.09, 0.35, 4),
        0xffedb0,
        g,
        side * 0.5,
        1.12,
        -0.32,
      );
  }
  if (type === 2) {
    for (const side of [-1, 1])
      mesh(
        new THREE.DodecahedronGeometry(0.2),
        0x657c83,
        g,
        side * 0.56,
        0.74,
        0,
      );
  }
  g.userData.phase = 0;
  return g;
}
const creatureViews = new Map();
function syncCreatures() {
  for (const c of state.creatures)
    if (!creatureViews.has(c)) {
      const m = creatureModel(c.type);
      creatureViews.set(c, m);
      m.position.set(c.x, 0, c.z);
    }
}
syncCreatures();
for (let i = 0; i < 9; i++) {
  if (state.removedWild.includes(i)) continue;
  let x = -18 - (i % 3) * 14,
    z = -35 + Math.floor(i / 3) * 28;
  const type = i % 3,
    m = creatureModel(type);
  m.position.set(x, 0, z);
  const previous = (
    Array.isArray(state.wildSnapshot) ? state.wildSnapshot : []
  )?.find((c) => c.id === i);
  wild.push({
    id: i,
    x,
    z,
    homeX: x,
    homeZ: z,
    hp: 100,
    type,
    mesh: m,
    timer: 0,
    ...(previous &&
    Number.isFinite(previous.hp) &&
    previous.hp > 0 &&
    Number.isFinite(previous.x) &&
    Number.isFinite(previous.z)
      ? {
          x: previous.x,
          z: previous.z,
          hp: previous.hp,
          timer: Number(previous.timer) || 0,
        }
      : {}),
  });
}
function spawnZombie(x, z, horde = false, savedZombie = null) {
  const m = human(true);
  m.position.set(x, 0, z);
  const type =
    savedZombie?.variant ||
    (zombies.length % 7 === 6
      ? "runner"
      : zombies.length % 9 === 8
        ? "brute"
        : "walker");
  const health = type === "brute" ? 110 : 65;
  if (type === "brute") m.scale.setScalar(1.25);
  if (type === "runner") m.scale.setScalar(0.9);
  const zed = {
    x,
    z,
    hp: health,
    maxHp: health,
    homeX: Number.isFinite(savedZombie?.homeX) ? savedZombie.homeX : x,
    homeZ: Number.isFinite(savedZombie?.homeZ) ? savedZombie.homeZ : z,
    aggro: Number.isFinite(savedZombie?.aggro) ? savedZombie.aggro : 0,
    mesh: m,
    cooldown: 0,
    slow: 0,
    horde,
    variant: type,
    hp: Math.max(1, Math.min(health, Number(savedZombie?.hp) || health)),
    cooldown: Math.max(0, Number(savedZombie?.cooldown) || 0),
    slow: Math.max(0, Number(savedZombie?.slow) || 0),
  };
  zombies.push(zed);
}
if (Array.isArray(state.zombieSnapshot)) {
  for (const z of state.zombieSnapshot.slice(0, 120))
    if (Number.isFinite(z.x) && Number.isFinite(z.z) && z.hp > 0)
      spawnZombie(z.x, z.z, z.horde, z);
} else
  for (let i = 0; i < 22; i++) {
    let x = rand(-65, 70),
      z = rand(-75, 75);
    if (Math.hypot(x, z) > 15 && !solid.some((s) => dist(s, { x, z }) < 9))
      spawnZombie(x, z);
  }
function structureView(s) {
  const g = new THREE.Group();
  scene.add(g);
  g.position.set(s.x, 0, s.z);
  g.rotation.y = s.angle || 0;
  const c = 0x79674b;
  if (s.kind === "wall" || s.kind === "gate") {
    const barrier = box(4, 2.8, 0.55, c, g);
    occluders.push(barrier);
    box(3.9, 0.16, 0.7, 0xa18e63, g, 0, 2.7, 0);
    for (let x = -1.7; x < 2; x += 0.7)
      box(0.15, 3, 0.7, 0x554b3b, g, x, 1.5, 0);
    if (s.kind === "gate") box(1.1, 0.25, 0.7, 0xb2a17a, g, 0, 1.5, -0.1);
  }
  if (s.kind === "tower") {
    for (const x of [-1, 1])
      for (const z of [-1, 1]) box(0.3, 4, 0.3, c, g, x, 2, z);
    box(2.8, 0.35, 2.8, c, g, 0, 3.8, 0);
    box(2.8, 0.35, 2.8, 0x384b40, g, 0, 5, 0);
  }
  if (s.kind === "bench") {
    box(2, 0.3, 1, c, g, 0, 1.2, 0);
    for (const x of [-0.8, 0.8]) box(0.2, 1.2, 0.8, c, g, x, 0.6, 0);
  }
  if (s.kind === "bed") {
    box(2, 0.5, 3, c, g);
    box(1.8, 0.3, 2.7, 0x81906f, g, 0, 0.65, 0);
    box(1.5, 0.2, 0.6, 0xc2c9ad, g, 0, 0.9, -0.9);
  }
  if (s.kind === "bench") {
    box(0.4, 0.35, 0.35, 0x889d98, g, 0.55, 1.5, 0);
    box(0.3, 0.13, 0.55, 0xa48c67, g, -0.5, 1.4, 0);
  }
  if (s.kind === "tower") {
    for (const z of [-1.3, 1.3]) box(2.8, 0.45, 0.18, 0x987e54, g, 0, 4.15, z);
  }
  s.mesh = g;
  if (s.open) g.rotation.y = (s.angle || 0) + Math.PI / 2;
  return g;
}
state.structures.forEach(structureView);
resources.forEach((r, i) => {
  if (state.depleted.includes(i)) {
    r.amount = 0;
    r.mesh.visible = false;
  }
});
dressWorld(scene, ground, solid);
for (const z of zombies)
  if (blocked(z.x, z.z)) {
    const at = safeSpawn(z);
    z.x = at.x;
    z.z = at.z;
    z.homeX = z.x;
    z.homeZ = z.z;
  }
if (blocked(state.player.x, state.player.z))
  state.player = safeSpawn(state.player);
const camp = new THREE.Group();
scene.add(camp);
camp.position.z = 5;
box(3, 0.25, 3, 0x625f4c, camp);
mesh(new THREE.ConeGeometry(2.2, 2.3, 4), 0x6a7554, camp, 0, 1.4, 0);
const fire = orb(0.3, 0xffae55, scene, 3, 0.4, 0);
const lamp = new THREE.PointLight(0xffb15c, 15, 14);
lamp.position.set(3, 2, 0);
scene.add(lamp);
const ghost = box(4, 2.8, 0.55, 0xc5e99c);
ghost.material = ghost.material.clone();
ghost.material.transparent = true;
ghost.material.opacity = 0.4;
ghost.visible = false;
function notify(msg) {
  $("notice").textContent = msg;
  $("notice").style.opacity = 1;
  noticeTimer = 4;
}
function canAfford(cost) {
  return Object.entries(cost).every(([k, v]) => state.inventory[k] >= v);
}
function pay(cost) {
  if (Object.entries(cost).some(([k, v]) => state.inventory[k] < v)) {
    notify("Recursos insuficientes. Explore e colete com E.");
    return false;
  }
  for (const [k, v] of Object.entries(cost)) state.inventory[k] -= v;
  return true;
}
function costText(cost) {
  return Object.entries(cost)
    .map(([k, v]) => `${v} ${names[k]}`)
    .join(" · ");
}
function nearBench() {
  return state.structures.some(
    (s) => s.kind === "bench" && dist(s, state.player) < 6,
  );
}
function openPanel(mode) {
  if (panelMode === mode) {
    closePanel();
    return;
  }
  if (!running || paused) return;
  building = null;
  ghost.visible = false;
  focusReturn = document.activeElement;
  panelMode = mode;
  document.exitPointerLock?.();
  renderPanel();
  $("panel").focus();
}
function closePanel() {
  panelMode = null;
  $("panel").classList.add("hidden");
  focusReturn?.focus?.();
}
function renderPanel() {
  const p = $("panel");
  p.classList.remove("hidden");
  p.innerHTML = `<button class="close" aria-label="Fechar painel">×</button><h2>${panelMode === "craft" ? "Fabricar" : panelMode === "build" ? "Construir" : "Companheiros"}</h2>`;
  p.onclick = (e) => {
    if (e.target.closest(".close")) closePanel();
  };
  if (panelMode === "craft") {
    p.innerHTML += `<p>O inventário da companheira fornece os materiais. Armas exigem uma bancada próxima.</p>`;
    for (const [k, r] of Object.entries(recipes)) {
      const b = document.createElement("button");
      b.innerHTML = `${r.name}<small>${costText(r.cost)}${["bow", "gun", "sword"].includes(k) ? " · bancada" : ""}</small>`;
      b.disabled =
        !canAfford(r.cost) ||
        (["bow", "gun", "sword"].includes(k) && !nearBench());
      b.onclick = () => {
        if (["bow", "gun", "sword"].includes(k)) {
          if (!nearBench())
            return notify("Construa uma bancada e aproxime-se.");
        }
        if (!pay(r.cost)) return;
        if (["bow", "gun", "sword"].includes(k)) {
          if (!state.weapons.includes(k)) state.weapons.push(k);
          state.equipment[k] = (state.equipment[k] || 0) + 1;
        } else state.inventory[k] += k === "capsules" ? 3 : 10;
        audio.play("craft");
        fx.burst(state.player, 0xc7da9c, 8);
        notify(`${r.name} fabricado.`);
        save();
        renderPanel();
        updateHUD();
      };
      p.append(b);
    }
  } else if (panelMode === "build") {
    p.innerHTML +=
      "<p>Selecione uma estrutura, mire no terreno e clique para colocar. T gira; Esc cancela. E abre portões.</p>";
    for (const [k, r] of Object.entries(builds)) {
      const b = document.createElement("button");
      b.innerHTML = `${r.name}<small>${costText(r.cost)}</small>`;
      b.disabled = !canAfford(r.cost);
      b.onclick = () => {
        building = { kind: k, angle: yaw };
        ghost.geometry = previewGeometry(k);
        ghost.position.y = buildHeight(k) / 2;
        ghost.visible = true;
        closePanel();
        notify("Clique para construir · T girar · Esc cancelar");
      };
      p.append(b);
    }
  } else {
    p.innerHTML +=
      "<p>Uma companheira ativa. Sentinelas usam torres próximas; guardiãs protegem sua posição atual.</p>";
    state.creatures.forEach((c, i) => {
      const b = document.createElement("button");
      b.innerHTML = `${TYPES[c.type].name} · ${c.level === 2 ? "evoluído" : "nível 1"} · ${Math.ceil(c.hp)} PV<small>${{ companion: "Companheira", guardian: "Guardiã", tower: "Sentinela" }[c.role]} · ${c.xp}/5 experiência</small>`;
      b.disabled = true;
      b.className = "creature-summary";
      p.append(b);
      const actions = document.createElement("div");
      actions.className = "role-actions";
      for (const [role, label] of [
        ["companion", "Acompanhar"],
        ["guardian", "Guardar área"],
        ["tower", "Ocupar torre"],
      ]) {
        const action = document.createElement("button");
        action.textContent = label;
        action.classList.toggle("selected", c.role === role);
        action.disabled = c.role === role;
        action.onclick = () => assignRole(c, role);
        actions.append(action);
      }
      p.append(actions);
      if (c.level === 1 && c.xp >= 5) {
        const e = document.createElement("button");
        e.textContent = "Evoluir · 10 pedras + 8 sucatas";
        e.disabled = !canAfford({ stone: 10, scrap: 8 });
        e.onclick = () => {
          if (pay({ stone: 10, scrap: 8 })) {
            c.level = 2;
            c.hp = 150;
            creatureViews.get(c).scale.setScalar(1.35);
            renderPanel();
            audio.play("evolve");
            fx.burst(c, TYPES[c.type].color, 24);
            save();
            notify(`${TYPES[c.type].name} evoluiu!`);
          }
        };
        p.append(e);
      }
    });
  }
}
function companion() {
  return state.creatures.find((c) => c.role === "companion");
}
function interact() {
  const gate = state.structures.find(
    (s) => s.kind === "gate" && dist(s, state.player) < 4,
  );
  if (gate) {
    gate.open = !gate.open;
    gate.mesh.rotation.y = (gate.angle || 0) + (gate.open ? Math.PI / 2 : 0);
    gate.mesh.visible = true;
    audio.play("ui");
    notify(gate.open ? "Portão aberto." : "Portão fechado.");
    save();
    return;
  }

  const r = resources.find((r) => r.amount > 0 && dist(r, state.player) < 3);
  if (r) {
    const c = companion();
    if (!c || c.hp <= 0)
      return notify("Reanime ou selecione uma companheira para coletar.");
    const amount = r.amount;
    state.inventory[r.kind] += amount;
    state.collected += amount;
    audio.play("collect");
    fx.burst(r, 0xc7da9c, 12);
    fx.text(r, `+${amount} ${names[r.kind]}`);
    state.depleted.push(resources.indexOf(r));
    r.amount = 0;
    r.mesh.visible = false;
    notify(
      `+${r.kind === "wood" ? 5 : r.kind === "stone" ? 4 : 5} ${names[r.kind]} no inventário da companheira`,
    );
    save();
    updateHUD();
    return;
  }
  openPanel("creatures");
}
function capture() {
  if (!state.inventory.capsules) return notify("Fabrique cápsulas primeiro.");
  const c = wild
    .filter((c) => c.hp > 0 && dist(c, state.player) < 9)
    .sort((a, b) => dist(a, state.player) - dist(b, state.player))[0];
  if (!c) return notify("Aproxime-se de uma criatura selvagem.");
  state.inventory.capsules--;
  flash(state.player, c, 0xb6dbd9);
  audio.play("bow");
  if (c.hp > 35)
    return notify("A cápsula falhou: enfraqueça a criatura até 35 PV.");
  const active = companion();
  const own = {
    type: c.type,
    hp: 100,
    x: c.x,
    z: c.z,
    role: active ? "guardian" : "companion",
    level: 1,
    xp: 0,
  };
  state.creatures.push(own);
  scene.remove(c.mesh);
  state.removedWild.push(c.id);
  wild.splice(wild.indexOf(c), 1);
  syncCreatures();
  audio.play("capture");
  fx.burst(c, TYPES[c.type].color, 22);
  fx.text(c, "CAPTURADO");
  save();
  notify(`${TYPES[c.type].name} capturado! Gerencie suas funções no painel.`);
}
function flash(a, b, color) {
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(a.x, 1.3, a.z),
    new THREE.Vector3(b.x, 1.2, b.z),
  ]);
  const m = new THREE.Line(geo, new THREE.LineBasicMaterial({ color }));
  scene.add(m);
  effects.push({ m, life: settings.flashes ? 0.12 : 0.07 });
  if (settings.particles) fx.burst(b, color, 5);
}
function kill(z) {
  if (z.hp > 0 || !zombies.includes(z)) return;
  scene.remove(z.mesh);
  zombies.splice(zombies.indexOf(z), 1);
  state.kills++;
  fx.burst(z, 0xc7da9c, 8);
  fx.text(z, "+1 sucata");
  if (z.horde && state.horde) state.horde.defeated++;
  state.inventory.scrap++;
  for (const c of state.creatures) if (c.hp > 0 && dist(c, z) < 18) c.xp++;
}
function attack() {
  if (attackTimer > 0 || building || panelMode) return;
  const weapon = state.weapon,
    range = weapon === "sword" ? 3.4 : weapon === "bow" ? 28 : 40;
  const ammo = weapon === "bow" ? "arrows" : weapon === "gun" ? "ammo" : null;
  if (ammo && !state.inventory[ammo])
    return notify("Sem munição. Fabrique com C.");
  if (ammo) state.inventory[ammo]--;
  attackTimer = weapon === "gun" ? 0.3 : 0.65;
  swing = 1;
  noiseTimer = 3;
  noiseRange = weapon === "gun" ? 40 : weapon === "bow" ? 14 : 8;
  audio.play(weapon);
  const forward = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
  const targets = [...zombies, ...wild]
    .filter((t) => {
      const d = dist(t, state.player);
      return (
        d < range &&
        clearSight(state.player, t) &&
        ((t.x - state.player.x) * forward.x +
          (t.z - state.player.z) * forward.z) /
          Math.max(d, 0.01) >
          (weapon === "sword" ? 0.1 : 0.96)
      );
    })
    .sort((a, b) => dist(a, state.player) - dist(b, state.player));
  if (targets.length) {
    const t = targets[0];
    const damage = weapon === "sword" ? 23 : weapon === "bow" ? 30 : 38;
    t.hp -= damage;
    audio.play("hit");
    fx.text(t, `−${damage}`, "#edc193");
    fx.burst(t, 0xe2a274, 10);
    $("reticle").classList.add("hit");
    setTimeout(() => $("reticle").classList.remove("hit"), 120);
    flash(state.player, t, 0xffd184);
    if (zombies.includes(t)) kill(t);
    else if (t.hp <= 0) {
      scene.remove(t.mesh);
      state.removedWild.push(t.id);
      wild.splice(wild.indexOf(t), 1);
      notify(
        "Criatura derrotada. Para capturar, pare de atacar quando estiver enfraquecida.",
      );
    }
  } else {
    let distance = range;
    for (let d = 0.5; d < range; d += 0.4) {
      const at = {
        x: state.player.x + forward.x * d,
        z: state.player.z + forward.z * d,
      };
      if (!clearSight(state.player, at)) {
        distance = d;
        break;
      }
    }
    flash(
      state.player,
      {
        x: state.player.x + forward.x * distance,
        z: state.player.z + forward.z * distance,
      },
      0xd7d8bc,
    );
  }
}
function staticBlocked(x, z, r = 0.5) {
  return (
    Math.abs(x) > 98 ||
    Math.abs(z) > 98 ||
    solid.some(
      (s) => Math.abs(x - s.x) < s.w / 2 + r && Math.abs(z - s.z) < s.d / 2 + r,
    )
  );
}
function inStructure(x, z, s, r = 0.5) {
  const dx = x - s.x,
    dz = z - s.z,
    cs = Math.cos(s.angle || 0),
    sn = Math.sin(s.angle || 0),
    lx = dx * cs - dz * sn,
    lz = dx * sn + dz * cs;
  const dims = {
    wall: [4, 0.55],
    gate: [4, 0.55],
    tower: [2.8, 2.8],
    bench: [2, 1],
    bed: [2, 3],
  }[s.kind];
  return Math.abs(lx) < dims[0] / 2 + r && Math.abs(lz) < dims[1] / 2 + r;
}
function blocked(x, z, r = 0.45) {
  return (
    staticBlocked(x, z, r) ||
    state.structures.some(
      (s) => !(s.kind === "gate" && s.open) && inStructure(x, z, s, r),
    )
  );
}
function clearSight(a, b) {
  const d = dist(a, b),
    steps = Math.ceil(d * 2);
  for (let i = 1; i < steps; i++) {
    const t = i / steps,
      x = a.x + (b.x - a.x) * t,
      z = a.z + (b.z - a.z) * t;
    if (
      staticBlocked(x, z, 0) ||
      (a.role !== "tower" &&
        state.structures.some(
          (s) =>
            ["wall", "gate"].includes(s.kind) &&
            !s.open &&
            inStructure(x, z, s, 0),
        ))
    )
      return false;
  }
  return true;
}
function move(a, tx, tz, speed, dt, collision = true) {
  const old = { x: a.x, z: a.z },
    d = dist(a, { x: tx, z: tz });
  if (d < 0.1) return;
  let goal = { x: tx, z: tz };
  a.repath = (a.repath || 0) - dt;
  const staticOnLine = () => {
    for (let i = 1; i <= 5; i++)
      if (
        staticBlocked(
          a.x + ((tx - a.x) * i) / 5,
          a.z + ((tz - a.z) * i) / 5,
          0.7,
        )
      )
        return true;
    return false;
  };
  if (collision && staticOnLine()) {
    if (a.repath <= 0) {
      a.path = findPath(a, { x: tx, z: tz }, (x, z) =>
        staticBlocked(x, z, 0.8),
      );
      a.repath = 2;
    }
    if (a.path?.length) {
      if (dist(a, a.path[0]) < 0.7) a.path.shift();
      if (a.path.length) goal = a.path[0];
    }
  }
  const length = dist(a, goal),
    step = Math.min(length, speed * dt),
    dx = ((goal.x - a.x) / Math.max(length, 0.01)) * step,
    dz = ((goal.z - a.z) / Math.max(length, 0.01)) * step;
  if (!collision || !blocked(a.x + dx, a.z)) a.x += dx;
  if (!collision || !blocked(a.x, a.z + dz)) a.z += dz;
  // Companions use a small lateral detour rather than sticking to defenses.
  if (collision && dist(a, old) < 0.001 && !a.mesh) {
    for (const side of [1, -1]) {
      const x = a.x - dz * side,
        z = a.z + dx * side;
      if (!blocked(x, z)) {
        a.x = x;
        a.z = z;
        break;
      }
    }
  }
  a.moving = dist(a, old) > 0.001;
}
function safeSpawn(base) {
  for (let r = 0; r < 8; r += 1)
    for (let i = 0; i < 12; i++) {
      const p = {
        x: base.x + Math.cos((i / 12) * Math.PI * 2) * r,
        z: base.z + Math.sin((i / 12) * Math.PI * 2) * r,
      };
      if (!blocked(p.x, p.z)) return p;
    }
  return { x: 0, z: 0 };
}
function respawn() {
  state.deaths++;
  state.health = 100;
  state.player = safeSpawn(state.base);
  velocity = { x: 0, z: 0 };
  invulnerability = 5;
  for (const c of state.creatures)
    if (c.role === "companion") {
      const at = safeSpawn({ x: state.player.x + 2, z: state.player.z });
      c.x = at.x;
      c.z = at.z;
    }
  audio.play("hurt");
  save();
  notify(
    "Você reviveu na base. Sua companheira e os recursos estão protegidos.",
  );
  showModal("death");
}
function assignRole(c, role) {
  if (role === "tower") {
    const t = state.structures.find(
      (s) =>
        s.kind === "tower" &&
        dist(s, state.player) < 12 &&
        !state.creatures.some(
          (other) =>
            other !== c && other.role === "tower" && dist(other, s) < 1,
        ),
    );
    if (!t) return notify("Precisa de uma torre livre a até 12 metros.");
    c.x = t.x;
    c.z = t.z;
  } else {
    const at = safeSpawn({ x: state.player.x + 2, z: state.player.z });
    c.x = at.x;
    c.z = at.z;
  }
  if (role === "companion")
    for (const other of state.creatures)
      if (other !== c && other.role === "companion") other.role = "guardian";
  c.role = role;
  renderPanel();
  save();
  notify(
    `${TYPES[c.type].name}: ${{ companion: "acompanhando", guardian: "guardando a área", tower: "defendendo a torre" }[role]}.`,
  );
}
const buildDimensions = {
  wall: [4, 2.8, 0.55],
  gate: [4, 2.8, 0.55],
  tower: [2.8, 5, 2.8],
  bench: [2, 1.5, 1],
  bed: [2, 0.8, 3],
};
function buildHeight(k) {
  return buildDimensions[k][1];
}
function previewGeometry(k) {
  return new THREE.BoxGeometry(...buildDimensions[k]);
}
function validPlacement(x, z, k, angle) {
  const [w, , d] = buildDimensions[k],
    cs = Math.cos(angle),
    sn = Math.sin(angle);
  for (const lx of [-w / 2, 0, w / 2])
    for (const lz of [-d / 2, 0, d / 2]) {
      const px = x + lx * cs + lz * sn,
        pz = z - lx * sn + lz * cs;
      if (
        staticBlocked(px, pz, 0.35) ||
        state.structures.some((s) => inStructure(px, pz, s, 0.25))
      )
        return false;
    }
  return dist({ x, z }, state.player) > 2;
}
function place() {
  if (!building) return;
  const x = ghost.position.x,
    z = ghost.position.z;
  if (!validPlacement(x, z, building.kind, building.angle))
    return notify("Escolha um terreno livre.");
  if (!pay(builds[building.kind].cost)) return;
  const s = {
    kind: building.kind,
    x,
    z,
    angle: building.angle,
    hp: building.kind === "wall" ? 300 : 200,
  };
  state.structures.push(s);
  audio.play("craft");
  fx.burst(s, 0xc7da9c, 15);
  structureView(s);
  if (s.kind === "bed") {
    state.base = safeSpawn({ x, z: z + 3 });
    notify("Novo ponto de renascimento definido.");
  } else notify(`${builds[s.kind].name} construído.`);
  building = null;
  ghost.visible = false;
  save();
  updateHUD();
}
function updateHUD() {
  const day = Math.floor(state.time / 720) + 1,
    minute = Math.floor(((state.time % 720) / 720) * 1440);
  $("clock").textContent =
    `DIA ${String(day).padStart(2, "0")} / ${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
  $("horde").textContent =
    `DIA ${(Math.floor((day - 1) / 5) + 1) * 5} · ${zombies.length} ameaças`;
  $("health").style.width = `${state.health}%`;
  $("healthValue").textContent = `${Math.ceil(state.health)} / 100`;
  $("health").parentElement.setAttribute(
    "aria-valuenow",
    Math.ceil(state.health),
  );
  $("protection").textContent =
    invulnerability > 0
      ? `PROTEÇÃO · ${Math.ceil(invulnerability)}s`
      : state.health < 30
        ? "VIDA BAIXA · VOLTE À BASE"
        : "";
  const active = state.horde;
  if (active) $("horde").textContent = `HORDA / DIA ${active.day}`;
  $("hordeDetail").textContent = active
    ? `${zombies.filter((z) => z.horde).length} restantes · ${active.defeated} derrotados`
    : `${zombies.length} zumbis na região · 12 min por dia`;
  const baseDistance = Math.round(dist(state.player, state.base));
  $("clock").title = `Refúgio: ${baseDistance} metros`;
  let objective = state.hordesCleared
    ? "Continue fortalecendo sua base. A próxima horda será maior."
    : !state.structures.some((s) => s.kind === "bench")
      ? "Construa uma bancada [B] para fabricar armas."
      : !state.structures.some((s) => s.kind === "bed")
        ? "Construa uma cama [B] para marcar seu refúgio."
        : state.creatures.length < 2
          ? "Enfraqueça uma criatura até 35 PV e capture com Q."
          : !state.structures.some((s) => s.kind === "tower")
            ? "Construa uma torre e atribua uma sentinela."
            : "Prepare munição e proteja seu refúgio para o dia 5.";
  const angle =
    Math.atan2(state.base.x - state.player.x, state.base.z - state.player.z) -
    Math.PI -
    yaw;
  $("objective").innerHTML =
    `<b>PRÓXIMO PASSO</b>${objective}<span class="base-location"><span style="display:inline-block;transform:rotate(${-angle}rad)">↑</span> REFÚGIO · ${baseDistance} m</span>`;
  const c = companion();
  $("companion").innerHTML = c
    ? `<span class="label">${TYPES[c.type].name.toUpperCase()} / ${c.level === 2 ? "EVOLUÍDO" : "COMPANHEIRA"}</span><p>${c.hp <= 0 ? "INCAPACITADA · R para reanimar" : `${Math.ceil(c.hp)} PV · ${TYPES[c.type].power}`}<br>${c.xp}/5 XP · E para gerenciar</p>`
    : "<p>Sem companheira ativa · Gerencie suas criaturas</p>";
  if (c)
    $("companion").innerHTML +=
      `<div class="companion-health"><i style="width:${(Math.max(0, c.hp) / (c.level === 2 ? 150 : 100)) * 100}%"></i></div>`;
  $("inventory").innerHTML = Object.entries(state.inventory)
    .map(([k, v]) => `<span>${names[k]} <b>${v}</b></span>`)
    .join("");
  document.querySelectorAll("[data-weapon]").forEach((b) => {
    b.classList.toggle("active", b.dataset.weapon === state.weapon);
    b.disabled = !state.weapons.includes(b.dataset.weapon);
    const labels = { sword: "1 / ESPADA", bow: "2 / ARCO", gun: "3 / PISTOLA" };
    b.textContent = `${labels[b.dataset.weapon]} ×${state.equipment[b.dataset.weapon] || 0}`;
  });
  const r = resources.find((r) => r.amount && dist(r, state.player) < 3),
    w = wild.find((w) => dist(w, state.player) < 9);
  $("hint").textContent = building
    ? "CLIQUE construir · T girar · ESC cancelar"
    : r
      ? `E · Coletar ${names[r.kind]}`
      : w
        ? `${TYPES[w.type].name} selvagem · ${Math.ceil(w.hp)} PV · Q capturar (≤35 PV)`
        : "E · Gerenciar criaturas";
  const gate = state.structures.find(
    (s) => s.kind === "gate" && dist(s, state.player) < 4,
  );
  if (gate && !building)
    $("hint").textContent = `E · ${gate.open ? "Fechar" : "Abrir"} portão`;
}
function save() {
  if (!running) return;
  const clean = {
    ...state,
    structures: state.structures.map(({ mesh, ...s }) => s),
    zombieSnapshot: zombies.map(({ mesh, path, repath, moving, ...z }) => z),
    wildSnapshot: wild.map(({ mesh, path, repath, moving, ...w }) => w),
    version: 2,
  };
  try {
    localStorage.setItem("vigilia-v1", JSON.stringify(clean));
    return true;
  } catch {
    notify(
      "Não foi possível salvar no navegador. Verifique o espaço ou as permissões de armazenamento.",
    );
    return false;
  }
}
function tick(dt) {
  if (!running || paused || panelMode) return;
  state.time += dt;
  invulnerability = Math.max(0, invulnerability - dt);
  swing = Math.max(0, swing - dt * 3);
  noiseTimer = Math.max(0, noiseTimer - dt);
  if (state.health < healthPrevious) {
    fx.hurt();
    audio.play("hurt");
  }
  healthPrevious = state.health;
  if (state.health <= 0) {
    respawn();
    return;
  }
  if (
    dist(state.player, state.base) < 5 &&
    zombies.every((z) => dist(z, state.player) > 10)
  )
    state.health = Math.min(100, state.health + dt * 3);
  attackTimer -= dt;
  saveTimer += dt;
  spawnTimer += dt;
  noticeTimer -= dt;
  if (noticeTimer <= 0) $("notice").style.opacity = 0;
  const p = state.player;
  let dx = 0,
    dz = 0;
  if (!panelMode) {
    const f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0),
      s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    dx = -Math.sin(yaw) * f + Math.cos(yaw) * s;
    dz = -Math.cos(yaw) * f - Math.sin(yaw) * s;
    const l = Math.hypot(dx, dz);
    if (l) {
      dx /= l;
      dz /= l;
      const speed = keys.ShiftLeft ? 7 : 4.5;
      const factor = 1 - Math.exp(-dt * 18);
      velocity.x += (dx * speed - velocity.x) * factor;
      velocity.z += (dz * speed - velocity.z) * factor;
    } else {
      velocity.x *= Math.exp(-dt * 22);
      velocity.z *= Math.exp(-dt * 22);
    }
    if (!blocked(p.x + velocity.x * dt, p.z)) p.x += velocity.x * dt;
    else velocity.x = 0;
    if (!blocked(p.x, p.z + velocity.z * dt)) p.z += velocity.z * dt;
    else velocity.z = 0;
  } else {
    velocity.x = 0;
    velocity.z = 0;
  }
  player.position.set(p.x, 0, p.z);
  animateHuman(player, Math.hypot(velocity.x, velocity.z), state.time, swing);
  player.rotation.y = yaw;
  for (const c of state.creatures) {
    const m = creatureViews.get(c);
    if (c.hp > 0) {
      if (c.role === "companion" && dist(c, p) > 2.5)
        move(c, p.x + Math.cos(yaw) * 1.5, p.z - Math.sin(yaw) * 1.5, 6, dt);
      if (
        c.role === "companion" &&
        dist(c, p) > 30 &&
        zombies.every((z) => dist(z, c) > 10)
      ) {
        const at = safeSpawn({ x: p.x + 2, z: p.z });
        c.x = at.x;
        c.z = at.z;
      }
      c.cooldown = (c.cooldown || 0) - dt;
      const targets = zombies.filter(
        (z) => dist(c, z) < TYPES[c.type].range + (c.level - 1) * 4,
      );
      if (targets.length && c.cooldown <= 0 && clearSight(c, targets[0])) {
        const z = targets[0];
        c.cooldown = 1.2;
        z.hp -= c.type === 2 ? 30 : 18 * c.level;
        if (c.type === 1) z.slow = 2;
        if (c.type === 0)
          for (const other of zombies)
            if (other !== z && dist(other, z) < 3) other.hp -= 10 * c.level;
        flash(c, z, TYPES[c.type].color);
        for (const dead of [...zombies]) kill(dead);
      }
      if (
        c.role === "tower" &&
        !state.structures.some((s) => s.kind === "tower" && dist(s, c) < 1)
      ) {
        c.role = "guardian";
      }
      const target = targets[0];
      if (target) m.rotation.y = Math.atan2(c.x - target.x, c.z - target.z);
    }
    m.position.set(
      c.x,
      (c.role === "tower" ? 4 : 0) +
        (c.hp > 0
          ? Math.sin(state.time * (c.moving ? 10 : 2) + c.type) * 0.045
          : 0),
      c.z,
    );
    if (m.userData.tail)
      m.userData.tail.rotation.x = Math.sin(state.time * 3) * 0.2;
    m.rotation.z = c.hp <= 0 ? Math.PI / 2 : 0;
    m.scale.setScalar(c.level === 2 ? 1.35 : 1);
  }
  for (const z of [...zombies]) {
    z.cooldown -= dt;
    z.slow -= dt;
    const alive = state.creatures.filter((c) => c.hp > 0 && c.role !== "tower"),
      target = [
        ...(z.horde && dist(z, state.base) > 8
          ? [{ ...state.base, kind: "base" }]
          : [{ ...p, kind: "player" }]),
        ...alive,
      ].sort((a, b) => dist(a, z) - dist(b, z))[0];
    z.aggro = Math.max(0, z.aggro - dt);
    if (
      (dist(z, target) < 22 && clearSight(z, target)) ||
      (noiseTimer > 0 && dist(z, p) < noiseRange) ||
      z.hp < z.maxHp
    )
      z.aggro = 8;
    const engaged = z.horde || z.aggro > 0;
    if (!engaged)
      move(
        z,
        z.homeX + Math.sin(state.time * 0.07 + z.homeX) * 3,
        z.homeZ + Math.cos(state.time * 0.07 + z.homeZ) * 3,
        0.45,
        dt,
      );
    else if (dist(z, target) > 1.35)
      move(
        z,
        target.x,
        target.z,
        z.slow > 0
          ? 0.6
          : z.variant === "runner"
            ? 2.6
            : z.variant === "brute"
              ? 1.25
              : 1.65,
        dt,
      );
    animateHuman(z.mesh, z.moving ? 1.5 : 0, state.time, 0, true);
    z.mesh.position.set(z.x, 0, z.z);
    z.mesh.rotation.y = Math.atan2(z.x - target.x, z.z - target.z);
    const structure = state.structures
      .filter((s) => !s.open && dist(s, z) < 3)
      .sort((a, b) => dist(a, z) - dist(b, z))[0];
    if (engaged && z.cooldown <= 0) {
      if (dist(z, target) < 1.7 && target.kind !== "base") {
        z.cooldown = 1;
        target.kind === "player"
          ? (state.health -=
              invulnerability > 0 ? 0 : z.variant === "brute" ? 13 : 7)
          : (target.hp = Math.max(
              0,
              target.hp - (z.variant === "brute" ? 18 : 10),
            ));
      } else if (structure) {
        z.cooldown = 1;
        structure.hp -= 16;
        fx.burst(structure, 0xba9d63, 4);
        if (structure.hp <= 0) {
          scene.remove(structure.mesh);
          for (const c of state.creatures)
            if (c.role === "tower" && dist(c, structure) < 1)
              c.role = "guardian";
          state.structures.splice(state.structures.indexOf(structure), 1);
          notify("Uma estrutura foi destruída!");
        }
      }
    }
    if (state.health <= 0) {
      respawn();
      updateHUD();
      return;
    }
  }
  for (const w of wild) {
    w.timer += dt;
    if (w.hp < 100 && dist(w, p) < 7) {
      if (dist(w, p) > 1.5) move(w, p.x, p.z, 2.8, dt);
      if (dist(w, p) < 1.8 && w.timer > 1.2) {
        if (invulnerability <= 0) state.health -= 5;
        w.timer = 0;
        if (state.health <= 0) {
          respawn();
          updateHUD();
          return;
        }
      }
    } else if (dist(w, p) > 5) {
      move(
        w,
        w.homeX + Math.sin(state.time * 0.12 + w.homeX) * 3,
        w.homeZ + Math.cos(state.time * 0.1 + w.homeZ) * 3,
        0.6,
        dt,
      );
    }
    w.mesh.position.set(w.x, 0, w.z);
    w.mesh.rotation.y = Math.atan2(w.x - p.x, w.z - p.z);
  }
  const day = Math.floor(state.time / 720) + 1;
  if (state.horde && zombies.every((z) => !z.horde)) {
    const result = { ...state.horde };
    state.horde = null;
    state.hordesCleared++;
    state.inventory.scrap += 12;
    state.inventory.capsules += 2;
    state.lastResult = result;
    save();
    audio.play("evolve");
    showModal("victory");
    return;
  }
  if (day % 5 === 0 && state.lastHorde !== day && !state.horde) {
    state.lastHorde = day;
    state.horde = { day, defeated: 0, startKills: state.kills };
    audio.play("horde");
    for (let i = 0; i < Math.min(100, 18 + Math.floor(day / 5) * 8); i++) {
      const a = rand(0, Math.PI * 2);
      spawnZombie(
        ...Object.values(
          safeSpawn({
            x: Math.max(-94, Math.min(94, state.base.x + Math.sin(a) * 35)),
            z: Math.max(-94, Math.min(94, state.base.z + Math.cos(a) * 35)),
          }),
        ),
        true,
      );
    }
    notify("HORDA! Os mortos estão se aproximando da base.");
    save();
  }
  if (spawnTimer > 45 && zombies.length < 35) {
    spawnTimer = 0;
    const a = rand(0, Math.PI * 2);
    const x = p.x + Math.sin(a) * 30,
      z = p.z + Math.cos(a) * 30;
    if (!blocked(x, z)) spawnZombie(x, z);
  }
  if (building) {
    ghost.position.set(
      Math.round((p.x - Math.sin(yaw) * 5) * 2) / 2,
      buildHeight(building.kind) / 2,
      Math.round((p.z - Math.cos(yaw) * 5) * 2) / 2,
    );
    ghost.material.color.set(
      validPlacement(
        ghost.position.x,
        ghost.position.z,
        building.kind,
        building.angle,
      ) && canAfford(builds[building.kind].cost)
        ? 0xc7da9c
        : 0xdd8667,
    );
    ghost.rotation.y = building.angle;
  }
  const phase = (state.time % 720) / 720,
    light = 0.5 + Math.max(0, Math.sin(phase * Math.PI * 2)) * 1.4;
  ambient.intensity = light;
  sun.intensity = light;
  const color = new THREE.Color().setHSL(0.46, 0.09, 0.18 + light * 0.21);
  scene.background = color;
  scene.fog.color.copy(color);
  sun.position.set(p.x + 25, 45, p.z + 20);
  sun.target.position.set(p.x, 0, p.z);
  sun.target.updateMatrixWorld();
  if (saveTimer > 10) {
    saveTimer = 0;
    save();
  }
  hudElapsed += dt;
  if (hudElapsed > 0.12) {
    hudElapsed = 0;
    updateHUD();
    updateTarget();
  }
}
let idleFrame = 0;
function animate() {
  requestAnimationFrame(animate);
  clock.update();
  const dt = Math.min(clock.getDelta(), 0.1);
  tick(dt);
  if (!running || paused) {
    idleFrame += dt;
    if (idleFrame < 0.08) return;
    idleFrame = 0;
  }
  const p = state.player;
  const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const origin = new THREE.Vector3(p.x, 1.65, p.z);
  const desired = new THREE.Vector3(
    p.x + Math.sin(yaw) * 7 * Math.cos(pitch),
    2 + Math.sin(pitch) * 7,
    p.z + Math.cos(yaw) * 7 * Math.cos(pitch),
  );
  const ray = new THREE.Ray(origin, desired.clone().sub(origin).normalize()),
    length = origin.distanceTo(desired),
    hit = new THREE.Vector3();
  let nearest = length;
  for (const object of occluders) {
    if (!object.parent?.parent || !object.parent.visible) continue;
    const bounds = new THREE.Box3().setFromObject(object).expandByScalar(0.25);
    if (ray.intersectBox(bounds, hit)) {
      const distance = origin.distanceTo(hit);
      if (distance > 0.2)
        nearest = Math.min(nearest, Math.max(0.7, distance - 0.2));
    }
  }
  if (nearest < length)
    desired.copy(origin).addScaledVector(ray.direction, nearest);
  camera.position.lerp(desired, 1 - Math.exp(-dt * 12));
  camera.lookAt(p.x + forward.x * 4, 1.3, p.z + forward.z * 4);
  if (fx.shake > 0 && settings.shake) {
    camera.position.x += (Math.random() - 0.5) * 0.05;
    camera.position.y += (Math.random() - 0.5) * 0.04;
  }
  camera.updateMatrixWorld();
  fx.update(dt, camera);
  for (const e of [...effects]) {
    e.life -= dt;
    if (e.life < 0) {
      scene.remove(e.m);
      e.m.geometry.dispose();
      e.m.material.dispose();
      effects.splice(effects.indexOf(e), 1);
    }
  }
  if (running && !paused && settings.particles && Math.random() < dt * 6)
    fx.burst({ x: 3, y: 0.5, z: 0 }, 0xffce82, 1);
  fire.scale.setScalar(0.9 + Math.sin(clock.getElapsed() * 5) * 0.08);
  lamp.intensity = 12 + Math.sin(clock.getElapsed() * 4) * 2;
  renderer.render(scene, camera);
}
const clock = new THREE.Timer();
clock.connect(document);
camera.position.set(9, 7, 12);
applySettings();
animate();
updateHUD();
$("play").textContent = saved ? "CONTINUAR EXPEDIÇÃO →" : "ENTRAR NA CIDADE →";
$("saveInfo").textContent = corruptSave
  ? "Save inválido preservado em vigilia-recovery. Inicie uma nova expedição para continuar."
  : saved
    ? `Progresso salvo · Dia ${Math.floor(state.time / 720) + 1} · ${state.creatures.length} criaturas`
    : "Seu progresso fica neste navegador. Teclado e mouse / WebGL.";
$("newGame").classList.toggle("hidden", !saved);
$("play").onclick = () => {
  running = true;
  paused = false;
  $("menu").classList.add("hidden");
  $("hud").classList.remove("hidden");
  audio.start().catch(() => {});
  applySettings();
  lockMouse();
  notify("Primeiro passo: construa uma bancada com B. E coleta recursos.");
  healthPrevious = state.health;
};
$("reset").onclick = () => showModal("reset");
$("newGame").onclick = () => showModal("reset");
$("pause").onclick = () => {
  if (!running) return;
  if (paused && modalMode) resumeGame();
  else showModal("pause");
};
$("settingsButton").onclick = () => showModal("settings");
$("menuSettings").onclick = () => showModal("settings");
$("helpButton").onclick = () => showModal("help");
$("menuHelp").onclick = () => showModal("help");
$("manageButton").onclick = () => openPanel("creatures");
$("craftButton").onclick = () => openPanel("craft");
$("buildButton").onclick = () => openPanel("build");
document
  .querySelectorAll("[data-weapon]")
  .forEach((b) => (b.onclick = () => (state.weapon = b.dataset.weapon)));
addEventListener("keydown", (e) => {
  if (["KeyW", "KeyA", "KeyS", "KeyD", "Space"].includes(e.code))
    e.preventDefault();
  keys[e.code] = true;
  if (e.target.matches("input,select")) return;
  if (e.code === "Escape" && !e.repeat) {
    if (modalMode) {
      if (modalMode === "settings" || modalMode === "help") closeModal();
      else if (running) resumeGame();
      else closeModal();
    } else if (panelMode) {
      closePanel();
    } else if (building) {
      building = null;
      ghost.visible = false;
    } else if (running) showModal("pause");
    return;
  }
  if (!running || paused || e.repeat) return;
  const weapon = { Digit1: "sword", Digit2: "bow", Digit3: "gun" }[e.code];
  if (weapon && state.weapons.includes(weapon)) state.weapon = weapon;
  if (e.code === "KeyE") interact();
  if (e.code === "KeyC") openPanel("craft");
  if (e.code === "KeyB") openPanel("build");
  if (e.code === "KeyQ") capture();
  if (e.code === "KeyR") {
    const c = state.creatures.find(
      (c) => c.hp <= 0 && dist(c, state.player) < 5,
    );
    if (c) {
      c.hp = c.level === 2 ? 150 : 100;
      audio.play("evolve");
      fx.burst(c, TYPES[c.type].color, 12);
      save();
      notify("Companheira reanimada.");
    }
  }
  if (e.code === "KeyF") {
    const target = state.structures
      .filter(
        (s) =>
          dist(s, state.player) < 4 && s.hp < (s.kind === "wall" ? 300 : 200),
      )
      .sort((a, b) => dist(a, state.player) - dist(b, state.player))[0];
    if (!target)
      notify("Aproxime-se de uma construção danificada para reparar.");
    else if (pay({ wood: 2, stone: 1 })) {
      target.hp = Math.min(target.kind === "wall" ? 300 : 200, target.hp + 100);
      audio.play("craft");
      fx.burst(target, 0xc7da9c, 10);
      save();
      notify(`Reparado: ${Math.ceil(target.hp)} PV · −2 madeiras, −1 pedra.`);
    }
  }
  if (e.code === "KeyT" && building) building.angle += Math.PI / 4;
});
addEventListener("keyup", (e) => (keys[e.code] = false));
addEventListener("blur", () => {
  Object.keys(keys).forEach((k) => (keys[k] = false));
  if (running && !paused) showModal("pause");
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && running && !paused) showModal("pause");
});
addEventListener("mousemove", (e) => {
  if (
    document.pointerLockElement &&
    running &&
    !paused &&
    !panelMode &&
    !modalMode
  ) {
    yaw -= e.movementX * 0.0025 * settings.sensitivity;
    pitch = THREE.MathUtils.clamp(
      pitch +
        e.movementY * 0.002 * settings.sensitivity * (settings.invert ? -1 : 1),
      0.1,
      0.85,
    );
  }
});
$("world").addEventListener("mousedown", (e) => {
  if (e.button !== 0) return;
  if (!running || paused) return;
  if (building) place();
  else if (!panelMode) {
    if (!document.pointerLockElement) lockMouse();
    attack();
  }
});
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
addEventListener("beforeunload", save);

// Read-only diagnostics for functional browser tests.
window.vigilia = {
  snapshot: () =>
    JSON.parse(
      JSON.stringify({
        ...state,
        structures: state.structures.map(({ mesh, ...s }) => s),
      }),
    ),
  entities: () => ({
    wild: wild.map(({ mesh, ...c }) => c),
    resources: resources.map(({ mesh, ...r }) => r),
    zombies: zombies.map(({ mesh, path, ...z }) => z),
  }),
  view: () => ({
    camera: camera.position.toArray(),
    quaternion: camera.quaternion.toArray(),
    render: { ...renderer.info.render },
    quality: settings.quality,
    paused,
    running,
    audio: audio.context?.state || "uninitialized",
  }),
  collision: (x, z) => blocked(x, z),
  ready: true,
};

function lockMouse() {
  try {
    const result = $("world").requestPointerLock?.();
    result?.catch?.(() => notify("Clique no cenário para controlar a câmera."));
  } catch {
    notify("Clique no cenário para controlar a câmera.");
  }
}
function animateHuman(model, speed, time, attack = 0, zombie = false) {
  const phase = time * (zombie ? 6 : 10),
    amount = Math.min(1, speed / 3);
  model.userData.legs?.forEach(
    (leg, i) =>
      (leg.rotation.x = Math.sin(phase + i * Math.PI) * 0.55 * amount),
  );
  model.userData.arms?.forEach((arm, i) => {
    arm.rotation.x = zombie
      ? -0.8 + Math.sin(phase + i) * 0.15
      : -Math.sin(phase + i * Math.PI) * 0.28 * amount;
    arm.rotation.z = 0;
  });
  if (!zombie && model.userData.arms) {
    model.userData.arms[1].rotation.x -= Math.sin(attack * Math.PI) * 1.4;
    model.userData.arms[1].rotation.z = Math.sin(attack * Math.PI) * 0.7;
    for (const [k, m] of Object.entries(weaponViews))
      m.visible = k === state.weapon;
  }
}
function updateTarget() {
  const f = { x: -Math.sin(yaw), z: -Math.cos(yaw) },
    candidates = [...zombies, ...wild]
      .filter((t) => {
        const d = dist(t, state.player);
        return (
          d < 30 &&
          ((t.x - state.player.x) * f.x + (t.z - state.player.z) * f.z) /
            Math.max(d, 0.01) >
            0.96 &&
          clearSight(state.player, t)
        );
      })
      .sort((a, b) => dist(a, state.player) - dist(b, state.player));
  const t = candidates[0];
  $("targetInfo").textContent = t
    ? `${wild.includes(t) ? TYPES[t.type].name : t.variant === "runner" ? "Corredor" : t.variant === "brute" ? "Brutamontes" : "Zumbi"} · ${Math.max(0, Math.ceil(t.hp))} PV${wild.includes(t) && t.hp <= 35 ? " · Q CAPTURAR" : ""}`
    : "";
}
function applySettings() {
  const profile = {
    low: { ratio: 1, shadow: false, resolution: 512 },
    medium: { ratio: 1.25, shadow: true, resolution: 1024 },
    high: { ratio: 1.75, shadow: true, resolution: 2048 },
  }[settings.quality];
  renderer.setPixelRatio(Math.min(devicePixelRatio, profile.ratio));
  renderer.setSize(innerWidth, innerHeight);
  const changed = renderer.shadowMap.enabled !== profile.shadow;
  renderer.shadowMap.enabled = profile.shadow;
  sun.castShadow = profile.shadow;
  if (changed)
    scene.traverse((o) => {
      if (o.material?.isMeshStandardMaterial) o.material.needsUpdate = true;
    });
  if (sun.shadow.mapSize.x !== profile.resolution) {
    sun.shadow.map?.dispose();
    sun.shadow.map = null;
    sun.shadow.mapSize.set(profile.resolution, profile.resolution);
  }
  renderer.shadowMap.needsUpdate = true;
  document.body.classList.toggle("high-contrast", settings.highContrast);
  audio.apply();
  storePreferences(settings);
}
function showModal(mode) {
  if (mode === "settings" || mode === "help")
    modalReturn = modalMode || (running ? "pause" : null);
  else modalReturn = null;
  focusReturn = document.activeElement;
  modalMode = mode;
  if (running) {
    paused = true;
    save();
  }
  audio.suspend();
  Object.keys(keys).forEach((k) => (keys[k] = false));
  velocity = { x: 0, z: 0 };
  document.exitPointerLock?.();
  closePanel();
  building = null;
  ghost.visible = false;
  $("modal").classList.remove("hidden");
  $("pause").textContent = "▶ RETOMAR";
  renderModal();
  requestAnimationFrame(() =>
    $("modal").querySelector("button,input,select")?.focus(),
  );
}
function resumeGame() {
  modalMode = null;
  modalReturn = null;
  paused = false;
  $("modal").classList.add("hidden");
  $("pause").textContent = "Ⅱ PAUSA";
  audio.start().catch(() => {});
  healthPrevious = state.health;
  Object.keys(keys).forEach((k) => (keys[k] = false));
  lockMouse();
}
function closeModal() {
  if (modalReturn) {
    audio.suspend();
    const mode = modalReturn;
    modalReturn = null;
    modalMode = mode;
    renderModal();
  } else if (running) resumeGame();
  else {
    audio.suspend();
    modalMode = null;
    $("modal").classList.add("hidden");
    focusReturn?.focus?.();
  }
}
function renderModal() {
  const body = $("modalBody"),
    actions = (text, action, primary = false) =>
      `<button data-action="${action}" class="${primary ? "primary" : ""}">${text}</button>`;
  let html = "";
  if (modalMode === "pause")
    html = `<span class="eyebrow">EXPEDIÇÃO EM PAUSA</span><h2 id="modalTitle">Respire. Planeje. Volte.</h2><p>O mundo está pausado. Seu progresso foi salvo neste navegador.</p><div class="stack">${actions("RETOMAR EXPEDIÇÃO", "resume", true)}${actions("Configurações", "settings")}${actions("Controles e como jogar", "help")}${actions("Salvar e retornar ao menu", "menu")}${actions("Reiniciar expedição", "reset")}</div>`;
  if (modalMode === "settings")
    html = `<span class="eyebrow">AJUSTE SUA EXPERIÊNCIA</span><h2 id="modalTitle">Configurações</h2><div class="settings-group"><h3>ÁUDIO</h3><label class="setting">Música / ambiente <input aria-label="Volume da música" data-setting="music" type="range" min="0" max="1" step=".05" value="${settings.music}"></label><label class="setting">Efeitos sonoros <input aria-label="Volume dos efeitos" data-setting="effects" type="range" min="0" max="1" step=".05" value="${settings.effects}"></label></div><button data-action="testAudio">Testar áudio</button><div class="settings-group"><h3>GRÁFICOS E ACESSIBILIDADE</h3><label class="setting">Qualidade <select aria-label="Qualidade gráfica" data-setting="quality"><option value="low">Leve / sem sombras</option><option value="medium">Equilibrada</option><option value="high">Alta</option></select></label>${[
      ["particles", "Partículas"],
      ["shake", "Tremor de câmera"],
      ["flashes", "Feedback de dano / flashes"],
      ["highContrast", "Interface com alto contraste"],
    ]
      .map(
        ([key, label]) =>
          `<label class="setting">${label}<input data-setting="${key}" type="checkbox" ${settings[key] ? "checked" : ""}></label>`,
      )
      .join(
        "",
      )}</div><div class="settings-group"><h3>CONTROLES</h3><label class="setting">Sensibilidade do mouse <input aria-label="Sensibilidade do mouse" data-setting="sensitivity" type="range" min=".2" max="2.5" step=".1" value="${settings.sensitivity}"></label><label class="setting">Inverter câmera vertical<input data-setting="invert" type="checkbox" ${settings.invert ? "checked" : ""}></label></div><p class="fine">Preferências salvas automaticamente. Plataforma: computador com teclado e mouse.</p><div class="stack">${actions("Voltar", "back", true)}</div>`;
  if (modalMode === "help")
    html = `<span class="eyebrow">MANUAL DE CAMPO</span><h2 id="modalTitle">Você não está sozinho.</h2><p>Explore as ruas e a mata com sua companheira. Ela carrega os recursos automaticamente. Construa uma bancada para fabricar armas e uma cama para definir onde renascer.</p><div class="key-grid"><kbd>W A S D / Shift</kbd><span>Mover / correr</span><kbd>Mouse / clique</kbd><span>Câmera / atacar. Clique no mundo para capturar o mouse.</span><kbd>1 / 2 / 3</kbd><span>Espada / arco / pistola</span><kbd>E / Q / R</kbd><span>Coletar ou abrir portão / capturar / reanimar</span><kbd>C / B / T / F</kbd><span>Fabricar / construir / girar / reparar (2 madeiras + 1 pedra)</span><kbd>Esc</kbd><span>Fechar painel, cancelar construção ou pausar</span></div><p>Capture criaturas com até 35 PV usando cápsulas fabricadas. No painel de criaturas, atribua companheiras, guardiãs ou sentinelas em torres livres. Cinco abates próximos permitem evoluir com recursos.</p><p>Hordas chegam nos dias 5, 10, 15… Cada dia dura 12 minutos de simulação. Em segurança perto da base, sua vida recupera. Ao morrer, sua companheira retorna com você, mesmo incapacitada, mantendo o inventário.</p><div class="stack">${actions("Entendido", "back", true)}</div>`;
  if (modalMode === "reset")
    html = `<span class="eyebrow">NOVA EXPEDIÇÃO</span><h2 id="modalTitle">Começar de novo?</h2><p>Isso substitui a partida salva neste navegador. Suas configurações serão mantidas. O progresso atual será guardado em uma cópia local de recuperação.</p><div class="stack">${actions("Iniciar nova expedição", "confirmReset", true)}${actions("Manter meu progresso", "back")}</div>`;
  if (modalMode === "death")
    html = `<span class="eyebrow">VOCÊ CAIU. A AMIZADE FICOU.</span><h2 id="modalTitle">De volta ao refúgio.</h2><p>Sua companheira voltou com você e os recursos permanecem protegidos. Se ela estiver incapacitada, aproxime-se e pressione R para reanimar.</p><div class="result-grid"><div><b>${state.deaths}</b><small>Retornos à base</small></div><div><b>${state.kills}</b><small>Zumbis derrotados</small></div><div><b>${state.creatures.length}</b><small>Criaturas aliadas</small></div></div><p>Você tem cinco segundos de proteção ao retomar.</p><div class="stack">${actions("Retomar na base", "resume", true)}${actions("Salvar e retornar ao menu", "menu")}</div>`;
  if (modalMode === "victory")
    html = `<span class="eyebrow">O REFÚGIO RESISTIU</span><h2 id="modalTitle">Mais uma madrugada.</h2><p>A horda foi derrotada. Sua expedição continua; use a calmaria para reparar suas defesas.</p><div class="result-grid"><div><b>${state.lastResult?.day || 5}</b><small>Dia da horda</small></div><div><b>${state.lastResult?.defeated || 0}</b><small>Inimigos vencidos</small></div><div><b>${state.hordesCleared}</b><small>Hordas superadas</small></div></div><p>Recompensa: 12 sucatas + 2 cápsulas.</p><div class="stack">${actions("Continuar sobrevivendo", "resume", true)}${actions("Salvar e retornar ao menu", "menu")}</div>`;
  body.innerHTML = html;
  if (modalMode === "settings")
    body.querySelector('[data-setting="quality"]').value = settings.quality;
  body.onclick = (e) => {
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    audio.play("ui");
    if (action === "testAudio")
      audio
        .start()
        .then(() => audio.play("capture"))
        .catch(() => {});
    if (action === "resume") resumeGame();
    if (action === "back") closeModal();
    if (["settings", "help", "reset"].includes(action)) showModal(action);
    if (action === "menu") {
      save();
      running = false;
      paused = false;
      modalMode = null;
      $("modal").classList.add("hidden");
      $("hud").classList.add("hidden");
      $("menu").classList.remove("hidden");
      $("play").textContent = "CONTINUAR EXPEDIÇÃO →";
      $("newGame").classList.remove("hidden");
      $("saveInfo").textContent =
        `Progresso salvo · Dia ${Math.floor(state.time / 720) + 1} · ${state.creatures.length} criaturas`;
      $("play").focus();
    }
    if (action === "confirmReset") {
      try {
        const previous = localStorage.getItem("vigilia-v1");
        if (previous) localStorage.setItem("vigilia-recovery", previous);
        localStorage.removeItem("vigilia-v1");
      } catch {
        $("modalBody").querySelector("p").textContent =
          "Não foi possível preservar e apagar o save. Verifique o armazenamento do navegador e tente novamente.";
        return;
      }
      running = false;
      location.reload();
    }
  };
  body.oninput = (e) => {
    const key = e.target.dataset.setting;
    if (!key) return;
    settings[key] =
      e.target.type === "checkbox"
        ? e.target.checked
        : e.target.type === "range"
          ? Number(e.target.value)
          : e.target.value;
    applySettings();
  };
}
// Keyboard focus stays within active dialogs, while Escape uses the game state machine.
addEventListener("keydown", (e) => {
  if (e.code !== "Tab") return;
  const container = modalMode
    ? $("modal")
    : panelMode
      ? $("panel")
      : !running
        ? $("menu")
        : null;
  if (!container) return;
  const buttons = [
    ...container.querySelectorAll("button:not(:disabled),input,select"),
  ].filter((el) => el.getClientRects().length);
  if (!buttons.length) return;
  const index = buttons.indexOf(document.activeElement);
  if (e.shiftKey && index <= 0) {
    e.preventDefault();
    buttons.at(-1).focus();
  } else if (!e.shiftKey && (index === buttons.length - 1 || index === -1)) {
    e.preventDefault();
    buttons[0].focus();
  }
});

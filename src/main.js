import * as THREE from "three";
import "./style.css";
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
let saved;
try {
  saved = JSON.parse(localStorage.getItem("vigilia-v1"));
} catch {}
// Serializable simulation state is separate from rendering, to permit a future authoritative server.
const state = saved || {
  time: 0,
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
state.equipment ||= Object.fromEntries(state.weapons.map((w) => [w, 1]));
state.depleted ||= [];
state.removedWild ||= [];
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
scene.background = new THREE.Color(0x859795);
scene.fog = new THREE.FogExp2(0x859795, 0.017);
const renderer = new THREE.WebGLRenderer({
  canvas: $("world"),
  antialias: true,
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, {
  left: -65,
  right: 65,
  top: 65,
  bottom: -65,
});
scene.add(sun);
function mesh(geo, color, parent = scene, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color, roughness: 0.85 }),
  );
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function box(w, h, d, c, p = scene, x = 0, y = h / 2, z = 0) {
  return mesh(new THREE.BoxGeometry(w, h, d), c, p, x, y, z);
}
function orb(r, c, p = scene, x = 0, y = 0, z = 0) {
  return mesh(new THREE.SphereGeometry(r, 12, 8), c, p, x, y, z);
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
  box(w, h, d, 0x65736c, g);
  box(w + 0.5, 0.45, d + 0.5, 0x303b3d, g, 0, h, 0);
  for (let a = -1; a <= 1; a += 2) {
    box(1.3, 1.5, 0.06, 0x1c3034, g, a * w * 0.28, 2.7, d / 2 + 0.04);
    box(0.06, 1.5, 1.3, 0x1c3034, g, w / 2 + 0.04, 2.7, a * d * 0.25);
  }
  box(1.5, 2.7, 0.07, 0x263331, g, 0, 1.35, d / 2 + 0.05);
  solid.push({ x, z, w, d });
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
  box(0.7, 1, 0.42, zombie ? 0x596754 : 0x354c51, g, 0, 1.25, 0);
  orb(0.28, zombie ? 0x9baa7a : 0xd2b293, g, 0, 2, 0);
  for (const s of [-1, 1]) {
    box(0.22, 0.7, 0.25, 0x263335, g, s * 0.2, 0.45, 0);
    box(0.2, 0.85, 0.2, zombie ? 0x718463 : 0x526a69, g, s * 0.48, 1.23, 0);
  }
  if (!zombie) {
    box(0.5, 0.65, 0.3, 0x846c49, g, 0, 1.3, 0.35);
    box(0.07, 1.2, 0.12, 0xc3c6bc, g, 0.6, 1.1, -0.25);
  }
  return g;
}
const player = human();
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
  orb(0.25, c, g, 0, 0.7, 0.65);
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
  });
}
function spawnZombie(x, z, horde = false) {
  const m = human(true);
  m.position.set(x, 0, z);
  zombies.push({ x, z, hp: 65, mesh: m, cooldown: 0, slow: 0, horde });
}
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
    box(4, 2.8, 0.55, c, g);
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
  s.mesh = g;
  return g;
}
state.structures.forEach(structureView);
resources.forEach((r, i) => {
  if (state.depleted.includes(i)) {
    r.amount = 0;
    r.mesh.visible = false;
  }
});
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
ghost.material.transparent = true;
ghost.material.opacity = 0.4;
ghost.visible = false;
function notify(msg) {
  $("notice").textContent = msg;
  $("notice").style.opacity = 1;
  noticeTimer = 4;
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
  panelMode = mode;
  document.exitPointerLock?.();
  renderPanel();
}
function closePanel() {
  panelMode = null;
  $("panel").classList.add("hidden");
}
function renderPanel() {
  const p = $("panel");
  p.classList.remove("hidden");
  p.innerHTML = `<button class="close">×</button><h2>${panelMode === "craft" ? "Fabricar" : panelMode === "build" ? "Construir" : "Companheiros"}</h2>`;
  p.onclick = (e) => {
    if (e.target.closest(".close")) closePanel();
  };
  if (panelMode === "craft") {
    p.innerHTML += `<p>O inventário da companheira fornece os materiais. Armas exigem uma bancada próxima.</p>`;
    for (const [k, r] of Object.entries(recipes)) {
      const b = document.createElement("button");
      b.innerHTML = `${r.name}<small>${costText(r.cost)}${["bow", "gun", "sword"].includes(k) ? " · bancada" : ""}</small>`;
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
        notify(`${r.name} fabricado.`);
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
      b.onclick = () => {
        building = { kind: k, angle: yaw };
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
      b.innerHTML = `${TYPES[c.type].name} · ${c.level === 2 ? "evoluído" : "nível 1"} · ${Math.ceil(c.hp)} PV<small>${c.role} · ${c.xp}/5 experiência</small>`;
      b.onclick = () => {
        const roles = ["companion", "guardian", "tower"];
        c.role = roles[(roles.indexOf(c.role) + 1) % 3];
        if (c.role === "companion")
          for (const other of state.creatures)
            if (other !== c && other.role === "companion")
              other.role = "guardian";
        c.x = state.player.x + 2;
        c.z = state.player.z;
        if (c.role === "tower") {
          const t = state.structures.find(
            (s) => s.kind === "tower" && dist(s, state.player) < 12,
          );
          if (!t) {
            c.role = "guardian";
            notify("Construa uma torre a até 12 metros.");
          } else {
            c.x = t.x;
            c.z = t.z;
          }
        }
        renderPanel();
      };
      p.append(b);
      if (c.level === 1 && c.xp >= 5) {
        const e = document.createElement("button");
        e.textContent = "Evoluir · 10 pedras + 8 sucatas";
        e.onclick = () => {
          if (pay({ stone: 10, scrap: 8 })) {
            c.level = 2;
            c.hp = 150;
            creatureViews.get(c).scale.setScalar(1.35);
            renderPanel();
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
  const r = resources.find((r) => r.amount > 0 && dist(r, state.player) < 3);
  if (r) {
    const c = companion();
    if (!c || c.hp <= 0)
      return notify("Reanime ou selecione uma companheira para coletar.");
    state.inventory[r.kind] += r.amount;
    state.depleted.push(resources.indexOf(r));
    r.amount = 0;
    r.mesh.visible = false;
    notify(
      `+${r.kind === "wood" ? 5 : r.kind === "stone" ? 4 : 5} ${names[r.kind]} no inventário da companheira`,
    );
    return;
  }
  const gate = state.structures.find(
    (s) => s.kind === "gate" && dist(s, state.player) < 4,
  );
  if (gate) {
    gate.open = !gate.open;
    gate.mesh.visible = !gate.open;
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
  notify(`${TYPES[c.type].name} capturado! E abre suas funções.`);
}
function flash(a, b, color) {
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(a.x, 1.3, a.z),
    new THREE.Vector3(b.x, 1.2, b.z),
  ]);
  const m = new THREE.Line(geo, new THREE.LineBasicMaterial({ color }));
  scene.add(m);
  effects.push({ m, life: 0.2 });
}
function kill(z) {
  if (z.hp > 0) return;
  scene.remove(z.mesh);
  zombies.splice(zombies.indexOf(z), 1);
  state.kills++;
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
  const forward = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
  const targets = [...zombies, ...wild]
    .filter((t) => {
      const d = dist(t, state.player);
      return (
        d < range &&
        ((t.x - state.player.x) * forward.x +
          (t.z - state.player.z) * forward.z) /
          Math.max(d, 0.01) >
          (weapon === "sword" ? 0.1 : 0.86)
      );
    })
    .sort((a, b) => dist(a, state.player) - dist(b, state.player));
  if (targets.length) {
    const t = targets[0];
    t.hp -= weapon === "sword" ? 23 : weapon === "bow" ? 30 : 38;
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
  } else
    flash(
      state.player,
      {
        x: state.player.x + forward.x * range,
        z: state.player.z + forward.z * range,
      },
      0xd7d8bc,
    );
}
function blocked(x, z) {
  if (Math.abs(x) > 98 || Math.abs(z) > 98) return true;
  if (
    solid.some(
      (s) =>
        Math.abs(x - s.x) < s.w / 2 + 0.5 && Math.abs(z - s.z) < s.d / 2 + 0.5,
    )
  )
    return true;
  return state.structures.some((s) => {
    if (!["wall", "gate"].includes(s.kind) || s.open) return false;
    const dx = x - s.x,
      dz = z - s.z,
      cs = Math.cos(s.angle || 0),
      sn = Math.sin(s.angle || 0);
    return (
      Math.abs(dx * cs - dz * sn) < 2.4 && Math.abs(dx * sn + dz * cs) < 0.8
    );
  });
}
function move(a, tx, tz, speed, dt, collision = true) {
  const d = dist(a, { x: tx, z: tz });
  if (d < 0.1) return;
  const dx = ((tx - a.x) / d) * speed * dt,
    dz = ((tz - a.z) / d) * speed * dt;
  if (!collision || !blocked(a.x + dx, a.z)) a.x += dx;
  if (!collision || !blocked(a.x, a.z + dz)) a.z += dz;
}
function respawn() {
  state.health = 100;
  state.player = { ...state.base };
  for (const c of state.creatures)
    if (c.role === "companion") {
      c.x = state.base.x + 2;
      c.z = state.base.z;
    }
  notify("Você reviveu na base. A companheira voltou com todos os recursos.");
}
function place() {
  if (!building) return;
  const x = ghost.position.x,
    z = ghost.position.z;
  if (
    blocked(x, z) ||
    state.structures.some((s) => dist(s, { x, z }) < 2.5) ||
    dist({ x, z }, state.player) < 2
  )
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
  structureView(s);
  if (s.kind === "bed") {
    state.base = { x, z: z + 3 };
    notify("Novo ponto de renascimento definido.");
  } else notify(`${builds[s.kind].name} construído.`);
  building = null;
  ghost.visible = false;
}
function updateHUD() {
  const day = Math.floor(state.time / 720) + 1,
    minute = Math.floor(((state.time % 720) / 720) * 1440);
  $("clock").textContent =
    `DIA ${String(day).padStart(2, "0")} / ${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
  $("horde").textContent =
    `DIA ${(Math.floor((day - 1) / 5) + 1) * 5} · ${zombies.length} ameaças`;
  $("health").style.width = `${state.health}%`;
  const c = companion();
  $("companion").innerHTML = c
    ? `<span class="label">${TYPES[c.type].name.toUpperCase()} / ${c.level === 2 ? "EVOLUÍDO" : "COMPANHEIRA"}</span><p>${c.hp <= 0 ? "INCAPACITADA · R para reanimar" : `${Math.ceil(c.hp)} PV · ${TYPES[c.type].power}`}<br>${c.xp}/5 XP · E para gerenciar</p>`
    : "<p>Sem companheira ativa · E gerenciar</p>";
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
}
function save() {
  const clean = {
    ...state,
    structures: state.structures.map(({ mesh, ...s }) => s),
  };
  try {
    localStorage.setItem("vigilia-v1", JSON.stringify(clean));
  } catch {
    notify("Não foi possível salvar no navegador.");
  }
}
function tick(dt) {
  if (!running || paused) return;
  state.time += dt;
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
      if (!blocked(p.x + dx * speed * dt, p.z)) p.x += dx * speed * dt;
      if (!blocked(p.x, p.z + dz * speed * dt)) p.z += dz * speed * dt;
    }
  }
  player.position.set(p.x, 0, p.z);
  player.rotation.y = yaw;
  for (const c of state.creatures) {
    const m = creatureViews.get(c);
    if (c.hp > 0) {
      if (c.role === "companion" && dist(c, p) > 2.5)
        move(c, p.x + Math.cos(yaw) * 1.5, p.z - Math.sin(yaw) * 1.5, 6, dt);
      c.cooldown = (c.cooldown || 0) - dt;
      const targets = zombies.filter(
        (z) => dist(c, z) < TYPES[c.type].range + (c.level - 1) * 4,
      );
      if (targets.length && c.cooldown <= 0) {
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
      const target = targets[0];
      if (target) m.rotation.y = Math.atan2(c.x - target.x, c.z - target.z);
    }
    m.position.set(c.x, c.role === "tower" ? 4 : 0, c.z);
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
    move(z, target.x, target.z, z.slow > 0 ? 0.6 : 1.7, dt);
    z.mesh.position.set(z.x, 0, z.z);
    z.mesh.rotation.y = Math.atan2(z.x - target.x, z.z - target.z);
    const structure = state.structures.find((s) => !s.open && dist(s, z) < 3);
    if (z.cooldown <= 0) {
      if (dist(z, target) < 1.7 && target.kind !== "base") {
        z.cooldown = 1;
        target.kind === "player"
          ? (state.health -= 8)
          : (target.hp = Math.max(0, target.hp - 12));
      } else if (structure) {
        z.cooldown = 1;
        structure.hp -= 16;
        if (structure.hp <= 0) {
          scene.remove(structure.mesh);
          state.structures.splice(state.structures.indexOf(structure), 1);
          notify("Uma estrutura foi destruída!");
        }
      }
    }
    if (state.health <= 0) respawn();
  }
  for (const w of wild) {
    w.timer += dt;
    if (w.hp < 100 && dist(w, p) < 7) {
      if (dist(w, p) > 1.5) move(w, p.x, p.z, 2.8, dt);
      if (dist(w, p) < 1.8 && w.timer > 1.2) {
        state.health -= 5;
        w.timer = 0;
        if (state.health <= 0) respawn();
      }
    } else {
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
  if (day % 5 === 0 && state.lastHorde !== day) {
    state.lastHorde = day;
    for (let i = 0; i < 18 + Math.floor(day / 5) * 8; i++) {
      const a = rand(0, Math.PI * 2);
      spawnZombie(
        Math.max(-95, Math.min(95, state.base.x + Math.sin(a) * 35)),
        Math.max(-95, Math.min(95, state.base.z + Math.cos(a) * 35)),
        true,
      );
    }
    notify("HORDA! Os mortos estão se aproximando da base.");
  }
  if (spawnTimer > 45 && zombies.length < 35) {
    spawnTimer = 0;
    const a = rand(0, Math.PI * 2);
    const x = p.x + Math.sin(a) * 30,
      z = p.z + Math.cos(a) * 30;
    if (!blocked(x, z)) spawnZombie(x, z);
  }
  if (building) {
    ghost.position.set(p.x - Math.sin(yaw) * 5, 1.4, p.z - Math.cos(yaw) * 5);
    ghost.rotation.y = building.angle;
  }
  const phase = (state.time % 720) / 720,
    light = 0.35 + Math.max(0, Math.sin(phase * Math.PI * 2)) * 1.6;
  ambient.intensity = light;
  sun.intensity = light;
  const color = new THREE.Color().setHSL(0.46, 0.09, 0.18 + light * 0.21);
  scene.background = color;
  scene.fog.color.copy(color);
  if (saveTimer > 10) {
    saveTimer = 0;
    save();
  }
  updateHUD();
}
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  tick(dt);
  const p = state.player;
  const desired = new THREE.Vector3(
    p.x + Math.sin(yaw) * 8 * Math.cos(pitch),
    2.2 + Math.sin(pitch) * 8,
    p.z + Math.cos(yaw) * 8 * Math.cos(pitch),
  );
  camera.position.lerp(desired, 1 - Math.exp(-dt * 10));
  camera.lookAt(p.x, 1.5, p.z);
  for (const e of [...effects]) {
    e.life -= dt;
    if (e.life < 0) {
      scene.remove(e.m);
      e.m.geometry.dispose();
      e.m.material.dispose();
      effects.splice(effects.indexOf(e), 1);
    }
  }
  renderer.render(scene, camera);
}
const clock = new THREE.Clock();
camera.position.set(9, 7, 12);
animate();
updateHUD();
$("play").onclick = () => {
  running = true;
  paused = false;
  $("menu").classList.add("hidden");
  $("world").requestPointerLock?.();
  notify("Colete com E, fabrique com C e construa com B.");
};
$("reset").onclick = () => {
  if (confirm("Apagar seu progresso neste navegador?")) {
    localStorage.removeItem("vigilia-v1");
    location.reload();
  }
};
$("pause").onclick = () => {
  paused = !paused;
  $("pause").textContent = paused ? "▶ CONTINUAR" : "Ⅱ PAUSA";
  if (paused) {
    save();
    document.exitPointerLock?.();
  }
};
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
      notify("Companheira reanimada.");
    }
  }
  if (e.code === "KeyT" && building) building.angle += Math.PI / 4;
  if (e.code === "Escape") {
    closePanel();
    building = null;
    ghost.visible = false;
  }
});
addEventListener("keyup", (e) => (keys[e.code] = false));
addEventListener("blur", () => {
  Object.keys(keys).forEach((k) => (keys[k] = false));
  if (running) {
    paused = true;
    $("pause").textContent = "▶ CONTINUAR";
    save();
  }
});
addEventListener("mousemove", (e) => {
  if (document.pointerLockElement && running && !paused) {
    yaw -= e.movementX * 0.0025;
    pitch = THREE.MathUtils.clamp(pitch + e.movementY * 0.002, 0.1, 0.85);
  }
});
$("world").addEventListener("mousedown", () => {
  if (!running || paused) return;
  if (building) place();
  else if (!panelMode) {
    if (!document.pointerLockElement) $("world").requestPointerLock?.();
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
  }),
  ready: true,
};

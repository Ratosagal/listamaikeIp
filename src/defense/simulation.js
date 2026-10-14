export const KEY = "vigilia-city-defense-v1";
export const LANES = [-12, 0, 12];
export const PLANTS = {
  shooter: {
    name: "Brotadora",
    role: "Atiradora",
    cost: 40,
    hp: 110,
    range: 21,
    damage: 22,
    interval: 1.4,
    color: 0x8cbf67,
    icon: "↗",
  },
  wall: {
    name: "Casca",
    role: "Barreira",
    cost: 30,
    hp: 420,
    range: 0,
    damage: 0,
    interval: 0,
    color: 0xc3a475,
    icon: "▰",
  },
  bomb: {
    name: "Estopim",
    role: "Explosiva",
    cost: 70,
    hp: 80,
    range: 4.5,
    damage: 180,
    interval: 0,
    color: 0xe99a66,
    icon: "✹",
  },
  frost: {
    name: "Névoa",
    role: "Desacelera",
    cost: 60,
    hp: 100,
    range: 18,
    damage: 10,
    interval: 1.9,
    color: 0x83c6da,
    icon: "❄",
  },
  solar: {
    name: "Aurora",
    role: "Gera energia",
    cost: 50,
    hp: 90,
    range: 0,
    damage: 0,
    interval: 8,
    color: 0xe9c56d,
    icon: "☀",
  },
};
export const BEDS = LANES.flatMap((x, lane) =>
  [-15, -7, 1, 9, 17].map((z, row) => ({
    id: `${lane}-${row}`,
    lane,
    row,
    x,
    z,
  })),
);
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export function freshState(inventory = {}) {
  const stock = { wood: 15, stone: 10, scrap: 12, arrows: 12, ammo: 0 };
  for (const key of Object.keys(stock))
    if (key in inventory)
      stock[key] = Math.max(
        0,
        Math.min(99999, Math.floor(Number(inventory[key]) || 0)),
      );
  return {
    version: 1,
    time: 0,
    player: { x: 0, z: 20, y: 0 },
    health: 100,
    baseHealth: 500,
    energy: 180,
    inventory: stock,
    weapons: ["sword", "bow"],
    weapon: "sword",
    bladeLevel: 1,
    plants: [],
    zombies: [],
    explored: BEDS.filter((b) => distance(b, { x: 0, z: 20 }) < 24).map(
      (b) => b.id,
    ),
    collected: [],
    wave: { number: 0, phase: "prepare", timer: 60, queue: 0, spawn: 0 },
    kills: 0,
    id: 0,
  };
}
export function restore(raw) {
  const s = JSON.parse(raw);
  if (
    s?.version !== 1 ||
    !Number.isFinite(s.player?.x) ||
    !Number.isFinite(s.player?.z) ||
    Math.abs(s.player.x) > 43 ||
    Math.abs(s.player.z) > 55 ||
    !Array.isArray(s.plants) ||
    !Array.isArray(s.zombies) ||
    !Array.isArray(s.explored) ||
    !Number.isFinite(s.energy) ||
    !s.wave
  )
    throw Error("Save inválido");
  const fallback = freshState();
  for (const key of ["health", "baseHealth", "time", "kills", "id"])
    if (!Number.isFinite(s[key])) s[key] = fallback[key];
  s.health = Math.max(0, Math.min(100, s.health));
  s.baseHealth = Math.max(0, Math.min(500, s.baseHealth));
  s.energy = Math.max(0, Math.min(99999, s.energy));
  s.player.y = 0;
  s.bladeLevel = Math.max(
    1,
    Math.min(3, Math.floor(Number(s.bladeLevel) || 1)),
  );
  s.inventory = { ...fallback.inventory, ...s.inventory };
  for (const key of Object.keys(fallback.inventory))
    s.inventory[key] = Math.max(
      0,
      Math.min(99999, Math.floor(Number(s.inventory[key]) || 0)),
    );
  s.weapons = (s.weapons || []).filter((w) =>
    ["sword", "bow", "gun"].includes(w),
  );
  if (!s.weapons.includes("sword")) s.weapons.unshift("sword");
  if (!s.weapons.includes(s.weapon)) s.weapon = "sword";
  const occupied = new Set();
  s.plants = s.plants.filter((p) => {
    if (
      !PLANTS[p.kind] ||
      !BEDS.some((b) => b.id === p.slot) ||
      occupied.has(p.slot) ||
      !Number.isFinite(p.hp) ||
      p.hp <= 0
    )
      return false;
    occupied.add(p.slot);
    p.level = Math.max(1, Math.min(3, Math.floor(Number(p.level) || 1)));
    p.cooldown = Math.max(0, Number(p.cooldown) || 0);
    return true;
  });
  s.zombies = s.zombies
    .filter(
      (z) =>
        Number.isFinite(z.x) &&
        Number.isFinite(z.z) &&
        Number.isFinite(z.hp) &&
        z.hp > 0 &&
        Number.isInteger(z.lane) &&
        z.lane >= 0 &&
        z.lane < 3,
    )
    .slice(0, 60);
  s.explored = s.explored.filter((id) => BEDS.some((b) => b.id === id));
  s.collected = Array.isArray(s.collected) ? s.collected : [];
  s.wave = {
    number: Math.max(0, Math.floor(Number(s.wave.number) || 0)),
    phase: ["prepare", "active", "defeat"].includes(s.wave.phase)
      ? s.wave.phase
      : "prepare",
    timer: Math.max(0, Number(s.wave.timer) || 0),
    queue: Math.max(0, Math.min(60, Math.floor(Number(s.wave.queue) || 0))),
    spawn: Math.max(0, Number(s.wave.spawn) || 0),
  };
  s.id = Math.max(s.id, ...s.zombies.map((z) => Number(z.id) || 0));
  return s;
}
export class Defense {
  constructor(state, emit = () => {}) {
    this.state = state;
    this.emit = emit;
    this.shots = [];
  }
  plant(slot, kind, personal = false) {
    const s = this.state,
      b = BEDS.find((b) => b.id === slot),
      spec = PLANTS[kind];
    if (!b || !spec) return "Escolha um canteiro e uma semente.";
    if (!s.explored.includes(slot))
      return "Explore essa região antes de plantar pelo tablet.";
    if (personal && (distance(s.player, b) > 3.6 || s.player.y > 1))
      return "Aproxime-se do canteiro para plantar.";
    if (s.plants.some((p) => p.slot === slot))
      return "Canteiro ocupado. Melhore ou remova a planta.";
    if (s.energy < spec.cost)
      return "Energia insuficiente. Use Aurora ou derrote zumbis.";
    s.energy -= spec.cost;
    s.plants.push({
      slot,
      kind,
      hp: spec.hp,
      level: 1,
      cooldown: kind === "solar" ? 5 : 0,
    });
    this.emit("plant", { ...b, kind });
    return null;
  }
  manage(slot, action) {
    const s = this.state,
      p = s.plants.find((p) => p.slot === slot);
    if (!p) return "Este canteiro está vazio.";
    const spec = PLANTS[p.kind];
    if (action === "remove") {
      s.energy += Math.floor(spec.cost * 0.4);
      s.plants.splice(s.plants.indexOf(p), 1);
      return null;
    }
    if (action === "repair") {
      if (s.inventory.wood < 2 || s.energy < 10)
        return "Reparar custa 10 de energia e 2 madeiras.";
      if (p.hp >= spec.hp * p.level) return "A planta já está saudável.";
      s.inventory.wood -= 2;
      s.energy -= 10;
      p.hp = Math.min(spec.hp * p.level, p.hp + spec.hp);
      return null;
    }
    if (p.level >= 3) return "Esta planta já está no nível máximo.";
    const cost = Math.ceil(spec.cost * 0.7 * p.level);
    if (s.energy < cost) return `Melhorar custa ${cost} de energia.`;
    s.energy -= cost;
    p.level++;
    p.hp = spec.hp * p.level;
    return null;
  }
  startWave() {
    const s = this.state;
    if (s.wave.phase !== "prepare") return false;
    s.wave.number++;
    s.wave.phase = "active";
    s.wave.queue = Math.min(36, 6 + s.wave.number * 3);
    s.wave.spawn = 0;
    this.emit("wave", s.wave);
    return true;
  }
  damage(z, amount, frost = false) {
    if (!this.state.zombies.includes(z)) return;
    z.hp -= amount;
    if (frost) z.slow = 3;
    this.emit("hit", z);
    if (z.hp <= 0) {
      this.state.zombies.splice(this.state.zombies.indexOf(z), 1);
      this.state.kills++;
      this.state.energy += 12;
      this.emit("kill", z);
    }
  }
  attack(yaw) {
    const s = this.state,
      weapon = s.weapon,
      ammo = weapon === "bow" ? "arrows" : weapon === "gun" ? "ammo" : null;
    if (ammo && !s.inventory[ammo]) return "Fabrique munição no refúgio [C].";
    if (ammo) s.inventory[ammo]--;
    const target = s.zombies
      .filter((z) => {
        const d = distance(z, s.player);
        return (
          (!this.canHit || this.canHit(s.player, z)) &&
          d < (weapon === "sword" ? 3.7 : 30) &&
          (weapon !== "sword" || s.player.y < 2) &&
          ((z.x - s.player.x) * -Math.sin(yaw) +
            (z.z - s.player.z) * -Math.cos(yaw)) /
            Math.max(0.01, d) >
            (weapon === "sword" ? -0.1 : 0.85)
        );
      })
      .sort((a, b) => distance(a, s.player) - distance(b, s.player))[0];
    if (target) {
      if (weapon === "sword")
        this.damage(target, 40 + 10 * ((s.bladeLevel || 1) - 1));
      else
        this.shots.push({
          x: s.player.x,
          z: s.player.z,
          y: 1.3,
          target: target.id,
          damage: weapon === "gun" ? 65 : 40,
          frost: false,
          color: weapon === "gun" ? 0xffd395 : 0xded8b3,
        });
    }
    this.emit("attack", { weapon });
    return null;
  }
  step(dt) {
    const s = this.state;
    if (s.wave.phase === "defeat") return;
    s.time += dt;
    for (const b of BEDS)
      if (distance(s.player, b) < 22 && !s.explored.includes(b.id))
        s.explored.push(b.id);
    if (s.wave.phase === "prepare") {
      s.wave.timer -= dt;
      if (s.wave.timer <= 0) this.startWave();
    }
    if (s.wave.phase === "active" && s.wave.queue > 0) {
      s.wave.spawn -= dt;
      if (s.wave.spawn <= 0) {
        const lane = (s.wave.queue + s.wave.number) % 3;
        s.zombies.push({
          id: ++s.id,
          lane,
          x: LANES[lane],
          z: -42,
          hp: 85 + s.wave.number * 12,
          attack: 0,
          slow: 0,
          phase: 0,
        });
        s.wave.queue--;
        s.wave.spawn = 1.6;
      }
    }
    for (const p of [...s.plants]) {
      const b = BEDS.find((b) => b.id === p.slot),
        spec = PLANTS[p.kind];
      p.cooldown -= dt;
      const targets = s.zombies
        .filter(
          (z) =>
            z.lane === b.lane && z.z < b.z + 2 && distance(z, b) < spec.range,
        )
        .sort((a, c) => distance(a, b) - distance(c, b));
      if (p.kind === "solar" && p.cooldown <= 0) {
        s.energy += 15 * p.level;
        p.cooldown = spec.interval;
        this.emit("energy", b);
      }
      if (p.kind === "bomb" && targets.length) {
        for (const z of [...s.zombies])
          if (distance(z, b) < 6) this.damage(z, spec.damage * p.level);
        s.plants.splice(s.plants.indexOf(p), 1);
        this.emit("explode", b);
      }
      if (
        targets.length &&
        spec.interval > 0 &&
        p.kind !== "solar" &&
        p.cooldown <= 0
      ) {
        p.cooldown = spec.interval / (1 + (p.level - 1) * 0.2);
        this.shots.push({
          x: b.x,
          z: b.z,
          y: 1.2,
          target: targets[0].id,
          damage: spec.damage * p.level,
          frost: p.kind === "frost",
          color: spec.color,
        });
        this.emit("shoot", b);
      }
    }
    for (const shot of [...this.shots]) {
      const target = s.zombies.find((z) => z.id === shot.target);
      if (!target) {
        this.shots.splice(this.shots.indexOf(shot), 1);
        continue;
      }
      const d = distance(shot, target);
      if (d < dt * 23 + 0.3) {
        this.damage(target, shot.damage, shot.frost);
        this.shots.splice(this.shots.indexOf(shot), 1);
      } else {
        shot.x += ((target.x - shot.x) / d) * dt * 23;
        shot.z += ((target.z - shot.z) / d) * dt * 23;
      }
    }
    for (const z of [...s.zombies]) {
      z.attack -= dt;
      z.slow = Math.max(0, (z.slow || 0) - dt);
      const plant = s.plants.find((p) => {
        const b = BEDS.find((b) => b.id === p.slot);
        return b.lane === z.lane && Math.abs(b.z - z.z) < 1.5;
      });
      if (plant) {
        if (z.attack <= 0) {
          plant.hp -= 12 + s.wave.number * 2;
          z.attack = 1;
          this.emit("bite", z);
          if (plant.hp <= 0) {
            s.plants.splice(s.plants.indexOf(plant), 1);
            this.emit(
              "lost",
              BEDS.find((b) => b.id === plant.slot),
            );
          }
        }
      } else if (
        distance(z, s.player) < 1.7 &&
        s.player.y < 1 &&
        !(s.protection > 0)
      ) {
        if (z.attack <= 0) {
          s.health -= 14;
          z.attack = 1;
          this.emit("hurt", z);
        }
      } else {
        const advance =
          dt *
          (z.slow > 0 ? 0.55 : 1.25 + Math.min(0.65, s.wave.number * 0.05));
        z.z += advance;
        z.phase = (z.phase || 0) + advance * 6;
      }
      if (z.z > 25) {
        s.baseHealth = Math.max(0, s.baseHealth - 35);
        s.zombies.splice(s.zombies.indexOf(z), 1);
        this.emit("breach", z);
      }
    }
    s.protection = Math.max(0, (s.protection || 0) - dt);
    if (s.health <= 0) {
      s.health = 100;
      s.player = { x: 0, z: 20, y: 0 };
      s.protection = 5;
      s.baseHealth = Math.max(0, s.baseHealth - 20);
      this.emit("respawn", s.player);
    }
    if (s.baseHealth <= 0) {
      s.wave.phase = "defeat";
      this.emit("defeat", {});
      return;
    }
    if (s.wave.phase === "active" && !s.wave.queue && !s.zombies.length) {
      s.wave.phase = "prepare";
      s.wave.timer = 40;
      s.energy += 50;
      s.inventory.scrap += 8;
      this.emit("cleared", s.wave);
    }
    if (distance(s.player, { x: 0, z: 26 }) < 9)
      s.health = Math.min(100, s.health + dt * 4);
  }
}

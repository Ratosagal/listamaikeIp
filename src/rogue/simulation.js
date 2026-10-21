export const KEY = "gisele-veil-v1";
export const WEAPONS = {
  staff: {
    name: "Bastão de Âmbar",
    description: "Alcance e impacto. Combo de três golpes.",
    damage: 24,
    range: 3.8,
    cooldown: 0.36,
    color: 0xe7b473,
  },
  blades: {
    name: "Lâminas do Crepúsculo",
    description: "Golpes rápidos e especiais em leque.",
    damage: 17,
    range: 2.8,
    cooldown: 0.23,
    color: 0xc9a1db,
  },
  bow: {
    name: "Arco Astral",
    description: "Projéteis precisos e disparos carregados.",
    damage: 28,
    range: 18,
    cooldown: 0.44,
    color: 0x82d9ce,
  },
};
export const REGIONS = [
  {
    name: "Jardins do Silêncio",
    subtitle: "Raízes sobre as ruínas do primeiro céu",
    color: 0x74c8b8,
    boss: "O Vigia de Basalto",
  },
  {
    name: "Arquivo Submerso",
    subtitle: "Toda memória cobra seu preço",
    color: 0x949cde,
    boss: "A Curadora do Breu",
  },
  {
    name: "Coração da Fenda",
    subtitle: "O que se perdeu ainda respira",
    color: 0xdd8e9d,
    boss: "O Oráculo Oco",
  },
];
export const BOONS = {
  ember: {
    name: "Brasa Inquieta",
    source: "Voto da Forja",
    description: "Seus golpes incendeiam inimigos por 3 segundos.",
    color: "#e9ad78",
  },
  frost: {
    name: "Geada Serena",
    source: "Voto das Marés",
    description: "Acertos reduzem a velocidade dos inimigos.",
    color: "#91d5df",
  },
  thunder: {
    name: "Fio da Tempestade",
    source: "Voto do Firmamento",
    description: "Especiais atingem também um inimigo próximo.",
    color: "#b4b1ed",
  },
  thorn: {
    name: "Jardim Espectral",
    source: "Voto da Raiz",
    description: "Seu círculo arcano causa mais dano por segundo.",
    color: "#a5cc92",
  },
  leech: {
    name: "Seiva Vital",
    source: "Voto da Raiz",
    description: "Recupere vida ao derrotar inimigos.",
    color: "#a5cc92",
  },
  aegis: {
    name: "Manto de Sal",
    source: "Voto das Marés",
    description: "Reduz todo dano recebido em 12% por nível.",
    color: "#91d5df",
  },
  fury: {
    name: "Pulso de Âmbar",
    source: "Voto da Forja",
    description: "Aumenta seu dano em 20% por nível.",
    color: "#e9ad78",
  },
  flow: {
    name: "Fonte Oculta",
    source: "Voto das Marés",
    description: "Regenera mais 3 de magia por segundo.",
    color: "#91d5df",
  },
  haste: {
    name: "Passo do Poente",
    source: "Voto do Firmamento",
    description: "Movimento 10% mais rápido por nível.",
    color: "#b4b1ed",
  },
  echo: {
    name: "Rastro Cortante",
    source: "Voto do Firmamento",
    description: "Esquivar causa dano aos inimigos próximos.",
    color: "#b4b1ed",
  },
  reach: {
    name: "Horizonte Aberto",
    source: "Voto da Forja",
    description: "Ataques corpo a corpo ganham alcance.",
    color: "#e9ad78",
  },
  well: {
    name: "Cálice Lunar",
    source: "Voto das Marés",
    description: "Aumenta a magia máxima em 25 e a recupera.",
    color: "#91d5df",
  },
};
export const UPGRADES = {
  vitality: {
    name: "Coração Persistente",
    description: "+10 de vida por nível.",
    cost: 15,
    max: 5,
  },
  channel: {
    name: "Canal Profundo",
    description: "+12 de magia e +0,5/s de regeneração.",
    cost: 15,
    max: 5,
  },
  power: {
    name: "Memória da Lâmina",
    description: "+6% de dano por nível.",
    cost: 20,
    max: 5,
  },
  resolve: {
    name: "Última Centelha",
    description: "Uma recuperação de 40% da vida por tentativa.",
    cost: 60,
    max: 1,
  },
};
export const PILLARS = [
  { x: -7, z: -2, r: 1 },
  { x: 7, z: -2, r: 1 },
  { x: -7, z: 4, r: 0.9 },
  { x: 7, z: 4, r: 0.9 },
];
export function pillarsFor(room = 0) {
  const variant = room % 3;
  return PILLARS.map((p) => ({
    ...p,
    x: p.x * (variant === 1 ? 0.78 : variant === 2 ? 1.12 : 1),
    z: p.z + (variant === 2 ? -1 : 0),
  }));
}
const finite = (v, f = 0) => (Number.isFinite(v) ? v : f);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export function freshState(seed = 931207) {
  const meta = {
    shards: 0,
    attempts: 0,
    deaths: 0,
    wins: 0,
    best: 0,
    weapon: "staff",
    upgrades: { vitality: 0, channel: 0, power: 0, resolve: 0 },
    conversations: {},
    difficulty: 0,
    ascension: 0,
    epilogueSeen: false,
    tutorialSeen: false,
    records: [],
  };
  return {
    version: 1,
    rng: seed >>> 0,
    time: 0,
    id: 0,
    phase: "hub",
    meta,
    run: null,
    hero: heroFor(meta),
    enemies: [],
    shots: [],
    hazards: [],
    fields: [],
  };
}
function heroFor(meta) {
  const hp = 100 + meta.upgrades.vitality * 10,
    mana = 100 + meta.upgrades.channel * 12;
  return {
    x: 0,
    z: 6,
    hp,
    maxHp: hp,
    mana,
    maxMana: mana,
    facing: 0,
    vx: 0,
    vz: 0,
    invuln: 0,
    dash: 0,
    dashX: 0,
    dashZ: -1,
    dashes: 2,
    refill: 0,
    attack: 0,
    special: 0,
    cast: 0,
    combo: 0,
    comboTime: 0,
    pose: 0,
    revives: meta.upgrades.resolve,
  };
}
export function restore(raw) {
  const s = JSON.parse(raw),
    base = freshState();
  if (
    s?.version !== 1 ||
    !s.meta ||
    !s.hero ||
    !Array.isArray(s.enemies) ||
    ![
      "hub",
      "combat",
      "cleared",
      "reward",
      "exit",
      "shop",
      "death",
      "victory",
    ].includes(s.phase)
  )
    throw Error("Save inválido");
  for (const key of ["shards", "attempts", "deaths", "wins", "best"])
    s.meta[key] = clamp(Math.floor(finite(s.meta[key])), 0, 999999);
  s.meta.upgrades = { ...base.meta.upgrades, ...s.meta.upgrades };
  for (const [key, spec] of Object.entries(UPGRADES))
    s.meta.upgrades[key] = clamp(
      Math.floor(finite(s.meta.upgrades[key])),
      0,
      spec.max,
    );
  s.meta.weapon = WEAPONS[s.meta.weapon] ? s.meta.weapon : "staff";
  s.meta.conversations =
    s.meta.conversations && typeof s.meta.conversations === "object"
      ? s.meta.conversations
      : {};
  s.meta.difficulty = clamp(Math.floor(finite(s.meta.difficulty)), 0, 5);
  s.meta.ascension = clamp(Math.floor(finite(s.meta.ascension)), 0, 5);
  s.meta.difficulty = Math.min(s.meta.difficulty, s.meta.ascension);
  s.meta.epilogueSeen = !!s.meta.epilogueSeen;
  s.meta.tutorialSeen = !!s.meta.tutorialSeen;
  s.meta.records = Array.isArray(s.meta.records)
    ? s.meta.records
        .filter(
          (r) =>
            r &&
            WEAPONS[r.weapon] &&
            Number.isFinite(r.room) &&
            Number.isFinite(r.kills),
        )
        .slice(0, 10)
        .map((r) => ({
          win: !!r.win,
          weapon: r.weapon,
          room: clamp(Math.floor(r.room), 1, 12),
          kills: clamp(Math.floor(r.kills), 0, 9999),
          duration: Math.max(0, finite(r.duration)),
          difficulty: clamp(Math.floor(finite(r.difficulty)), 0, 5),
        }))
    : [];
  s.meta.conversations = Object.fromEntries(
    ["iria", "oren", "nara"].map((key) => [
      key,
      clamp(Math.floor(finite(s.meta.conversations[key])), 0, 2),
    ]),
  );
  const h = heroFor(s.meta);
  for (const key of Object.keys(h)) h[key] = finite(s.hero[key], h[key]);
  h.x = clamp(h.x, -11.8, 11.8);
  h.z = clamp(h.z, -8.8, 8.8);
  h.maxHp = clamp(h.maxHp, 50, 400);
  h.hp = clamp(h.hp, 0, h.maxHp);
  h.maxMana = clamp(h.maxMana, 50, 400);
  h.mana = clamp(h.mana, 0, h.maxMana);
  h.dashes = clamp(Math.floor(h.dashes), 0, 2);
  h.dash = 0;
  h.invuln = clamp(h.invuln, 0.6, 2);
  h.revives = clamp(Math.floor(h.revives), 0, s.meta.upgrades.resolve);
  h.vx = h.vz = 0;
  s.hero = h;
  s.time = Math.max(0, finite(s.time));
  s.rng = finite(s.rng, 931207) >>> 0;
  s.id = Math.max(0, Math.floor(finite(s.id)));
  if (s.phase !== "hub" && !s.run) throw Error("Tentativa ausente");
  if (s.run) {
    s.run.room = clamp(Math.floor(finite(s.run.room, 1)), 1, 12);
    s.run.weapon = WEAPONS[s.run.weapon] ? s.run.weapon : s.meta.weapon;
    s.run.coins = clamp(Math.floor(finite(s.run.coins)), 0, 99999);
    s.run.shards = clamp(Math.floor(finite(s.run.shards)), 0, 99999);
    s.run.kills = Math.max(0, Math.floor(finite(s.run.kills)));
    s.run.boons = Object.fromEntries(
      Object.entries(s.run.boons || {})
        .filter(([key]) => key in BOONS)
        .map(([k, v]) => [k, clamp(Math.floor(finite(v)), 0, 3)]),
    );
    s.run.offers = [
      ...new Set(
        (Array.isArray(s.run.offers) ? s.run.offers : []).filter(
          (k) => k in BOONS,
        ),
      ),
    ].slice(0, 3);
    s.run.difficulty = clamp(Math.floor(finite(s.run.difficulty)), 0, 5);
    s.run.wave = clamp(Math.floor(finite(s.run.wave)), 0, 3);
    s.run.remaining = clamp(Math.floor(finite(s.run.remaining)), 0, 3);
    s.run.next = Math.max(0, finite(s.run.next));
    s.run.banked = !!s.run.banked;
    s.run.path = ["gold", "heal"].includes(s.run.path) ? s.run.path : "gold";
    s.run.started = Math.max(0, finite(s.run.started));
  }
  s.enemies = s.enemies
    .filter(
      (e) =>
        ["shade", "archer", "brute", "wisp", "boss"].includes(e.type) &&
        Number.isFinite(e.x) &&
        Number.isFinite(e.z) &&
        Number.isFinite(e.hp) &&
        e.hp > 0,
    )
    .slice(0, 40)
    .map((e) => ({
      ...e,
      id: ++s.id,
      x: clamp(e.x, -11.5, 11.5),
      z: clamp(e.z, -8.5, 8.5),
      maxHp: Math.max(e.hp, finite(e.maxHp, e.hp)),
      timer: Math.max(0, finite(e.timer)),
      cooldown: Math.max(0, finite(e.cooldown)),
      phase: ["hunt", "windup", "recover"].includes(e.phase) ? e.phase : "hunt",
      pattern: Math.floor(finite(e.pattern)),
      aim: finite(e.aim),
      slow: 0,
      burn: 0,
      tick: 0,
      motion: finite(e.motion),
      targetX: clamp(finite(e.targetX, s.hero.x), -11, 11),
      targetZ: clamp(finite(e.targetZ, s.hero.z), -8, 8),
      knock: 0,
      damage: Math.max(1, finite(e.damage, e.type === "boss" ? 22 : 8)),
      speed: Math.max(0, Math.min(5, finite(e.speed, 2))),
    }));
  if (s.phase === "reward" && !s.run.offers.length)
    throw Error("Votos ausentes");
  if (s.phase === "hub") {
    s.run = null;
    s.enemies = [];
    s.hero = heroFor(s.meta);
  }
  const blocked = (point, r) =>
    Math.abs(point.x) > 12 - r ||
    Math.abs(point.z) > 9 - r ||
    pillarsFor(s.run?.room || 0).some(
      (p) => Math.hypot(point.x - p.x, point.z - p.z) < p.r + r,
    );
  if (blocked(s.hero, 0.4)) {
    s.hero.x = 0;
    s.hero.z = 6;
  }
  for (const enemy of s.enemies)
    if (blocked(enemy, enemy.type === "boss" ? 0.9 : 0.4)) {
      enemy.x = 0;
      enemy.z = -4;
    }
  if (["death", "victory"].includes(s.phase) && !s.run.banked)
    throw Error("Resultado incompleto");
  if (s.phase === "combat" && s.hero.hp === 0) {
    s.hero.hp = 1;
    s.hero.invuln = 2;
  }
  s.shots = [];
  s.hazards = [];
  s.fields = [];
  return s;
}
export class Rogue {
  constructor(state, emit = () => {}) {
    this.s = state;
    this.emit = emit;
  }
  random() {
    const s = this.s;
    s.rng = (Math.imul(s.rng, 1664525) + 1013904223) >>> 0;
    return s.rng / 4294967296;
  }
  region() {
    return Math.floor(((this.s.run?.room || 1) - 1) / 4);
  }
  rank(key) {
    return this.s.run?.boons[key] || 0;
  }
  damageScale() {
    return (
      (1 + this.s.meta.upgrades.power * 0.06) * (1 + this.rank("fury") * 0.2)
    );
  }
  blocked(x, z, r = 0.4) {
    return (
      Math.abs(x) > 12 - r ||
      Math.abs(z) > 9 - r ||
      pillarsFor(this.s.run?.room || 0).some(
        (p) => Math.hypot(x - p.x, z - p.z) < p.r + r,
      )
    );
  }
  clearLine(a, b) {
    const dx = b.x - a.x,
      dz = b.z - a.z,
      den = dx * dx + dz * dz;
    return !pillarsFor(this.s.run?.room || 0).some((p) => {
      const t = den
        ? clamp(((p.x - a.x) * dx + (p.z - a.z) * dz) / den, 0, 1)
        : 0;
      return Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t)) < p.r + 0.1;
    });
  }
  move(entity, dx, dz, dt) {
    const radius = entity.type === "boss" ? 0.9 : 0.4;
    for (let left = dt; left > 0;) {
      const step = Math.min(0.016, left);
      left -= step;
      if (!this.blocked(entity.x + dx * step, entity.z, radius))
        entity.x += dx * step;
      if (!this.blocked(entity.x, entity.z + dz * step, radius))
        entity.z += dz * step;
    }
  }
  begin() {
    const s = this.s;
    if (s.phase !== "hub") return false;
    s.meta.attempts++;
    s.hero = heroFor(s.meta);
    s.run = {
      room: 1,
      weapon: s.meta.weapon,
      coins: 0,
      shards: 0,
      kills: 0,
      boons: {},
      offers: [],
      wave: 0,
      remaining: 0,
      next: 0,
      banked: false,
      path: "gold",
      started: s.time,
      difficulty: s.meta.difficulty,
    };
    this.enter();
    return true;
  }
  enter() {
    const s = this.s,
      r = s.run;
    s.enemies = [];
    s.shots = [];
    s.fields = [];
    s.hazards = [];
    s.hero.x = 0;
    s.hero.z = 6;
    s.hero.vx = s.hero.vz = 0;
    s.hero.invuln = 1;
    r.wave = 0;
    r.next = 0.7;
    s.meta.best = Math.max(s.meta.best, r.room);
    if (r.room % 4 === 3) {
      s.phase = "shop";
      r.remaining = 0;
      s.hero.hp = Math.min(s.hero.maxHp, s.hero.hp + 15);
      this.emit("room", {});
      return;
    }
    s.phase = "combat";
    if (r.room % 4 === 0) {
      r.remaining = 0;
      this.spawn("boss", 0, -4);
    } else {
      r.remaining = r.room % 4 === 2 ? 2 : 1;
      this.spawnWave();
    }
    this.emit("room", {});
  }
  spawn(type, x, z) {
    const s = this.s,
      region = this.region(),
      elite = s.run.room % 4 === 2;
    const stats = {
      shade: [48, 8, 2.3],
      archer: [38, 9, 1.5],
      brute: [100, 14, 1.3],
      wisp: [30, 7, 3.3],
      boss: [500 + region * 220, 18 + region * 4, 1.4],
    }[type];
    if (this.blocked(x, z, 0.6)) {
      x = 0;
      z = -4;
    }
    const hp =
      stats[0] *
      (type === "boss" ? 1 : 1 + region * 0.3 + (elite ? 0.12 : 0)) *
      (1 + (s.run.difficulty || 0) * 0.12);
    s.enemies.push({
      id: ++s.id,
      type,
      x,
      z,
      hp,
      maxHp: hp,
      damage: Math.round(
        (stats[1] + region * 2) * (1 + (s.run.difficulty || 0) * 0.1),
      ),
      speed: stats[2],
      phase: "hunt",
      timer: 0,
      cooldown: type === "boss" ? 1.6 : 0.7 + this.random(),
      aim: 0,
      pattern: 0,
      slow: 0,
      burn: 0,
      tick: 0,
      motion: 0,
    });
  }
  spawnWave() {
    const r = this.s.run;
    r.wave++;
    r.remaining--;
    const count = 3 + this.region() + (r.room % 4 === 2 ? 1 : 0);
    for (let i = 0; i < count; i++) {
      const type =
        i % 3 === 0 && this.region() > 0
          ? "wisp"
          : i % 3 === 1
            ? "archer"
            : i % 3 === 2
              ? "brute"
              : "shade";
      const x = (i % 2 ? -1 : 1) * (3 + this.random() * 5),
        z = -5 + this.random() * 5;
      this.spawn(type, x, z);
    }
    this.emit("spawn", {});
  }
  hitEnemy(enemy, damage, source = "attack") {
    const s = this.s;
    if (!s.enemies.includes(enemy)) return;
    const amount = Math.round(damage * this.damageScale());
    enemy.hp -= amount;
    enemy.flash = 0.12;
    if (
      (source === "attack" || source === "special") &&
      !["boss", "brute"].includes(enemy.type)
    ) {
      const d = Math.max(0.1, dist(enemy, s.hero));
      enemy.knock = 0.08;
      enemy.knockX = (enemy.x - s.hero.x) / d;
      enemy.knockZ = (enemy.z - s.hero.z) / d;
      enemy.phase = "recover";
      enemy.timer = 0.15;
    }
    if (this.rank("ember") && source !== "burn") {
      enemy.burn = 3;
      enemy.tick = Math.min(enemy.tick || 0, 0.5);
    }
    if (this.rank("frost")) enemy.slow = 2;
    this.emit("hit", { x: enemy.x, z: enemy.z, damage: amount });
    if (enemy.hp <= 0) {
      s.enemies.splice(s.enemies.indexOf(enemy), 1);
      s.run.kills++;
      s.run.coins += enemy.type === "boss" ? 90 : 12;
      s.run.shards += enemy.type === "boss" ? 20 : 2;
      if (this.rank("leech"))
        s.hero.hp = Math.min(s.hero.maxHp, s.hero.hp + this.rank("leech") * 2);
      this.emit("kill", {
        x: enemy.x,
        z: enemy.z,
        boss: enemy.type === "boss",
      });
    }
  }
  hurt(amount) {
    const s = this.s,
      h = s.hero;
    if (h.invuln > 0 || s.phase !== "combat") return false;
    const actual = Math.max(
      1,
      Math.round(amount * (1 - this.rank("aegis") * 0.12)),
    );
    h.hp = Math.max(0, h.hp - actual);
    h.invuln = 0.65;
    this.emit("hurt", { damage: actual });
    if (h.hp <= 0) {
      if (h.revives > 0) {
        h.revives--;
        h.hp = Math.round(h.maxHp * 0.4);
        h.invuln = 2;
        this.emit("revive", {});
      } else this.finish(false);
    }
    return true;
  }
  attack(charged = false) {
    const s = this.s,
      h = s.hero;
    if (s.phase !== "combat") return false;
    if (h.attack > 0 && !charged) return false;
    if (charged && h.mana < 18)
      return this.emit("message", {
        text: "Magia insuficiente para o golpe carregado.",
      });
    if (charged) h.mana -= 18;
    const weapon = WEAPONS[s.run.weapon];
    h.combo = h.comboTime > 0 ? (h.combo + 1) % 3 : 0;
    h.comboTime = 1;
    h.attack = weapon.cooldown;
    h.pose = 1;
    const damage = weapon.damage * (charged ? 2.8 : 1 + h.combo * 0.25),
      range = weapon.range + this.rank("reach") * 0.8;
    if (s.run.weapon === "bow") {
      this.projectile(
        "hero",
        h.x,
        h.z,
        h.facing,
        damage,
        charged ? 22 : 19,
        charged ? 0.65 : 0.25,
        charged ? true : false,
      );
    } else {
      for (const enemy of [...s.enemies]) {
        const d = dist(enemy, h),
          dot =
            ((enemy.x - h.x) * -Math.sin(h.facing) +
              (enemy.z - h.z) * -Math.cos(h.facing)) /
            Math.max(0.01, d);
        if (
          d < range + (charged ? 1.5 : 0) &&
          (charged || dot > -0.2) &&
          (charged || this.clearLine(h, enemy))
        )
          this.hitEnemy(enemy, damage);
      }
    }
    this.emit("attack", {
      x: h.x,
      z: h.z,
      facing: h.facing,
      charged,
      kind: s.run.weapon,
    });
    return true;
  }
  special(charged = false) {
    const s = this.s,
      h = s.hero;
    if (s.phase !== "combat" || (h.special > 0 && !charged)) return false;
    const cost = charged ? 25 : 8;
    if (h.mana < cost) {
      this.emit("message", { text: "Magia insuficiente." });
      return false;
    }
    h.mana -= cost;
    h.special = 0.8;
    h.pose = 1;
    const damage = s.run.weapon === "blades" ? 22 : 36;
    const angles = s.run.weapon === "blades" || charged ? [-0.3, 0, 0.3] : [0];
    for (const angle of angles)
      this.projectile(
        "hero",
        h.x,
        h.z,
        h.facing + angle,
        damage * (charged ? 1.8 : 1),
        14,
        0.35,
        charged,
      );
    if (this.rank("thunder")) {
      const near = s.enemies
        .slice()
        .sort((a, b) => dist(a, h) - dist(b, h))
        .slice(0, 2);
      for (const e of near)
        if (dist(e, h) < 10)
          this.hitEnemy(e, 12 * this.rank("thunder"), "special");
    }
    this.emit("special", { x: h.x, z: h.z, facing: h.facing, charged });
    return true;
  }
  cast() {
    const s = this.s,
      h = s.hero;
    if (s.phase !== "combat" || h.cast > 0) return false;
    if (h.mana < 20) {
      this.emit("message", { text: "O círculo precisa de 20 de magia." });
      return false;
    }
    h.mana -= 20;
    h.cast = 4;
    s.fields.push({ id: ++s.id, x: h.x, z: h.z, r: 4, life: 4.5, tick: 0 });
    this.emit("cast", { x: h.x, z: h.z });
    return true;
  }
  dash(dx, dz) {
    const s = this.s,
      h = s.hero;
    if (
      !["combat", "exit", "cleared", "shop", "hub"].includes(s.phase) ||
      h.dashes <= 0 ||
      h.dash > 0
    )
      return false;
    const length = Math.hypot(dx, dz);
    h.dashX = length ? dx / length : -Math.sin(h.facing);
    h.dashZ = length ? dz / length : -Math.cos(h.facing);
    h.dash = 0.18;
    h.invuln = Math.max(h.invuln, 0.28);
    h.dashes--;
    h.refill = h.refill || 1.35;
    if (this.rank("echo") && s.phase === "combat")
      for (const enemy of [...s.enemies])
        if (dist(enemy, h) < 3.3)
          this.hitEnemy(enemy, 20 * this.rank("echo"), "dash");
    this.emit("dash", { x: h.x, z: h.z });
    return true;
  }
  projectile(owner, x, z, angle, damage, speed = 9, r = 0.22, pierce = false) {
    this.s.shots.push({
      id: ++this.s.id,
      owner,
      x,
      z,
      vx: -Math.sin(angle) * speed,
      vz: -Math.cos(angle) * speed,
      damage,
      r,
      pierce,
      life: 2.4,
      hits: [],
    });
  }
  choose(key) {
    const s = this.s;
    if (s.phase !== "reward" || !s.run.offers.includes(key)) return false;
    s.run.boons[key] = Math.min(3, (s.run.boons[key] || 0) + 1);
    if (key === "well") {
      s.hero.maxMana += 25;
      s.hero.mana = s.hero.maxMana;
    }
    s.run.offers = [];
    s.phase = "exit";
    this.emit("boon", { key });
    return true;
  }
  reward() {
    const s = this.s;
    if (s.phase !== "cleared") return false;
    const available = Object.keys(BOONS).filter((key) => this.rank(key) < 3);
    s.run.offers = [];
    while (available.length && s.run.offers.length < 3) {
      const index = Math.floor(this.random() * available.length);
      s.run.offers.push(available.splice(index, 1)[0]);
    }
    s.phase = "reward";
    return true;
  }
  next(path = "gold") {
    const s = this.s;
    if (!["exit", "shop"].includes(s.phase)) return false;
    if (s.run.room >= 12) return false;
    if (!["gold", "heal"].includes(path)) return false;
    s.run.path = path;
    if (path === "heal") s.hero.hp = Math.min(s.hero.maxHp, s.hero.hp + 18);
    else s.run.coins += 15;
    s.run.room++;
    this.enter();
    return true;
  }
  buy(item) {
    const s = this.s;
    if (s.phase !== "shop") return "A loja fica no descanso de cada região.";
    if (!["heal", "boon"].includes(item)) return "Escolha uma oferta válida.";
    const cost = item === "heal" ? 30 : 65;
    if (s.run.coins < cost) return "Óbolos insuficientes.";
    if (item === "heal" && s.hero.hp >= s.hero.maxHp)
      return "Sua vida já está completa.";
    s.run.coins -= cost;
    if (item === "heal") {
      s.hero.hp = Math.min(s.hero.maxHp, s.hero.hp + 45);
      return null;
    }
    const available = Object.keys(BOONS).filter((k) => this.rank(k) < 3);
    const key = available[Math.floor(this.random() * available.length)];
    if (!key) {
      s.run.coins += cost;
      return "Todos os votos estão completos.";
    }
    s.run.boons[key] = (s.run.boons[key] || 0) + 1;
    if (key === "well") {
      s.hero.maxMana += 25;
      s.hero.mana = s.hero.maxMana;
    }
    this.emit("boon", { key });
    return null;
  }
  upgrade(key) {
    const s = this.s,
      spec = UPGRADES[key];
    if (s.phase !== "hub" || !spec) return false;
    const level = s.meta.upgrades[key],
      cost = spec.cost * (level + 1);
    if (level >= spec.max || s.meta.shards < cost) return false;
    s.meta.shards -= cost;
    s.meta.upgrades[key]++;
    s.hero = heroFor(s.meta);
    return true;
  }
  finish(win) {
    const s = this.s;
    if (!s.run || s.run.banked) return;
    s.run.banked = true;
    s.meta.shards += s.run.shards;
    s.meta[win ? "wins" : "deaths"]++;
    if (win)
      s.meta.ascension = Math.max(
        s.meta.ascension || 0,
        Math.min(5, (s.run.difficulty || 0) + 1),
      );
    s.meta.records = [
      {
        win,
        weapon: s.run.weapon,
        room: s.run.room,
        kills: s.run.kills,
        duration: Math.max(0, s.time - s.run.started),
        difficulty: s.run.difficulty || 0,
      },
      ...(s.meta.records || []),
    ].slice(0, 10);
    s.phase = win ? "victory" : "death";
    s.shots = [];
    s.hazards = [];
    s.fields = [];
    this.emit(win ? "victory" : "death", {});
  }
  hub() {
    const s = this.s;
    if (!["death", "victory"].includes(s.phase)) return false;
    s.run = null;
    s.phase = "hub";
    s.hero = heroFor(s.meta);
    s.enemies = [];
    s.shots = [];
    s.hazards = [];
    s.fields = [];
    return true;
  }
  step(dt, input = { x: 0, z: 0 }) {
    const s = this.s,
      h = s.hero;
    if (["reward", "death", "victory"].includes(s.phase)) return;
    s.time += dt;
    h.invuln = Math.max(0, h.invuln - dt);
    h.attack = Math.max(0, h.attack - dt);
    h.special = Math.max(0, h.special - dt);
    h.cast = Math.max(0, h.cast - dt);
    h.comboTime = Math.max(0, h.comboTime - dt);
    h.pose = Math.max(0, h.pose - dt * 3.5);
    h.mana = Math.min(
      h.maxMana,
      h.mana + dt * (5 + s.meta.upgrades.channel * 0.5 + this.rank("flow") * 3),
    );
    if (h.dashes < 2) {
      h.refill -= dt;
      if (h.refill <= 0) {
        h.dashes++;
        h.refill = h.dashes < 2 ? 1.35 : 0;
      }
    }
    const d = Math.hypot(input.x || 0, input.z || 0),
      speed = (input.sprint ? 7.5 : 5.5) * (1 + this.rank("haste") * 0.1),
      dx = d ? input.x / d : 0,
      dz = d ? input.z / d : 0;
    if (h.dash > 0) {
      h.dash = Math.max(0, h.dash - dt);
      h.vx = h.dashX * 23;
      h.vz = h.dashZ * 23;
    } else {
      const f = 1 - Math.exp(-dt * 19);
      h.vx += (dx * speed - h.vx) * f;
      h.vz += (dz * speed - h.vz) * f;
    }
    this.move(h, h.vx, h.vz, dt);
    if (s.phase !== "combat") return;
    for (const field of [...s.fields]) {
      field.life -= dt;
      field.tick -= dt;
      for (const e of [...s.enemies])
        if (dist(e, field) < field.r) {
          e.slow = 0.3;
          if (field.tick <= 0)
            this.hitEnemy(e, 8 + this.rank("thorn") * 7, "cast");
        }
      if (field.tick <= 0) field.tick = 0.45;
      if (field.life <= 0) s.fields.splice(s.fields.indexOf(field), 1);
    }
    for (const e of [...s.enemies]) {
      e.cooldown -= dt;
      e.slow = Math.max(0, (e.slow || 0) - dt);
      e.flash = Math.max(0, (e.flash || 0) - dt);
      if (e.burn > 0) {
        e.burn -= dt;
        e.tick -= dt;
        if (e.tick <= 0) {
          e.tick = 0.5;
          this.hitEnemy(e, 3 * this.rank("ember"), "burn");
          if (!s.enemies.includes(e)) continue;
        }
      }
      if (e.knock > 0) {
        const step = Math.min(dt, e.knock);
        this.move(e, e.knockX * 5, e.knockZ * 5, step);
        e.knock = Math.max(0, e.knock - dt);
      }
      const distance = dist(e, h);
      if (e.phase === "windup") {
        e.timer -= dt;
        if (e.timer <= 0) {
          this.enemyAttack(e);
          e.phase = "recover";
          e.timer = e.type === "boss" ? 1 : 0.65;
          e.cooldown = e.type === "boss" ? 1.5 : 1.3;
        }
        continue;
      }
      if (e.phase === "recover") {
        e.timer -= dt;
        if (e.timer <= 0) e.phase = "hunt";
        continue;
      }
      const attackRange =
        e.type === "archer" ? 13 : e.type === "boss" ? 18 : 2.1;
      if (
        distance < attackRange &&
        e.cooldown <= 0 &&
        (e.type === "boss" || this.clearLine(e, h))
      ) {
        e.phase = "windup";
        e.timer =
          e.type === "boss"
            ? 1.05
            : e.type === "archer"
              ? 0.85
              : e.type === "brute"
                ? 0.85
                : 0.5;
        e.aim = Math.atan2(e.x - h.x, e.z - h.z);
        e.targetX = h.x;
        e.targetZ = h.z;
        this.emit("windup", { id: e.id });
      } else if (distance > (e.type === "archer" ? 8 : 1.7)) {
        const f = e.slow > 0 ? 0.38 : 1;
        let dx = (h.x - e.x) / Math.max(0.1, distance),
          dz = (h.z - e.z) / Math.max(0.1, distance);
        if (
          this.blocked(
            e.x + dx * 0.9,
            e.z + dz * 0.9,
            e.type === "boss" ? 0.9 : 0.4,
          )
        ) {
          const angle = Math.atan2(dx, dz) + (e.id % 2 ? 1 : -1) * 1.05;
          dx = Math.sin(angle);
          dz = Math.cos(angle);
        }
        this.move(e, dx * e.speed * f, dz * e.speed * f, dt);
        e.motion += dt * e.speed * f;
      }
    }
    for (const shot of [...s.shots]) {
      shot.life -= dt;
      const oldX = shot.x,
        oldZ = shot.z;
      shot.x += shot.vx * dt;
      shot.z += shot.vz * dt;
      const hitAlong = (target, r) => {
        const vx = shot.x - oldX,
          vz = shot.z - oldZ,
          den = vx * vx + vz * vz,
          t = den
            ? clamp(
                ((target.x - oldX) * vx + (target.z - oldZ) * vz) / den,
                0,
                1,
              )
            : 0;
        return (
          Math.hypot(target.x - (oldX + vx * t), target.z - (oldZ + vz * t)) < r
        );
      };
      if (pillarsFor(s.run?.room || 0).some((p) => hitAlong(p, p.r + 0.1))) {
        const i = s.shots.indexOf(shot);
        if (i >= 0) s.shots.splice(i, 1);
        continue;
      }
      if (shot.owner === "hero") {
        for (const e of [...s.enemies])
          if (!shot.hits.includes(e.id) && hitAlong(e, 0.65 + shot.r)) {
            this.hitEnemy(e, shot.damage, "special");
            shot.hits.push(e.id);
            if (!shot.pierce) {
              shot.life = 0;
              break;
            }
          }
      } else if (hitAlong(h, 0.4 + shot.r)) {
        this.hurt(shot.damage);
        shot.life = 0;
      }
      if (shot.life <= 0 || this.blocked(shot.x, shot.z, 0.1)) {
        const index = s.shots.indexOf(shot);
        if (index >= 0) s.shots.splice(index, 1);
      }
    }
    for (const hazard of [...s.hazards]) {
      if (hazard.delay > 0) {
        hazard.delay -= dt;
        continue;
      }
      hazard.timer -= dt;
      if (hazard.kind === "ring") {
        hazard.r += dt * 7;
        if (Math.abs(dist(h, hazard) - hazard.r) < 0.55)
          this.hurt(hazard.damage);
        if (hazard.r > 19) hazard.timer = 0;
      } else if (hazard.timer <= 0 && dist(h, hazard) < hazard.r)
        this.hurt(hazard.damage);
      if (hazard.timer <= 0) {
        this.emit("impact", { x: hazard.x, z: hazard.z });
        s.hazards.splice(s.hazards.indexOf(hazard), 1);
      }
    }
    if (s.phase !== "combat") return;
    if (!s.enemies.length) {
      if (s.run.remaining > 0) {
        s.run.next -= dt;
        if (s.run.next <= 0) this.spawnWave();
      } else if (s.run.room === 12) this.finish(true);
      else {
        s.phase = "cleared";
        s.shots = [];
        s.hazards = [];
        s.fields = [];
        if (s.run.room % 4 === 0) h.hp = Math.min(h.maxHp, h.hp + 25);
        this.emit("cleared", {});
      }
    }
  }
  enemyAttack(e) {
    const s = this.s,
      h = s.hero;
    if (e.type === "boss") {
      const region = this.region(),
        enraged = e.hp < e.maxHp * 0.5,
        pattern = e.pattern++ % 3;
      if (pattern === 0) {
        if (region === 1) {
          for (let i = 0; i < (enraged ? 16 : 12); i++)
            this.projectile(
              "enemy",
              e.x,
              e.z,
              (i / (enraged ? 16 : 12)) * Math.PI * 2,
              e.damage,
              5,
              0.24,
            );
        } else {
          s.hazards.push({
            id: ++s.id,
            kind: "ring",
            x: e.x,
            z: e.z,
            r: 0.5,
            timer: 4,
            damage: e.damage,
          });
          if (region === 2)
            s.hazards.push({
              id: ++s.id,
              kind: "ring",
              x: e.x,
              z: e.z,
              r: 0.5,
              timer: 4,
              delay: enraged ? 0.38 : 0.65,
              damage: e.damage,
            });
        }
      }
      if (pattern === 1) {
        const count =
          (enraged ? 7 : 5) + (region === 2 ? 4 : region === 1 ? 2 : 0);
        for (let i = 0; i < count; i++)
          this.projectile(
            "enemy",
            e.x,
            e.z,
            e.aim + (i - (count - 1) / 2) * 0.22,
            e.damage,
            6 + region,
            0.28,
          );
      }
      if (pattern === 2) {
        const count =
          (enraged ? 4 : 2) + (region === 2 ? 1 : region === 1 ? 1 : 0);
        for (let i = 0; i < count; i++)
          s.hazards.push({
            id: ++s.id,
            kind: "blast",
            x: clamp(e.targetX + (i ? Math.cos(i * 2.3) * 3 : 0), -10, 10),
            z: clamp(e.targetZ + (i ? Math.sin(i * 2.3) * 3 : 0), -7, 7),
            r: region === 0 ? 2.8 : 2.2,
            timer: region === 1 ? 1.35 : 1.1,
            damage: e.damage + 3,
          });
      }
      this.emit("bossAttack", { x: e.x, z: e.z, pattern });
      return;
    }
    if (e.type === "archer")
      this.projectile("enemy", e.x, e.z, e.aim, e.damage, 8, 0.22);
    else if (dist(e, h) < (e.type === "brute" ? 3 : 2.6)) this.hurt(e.damage);
    this.emit("enemyAttack", { x: e.x, z: e.z });
  }
}

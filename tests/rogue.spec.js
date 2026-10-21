import { test, expect } from "@playwright/test";
import {
  Rogue,
  freshState,
  restore,
  KEY,
  BOONS,
  WEAPONS,
  pillarsFor,
} from "../src/rogue/simulation.js";
function fixture() {
  const s = freshState(42),
    g = new Rogue(s);
  g.begin();
  return s;
}
function enemy(s, overrides = {}) {
  return {
    id: 999,
    type: "shade",
    x: 0,
    z: 3,
    hp: 100,
    maxHp: 100,
    damage: 8,
    speed: 0,
    phase: "hunt",
    timer: 0,
    cooldown: 100,
    aim: 0,
    pattern: 0,
    slow: 0,
    burn: 0,
    tick: 0,
    motion: 0,
    ...overrides,
  };
}
test("weapons, charged attacks, mana, cast, dodge invulnerability and collision are functional", () => {
  const s = fixture(),
    g = new Rogue(s);
  s.enemies = [enemy(s)];
  s.hero.invuln = 0;
  expect(g.attack()).toBeTruthy();
  expect(s.enemies[0].hp).toBe(76);
  expect(g.attack()).toBeFalsy();
  g.step(0.4);
  g.attack(true);
  expect(s.hero.mana).toBeLessThan(100);
  expect(s.enemies[0]?.hp || 0).toBeLessThan(20);
  s.hero.mana = 0;
  s.hero.special = 0;
  expect(g.special()).toBeFalsy();
  s.hero.mana = 100;
  expect(g.cast()).toBeTruthy();
  expect(s.fields).toHaveLength(1);
  expect(s.hero.mana).toBe(80);
  expect(g.dash(1, 0)).toBeTruthy();
  expect(g.hurt(50)).toBeFalsy();
  expect(s.hero.hp).toBe(100);
  for (let i = 0; i < 15; i++) g.step(0.02);
  expect(s.hero.x).toBeGreaterThan(3);
  const pillar = pillarsFor(s.run.room)[0];
  s.hero.x = pillar.x;
  s.hero.z = pillar.z + 3;
  s.hero.dash = 0;
  g.dash(0, -1);
  for (let i = 0; i < 20; i++) g.step(0.02);
  expect(
    Math.hypot(s.hero.x - pillar.x, s.hero.z - pillar.z),
  ).toBeGreaterThanOrEqual(pillar.r + 0.39);
});
test("vows apply, upgrades persist, and current-run powers reset at the refuge", () => {
  const s = fixture(),
    g = new Rogue(s);
  s.phase = "reward";
  s.run.offers = ["fury", "well", "leech"];
  expect(g.choose("fury")).toBeTruthy();
  expect(g.choose("well")).toBeFalsy();
  expect(g.damageScale()).toBeCloseTo(1.2);
  s.phase = "reward";
  s.run.offers = ["well"];
  g.choose("well");
  expect(s.hero.maxMana).toBe(125);
  s.run.shards = 35;
  g.finish(false);
  expect(s.meta.shards).toBe(35);
  g.finish(false);
  expect(s.meta.shards).toBe(35);
  g.hub();
  expect(g.upgrade("vitality")).toBeTruthy();
  expect(s.hero.maxHp).toBe(110);
  expect(s.meta.shards).toBe(20);
  g.begin();
  expect(s.run.boons).toEqual({});
  expect(s.hero.maxMana).toBe(100);
  expect(s.hero.maxHp).toBe(110);
});
test("the twelve-chamber campaign includes three shops and three distinct bosses and banks victory once", () => {
  const s = fixture(),
    g = new Rogue(s),
    bosses = new Set(),
    shops = [];
  let guard = 0;
  while (s.phase !== "victory" && guard++ < 150) {
    if (s.phase === "combat") {
      if (s.enemies.some((e) => e.type === "boss")) bosses.add(g.region());
      for (const e of [...s.enemies]) g.hitEnemy(e, 999);
      g.step(1);
    } else if (s.phase === "cleared") g.reward();
    else if (s.phase === "reward") g.choose(s.run.offers[0]);
    else if (s.phase === "shop") {
      shops.push(s.run.room);
      g.next("heal");
    } else if (s.phase === "exit") g.next("gold");
  }
  expect(s.phase).toBe("victory");
  expect(s.run.room).toBe(12);
  expect(bosses.size).toBe(3);
  expect(shops).toEqual([3, 7, 11]);
  expect(s.meta.wins).toBe(1);
  expect(s.meta.shards).toBeGreaterThan(100);
  const shards = s.meta.shards;
  g.finish(true);
  expect(s.meta.shards).toBe(shards);
});
test("boss windups lead to three dodgeable patterns and projectiles can hit the player", () => {
  const s = fixture(),
    g = new Rogue(s);
  s.run.room = 4;
  s.enemies = [];
  g.spawn("boss", 0, -4);
  s.hero.invuln = 0;
  const boss = s.enemies[0];
  boss.pattern = 0;
  g.enemyAttack(boss);
  expect(s.hazards[0].kind).toBe("ring");
  boss.pattern = 1;
  boss.aim = 0;
  g.enemyAttack(boss);
  expect(s.shots.filter((s) => s.owner === "enemy")).toHaveLength(5);
  boss.pattern = 2;
  boss.targetX = 0;
  boss.targetZ = 6;
  g.enemyAttack(boss);
  expect(s.hazards.filter((h) => h.kind === "blast")).toHaveLength(2);
  boss.hp = boss.maxHp * 0.4;
  boss.pattern = 1;
  g.enemyAttack(boss);
  expect(s.shots.filter((s) => s.owner === "enemy")).toHaveLength(12);
  s.shots = [];
  s.hazards = [];
  g.projectile("enemy", 0, 4, Math.PI, 20, 8);
  g.step(0.2);
  expect(s.hero.hp).toBeLessThan(100);
});
test("a saved run restores its weapon, enemies, vows, meta progress and pending reward", () => {
  const s = fixture(),
    g = new Rogue(s);
  s.run.boons = { frost: 2 };
  s.run.coins = 91;
  const copy = restore(JSON.stringify(s));
  expect(copy.run.boons.frost).toBe(2);
  expect(copy.run.coins).toBe(91);
  expect(copy.enemies.length).toBe(s.enemies.length);
  expect(copy.hero.hp).toBe(100);
  s.phase = "reward";
  s.run.offers = ["fury", "frost", "echo"];
  expect(restore(JSON.stringify(s)).run.offers).toEqual(s.run.offers);
  expect(() => restore("{broken")).toThrow();
  expect(() => restore(JSON.stringify({ ...s, run: null }))).toThrow();
});
async function launch(page, seed = freshState(42)) {
  await page.addInitScript(
    ({ seed, key }) => {
      localStorage.setItem(
        "vigilia-settings",
        JSON.stringify({ quality: "low", music: 0, effects: 0 }),
      );
      if (!sessionStorage.getItem("gisele-fixture")) {
        localStorage.setItem(key, JSON.stringify(seed));
        sessionStorage.setItem("gisele-fixture", "1");
      }
    },
    { seed, key: KEY },
  );
  await page.goto("/");
  await page.waitForFunction(() => window.gisele?.ready);
  await page.locator("#play").click();
}
test("Gisele equips a weapon, enters a run, moves, casts, dashes, pauses and restores", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await launch(page);
  await page.locator('[data-weapon="blades"]').click();
  await page.locator("#depart").click();
  expect(await page.evaluate(() => gisele.snapshot().run.weapon)).toBe(
    "blades",
  );
  const before = await page.evaluate(() => gisele.snapshot().hero);
  await page.keyboard.down("KeyD");
  await expect
    .poll(() => page.evaluate(() => gisele.snapshot().hero.x))
    .toBeGreaterThan(before.x + 0.6);
  await page.keyboard.up("KeyD");
  await page.keyboard.press("KeyQ");
  expect(await page.evaluate(() => gisele.snapshot().hero.mana)).toBeLessThan(
    100,
  );
  await page.keyboard.press("Space");
  expect(await page.evaluate(() => gisele.snapshot().hero.dashes)).toBeLessThan(
    2,
  );
  await page.keyboard.press("Escape");
  const time = await page.evaluate(() => gisele.snapshot().time);
  await page.keyboard.press("KeyW");
  expect(await page.evaluate(() => gisele.snapshot().time)).toBe(time);
  await page.reload();
  await page.waitForFunction(() => window.gisele?.ready);
  expect(await page.evaluate(() => gisele.snapshot().run.weapon)).toBe(
    "blades",
  );
  expect(errors).toEqual([]);
});
test("real combat clears a room, reward choice applies and the next chamber opens", async ({
  page,
}) => {
  const s = fixture();
  s.enemies = [enemy(s, { hp: 20, maxHp: 20 })];
  s.run.remaining = 0;
  await launch(page, s);
  await page.keyboard.press("KeyJ");
  await expect
    .poll(() => page.evaluate(() => gisele.snapshot().phase))
    .toBe("cleared");
  await page.locator("#actionButton").click();
  await expect(page.locator("[data-boon]")).toHaveCount(3);
  const key = await page
    .locator("[data-boon]")
    .first()
    .getAttribute("data-boon");
  await page.locator("[data-boon]").first().click();
  expect(await page.evaluate((k) => gisele.snapshot().run.boons[k], key)).toBe(
    1,
  );
  await page.locator("#actionButton").click();
  await page.locator('[data-route="heal"]').click();
  expect(await page.evaluate(() => gisele.snapshot().run.room)).toBe(2);
});
test("death returns to the refuge with permanent fragments and buys an upgrade", async ({
  page,
}) => {
  const s = fixture();
  s.phase = "death";
  s.run.shards = 35;
  s.run.banked = true;
  s.meta.shards = 35;
  s.meta.deaths = 1;
  await launch(page, s);
  await page.locator("#returnHub").click();
  await page.locator("#upgradesButton").click();
  await page.locator('[data-upgrade="vitality"]').click();
  expect(
    await page.evaluate(() => gisele.snapshot().meta.upgrades.vitality),
  ).toBe(1);
  expect(await page.evaluate(() => gisele.snapshot().meta.shards)).toBe(20);
  await page.reload();
  await page.waitForFunction(() => window.gisele?.ready);
  expect(await page.evaluate(() => gisele.snapshot().hero.maxHp)).toBe(110);
});
test("compact dialogs, original conversations, codex and quality settings remain usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 800, height: 600 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await launch(page);
  await page.locator("#iriaButton").click();
  await expect(page.locator(".dialogue blockquote")).toContainText("Véu");
  await page.locator("#talkNext").click();
  await expect(page.locator(".dialogue blockquote")).toContainText("Vigia");
  await page.keyboard.press("Escape");
  await page.keyboard.press("KeyC");
  await expect(page.locator(".codex article")).toHaveCount(4);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.locator("#settingsOpen").click();
  await page.getByLabel("Qualidade gráfica").selectOption("medium");
  await expect
    .poll(() => page.evaluate(() => gisele.view().quality))
    .toBe("medium");
  await page.getByLabel("Qualidade gráfica").selectOption("low");
  await page.locator("#settingsBack").click();
  const bounds = await page.locator("#resume").boundingBox();
  expect(bounds.y + bounds.height).toBeLessThan(600);
  expect(errors).toEqual([]);
});

test("regional guardians have different patterns and pillars stop projectiles", () => {
  const s = fixture(),
    g = new Rogue(s);
  s.run.room = 8;
  s.enemies = [];
  g.spawn("boss", 0, -4);
  g.enemyAttack(s.enemies[0]);
  expect(s.shots).toHaveLength(12);
  expect(s.hazards).toHaveLength(0);
  s.run.room = 12;
  s.shots = [];
  s.enemies = [];
  g.spawn("boss", 0, -4);
  g.enemyAttack(s.enemies[0]);
  expect(s.hazards).toHaveLength(2);
  expect(s.hazards[1].delay).toBeGreaterThan(0);
  const p = pillarsFor(12)[0];
  s.hero.x = p.x;
  s.hero.z = p.z + 2;
  s.hero.invuln = 0;
  s.enemies = [enemy(s, { x: 10, z: -7 })];
  s.shots = [];
  s.hazards = [];
  g.projectile("enemy", p.x, p.z - 2, Math.PI, 50, 40);
  g.step(0.1);
  expect(s.hero.hp).toBe(100);
  expect(s.shots).toHaveLength(0);
});

test("holding and releasing a charged attack spends magic and deals extra damage in the browser", async ({
  page,
}) => {
  const s = fixture();
  s.enemies = [enemy(s, { hp: 400, maxHp: 400 })];
  s.run.remaining = 0;
  await launch(page, s);
  await page.keyboard.down("KeyJ");
  await expect(page.locator("#chargeHUD")).toBeVisible();
  await expect
    .poll(() => page.locator("#chargeFill").evaluate((el) => el.style.width))
    .toBe("100%");
  await page.keyboard.up("KeyJ");
  await expect
    .poll(() => page.evaluate(() => gisele.snapshot().hero.mana))
    .toBeLessThan(100);
  expect(
    await page.evaluate(() => gisele.snapshot().enemies[0].hp),
  ).toBeLessThan(350);
});

import { test, expect } from "@playwright/test";
import {
  Defense,
  freshState,
  restore,
  KEY,
  BEDS,
  PLANTS,
} from "../src/defense/simulation.js";

test("planting costs, exploration, upgrades and repairs are shared by both placement methods", () => {
  const state = freshState(),
    model = new Defense(state);
  expect(model.plant("1-0", "shooter")).toContain("Explore");
  expect(state.energy).toBe(180);
  expect(model.plant("0-4", "shooter", true)).toContain("Aproxime");
  expect(model.plant("1-4", "shooter", true)).toBeNull();
  expect(state.energy).toBe(140);
  expect(model.plant("1-4", "solar")).toContain("ocupado");
  expect(state.energy).toBe(140);
  expect(model.manage("1-4", "upgrade")).toBeNull();
  expect(state.plants[0].level).toBe(2);
  expect(state.energy).toBe(112);
  state.plants[0].hp = 20;
  expect(model.manage("1-4", "repair")).toBeNull();
  expect(state.inventory.wood).toBe(13);
  expect(state.plants[0].hp).toBe(130);
  const copy = restore(JSON.stringify(state));
  expect(copy.plants).toEqual(state.plants);
  expect(copy.energy).toBe(102);
});
test("all five plants have their gameplay effects, waves reward once and breaches cause defeat", () => {
  const s = freshState(),
    events = [],
    m = new Defense(s, (e) => events.push(e));
  s.energy = 1000;
  s.explored = BEDS.map((b) => b.id);
  m.plant("0-4", "shooter");
  m.plant("1-4", "frost");
  m.plant("2-4", "bomb");
  m.plant("0-3", "solar");
  m.plant("1-3", "wall");
  s.wave.phase = "active";
  s.wave.queue = 0;
  s.zombies = [
    { id: 1, lane: 0, x: -12, z: 10, hp: 20, attack: 0, slow: 0 },
    { id: 2, lane: 1, x: 0, z: 10, hp: 200, attack: 0, slow: 0 },
    { id: 3, lane: 2, x: 12, z: 14, hp: 100, attack: 0, slow: 0 },
  ];
  for (let i = 0; i < 100; i++) m.step(0.1);
  expect(events).toContain("kill");
  expect(events).toContain("explode");
  expect(events).toContain("energy");
  expect(s.plants.some((p) => p.kind === "bomb")).toBeFalsy();
  expect(s.zombies.find((z) => z.id === 2)?.slow).toBeGreaterThan(0);
  expect(s.plants.find((p) => p.kind === "wall").hp).toBeLessThan(420);
  s.zombies = [];
  m.step(0.1);
  const energy = s.energy;
  expect(s.wave.phase).toBe("prepare");
  m.step(0.1);
  expect(s.energy).toBe(energy);
  s.baseHealth = 10;
  s.wave.phase = "active";
  s.zombies = [{ id: 9, lane: 0, x: -12, z: 26, hp: 100, attack: 0, slow: 0 }];
  m.step(0.1);
  expect(s.wave.phase).toBe("defeat");
  expect(s.baseHealth).toBe(0);
});
async function launch(page, seed) {
  await page.addInitScript(
    ({ key, seed }) => {
      localStorage.setItem(
        "vigilia-settings",
        JSON.stringify({ quality: "low", effects: 0, music: 0 }),
      );
      if (seed && !sessionStorage.getItem("defense-test")) {
        sessionStorage.setItem("defense-test", "yes");
        localStorage.setItem(key, JSON.stringify(seed));
      }
    },
    { key: KEY, seed },
  );
  await page.goto("/defense.html");
  await page.waitForFunction(() => window.vigiliaDefense?.ready);
  await page.locator("#play").click();
}
test("tablet pauses, shows exploration, plants remotely, upgrades and persists", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await launch(page);
  await page.keyboard.press("Tab");
  await expect(page.locator("#tablet")).toBeVisible();
  const time = await page.evaluate(() => vigiliaDefense.snapshot().time);
  await page.keyboard.down("KeyW");
  await page.keyboard.up("KeyW");
  expect(await page.evaluate(() => vigiliaDefense.snapshot().time)).toBe(time);
  await expect(page.locator('[data-slot="1-0"]')).toBeDisabled();
  await page.locator('[data-slot="1-4"]').click();
  await page.locator("#confirmPlant").click();
  expect(await page.evaluate(() => vigiliaDefense.snapshot().energy)).toBe(140);
  await page.locator("#upgradePlant").click();
  expect(
    await page.evaluate(() => vigiliaDefense.snapshot().plants[0].level),
  ).toBe(2);
  await page.locator("#closeTablet").click();
  await page.keyboard.press("Escape");
  await page.reload();
  await page.waitForFunction(() => window.vigiliaDefense?.ready);
  expect(
    await page.evaluate(() => vigiliaDefense.snapshot().plants[0].level),
  ).toBe(2);
  expect(errors).toEqual([]);
});
test("personal planting has the same cost, movement reveals new beds and crafting spends resources", async ({
  page,
}) => {
  await launch(page);
  await page.keyboard.press("KeyE");
  expect(await page.evaluate(() => vigiliaDefense.snapshot().energy)).toBe(140);
  await page.keyboard.press("KeyC");
  await page.locator('[data-craft="arrows"]').click();
  expect(
    await page.evaluate(() => vigiliaDefense.snapshot().inventory.arrows),
  ).toBe(24);
  expect(
    await page.evaluate(() => vigiliaDefense.snapshot().inventory.wood),
  ).toBe(12);
  await page.locator("[data-resume]").click();
  const before = await page.evaluate(
    () => vigiliaDefense.snapshot().explored.length,
  );
  await page.keyboard.down("KeyW");
  await expect
    .poll(() => page.evaluate(() => vigiliaDefense.snapshot().explored.length))
    .toBeGreaterThan(before);
  await page.keyboard.up("KeyW");
  await page.keyboard.press("Tab");
  await expect(page.locator('[data-slot="1-1"]')).toBeEnabled();
});
test("player attacks and planted defenses damage real zombies during an active wave", async ({
  page,
}) => {
  const s = freshState();
  s.player = { x: 0, z: 20, y: 0 };
  s.wave = { number: 1, phase: "active", queue: 0, timer: 0, spawn: 0 };
  s.zombies = [
    { id: 1, lane: 1, x: 0, z: 17.5, hp: 130, attack: 0, slow: 0, phase: 0 },
  ];
  s.plants = [{ slot: "0-4", kind: "shooter", hp: 110, level: 1, cooldown: 0 }];
  s.id = 1;
  await launch(page, s);
  await page.locator("#world").click({ position: { x: 650, y: 350 } });
  await page.evaluate(() => document.exitPointerLock());
  await expect
    .poll(() =>
      page.evaluate(() => vigiliaDefense.snapshot().zombies[0]?.hp || 0),
    )
    .toBeLessThan(130);
  await page.keyboard.press("Tab");
  await page.locator('[data-slot="1-4"]').click();
  await page.locator("#confirmPlant").click();
  await page.locator("#closeTablet").click();
  await expect
    .poll(() => page.evaluate(() => vigiliaDefense.snapshot().kills), {
      timeout: 40000,
    })
    .toBeGreaterThan(0);
});

test("death preserves inventory, wave spawns cover the three streets and active saves restore", () => {
  const s = freshState(),
    m = new Defense(s);
  s.health = 0;
  const inventory = { ...s.inventory };
  m.step(0.1);
  expect(s.health).toBe(100);
  expect(s.baseHealth).toBe(480);
  expect(s.inventory).toEqual(inventory);
  expect(s.protection).toBeGreaterThan(0);
  m.startWave();
  for (let i = 0; i < 60; i++) m.step(0.1);
  expect(new Set(s.zombies.map((z) => z.lane)).size).toBe(3);
  const saved = restore(JSON.stringify(s));
  expect(saved.wave).toEqual(s.wave);
  expect(saved.zombies.length).toBe(s.zombies.length);
  s.player = { x: 0, z: 20, y: 0 };
  s.bladeLevel = 3;
  const z = { id: 99, lane: 1, x: 0, z: 18, hp: 100, attack: 0 };
  s.zombies.push(z);
  m.attack(0);
  expect(z.hp).toBe(40);
});
test("compact tablet, keyboard focus and sword crafting work without rendering errors", async ({
  page,
}) => {
  await page.setViewportSize({ width: 800, height: 600 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await launch(page);
  await page.keyboard.press("KeyC");
  await page.locator('[data-craft="sword"]').click();
  expect(await page.evaluate(() => vigiliaDefense.snapshot().bladeLevel)).toBe(
    2,
  );
  await page.locator("[data-resume]").click();
  await page.keyboard.press("Tab");
  await expect(page.locator("#tablet")).toBeVisible();
  await page.keyboard.press("Tab");
  expect(
    await page.evaluate(
      () => document.activeElement.closest("#tablet") !== null,
    ),
  ).toBeTruthy();
  await page.locator('[data-slot="1-4"]').click();
  const box = await page.locator("#confirmPlant").boundingBox();
  expect(box.y + box.height).toBeLessThanOrEqual(600);
  await page.locator("#confirmPlant").click();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.locator("#quality").selectOption("medium");
  await expect
    .poll(() => page.evaluate(() => vigiliaDefense.view().quality))
    .toBe("medium");
  await page.locator("#quality").selectOption("low");
  expect(errors).toEqual([]);
});

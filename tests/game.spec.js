import { test, expect } from "@playwright/test";
async function start(page, seed) {
  await page.addInitScript(() => {
    if (!localStorage.getItem("vigilia-settings"))
      localStorage.setItem(
        "vigilia-settings",
        JSON.stringify({ quality: "low", music: 0, effects: 0 }),
      );
  });
  if (seed)
    await page.addInitScript((s) => {
      if (!localStorage.getItem("vigilia-v1"))
        localStorage.setItem("vigilia-v1", JSON.stringify(s));
    }, seed);
  await page.goto("/");
  await page.waitForFunction(() => window.vigilia?.ready);
  await page.locator("#play").click();
  await page.evaluate(() => document.exitPointerLock());
  await page.waitForFunction(() => !document.pointerLockElement);
}
const seed = () => ({
  time: 0,
  health: 100,
  player: { x: 0, z: 0 },
  base: { x: 0, z: 0 },
  inventory: {
    wood: 100,
    stone: 100,
    scrap: 100,
    arrows: 10,
    ammo: 10,
    capsules: 3,
  },
  weapons: ["sword", "bow", "gun"],
  weapon: "sword",
  creatures: [
    { type: 0, hp: 100, x: 1, z: 0, role: "companion", level: 1, xp: 5 },
  ],
  structures: [],
  lastHorde: 0,
  kills: 0,
});
test("renders, moves, crafts, constructs and persists", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page, seed());
  const before = await page.evaluate(() => vigilia.snapshot().player);
  await page.keyboard.down("KeyW");
  await expect
    .poll(async () => {
      const p = await page.evaluate(() => vigilia.snapshot().player);
      return Math.hypot(p.x - before.x, p.z - before.z);
    })
    .toBeGreaterThan(1);
  await page.keyboard.up("KeyW");
  const after = await page.evaluate(() => vigilia.snapshot().player);
  expect(Math.hypot(before.x - after.x, before.z - after.z)).toBeGreaterThan(1);
  await page.keyboard.press("KeyC");
  await page.locator("#panel button").filter({ hasText: "10 flechas" }).click();
  expect(await page.evaluate(() => vigilia.snapshot().inventory.arrows)).toBe(
    20,
  );
  await page.locator("#panel .close").click();
  await expect(page.locator("#panel")).toBeHidden();
  await page.keyboard.press("KeyB");
  await page
    .locator("#panel button")
    .filter({ hasText: "Cama / renascimento" })
    .click();
  await page.waitForTimeout(100);
  await page.locator("#world").click({ position: { x: 600, y: 400 } });
  expect(await page.evaluate(() => vigilia.snapshot().structures.length)).toBe(
    1,
  );
  await page.evaluate(() => document.exitPointerLock());
  await page.waitForFunction(() => !document.pointerLockElement);
  await page.locator("#pause").click();
  await page.reload();
  await page.waitForFunction(() => window.vigilia?.ready);
  expect(await page.evaluate(() => vigilia.snapshot().structures[0].kind)).toBe(
    "bed",
  );
  expect(errors).toEqual([]);
});
test("evolves companion and triggers the fifth-day horde", async ({ page }) => {
  const s = seed();
  s.time = 2879.8;
  await start(page, s);
  await expect
    .poll(() => page.evaluate(() => vigilia.snapshot().lastHorde))
    .toBe(5);
  expect(await page.evaluate(() => vigilia.snapshot().lastHorde)).toBe(5);
  await page.locator("#manageButton").click();
  await page.locator("#panel button").filter({ hasText: "Evoluir" }).click();
  expect(await page.evaluate(() => vigilia.snapshot().creatures[0].level)).toBe(
    2,
  );
  await page.locator("#panel .close").click();
});
test("death returns incapacitated companion and preserves inventory", async ({
  page,
}) => {
  const s = seed();
  s.health = 0;
  s.player = { x: 15, z: 15 };
  s.creatures[0].hp = 0;
  s.creatures[0].x = 15;
  s.creatures[0].z = 15;
  await start(page, s);
  await page.waitForTimeout(200);
  const actual = await page.evaluate(() => vigilia.snapshot());
  expect(actual.health).toBe(100);
  expect(actual.player).toMatchObject(actual.base);
  expect(actual.player.y).toBe(0);
  expect(actual.creatures[0].x).toBe(2);
  expect(actual.creatures[0].hp).toBe(0);
  expect(actual.inventory).toEqual(s.inventory);
  await page.getByRole("button", { name: "Retomar na base" }).click();
  await page.evaluate(() => document.exitPointerLock());
  await page.waitForFunction(() => !document.pointerLockElement);
  await page.keyboard.press("KeyR");
  expect(await page.evaluate(() => vigilia.snapshot().creatures[0].hp)).toBe(
    100,
  );
});

test("weakens and captures a wild creature with a crafted capsule", async ({
  page,
}) => {
  const s = seed();
  s.player = { x: -16.5, z: -32.8 };
  s.zombieSnapshot = [];
  s.creatures[0].hp = 0;
  await start(page, s);
  await page.keyboard.press("KeyC");
  await page.locator("#panel button").filter({ hasText: "3 cápsulas" }).click();
  await page.locator("#panel .close").click();
  for (let i = 0; i < 3; i++) {
    const time = await page.evaluate(() => vigilia.snapshot().time);
    await page.locator("#world").click({ position: { x: 640, y: 360 } });
    await page.evaluate(() => document.exitPointerLock());
    await page.waitForFunction(() => !document.pointerLockElement);
    await expect
      .poll(() => page.evaluate(() => vigilia.snapshot().time))
      .toBeGreaterThan(time + 0.7);
  }
  expect(
    await page.evaluate(
      () => vigilia.entities().wild.find((c) => c.id === 0)?.hp,
    ),
  ).toBe(31);
  await page.keyboard.press("KeyQ");
  expect(await page.evaluate(() => vigilia.snapshot().creatures.length)).toBe(
    2,
  );
  expect(await page.evaluate(() => vigilia.snapshot().inventory.capsules)).toBe(
    5,
  );
  await page.locator("#pause").click();
  await page.reload();
  await page.waitForFunction(() => window.vigilia?.ready);
  expect(
    await page.evaluate(() => vigilia.entities().wild.some((c) => c.id === 0)),
  ).toBe(false);
});

test("manufactures swords and firearms at a workbench", async ({ page }) => {
  const s = seed();
  s.weapons = ["sword"];
  s.structures = [{ kind: "bench", x: 3, z: 0, angle: 0, hp: 200 }];
  await start(page, s);
  await page.keyboard.press("KeyC");
  await page.locator("#panel button").filter({ hasText: "Espada" }).click();
  expect(await page.evaluate(() => vigilia.snapshot().equipment.sword)).toBe(2);
  await page.locator("#panel button").filter({ hasText: "Pistola" }).click();
  expect(await page.evaluate(() => vigilia.snapshot().weapons)).toContain(
    "gun",
  );
  expect(await page.evaluate(() => vigilia.snapshot().inventory.scrap)).toBe(
    77,
  );
});

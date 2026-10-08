import { test, expect } from "@playwright/test";

test("hooks lift the player, release safely and recharge after landing", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const THREE = await import("/node_modules/.vite/deps/three.js");
    const { AerialRig } = await import("/src/systems/aerial.js");
    const state = { player: { x: 16, y: 0, z: 22 } };
    const rig = new AerialRig(
      new THREE.Scene(),
      state,
      [{ x: 5, z: 13, w: 10, d: 10, h: 8 }],
      () => {},
      { play() {} },
    );
    rig.fire(0.6);
    for (let i = 0; i < 120; i++) rig.update(1 / 60, 0, 0, true, () => false);
    const flight = rig.snapshot();
    rig.jump();
    const detached = rig.snapshot();
    for (let i = 0; i < 1200; i++) rig.update(1 / 60, 0, 0, false, () => false);
    return { flight, detached, landed: rig.snapshot(), player: state.player };
  });
  expect(result.flight.height).toBeGreaterThan(3);
  expect(result.flight.hooks).toBe(1);
  expect(result.flight.gas).toBeLessThan(92);
  expect(result.detached.hooks).toBe(0);
  expect(result.landed.gas).toBe(100);
  expect(Number.isFinite(result.player.y)).toBeTruthy();
});

test("giant armor resists ground attacks and aerial nape strikes defeat it", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const THREE = await import("/node_modules/.vite/deps/three.js");
    const { Colossi } = await import("/src/systems/colossi.js");
    const state = {
      colossi: [{ id: 1, x: 0, z: 0, hp: 300 }],
      inventory: { scrap: 0, stone: 0, capsules: 0 },
      creatures: [{ xp: 0 }],
    };
    const giants = new Colossi(
      new THREE.Scene(),
      state,
      { burst() {}, text() {} },
      { play() {} },
      () => {},
    );
    giants.strike({ x: 0, y: 0, z: 2 }, 0, "sword", 0, () => true);
    const armored = giants.snapshot()[0].hp;
    giants.strike({ x: 0, y: 6.1, z: 2 }, 0, "sword", 30, () => true);
    return {
      armored,
      remaining: giants.snapshot().length,
      kills: state.colossusKills,
      inventory: state.inventory,
      xp: state.creatures[0].xp,
    };
  });
  expect(result.armored).toBe(295);
  expect(result.remaining).toBe(0);
  expect(result.kills).toBe(1);
  expect(result.inventory.scrap).toBe(25);
  expect(result.xp).toBe(5);
});

test("player controls attach two hooks, gain altitude and release in the game", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem(
      "vigilia-settings",
      JSON.stringify({ quality: "low", music: 0, effects: 0 }),
    );
    localStorage.setItem(
      "vigilia-v1",
      JSON.stringify({
        time: 180,
        health: 100,
        player: { x: 16, z: -20 },
        base: { x: 0, z: 0 },
        inventory: {
          wood: 10,
          stone: 10,
          scrap: 10,
          arrows: 10,
          ammo: 10,
          capsules: 3,
        },
        weapons: ["sword"],
        weapon: "sword",
        creatures: [],
        structures: [],
        colossi: [],
        zombieSnapshot: [],
        lastHorde: 0,
        kills: 0,
      }),
    );
  });
  await page.goto("/");
  await page.waitForFunction(() => window.vigilia?.ready);
  await page.locator("#play").click();
  await page.evaluate(() => document.exitPointerLock());
  await page.keyboard.press("KeyG");
  await expect.poll(() => page.evaluate(() => vigilia.aerial().hooks)).toBe(1);
  await page.keyboard.press("KeyZ");
  await expect.poll(() => page.evaluate(() => vigilia.aerial().hooks)).toBe(2);
  await page.keyboard.down("ShiftLeft");
  await expect
    .poll(() => page.evaluate(() => vigilia.aerial().height))
    .toBeGreaterThan(3);
  await page.keyboard.up("ShiftLeft");
  await expect(page.locator("#aerialHUD")).toContainText("2/2 cabos");
  await page.screenshot({ path: "/tmp/vigilia-aerial.png" });
  await page.keyboard.press("Space");
  await expect.poll(() => page.evaluate(() => vigilia.aerial().hooks)).toBe(0);
  expect(errors).toEqual([]);
});

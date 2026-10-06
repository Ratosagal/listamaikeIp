import { test, expect } from "@playwright/test";
const fixture = () => ({
  time: 180,
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
  zombieSnapshot: [],
});
async function launch(page, state) {
  await page.addInitScript((s) => {
    if (!localStorage.getItem("test-fixture-set") && s) {
      localStorage.setItem("vigilia-v1", JSON.stringify(s));
      localStorage.setItem("test-fixture-set", "yes");
    }
    if (!localStorage.getItem("vigilia-settings"))
      localStorage.setItem(
        "vigilia-settings",
        JSON.stringify({ quality: "low", music: 0, effects: 0 }),
      );
  }, state);
  await page.goto("/");
  await page.waitForFunction(() => window.vigilia?.ready);
  await page.locator("#play").click();
  await page.evaluate(() => document.exitPointerLock());
}
test("pause, settings, keyboard focus, resume and return to menu preserve progress", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await launch(page, fixture());
  await page.keyboard.press("Escape");
  await expect(page.locator("#modalTitle")).toHaveText(
    "Respire. Planeje. Volte.",
  );
  const time = await page.evaluate(() => vigilia.snapshot().time);
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(200);
  await page.keyboard.up("KeyW");
  expect(await page.evaluate(() => vigilia.snapshot().time)).toBe(time);
  await page.locator("#modal [data-action=settings]").click();
  await page.getByLabel("Qualidade gráfica").selectOption("medium");
  await expect
    .poll(() => page.evaluate(() => vigilia.view().quality))
    .toBe("medium");
  await page.getByLabel("Qualidade gráfica").selectOption("low");
  await page.getByLabel("Interface com alto contraste").check();
  await page.getByLabel("Partículas", { exact: true }).uncheck();
  await page.getByLabel("Volume da música").focus();
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowRight");
  await page.getByLabel("Sensibilidade do mouse").focus();
  await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: "Testar áudio" }).click();
  await expect
    .poll(() => page.evaluate(() => vigilia.view().audio))
    .toBe("running");
  await page.getByRole("button", { name: "Voltar", exact: true }).click();
  await page
    .getByRole("button", { name: "RETOMAR EXPEDIÇÃO", exact: true })
    .click();
  await page.evaluate(() => document.exitPointerLock());
  await expect
    .poll(() => page.evaluate(() => vigilia.snapshot().time))
    .toBeGreaterThan(time);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Salvar e retornar ao menu" }).click();
  await expect(page.locator("#menu")).toBeVisible();
  await expect(page.locator("#hud")).toBeHidden();
  await page.reload();
  await page.waitForFunction(() => window.vigilia?.ready);
  await page.locator("#menuSettings").click();
  await expect(page.getByLabel("Qualidade gráfica")).toHaveValue("low");
  await expect(page.getByLabel("Interface com alto contraste")).toBeChecked();
  await expect(
    page.getByLabel("Partículas", { exact: true }),
  ).not.toBeChecked();
  expect(errors).toEqual([]);
});
test("completed horde gives a result and rewards once, then continues and can restart", async ({
  page,
}) => {
  const s = fixture();
  s.time = 2880;
  s.lastHorde = 5;
  s.horde = { day: 5, defeated: 26, startKills: 0 };
  s.kills = 26;
  await launch(page, s);
  await expect(page.locator("#modalTitle")).toHaveText("Mais uma madrugada.");
  expect(await page.evaluate(() => vigilia.snapshot().inventory.scrap)).toBe(
    112,
  );
  expect(await page.evaluate(() => vigilia.snapshot().hordesCleared)).toBe(1);
  await page.getByRole("button", { name: "Continuar sobrevivendo" }).click();
  await page.evaluate(() => document.exitPointerLock());
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Reiniciar expedição" }).click();
  await page.getByRole("button", { name: "Iniciar nova expedição" }).click();
  await page.waitForFunction(() => window.vigilia?.ready);
  await expect(page.locator("#menu")).toBeVisible();
  expect(await page.evaluate(() => vigilia.snapshot().kills)).toBe(0);
  expect(
    await page.evaluate(() => !!localStorage.getItem("vigilia-recovery")),
  ).toBe(true);
});
test("active hordes, injured wild creatures and resources restore without resets", async ({
  page,
}) => {
  const s = fixture();
  s.time = 2881;
  s.lastHorde = 5;
  s.horde = { day: 5, defeated: 3, startKills: 0 };
  s.zombieSnapshot = [
    {
      x: 45,
      z: 40,
      hp: 23,
      variant: "walker",
      horde: true,
      cooldown: 0,
      slow: 0,
    },
  ];
  s.wildSnapshot = [{ id: 0, x: -18, z: -35, hp: 31, timer: 0 }];
  s.depleted = [0];
  await launch(page, s);
  await page.locator("#pause").click();
  await page.reload();
  await page.waitForFunction(() => window.vigilia?.ready);
  expect(await page.evaluate(() => vigilia.snapshot().horde.defeated)).toBe(3);
  const restored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("vigilia-v1")),
  );
  expect(restored.zombieSnapshot).toHaveLength(1);
  expect(restored.zombieSnapshot[0].hp).toBe(23);
  expect(
    await page.evaluate(
      () => vigilia.entities().wild.find((c) => c.id === 0).hp,
    ),
  ).toBe(31);
  expect(
    await page.evaluate(() => vigilia.entities().resources[0].amount),
  ).toBe(0);
});
test("gate stays open after reload and a tower has only one sentry", async ({
  page,
}) => {
  const s = fixture();
  s.structures = [
    { kind: "gate", x: 0, z: -3, angle: 0, hp: 200, open: true },
    { kind: "tower", x: 4, z: 0, hp: 200, angle: 0 },
  ];
  s.creatures.push({
    type: 1,
    hp: 100,
    x: 2,
    z: 0,
    role: "guardian",
    level: 1,
    xp: 0,
  });
  await launch(page, s);
  expect(await page.evaluate(() => vigilia.collision(0, -3))).toBe(false);
  await page.locator("#manageButton").click();
  await page.getByRole("button", { name: "Ocupar torre" }).nth(0).click();
  expect(await page.evaluate(() => vigilia.snapshot().creatures[0].role)).toBe(
    "tower",
  );
  await page.getByRole("button", { name: "Ocupar torre" }).nth(1).click();
  expect(await page.evaluate(() => vigilia.snapshot().creatures[1].role)).toBe(
    "guardian",
  );
  await expect(page.locator("#notice")).toContainText("torre livre");
  await page.locator("#panel .close").click();
  await page.keyboard.press("KeyE");
  expect(await page.evaluate(() => vigilia.snapshot().structures[0].open)).toBe(
    false,
  );
  expect(await page.evaluate(() => vigilia.collision(0, -3))).toBe(true);
});
test("low quality and changing shadow quality render the world without WebGL errors", async ({
  page,
}) => {
  const failures = [];
  page.on("console", (msg) => {
    if (
      /GL_INVALID_OPERATION|Shader Error|VALIDATE_STATUS|Mismatch between texture/.test(
        msg.text(),
      )
    )
      failures.push(msg.text());
  });
  await launch(page, fixture());
  await expect
    .poll(() => page.evaluate(() => vigilia.view().render.calls))
    .toBeGreaterThan(100);
  expect(
    await page.evaluate(() => vigilia.view().camera.every(Number.isFinite)),
  ).toBe(true);
  await page.locator("#settingsButton").click();
  await page.getByLabel("Qualidade gráfica").selectOption("high");
  await page.waitForTimeout(300);
  await page.getByLabel("Qualidade gráfica").selectOption("low");
  await page.getByRole("button", { name: "Voltar", exact: true }).click();
  await page
    .getByRole("button", { name: "RETOMAR EXPEDIÇÃO", exact: true })
    .click();
  await page.evaluate(() => document.exitPointerLock());
  await page.waitForTimeout(200);
  expect(failures).toEqual([]);
});
test("menus fit compact desktop viewports and all controls remain reachable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 640, height: 480 });
  await launch(page, fixture());
  await page.locator("#helpButton").click();
  await expect(page.locator("#modalTitle")).toHaveText(
    "Você não está sozinho.",
  );
  const dialog = page.locator("#modalBody");
  const box = await dialog.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(640);
  await page.getByRole("button", { name: "Entendido" }).click();
  await page
    .getByRole("button", { name: "RETOMAR EXPEDIÇÃO", exact: true })
    .click();
  await page.evaluate(() => document.exitPointerLock());
  await page.keyboard.press("KeyC");
  await expect(page.locator("#panel")).toBeVisible();
  const panel = await page.locator("#panel").boundingBox();
  expect(panel.x + panel.width).toBeLessThanOrEqual(640);
  expect(panel.y + panel.height).toBeLessThanOrEqual(480);
  await page.locator("#panel .close").click();
  await expect(page.locator("#panel")).toBeHidden();
});
test("invalid saved data is preserved for recovery instead of crashing", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("vigilia-v1", '{"broken":'),
  );
  await page.goto("/");
  await page.waitForFunction(() => window.vigilia?.ready);
  await expect(page.locator("#saveInfo")).toContainText("preservado");
  expect(
    await page.evaluate(() => localStorage.getItem("vigilia-recovery")),
  ).toBe('{"broken":');
  await page.locator("#menuHelp").click();
  await expect(page.locator("#modalTitle")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#menu")).toBeVisible();
});

test("a sentry actually defeats zombies across its wall and the player repairs that defense", async ({
  page,
}) => {
  const s = fixture();
  s.time = 2881;
  s.lastHorde = 5;
  s.horde = { day: 5, defeated: 0, startKills: 0 };
  s.structures = [
    { kind: "tower", x: 3, z: 0, angle: 0, hp: 200 },
    { kind: "wall", x: 0, z: -3, angle: 0, hp: 100 },
  ];
  s.creatures[0] = { ...s.creatures[0], role: "tower", x: 3, z: 0 };
  s.zombieSnapshot = [
    {
      x: 0,
      z: -6,
      hp: 10,
      variant: "walker",
      horde: true,
      cooldown: 0,
      slow: 0,
    },
    {
      x: 2,
      z: -6,
      hp: 10,
      variant: "walker",
      horde: true,
      cooldown: 0,
      slow: 0,
    },
  ];
  await launch(page, s);
  await expect(page.locator("#modalTitle")).toHaveText("Mais uma madrugada.");
  expect(await page.evaluate(() => vigilia.snapshot().kills)).toBe(2);
  expect(
    await page.evaluate(() => vigilia.snapshot().lastResult.defeated),
  ).toBe(2);
  await page.getByRole("button", { name: "Continuar sobrevivendo" }).click();
  await page.evaluate(() => document.exitPointerLock());
  await page.keyboard.press("KeyF");
  expect(
    await page.evaluate(
      () => vigilia.snapshot().structures.find((s) => s.kind === "wall").hp,
    ),
  ).toBe(200);
  expect(await page.evaluate(() => vigilia.snapshot().inventory.wood)).toBe(98);
});
test("bow and gun shots consume ammunition and damage a real zombie", async ({
  page,
}) => {
  const s = fixture();
  s.creatures[0].hp = 0;
  s.zombieSnapshot = [
    {
      x: -5,
      z: -7.3,
      hp: 65,
      variant: "walker",
      horde: false,
      cooldown: 0,
      slow: 0,
    },
  ];
  await launch(page, s);
  await page.keyboard.press("Digit2");
  await page.locator("#world").click({ position: { x: 640, y: 360 } });
  await page.evaluate(() => document.exitPointerLock());
  await page.waitForFunction(() => !document.pointerLockElement);
  expect(await page.evaluate(() => vigilia.snapshot().inventory.arrows)).toBe(
    9,
  );
  expect(await page.evaluate(() => vigilia.entities().zombies[0]?.hp)).toBe(35);
  const time = await page.evaluate(() => vigilia.snapshot().time);
  await expect
    .poll(() => page.evaluate(() => vigilia.snapshot().time))
    .toBeGreaterThan(time + 0.7);
  await page.keyboard.press("Digit3");
  await page.locator("#world").click({ position: { x: 640, y: 360 } });
  expect(await page.evaluate(() => vigilia.snapshot().inventory.ammo)).toBe(9);
  expect(await page.evaluate(() => vigilia.snapshot().kills)).toBe(1);
});

test("distant zombies wander while nearby zombies detect and pursue the player", async ({
  page,
}) => {
  const s = fixture();
  s.creatures[0].hp = 0;
  s.zombieSnapshot = [
    {
      x: 65,
      z: 65,
      hp: 65,
      variant: "walker",
      horde: false,
      cooldown: 0,
      slow: 0,
    },
    {
      x: -10,
      z: -10,
      hp: 65,
      variant: "walker",
      horde: false,
      cooldown: 0,
      slow: 0,
    },
  ];
  await launch(page, s);
  const before = await page.evaluate(() => ({
    time: vigilia.snapshot().time,
    z: vigilia.entities().zombies,
  }));
  await expect
    .poll(() => page.evaluate(() => vigilia.snapshot().time))
    .toBeGreaterThan(before.time + 2);
  const after = await page.evaluate(() => vigilia.entities().zombies);
  expect(
    Math.hypot(after[0].x - before.z[0].x, after[0].z - before.z[0].z),
  ).toBeLessThan(1.8);
  expect(
    Math.hypot(after[1].x - before.z[1].x, after[1].z - before.z[1].z),
  ).toBeGreaterThan(2);
  expect(after[0].aggro).toBe(0);
  expect(after[1].aggro).toBeGreaterThan(0);
});

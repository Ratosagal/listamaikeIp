import * as THREE from "three";
import "./style.css";
import {
  Rogue,
  KEY,
  WEAPONS,
  BOONS,
  UPGRADES,
  REGIONS,
  freshState,
  restore,
} from "./simulation.js";
import { createGisele, animateGisele } from "./hero.js";
import {
  buildStage,
  enemyModel,
  floorRing,
  orb,
  glow,
  disposeActor,
} from "./world.js";
import { Feedback } from "../systems/effects.js";
import { Soundscape } from "../systems/audio.js";
import {
  loadPreferences,
  clampPreferences,
  storePreferences,
} from "../systems/preferences.js";
const $ = (id) => document.getElementById(id),
  settings = clampPreferences(loadPreferences());
let state = freshState(Date.now() >>> 0),
  recovery = false;
try {
  const raw = localStorage.getItem(KEY);
  if (raw) state = restore(raw);
} catch {
  recovery = true;
  try {
    localStorage.setItem(KEY + "-recovery", localStorage.getItem(KEY) || "");
  } catch {}
}
const scene = new THREE.Scene();
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: $("world"), antialias: true });
} catch {
  $("menu").innerHTML =
    '<div class="menu-copy"><h1>GISELE</h1><p>WebGL indisponível. Ative a aceleração gráfica do navegador para jogar.</p></div>';
  throw Error("WebGL indisponível");
}
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.type = THREE.PCFShadowMap;
const camera = new THREE.OrthographicCamera(-20, 20, 12.5, -12.5, 0.1, 120);
camera.position.set(20, 25, 20);
camera.lookAt(0, 0, 0);
const ambient = new THREE.HemisphereLight(0xc7d2ed, 0x273b3c, 1.35);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xffd6aa, 2.5);
sun.position.set(-8, 20, 10);
sun.castShadow = true;
sun.shadow.normalBias = 0.025;
sun.shadow.bias = -0.0003;
Object.assign(sun.shadow.camera, {
  left: -20,
  right: 20,
  top: 20,
  bottom: -20,
  far: 70,
});
scene.add(sun);
const rim = new THREE.DirectionalLight(0x7bbab4, 1.6);
rim.position.set(8, 9, -12);
scene.add(rim);
const audio = new Soundscape(settings),
  fx = new Feedback(scene, settings),
  hero = createGisele(scene);
hero.scale.setScalar(1.3);
const heroMark = floorRing(scene, 0x91d9c4, 0.46);
heroMark.material.depthTest = false;
heroMark.material.opacity = 0.45;
let running = false,
  panel = null,
  panelReturn = null,
  stage = null,
  stageKey = "",
  noticeTimer = 0,
  bannerTimer = 0,
  saveTimer = 0,
  hudTimer = 0,
  mouseAiming = false,
  zoom = 1,
  shakeTimer = 0;
const keys = {},
  held = { attack: false, special: false },
  charge = { attack: 0, special: 0 },
  enemyViews = new Map(),
  shotViews = new Map(),
  fieldViews = new Map(),
  hazardViews = new Map(),
  telegraphs = new Map(),
  effects = [];
const pointer = new THREE.Vector2(0, 0),
  raycaster = new THREE.Raycaster(),
  plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
  aimPoint = new THREE.Vector3(),
  cameraFocus = new THREE.Vector3(),
  nextFocus = new THREE.Vector3();
const model = new Rogue(state, handleEvent);
const npcData = {
  iria: {
    name: "Íria, a Guardiã dos Fios",
    sigil: "I",
    role: "GUARDIÃ DO REFÚGIO",
    lines: [
      "O Véu não separa a vida da morte, Gisele. Separa o que lembramos do que escolhemos esquecer. Sua irmã deixou um fio aqui. Siga-o.",
      "O Vigia protege um jardim sem nomes. Não tente ser mais forte que a pedra. Seja o instante entre os golpes.",
      "Cada retorno muda este lugar. Nem toda derrota significa que você voltou de mãos vazias.",
    ],
  },
  oren: {
    name: "Oren, o Ferreiro de Ecos",
    sigil: "O",
    role: "ARMAS E MEMÓRIAS",
    lines: [
      "Não forjo lâminas novas. Dou forma às que você ainda não aprendeu a lembrar. Qual história levará consigo?",
      "Âmbar guarda o calor. As lâminas guardam o intervalo. O arco guarda a distância. Domine o ritmo de cada um.",
      "Traga fragmentos da Fenda. A sua memória é o único metal que atravessa o Véu.",
    ],
  },
  nara: {
    name: "Nara, a Cartógrafa",
    sigil: "N",
    role: "CÓDICE DA FENDA",
    lines: [
      "Mapas não registram lugares. Registram maneiras de voltar. Deixe-me anotar as suas.",
      "O Arquivo guarda as lembranças que a cidade lançou ao mar. A Curadora não distingue uma memória de sua dona.",
      "No coração da Fenda, o Oráculo fala com a voz de quem você perdeu. Não responda antes de reconhecer a sua.",
    ],
  },
};
function portrait() {
  return `<svg viewBox="0 0 600 800" role="img" aria-label="Gisele, mulher de cabelos prateados, manto violeta e bastão de âmbar"><defs><linearGradient id="robe" x2="1" y2="1"><stop stop-color="#5e4a67"/><stop offset="1" stop-color="#25293d"/></linearGradient><linearGradient id="silver" x2="1" y2="1"><stop stop-color="#e2e3dc"/><stop offset=".6" stop-color="#9aa9b7"/><stop offset="1" stop-color="#697c91"/></linearGradient><linearGradient id="skin" x2="1" y2="1"><stop stop-color="#dbb8a0"/><stop offset="1" stop-color="#9d7e81"/></linearGradient><radialGradient id="aura"><stop stop-color="#77bea6" stop-opacity=".24"/><stop offset="1" stop-color="#77bea6" stop-opacity="0"/></radialGradient></defs><ellipse cx="310" cy="410" rx="275" ry="350" fill="url(#aura)"/><g fill="none" stroke="#a7997250"><circle cx="310" cy="310" r="220"/><circle cx="310" cy="310" r="203"/><path d="M310 60V0M310 560v70M60 310H0M560 310h40"/><path d="M153 153l-30-30M467 153l30-30M153 467l-30 30M467 467l30 30"/></g><path d="M241 194Q275 125 357 160Q415 177 410 283L397 491l-66-87-92 80-34-169z" fill="url(#silver)"/><path d="M170 486Q207 399 255 393l99-2q85 30 112 139l69 257H105z" fill="url(#robe)"/><path d="M194 477l-42 175-41 25-19-23 56-195zM397 458l48 142 55-72 24 14-51 126-47 8-77-166" fill="url(#skin)"/><path d="M262 336l-8 66 45 45 53-46-18-66z" fill="url(#skin)"/><path d="M236 233Q246 185 308 188Q374 189 377 250l-14 76-43 56-40-15-43-57z" fill="url(#skin)"/><path d="M233 266l-12-52 39-48 62-12 64 40 21 75-38-26-16-35-12 27-25-20-19 25-24-12-24 34z" fill="url(#silver)"/><path d="M255 269q20-13 38-2M326 266q19-8 34 3" fill="none" stroke="#5b5360" stroke-width="5"/><path d="M258 283q15-8 31-1M327 282q16-7 29 2" fill="none" stroke="#263d43" stroke-width="4"/><path d="M309 283l-8 34 14 3M288 337q20 10 38-1" fill="none" stroke="#997174" stroke-width="3"/><path d="M238 229l66-25 70 29" fill="none" stroke="#cbb37d" stroke-width="8"/><path d="M304 197l9 12-9 16-9-16z" fill="#98d8bc"/><path d="M206 425l52-24 41 45 52-45 43 26-36 121H248z" fill="#343244"/><g fill="none" stroke="#c2a171" stroke-width="6"><path d="M207 428l50 120 100 1 37-121M299 447v101M250 466l40 19M354 466l-42 19"/><path d="M232 561l137 2M245 570l-22 200M357 570l50 200"/></g><path d="M245 402l-28 131-27 119 18-245zM378 222l-7 201 30 86-3-221z" fill="url(#silver)"/><path d="M497 281l-22 469" stroke="#b49a6b" stroke-width="10"/><path d="M499 274l-24-28 5-58 22-35 20 40 1 52z" fill="#9bcebb"/><path d="M499 274l-24-28 5-58 22-35 20 40 1 52z" fill="none" stroke="#d9c499" stroke-width="4"/><g fill="#afc5b7" opacity=".6"><circle cx="150" cy="294" r="2"/><circle cx="460" cy="360" r="3"/><circle cx="435" cy="158" r="2"/><circle cx="146" cy="530" r="2"/></g></svg>`;
}
$("portraitArt").innerHTML = portrait();
function notify(text) {
  $("notice").textContent = text;
  $("notice").style.opacity = 1;
  noticeTimer = 3.3;
}
function save() {
  if (!running) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    notify("Não foi possível salvar. Verifique o armazenamento do navegador.");
  }
}
function clearInputs() {
  for (const key of Object.keys(keys)) keys[key] = false;
  held.attack = held.special = false;
  charge.attack = charge.special = 0;
  state.hero.vx = state.hero.vz = 0;
}
function stageId() {
  return `${state.phase === "hub" ? "hub" : "run"}:${state.run?.room || 0}`;
}
function refreshStage() {
  const id = stageId();
  if (id === stageKey) return;
  stageKey = id;
  stage?.dispose();
  for (const map of [
    enemyViews,
    shotViews,
    fieldViews,
    hazardViews,
    telegraphs,
  ]) {
    for (const view of map.values()) {
      scene.remove(view);
      if (map === enemyViews) disposeActor(view);
      if ([fieldViews, hazardViews, telegraphs].includes(map)) {
        view.geometry.dispose();
        view.material.dispose();
      }
    }
    map.clear();
  }
  for (const e of effects) {
    scene.remove(e.mesh);
    e.mesh.geometry.dispose();
    e.mesh.material.dispose();
  }
  effects.length = 0;
  stage = buildStage(
    scene,
    model.region(),
    state.phase === "hub",
    state.run?.room || 0,
  );
  bannerTimer = 3;
  $("roomBanner").textContent =
    state.phase === "hub" ? "Átrio dos Fios" : REGIONS[model.region()].name;
}
function transientRing(x, z, color, r = 2, life = 0.35) {
  const m = floorRing(scene, color, r);
  m.position.set(x, 0.045, z);
  effects.push({ mesh: m, life, total: life, r });
}
function handleEvent(type, data) {
  if (type === "message") {
    notify(data.text);
    return;
  }
  if (type === "hit") {
    fx.burst({ x: data.x, y: 1, z: data.z }, 0xc1d7af, 5);
    fx.text(data, `${data.damage}`, "#eee0b4");
    audio.play("hit");
  }
  if (type === "kill") {
    fx.burst(
      { x: data.x, y: 1, z: data.z },
      data.boss ? 0xe9b584 : 0x82c5ba,
      data.boss ? 30 : 12,
    );
  }
  if (type === "hurt") {
    fx.hurt();
    audio.play("hurt");
    shakeTimer = 0.15;
  }
  if (type === "attack") {
    audio.play(data.kind === "bow" ? "bow" : "sword");
    if (data.kind === "bow")
      fx.burst({ x: data.x, y: 1.2, z: data.z }, 0x97d9c4, 8);
    else if (data.charged) transientRing(data.x, data.z, 0xf3d69c, 3.4, 0.3);
    else {
      const arc = floorRing(scene, 0xbee4d5, 1);
      arc.geometry.dispose();
      arc.geometry = new THREE.RingGeometry(
        1.8,
        2.25,
        32,
        1,
        data.facing - Math.PI * 0.1,
        Math.PI * 1.2,
      );
      arc.position.set(data.x, 0.05, data.z);
      effects.push({ mesh: arc, life: 0.22, total: 0.22, r: 1 });
    }
  }
  if (type === "special") {
    audio.play("bow");
    fx.burst({ x: data.x, y: 1, z: data.z }, 0xa7bcdd, 9);
  }
  if (type === "cast") {
    audio.play("capture");
    fx.burst({ x: data.x, y: 0.3, z: data.z }, 0x82d3bd, 18);
  }
  if (type === "dash") {
    audio.play("bow");
    fx.burst({ x: data.x, y: 0.6, z: data.z }, 0x9ed5ca, 8);
  }
  if (type === "impact") {
    transientRing(data.x, data.z, 0xe59fa6, 2.8, 0.25);
  }
  if (type === "cleared") {
    notify("Encontro superado. Recolha um voto no altar [E].");
    audio.play("collect");
    save();
  }
  if (type === "room") {
    refreshStage();
    save();
  }
  if (type === "boon") {
    notify(`${BOONS[data.key].name} · nível ${model.rank(data.key)}`);
    audio.play("evolve");
    save();
  }
  if (type === "revive") {
    notify("Última Centelha · você ainda tem um fio a seguir.");
    transientRing(state.hero.x, state.hero.z, 0xdccb8c, 4, 0.8);
  }
  if (type === "death" || type === "victory") {
    save();
    showResult(type === "victory");
    audio.play(type === "victory" ? "evolve" : "horde");
  }
}
function nearestInteraction() {
  const h = state.hero;
  if (state.phase === "hub") {
    if (Math.hypot(h.x, h.z + 7) < 2.5)
      return { text: "E · Atravessar o Véu", action: beginRun };
    const nearest = [
      { key: "iria", x: -5, z: -2 },
      { key: "oren", x: 0, z: -2 },
      { key: "nara", x: 5, z: -2 },
    ].sort(
      (a, b) =>
        Math.hypot(a.x - h.x, a.z - h.z) - Math.hypot(b.x - h.x, b.z - h.z),
    )[0];
    if (Math.hypot(h.x - nearest.x, h.z - nearest.z) < 2.4)
      return {
        text: `E · Conversar com ${npcData[nearest.key].name.split(",")[0]}`,
        action: () => showDialogue(nearest.key),
      };
    return {
      text: "WASD mover · Oren forja armas · Íria guarda os fios · Nara registra sua jornada",
      action: null,
    };
  }
  if (state.phase === "cleared")
    return { text: "E · Receber um voto do altar", action: openRewards };
  if (state.phase === "exit") {
    const path = h.x < 0 ? "gold" : "heal";
    return {
      text: `E · Próxima câmara · ${path === "gold" ? "+15 óbolos" : "+18 de vida"}`,
      action: () => chooseRoute(path),
    };
  }
  if (state.phase === "shop") {
    if (Math.hypot(h.x, h.z + 7) < 2.5)
      return {
        text: "E · Seguir até o guardião",
        action: () => chooseRoute("gold"),
      };
    return { text: "E · Mercador de ecos · poção e voto", action: showShop };
  }
  return {
    text: "J / clique: ataque · K / direito: especial · Q: círculo · Espaço: esquiva",
    action: null,
  };
}
function beginRun() {
  closePanel();
  if (model.begin()) {
    refreshStage();
    updateHUD();
    save();
  }
}
function chooseRoute(path) {
  if (model.next(path)) {
    closePanel();
    refreshStage();
    syncViews(0);
    updateHUD();
    save();
  }
}
function openRewards() {
  if (state.phase === "cleared") model.reward();
  if (state.phase !== "reward") return;
  openPanel("reward", "UM FRAGMENTO DO INFINITO", "Escolha um voto");
  $("panelBody").innerHTML =
    `<p>Um voto acompanha Gisele até o fim desta tentativa. Os níveis se acumulam até três.</p><div class="choices">${state.run.offers
      .map((key, i) => {
        const boon = BOONS[key];
        return `<button class="choice" data-boon="${key}" style="--choice:${boon.color}"><span class="sigil">${["✧", "◇", "✦"][i]}</span><span class="eyebrow">${boon.source}</span><h3>${boon.name}</h3><p>${boon.description}</p><small>NÍVEL ${model.rank(key) + 1} / 3 · ESCOLHER</small></button>`;
      })
      .join("")}</div>`;
  $("panelBody")
    .querySelectorAll("[data-boon]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          model.choose(b.dataset.boon);
          closePanel();
          save();
          updateHUD();
        }),
    );
  focusPanel();
  save();
}
function openPanel(mode, eyebrow, title) {
  panel = mode;
  clearInputs();
  $("panel").hidden = false;
  $("panelEyebrow").textContent = eyebrow;
  $("panelTitle").textContent = title;
  $("closePanel").hidden = ["reward", "result"].includes(mode);
  save();
}
function closePanel() {
  if (
    (panel === "reward" && state.phase === "reward") ||
    (panel === "result" && ["death", "victory"].includes(state.phase))
  )
    return;
  panel = null;
  panelReturn = null;
  $("panel").hidden = true;
  clearInputs();
  $("pause").focus();
  save();
}
function focusPanel() {
  $("panelBody").querySelector("button:not(:disabled),select,input")?.focus();
}
function showHub() {
  openPanel("hub", "ÁTRIO DOS FIOS", "O que você leva consigo?");
  $("panelBody").innerHTML =
    `<p>Os votos são passageiros. A memória permanece. Escolha sua arma, fortaleça Gisele e converse antes de atravessar o Véu.</p><div class="choices">${Object.entries(
      WEAPONS,
    )
      .map(
        ([key, w], i) =>
          `<button class="choice" data-weapon="${key}" style="--choice:${["#dfbc86", "#c7a1da", "#93d2c5"][i]}"><span class="sigil">${["Ⅰ", "Ⅱ", "Ⅲ"][i]}</span><span class="eyebrow">${state.meta.weapon === key ? "EQUIPADA" : "ARMA DO REFÚGIO"}</span><h3>${w.name}</h3><p>${w.description}</p><small>${w.damage} DANO BASE · ${w.range} M ALCANCE</small></button>`,
      )
      .join(
        "",
      )}</div><div class="panel-actions"><button id="upgradesButton">Memórias permanentes · ${state.meta.shards} fragmentos</button><button id="iriaButton">Conversar com Íria</button><button id="naraButton">Códice de Nara</button><button id="depart" class="primary">Atravessar o Véu ›</button></div>`;
  $("panelBody")
    .querySelectorAll("[data-weapon]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          if (state.phase !== "hub") return;
          state.meta.weapon = b.dataset.weapon;
          showHub();
          save();
          updateHUD();
        }),
    );
  $("upgradesButton").onclick = showUpgrades;
  $("iriaButton").onclick = () => showDialogue("iria");
  $("naraButton").onclick = showCodex;
  $("depart").onclick = beginRun;
  focusPanel();
}
function showUpgrades() {
  if (state.phase !== "hub") return;
  openPanel("upgrades", "MEMÓRIAS QUE ATRAVESSAM O VÉU", "A força de voltar");
  $("panelBody").innerHTML =
    `<p>Fragmentos disponíveis: <strong>${state.meta.shards}</strong>. Estas melhorias persistem entre tentativas.</p><div class="upgrade-grid">${Object.entries(
      UPGRADES,
    )
      .map(([key, u]) => {
        const rank = state.meta.upgrades[key],
          cost = u.cost * (rank + 1);
        return `<article class="upgrade"><h3>${u.name}</h3><p>${u.description}</p><button data-upgrade="${key}" ${rank >= u.max || state.meta.shards < cost ? "disabled" : ""}>${rank >= u.max ? "MEMÓRIA COMPLETA" : `${rank} / ${u.max} · Fortalecer por ${cost} fragmentos`}</button></article>`;
      })
      .join(
        "",
      )}</div><div class="panel-actions"><button id="backHub">Voltar ao refúgio</button></div>`;
  $("panelBody")
    .querySelectorAll("[data-upgrade]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          if (model.upgrade(b.dataset.upgrade)) {
            audio.play("craft");
            save();
            showUpgrades();
            updateHUD();
          }
        }),
    );
  $("backHub").onclick = showHub;
  focusPanel();
}
function showDialogue(key) {
  if (state.phase !== "hub") return;
  const npc = npcData[key],
    page = Math.min(2, Number(state.meta.conversations[key]) || 0);
  openPanel("dialogue", npc.role, npc.name);
  $("panelBody").innerHTML =
    `<div class="dialogue"><div class="npc-sigil">${npc.sigil}</div><div><blockquote>“${npc.lines[page]}”</blockquote><p>Gisele escuta. Mais um fio encontra seu lugar no Átrio.</p><div class="panel-actions"><button id="talkNext" class="primary">Continuar conversa</button>${key === "oren" ? '<button id="forge">Armas e memórias</button>' : key === "nara" ? '<button id="readCodex">Abrir códice</button>' : ""}<button id="endTalk">Voltar ao refúgio</button></div></div></div>`;
  $("talkNext").onclick = () => {
    state.meta.conversations[key] =
      ((Number(state.meta.conversations[key]) || 0) + 1) % 3;
    save();
    showDialogue(key);
  };
  $("endTalk").onclick = closePanel;
  if ($("forge")) $("forge").onclick = showHub;
  if ($("readCodex")) $("readCodex").onclick = showCodex;
  focusPanel();
}
function showShop() {
  if (state.phase !== "shop") return;
  openPanel("shop", "MERCADOR DE ECOS", "Tudo tem uma lembrança");
  $("panelBody").innerHTML =
    `<p>Óbolos disponíveis: ${state.run.coins}. A próxima passagem leva ao guardião desta região.</p><div class="choices"><button class="choice" id="buyHeal"><span class="sigil">✦</span><h3>Infusão de raízes</h3><p>Recupere 45 de vida.</p><small>30 ÓBOLOS</small></button><button class="choice" id="buyBoon"><span class="sigil">◇</span><h3>Voto esquecido</h3><p>Receba um voto aleatório. Pode fortalecer um voto já recebido.</p><small>65 ÓBOLOS</small></button></div><div class="panel-actions"><button id="leaveShop" class="primary">Seguir até o guardião ›</button></div>`;
  $("buyHeal").onclick = () => {
    notify(model.buy("heal") || "Vitalidade restaurada.");
    save();
    showShop();
    updateHUD();
  };
  $("buyBoon").onclick = () => {
    const result = model.buy("boon");
    if (result) notify(result);
    save();
    showShop();
    updateHUD();
  };
  $("leaveShop").onclick = () => chooseRoute("gold");
  focusPanel();
}
function showRoutes() {
  openPanel("routes", "UM NOVO FIO", "Escolha sua passagem");
  $("panelBody").innerHTML =
    '<p>O destino da próxima câmara permanece incerto. Você escolhe o que recolher no caminho.</p><div class="choices"><button class="choice" data-route="gold"><span class="sigil">◇</span><h3>Rastro de âmbar</h3><p>Receba 15 óbolos para gastar no descanso.</p></button><button class="choice" data-route="heal"><span class="sigil">✦</span><h3>Fonte de memória</h3><p>Recupere 18 de vida ao atravessar.</p></button></div>';
  $("panelBody")
    .querySelectorAll("[data-route]")
    .forEach((b) => (b.onclick = () => chooseRoute(b.dataset.route)));
  focusPanel();
}
function showResult(win) {
  openPanel(
    "result",
    win ? "O VÉU RESPIRA OUTRA VEZ" : "AINDA HÁ UM FIO",
    win ? "Você devolveu um nome." : "Nem tudo termina aqui.",
  );
  $("panelBody").innerHTML =
    `<p>${win ? "O Oráculo silencia. Gisele leva a primeira lembrança de Aurora de volta ao Átrio. A Fenda ainda guarda outras histórias." : "Gisele desperta no Átrio. Os votos se desfizeram, mas os fragmentos e a memória de cada encontro continuam com ela."}</p><div class="result-grid"><div><b>${state.run.room}/12</b><small>Câmara alcançada</small></div><div><b>${state.run.kills}</b><small>Inimigos vencidos</small></div><div><b>${state.run.shards}</b><small>Fragmentos guardados</small></div><div><b>${Object.values(state.run.boons).reduce((a, b) => a + b, 0)}</b><small>Votos recebidos</small></div></div><p>Fragmentos permanentes: ${state.meta.shards} · Tentativas: ${state.meta.attempts} · Vitórias: ${state.meta.wins}</p><button id="returnHub" class="primary">Despertar no refúgio ›</button>`;
  $("returnHub").onclick = () => {
    model.hub();
    panel = null;
    $("panel").hidden = true;
    refreshStage();
    updateHUD();
    save();
    showHub();
  };
  focusPanel();
}
function showCodex() {
  openPanel("codex", "CARTOGRAFIA DO IMPOSSÍVEL", "Os nomes que ficam");
  $("panelBody").innerHTML =
    `<p>${state.meta.attempts} tentativas · ${state.meta.deaths} retornos · ${state.meta.wins} vitórias · Melhor câmara: ${state.meta.best}/12</p><div class="codex">${REGIONS.map((r, i) => `<article><small>REGIÃO ${i + 1} / ${state.meta.best > i * 4 ? "DESCOBERTA" : "AINDA ALÉM DO VÉU"}</small><h3>${r.name}</h3><p>${r.subtitle}</p><p>Guardião: ${state.meta.best >= i * 4 + 4 ? r.boss : "Sua presença ainda não tem um nome."}</p></article>`).join("")}<article><small>GUIA DE COMBATE</small><h3>Conheça o intervalo.</h3><p>Os círculos vermelhos anunciam ataques. Esquive para atravessar projéteis e ondas. O círculo arcano retém os inimigos e causa dano contínuo. Correr não concede invulnerabilidade.</p></article></div><div class="panel-actions"><button id="codexBack">Voltar</button></div>`;
  $("codexBack").onclick = closePanel;
  focusPanel();
}
function showHelp() {
  openPanel("help", "MANUAL DO VÉU", "Aprenda o seu ritmo.");
  $("panelBody").innerHTML =
    '<div class="help-grid"><div><kbd>WASD / SHIFT</kbd><p>Mover na direção da tela / correr.</p></div><div><kbd>J / CLIQUE ESQUERDO</kbd><p>Ataque básico e combo. Segure por 0,65s e solte para um ataque carregado; custa 18 de magia.</p></div><div><kbd>K / CLIQUE DIREITO</kbd><p>Especial por 8 de magia. Segure e solte para uma versão carregada com custo adicional de 25.</p></div><div><kbd>Q OU L</kbd><p>Círculo arcano: desacelera e causa dano em área. Custa 20 de magia.</p></div><div><kbd>ESPAÇO</kbd><p>Esquiva na direção do movimento, ou da mira quando parada. Há duas cargas que se recuperam.</p></div><div><kbd>E / C / ESC</kbd><p>Interagir / abrir códice / pausar. A mira segue o mouse; J e K usam o alvo mais próximo quando o mouse está parado.</p></div></div><p>Complete três regiões e vença seus guardiões. Entre encontros, escolha um voto e uma passagem. Fragmentos financiam melhorias permanentes; vida, óbolos e votos da tentativa se renovam ao voltar ao refúgio.</p><button id="helpBack" class="primary">Entendido</button>';
  $("helpBack").onclick = closePanel;
  focusPanel();
}
function showSettings() {
  const previous = panel;
  openPanel("settings", "CONFIGURAÇÕES", "O seu jeito de atravessar.");
  panelReturn = previous;
  $("panelBody").innerHTML =
    `<div class="settings-grid"><label>Qualidade gráfica<select id="quality"><option value="low">Leve</option><option value="medium">Equilibrada</option><option value="high">Alta</option></select></label><label>Volume da música<input id="music" type="range" min="0" max="1" step=".05" value="${settings.music}"></label><label>Volume dos efeitos<input id="sound" type="range" min="0" max="1" step=".05" value="${settings.effects}"></label><label><span><input id="flashes" type="checkbox" ${settings.flashes ? "checked" : ""}> Feedback de dano</span></label><label><span><input id="particles" type="checkbox" ${settings.particles ? "checked" : ""}> Partículas</span></label><label><span><input id="contrast" type="checkbox" ${settings.highContrast ? "checked" : ""}> Alto contraste</span></label></div><div class="panel-actions"><button id="settingsBack" class="primary">Voltar</button></div>`;
  $("quality").value = settings.quality;
  $("quality").onchange = (e) => {
    settings.quality = e.target.value;
    applyQuality();
    storePreferences(settings);
  };
  for (const [id, key] of [
    ["music", "music"],
    ["sound", "effects"],
    ["flashes", "flashes"],
    ["particles", "particles"],
    ["contrast", "highContrast"],
  ])
    $(id).oninput = (e) => {
      settings[key] =
        e.target.type === "checkbox"
          ? e.target.checked
          : Number(e.target.value);
      audio.apply();
      storePreferences(settings);
      document.body.classList.toggle("high-contrast", settings.highContrast);
    };
  $("settingsBack").onclick = () => {
    if (panelReturn === "pause") showPause();
    else closePanel();
  };
  focusPanel();
}
function showPause() {
  openPanel("pause", "OS FIOS PODEM ESPERAR", "Respire. Retorne.");
  $("panelBody").innerHTML =
    '<p>O mundo está pausado. Sua tentativa foi salva neste navegador.</p><div class="stack"><button id="resume" class="primary">Retomar tentativa</button><button id="settingsOpen">Configurações</button><button id="helpOpen">Controles e combate</button><button id="saveMenu">Salvar e voltar ao menu</button></div>';
  $("resume").onclick = closePanel;
  $("settingsOpen").onclick = showSettings;
  $("helpOpen").onclick = showHelp;
  $("saveMenu").onclick = () => {
    save();
    panel = null;
    $("panel").hidden = true;
    running = false;
    $("hud").hidden = true;
    $("menu").hidden = false;
    audio.suspend();
    updateSaveLabel();
  };
  focusPanel();
}
function updateSaveLabel() {
  $("saveInfo").textContent = recovery
    ? "Save inválido preservado. Novo fio preparado."
    : state.run
      ? `Continuar tentativa · Câmara ${state.run.room}/12 · ${WEAPONS[state.run.weapon].name}`
      : `${state.meta.attempts} tentativas · ${state.meta.shards} fragmentos permanentes`;
  $("play").innerHTML = state.run
    ? "CONTINUAR TENTATIVA <span>›</span>"
    : "ENTRAR NO REFÚGIO <span>›</span>";
}
function updateHUD() {
  const h = state.hero,
    region = REGIONS[model.region()],
    weapon = state.run?.weapon || state.meta.weapon;
  $("regionLabel").textContent =
    state.phase === "hub"
      ? "REFÚGIO ENTRE OS MUNDOS"
      : region.name.toUpperCase();
  $("roomLabel").textContent =
    state.phase === "hub"
      ? "Átrio dos Fios"
      : `Câmara ${state.run.room} / 12 · ${state.run.room % 4 === 0 ? "GUARDIÃO" : state.phase === "shop" ? "DESCANSO" : state.run.room % 4 === 2 ? "ENCONTRO DE ELITE" : "ENCONTRO"}`;
  $("healthText").textContent = `${Math.ceil(h.hp)} / ${h.maxHp}`;
  $("healthFill").style.width = Math.max(0, (h.hp / h.maxHp) * 100) + "%";
  $("manaText").textContent = `${Math.floor(h.mana)} / ${h.maxMana}`;
  $("manaFill").style.width = (h.mana / h.maxMana) * 100 + "%";
  $("weaponName").textContent = WEAPONS[weapon].name;
  $("coins").textContent = `◇ ${state.run?.coins || 0}`;
  $("shards").textContent = `✦ ${state.run?.shards || state.meta.shards}`;
  $("dashPips").innerHTML = [0, 1]
    .map((i) => `<i class="${h.dashes <= i ? "empty" : ""}"></i>`)
    .join("");
  const objective = {
    hub: [
      "Escolha sua arma, fortaleça memórias e atravesse o Véu.",
      "PREPARAR INCURSÃO",
      showHub,
    ],
    combat: [
      `${state.enemies.length} inimigos neste encontro. Observe a preparação dos ataques e preserve sua magia.`,
      "ENCONTRO EM ANDAMENTO",
      null,
    ],
    cleared: [
      "Um voto espera no altar. Sua escolha moldará esta tentativa.",
      "RECEBER VOTO",
      openRewards,
    ],
    exit: [
      "Escolha sua próxima passagem: recursos ou vitalidade.",
      "ESCOLHER PASSAGEM",
      showRoutes,
    ],
    shop: [
      "Descanse, compre uma infusão ou aceite um voto do mercador.",
      "VISITAR MERCADOR",
      showShop,
    ],
    reward: ["Escolha um dos três votos.", "ESCOLHA SEU VOTO", null],
    death: ["Os fragmentos continuam com você.", "RETORNAR", null],
    victory: ["Uma memória encontrou o caminho de volta.", "VITÓRIA", null],
  }[state.phase];
  $("objectiveText").textContent = objective[0];
  $("actionButton").textContent = objective[1];
  $("actionButton").disabled = !objective[2];
  $("actionButton").onclick = objective[2];
  $("hint").textContent = nearestInteraction().text;
  const boss = state.enemies.find((e) => e.type === "boss");
  $("bossHUD").hidden = !boss;
  if (boss) {
    $("bossName").textContent = region.boss;
    $("bossFill").style.width = Math.max(0, (boss.hp / boss.maxHp) * 100) + "%";
    $("bossPhase").textContent =
      boss.hp < boss.maxHp * 0.5
        ? "SEGUNDA FASE · O VÉU SE AGITA"
        : "GUARDIÃO DA PASSAGEM";
  }
  const boonHTML = Object.entries(state.run?.boons || {})
    .map(
      ([key, rank]) =>
        `<button data-inspect="${key}" title="${BOONS[key].name} · nível ${rank}: ${BOONS[key].description}" style="--boon:${BOONS[key].color}" aria-label="${BOONS[key].name}, nível ${rank}">${rank}</button>`,
    )
    .join("");
  if ($("boons").innerHTML !== boonHTML) {
    $("boons").innerHTML = boonHTML;
    $("boons")
      .querySelectorAll("[data-inspect]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            notify(
              `${BOONS[b.dataset.inspect].name} · ${BOONS[b.dataset.inspect].description}`,
            )),
      );
  }
}
function aim() {
  const h = state.hero;
  if (mouseAiming) {
    raycaster.setFromCamera(pointer, camera);
    if (raycaster.ray.intersectPlane(plane, aimPoint))
      h.facing = Math.atan2(h.x - aimPoint.x, h.z - aimPoint.z);
  } else {
    const nearest = state.enemies
      .slice()
      .sort(
        (a, b) =>
          Math.hypot(a.x - h.x, a.z - h.z) - Math.hypot(b.x - h.x, b.z - h.z),
      )[0];
    if (nearest) h.facing = Math.atan2(h.x - nearest.x, h.z - nearest.z);
  }
}
function press(kind) {
  if (!running || panel || held[kind]) return;
  aim();
  held[kind] = true;
  charge[kind] = 0;
  model[kind](false);
}
function release(kind) {
  if (held[kind] && charge[kind] >= 0.65 && !panel && running) {
    aim();
    model[kind](true);
  }
  held[kind] = false;
  charge[kind] = 0;
}
function movement() {
  const x = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0),
    y = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
  return {
    x: (x - y) * Math.SQRT1_2,
    z: (-x - y) * Math.SQRT1_2,
    sprint: !!(keys.ShiftLeft || keys.ShiftRight),
  };
}
$("play").onclick = () => {
  running = true;
  $("menu").hidden = true;
  $("hud").hidden = false;
  audio.start().catch(() => {});
  refreshStage();
  updateHUD();
  if (["death", "victory"].includes(state.phase))
    showResult(state.phase === "victory");
  else if (state.phase === "reward") openRewards();
  else if (state.phase === "hub") showHub();
};
$("pause").onclick = showPause;
$("closePanel").onclick = () => {
  if (panel === "settings" && panelReturn === "pause") showPause();
  else closePanel();
};
$("menuSettings").onclick = showSettings;
$("menuHelp").onclick = showHelp;
addEventListener("keydown", (e) => {
  if (e.code === "Escape") {
    e.preventDefault();
    if (panel) {
      if (!["reward", "result"].includes(panel)) closePanel();
    } else if (running) showPause();
    return;
  }
  if (e.target.matches("input,select")) return;
  if (panel || !running) return;
  if (["Space", "KeyW", "KeyA", "KeyS", "KeyD"].includes(e.code))
    e.preventDefault();
  keys[e.code] = true;
  if (e.repeat) return;
  if (e.code === "KeyJ") {
    mouseAiming = false;
    press("attack");
  }
  if (e.code === "KeyK") {
    mouseAiming = false;
    press("special");
  }
  if (e.code === "KeyQ" || e.code === "KeyL") model.cast();
  if (e.code === "Space") {
    aim();
    const input = movement();
    model.dash(input.x, input.z);
  }
  if (e.code === "KeyE") nearestInteraction().action?.();
  if (e.code === "KeyC") showCodex();
});
addEventListener("keyup", (e) => {
  keys[e.code] = false;
  if (e.code === "KeyJ") release("attack");
  if (e.code === "KeyK") release("special");
});
$("world").addEventListener("contextmenu", (e) => e.preventDefault());
$("world").addEventListener("mousedown", (e) => {
  if (e.button === 0) press("attack");
  if (e.button === 2) press("special");
});
addEventListener("mouseup", (e) => {
  if (e.button === 0) release("attack");
  if (e.button === 2) release("special");
});
$("world").addEventListener("mousemove", (e) => {
  pointer.set(
    (e.clientX / innerWidth) * 2 - 1,
    (-e.clientY / innerHeight) * 2 + 1,
  );
  mouseAiming = true;
});
$("world").addEventListener(
  "wheel",
  (e) => {
    if (!running || panel) return;
    zoom = THREE.MathUtils.clamp(zoom - e.deltaY * 0.0003, 0.8, 1.25);
    resize();
  },
  { passive: true },
);
function blurPause() {
  clearInputs();
  if (running && !panel) showPause();
}
addEventListener("blur", blurPause);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) blurPause();
});
addEventListener("beforeunload", save);
addEventListener("keydown", (e) => {
  if (e.code !== "Tab") return;
  const container = panel ? $("panel") : !running ? $("menu") : null;
  if (!container) return;
  const controls = [
    ...container.querySelectorAll("button:not(:disabled),input,select"),
  ].filter((el) => el.getClientRects().length);
  if (!controls.length) return;
  const index = controls.indexOf(document.activeElement);
  if (e.shiftKey && index <= 0) {
    e.preventDefault();
    controls.at(-1).focus();
  } else if (!e.shiftKey && index === controls.length - 1) {
    e.preventDefault();
    controls[0].focus();
  }
});
function resize() {
  const aspect = innerWidth / innerHeight,
    half = 12.8 / zoom;
  camera.left = -half * aspect;
  camera.right = half * aspect;
  camera.top = half;
  camera.bottom = -half;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
addEventListener("resize", resize);
function applyQuality() {
  const low = settings.quality === "low",
    high = settings.quality === "high";
  renderer.setPixelRatio(
    Math.min(devicePixelRatio, low ? 1 : high ? 1.65 : 1.25),
  );
  const changed = renderer.shadowMap.enabled !== !low;
  renderer.shadowMap.enabled = !low;
  sun.castShadow = !low;
  const resolution = high ? 2048 : 1024;
  if (sun.shadow.mapSize.x !== resolution) {
    sun.shadow.map?.dispose();
    sun.shadow.map = null;
    sun.shadow.mapSize.set(resolution, resolution);
  }
  if (changed)
    scene.traverse((o) => {
      if (o.material?.isMeshStandardMaterial) o.material.needsUpdate = true;
    });
  document.body.classList.toggle("high-contrast", settings.highContrast);
  resize();
}
function removeView(map, id, dispose = false) {
  const view = map.get(id);
  if (!view) return;
  scene.remove(view);
  if (map === enemyViews) disposeActor(view);
  if (dispose) {
    view.geometry?.dispose();
    view.material?.dispose();
  }
  map.delete(id);
}
function syncViews(dt) {
  for (const [id] of enemyViews)
    if (!state.enemies.some((e) => e.id === id)) removeView(enemyViews, id);
  for (const e of state.enemies) {
    if (!enemyViews.has(e.id))
      enemyViews.set(e.id, enemyModel(scene, e, model.region()));
    const view = enemyViews.get(e.id);
    view.position.set(
      e.x,
      e.type === "wisp" ? Math.sin(state.time * 3 + e.id) * 0.12 : 0,
      e.z,
    );
    view.rotation.y =
      e.phase === "windup"
        ? e.aim
        : Math.atan2(e.x - state.hero.x, e.z - state.hero.z);
    view.userData.legs?.forEach(
      (leg, i) =>
        (leg.rotation.x = Math.sin(e.motion * 5 + i * Math.PI) * 0.45),
    );
    view.userData.arms?.forEach(
      (arm) =>
        (arm.rotation.x =
          e.phase === "windup" ? -1.6 : e.phase === "recover" ? 0.4 : 0),
    );
    if (e.phase === "windup") {
      if (!telegraphs.has(e.id))
        telegraphs.set(
          e.id,
          floorRing(
            scene,
            0xe28c99,
            e.type === "boss" ? 3 : e.type === "archer" ? 1.4 : 2.4,
          ),
        );
      const ring = telegraphs.get(e.id);
      ring.position.set(e.x, 0.035, e.z);
      ring.material.opacity = 0.4 + Math.sin(state.time * 18) * 0.18;
    } else if (telegraphs.has(e.id)) removeView(telegraphs, e.id, true);
  }
  for (const [id] of telegraphs)
    if (!state.enemies.some((e) => e.id === id))
      removeView(telegraphs, id, true);
  for (const [id] of shotViews)
    if (!state.shots.some((s) => s.id === id)) removeView(shotViews, id);
  for (const shot of state.shots) {
    if (!shotViews.has(shot.id)) {
      const m = orb(
        scene,
        shot.r,
        glow(shot.owner === "hero" ? 0x99dcc6 : 0xef91a7),
      );
      shotViews.set(shot.id, m);
    }
    shotViews.get(shot.id).position.set(shot.x, 0.9, shot.z);
  }
  for (const [id] of fieldViews)
    if (!state.fields.some((f) => f.id === id))
      removeView(fieldViews, id, true);
  for (const field of state.fields) {
    if (!fieldViews.has(field.id))
      fieldViews.set(field.id, floorRing(scene, 0x91e0bc, field.r));
    const view = fieldViews.get(field.id);
    view.position.set(field.x, 0.04, field.z);
    view.rotation.z = state.time * 0.25;
    view.material.opacity = Math.min(0.7, field.life * 0.35);
  }
  for (const [id] of hazardViews)
    if (!state.hazards.some((f) => f.id === id))
      removeView(hazardViews, id, true);
  for (const hazard of state.hazards) {
    if (!hazardViews.has(hazard.id))
      hazardViews.set(
        hazard.id,
        floorRing(
          scene,
          hazard.kind === "ring" ? 0xf3be8c : 0xe98cab,
          hazard.r,
        ),
      );
    const view = hazardViews.get(hazard.id);
    view.position.set(hazard.x, 0.05, hazard.z);
    view.visible = !(hazard.delay > 0);
    view.scale.setScalar(hazard.r);
    view.material.opacity =
      hazard.kind === "ring" ? 0.85 : 0.4 + Math.sin(state.time * 16) * 0.25;
  }
  for (const e of [...effects]) {
    e.life -= dt;
    e.mesh.material.opacity = Math.max(0, (e.life / e.total) * 0.7);
    e.mesh.scale.setScalar(e.r * (1 + (1 - e.life / e.total) * 0.35));
    if (e.life <= 0) {
      scene.remove(e.mesh);
      e.mesh.geometry.dispose();
      e.mesh.material.dispose();
      effects.splice(effects.indexOf(e), 1);
    }
  }
}
let previous = 0,
  renderClock = 0,
  idleElapsed = 0;
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.1, (now - (previous || now)) / 1000);
  previous = now;
  renderClock += dt;
  if (running && !panel) {
    aim();
    const input = movement();
    for (const kind of ["attack", "special"])
      if (held[kind]) charge[kind] = Math.min(1.6, charge[kind] + dt);
    model.step(dt, input);
    refreshStage();
    hero.position.set(state.hero.x, 0, state.hero.z);
    const target = state.hero.facing,
      turn = Math.atan2(
        Math.sin(target - hero.rotation.y),
        Math.cos(target - hero.rotation.y),
      );
    hero.rotation.y += turn * (1 - Math.exp(-dt * 22));
    animateGisele(
      hero,
      state.hero,
      state.time,
      dt,
      state.run?.weapon || state.meta.weapon,
      Math.max(charge.attack, charge.special),
    );
    syncViews(dt);
    saveTimer += dt;
    if (saveTimer > 6) {
      saveTimer = 0;
      save();
    }
    hudTimer += dt;
    if (hudTimer > 0.12) {
      hudTimer = 0;
      updateHUD();
    }
  }
  if (!running || panel) {
    idleElapsed += dt;
    if (idleElapsed < 0.05) return;
    idleElapsed = 0;
    hero.position.set(state.hero.x, 0, state.hero.z);
    animateGisele(
      hero,
      { ...state.hero, vx: 0, vz: 0, pose: 0 },
      renderClock,
      dt,
      state.run?.weapon || state.meta.weapon,
    );
  }
  stage?.update(renderClock, state.phase);
  nextFocus.set(state.hero.x * 0.08, -0.3, state.hero.z * 0.08);
  cameraFocus.lerp(nextFocus, 1 - Math.exp(-dt * 5));
  camera.position.set(cameraFocus.x + 20, 25, cameraFocus.z + 20);
  camera.lookAt(cameraFocus);
  if (shakeTimer > 0 && settings.shake) {
    camera.position.x += (Math.random() - 0.5) * 0.12;
    shakeTimer -= dt;
  }
  hero.rotation.z = state.phase === "death" ? -1.1 : 0;
  heroMark.position.set(state.hero.x, 0.04, state.hero.z);
  heroMark.visible = running;
  camera.updateMatrixWorld();
  fx.update(dt, camera);
  noticeTimer -= dt;
  if (noticeTimer <= 0) $("notice").style.opacity = 0;
  bannerTimer -= dt;
  $("roomBanner").style.opacity =
    bannerTimer > 0.8
      ? Math.min(1, 3 - bannerTimer)
      : Math.max(0, bannerTimer / 0.8);
  const amount = Math.max(charge.attack, charge.special);
  $("chargeHUD").hidden = amount < 0.15;
  $("chargeFill").style.width = Math.min(100, (amount / 0.65) * 100) + "%";
  renderer.render(scene, camera);
}
refreshStage();
updateHUD();
updateSaveLabel();
applyQuality();
requestAnimationFrame(animate);
window.gisele = {
  ready: true,
  snapshot: () => JSON.parse(JSON.stringify(state)),
  view: () => ({
    panel,
    quality: settings.quality,
    camera: camera.position.toArray(),
    render: { ...renderer.info.render },
    character: hero.name,
    animation: hero.userData.rig.mode,
    stage: stageKey,
  }),
  weapons: () => WEAPONS,
};

"use strict";

const app = {
  state: null,
  view: "planet",
  planetMode: "composite",
  planetTool: "heat",
  planetRotation: 0.45,
  hoverPoint: null,
  drag: null,
  macroRunning: false,
  compiledText: null,
  telemetryFilter: "all",
  waveReport: null,
  siegePreviewDirty: true,
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function api(path, body = null) {
  const options = body === null
    ? { method: "GET" }
    : {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      };
  const response = await fetch(path, options);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || `Request failed (${response.status})`);
  }
  return payload;
}

function toast(message, error = false) {
  const stack = $("#toast-stack");
  const node = document.createElement("div");
  node.className = `toast${error ? " error" : ""}`;
  node.textContent = message;
  stack.appendChild(node);
  setTimeout(() => node.remove(), 3600);
}

async function mutate(path, body = {}) {
  try {
    const payload = await api(path, body);
    app.state = payload.state || payload;
    renderAll();
    return payload;
  } catch (error) {
    toast(error.message, true);
    throw error;
  }
}

function fmt(value, digits = 2) {
  if (!Number.isFinite(Number(value))) return "—";
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: digits });
}

function shortHash(value) {
  if (!value) return "—";
  return `${value.slice(0, 9)}…${value.slice(-6)}`;
}

function initNavigation() {
  $$(".nav-button[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      app.view = button.dataset.view;
      $$(".nav-button[data-view]").forEach((item) => item.classList.toggle("active", item === button));
      $$("[data-view-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.viewPanel === app.view));
      requestAnimationFrame(drawActiveCanvases);
    });
  });
}

function setDisabledForInert(inert) {
  ["#withdraw-star", "#commit-dive", "#canonical-wave", "#macro-step", "#macro-run"].forEach((selector) => {
    const node = $(selector);
    if (node) node.disabled = inert;
  });
  $("#inject-syrin").disabled = inert;
  $$("#planet-tools .tool-button").forEach((node) => { node.disabled = inert; });
}

function renderAll() {
  if (!app.state) return;
  const state = app.state;
  const inert = state.inert;
  const status = $("#runtime-status");
  status.classList.toggle("inert", inert);
  $("span", status).textContent = inert ? "STARSILK INERT" : "STARSILK ACTIVE";
  $("#revision-readout").textContent = `R${state.revision}`;
  $("#footer-state").textContent = inert
    ? `NULLIFICATION LOCK // sequence ${state.nullification?.sequence ?? "—"} // reset required`
    : `planet ${shortHash(state.planet.state_hash)} // runtime nominal`;
  setDisabledForInert(inert);

  renderPlanetInstruments();
  renderMacroPanel();
  renderStarbindingPanel();
  renderSiegePanel();
  renderTelemetry();
  requestAnimationFrame(drawActiveCanvases);
}

function renderPlanetInstruments() {
  const state = app.state;
  const planet = state.planet;
  const star = state.star;
  $("#planet-hash").textContent = `HASH ${shortHash(planet.state_hash)}`;
  $("#planet-steps").textContent = `STEP ${planet.steps}`;
  $("#metric-temp").textContent = `${fmt(planet.stats.temperature_mean_k, 1)} K`;
  $("#metric-relief").textContent = `${fmt(planet.stats.elevation_max_m - planet.stats.elevation_min_m, 0)} m`;
  $("#metric-pressure").textContent = `${fmt(planet.stats.pressure_mean_pa / 1000, 2)} kPa`;
  $("#metric-co2").textContent = `${fmt(planet.stats.co2_mean_fraction * 1e6, 1)} ppm`;

  const bond = Number(star.bond_index);
  $("#bond-index").textContent = bond.toFixed(6);
  $("#bond-meter").style.width = `${clamp(bond * 100, 0, 100)}%`;
  $("#star-state-label").textContent = star.state.toUpperCase();
  $("#star-mass").textContent = `${Number(star.mass_solar).toFixed(3)} M☉`;
  $("#star-temp").textContent = `${fmt(star.temperature_k, 0)} K`;
  $("#heliocide-state").textContent = star.heliocide_event ? star.heliocide_event.event_id : "NO";
  const orb = $("#stellar-orb");
  orb.classList.toggle("collapsed", star.state === "collapsed");
  orb.classList.toggle("inert", state.inert);
  $("#planet-mode-label").textContent = `${app.planetMode.toUpperCase()} FIELD`;
}

function initPlanetControls() {
  $$("#planet-mode button").forEach((button) => {
    button.addEventListener("click", () => {
      app.planetMode = button.dataset.mode;
      $$("#planet-mode button").forEach((node) => node.classList.toggle("active", node === button));
      $("#planet-mode-label").textContent = `${app.planetMode.toUpperCase()} FIELD`;
      drawPlanet();
    });
  });
  $$("#planet-tools .tool-button").forEach((button) => {
    button.addEventListener("click", () => {
      app.planetTool = button.dataset.tool;
      $$("#planet-tools .tool-button").forEach((node) => node.classList.toggle("active", node === button));
    });
  });
  const intensity = $("#tool-intensity");
  const radius = $("#tool-radius");
  intensity.addEventListener("input", () => { $("#intensity-value").textContent = intensity.value; });
  radius.addEventListener("input", () => { $("#radius-value").textContent = radius.value; });

  const withdraw = $("#withdraw-slider");
  withdraw.addEventListener("input", () => { $("#withdraw-value").textContent = `${withdraw.value}%`; });
  $("#withdraw-star").addEventListener("click", async () => {
    await mutate("/api/star/withdraw", { fraction: Number(withdraw.value) / 100 });
    const event = app.state.star.heliocide_event;
    toast(event ? `Heliocide event ${event.event_id}: core collapsed immediately.` : "Starsilk withdrawal committed.");
  });
  $("#inject-syrin").addEventListener("click", async () => {
    await mutate("/api/syrin/inject", { contact_fraction: 1e-12 });
    toast("Syrin contact registered. Active Starsilk is inert until full laboratory reset.", true);
  });
  $("#advance-planet").addEventListener("click", () => mutate("/api/planet/step", { seconds: 1 }));
  $("#reset-lab").addEventListener("click", async () => {
    app.macroRunning = false;
    app.compiledText = null;
    app.waveReport = null;
    await mutate("/api/reset", {});
    app.siegePreviewDirty = true;
    drawSiege();
    toast("Laboratory session reset to deterministic baseline.");
  });
  $("#export-state").addEventListener("click", () => { window.location.assign("/api/export"); });

  const canvas = $("#planet-canvas");
  canvas.addEventListener("pointerdown", (event) => {
    const p = localPoint(event, canvas);
    canvas.setPointerCapture(event.pointerId);
    app.drag = { startX: p.x, startY: p.y, rotation: app.planetRotation, moved: false };
  });
  canvas.addEventListener("pointermove", (event) => {
    const p = localPoint(event, canvas);
    app.hoverPoint = p;
    if (app.drag) {
      const dx = p.x - app.drag.startX;
      if (Math.abs(dx) > 3 || Math.abs(p.y - app.drag.startY) > 3) app.drag.moved = true;
      app.planetRotation = app.drag.rotation + dx * 0.008;
      drawPlanet();
    } else {
      updatePlanetCursor(p);
      drawPlanet();
    }
  });
  canvas.addEventListener("pointerleave", () => {
    if (!app.drag) {
      app.hoverPoint = null;
      $("#planet-cursor").textContent = "CELL — / —";
      drawPlanet();
    }
  });
  canvas.addEventListener("pointerup", async (event) => {
    const p = localPoint(event, canvas);
    const dragged = app.drag?.moved;
    app.drag = null;
    if (!dragged) {
      const cell = planetCellFromPoint(p.x, p.y, canvas);
      if (cell) {
        try {
          await mutate("/api/planet/brush", {
            tool: app.planetTool,
            row: cell.row,
            col: cell.col,
            intensity: Number($("#tool-intensity").value),
            radius: Number($("#tool-radius").value),
          });
        } catch (_) {
          return;
        }
      }
    }
  });
}

function localPoint(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function canvasContext(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: rect.width, h: rect.height };
}

function planetGeometry(canvas) {
  const rect = canvas.getBoundingClientRect();
  const radius = Math.max(90, Math.min(rect.width * 0.31, rect.height * 0.405));
  return { cx: rect.width * 0.5, cy: rect.height * 0.51, radius };
}

function planetCellFromPoint(x, y, canvas) {
  if (!app.state) return null;
  const { cx, cy, radius } = planetGeometry(canvas);
  const sx = (x - cx) / radius;
  const sy = -(y - cy) / radius;
  const q = sx * sx + sy * sy;
  if (q > 1) return null;
  const sz = Math.sqrt(Math.max(0, 1 - q));
  const cosR = Math.cos(app.planetRotation);
  const sinR = Math.sin(app.planetRotation);
  const px = sx * cosR - sz * sinR;
  const pz = sx * sinR + sz * cosR;
  const lat = Math.asin(clamp(sy, -1, 1));
  const lon = Math.atan2(pz, px);
  const rows = app.state.planet.rows;
  const cols = app.state.planet.cols;
  const row = clamp(Math.round(((lat + Math.PI / 2) / Math.PI) * (rows - 1)), 0, rows - 1);
  let col = Math.floor(((lon + Math.PI) / (2 * Math.PI)) * cols);
  col = ((col % cols) + cols) % cols;
  return { row, col };
}

function updatePlanetCursor(point) {
  const cell = planetCellFromPoint(point.x, point.y, $("#planet-canvas"));
  $("#planet-cursor").textContent = cell ? `CELL ${String(cell.row).padStart(2, "0")} / ${String(cell.col).padStart(2, "0")}` : "CELL — / —";
}

function drawActiveCanvases() {
  if (!app.state) return;
  if (app.view === "planet") drawPlanet();
  if (app.view === "starbinding") drawStarbinding();
  if (app.view === "siege") drawSiege();
}

function drawSpace(ctx, w, h, density = 70) {
  ctx.fillStyle = "#020407";
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < density; i += 1) {
    const x = ((i * 73) % 997) / 997 * w;
    const y = ((i * 193 + 17) % 991) / 991 * h;
    const a = 0.14 + (((i * 37) % 100) / 100) * 0.38;
    const size = i % 11 === 0 ? 1.2 : 0.6;
    ctx.fillStyle = `rgba(180,220,236,${a})`;
    ctx.fillRect(x, y, size, size);
  }
}

function colorForPlanet(row, col, z) {
  const maps = app.state.planet.maps;
  const temp = maps.temperature_k[row][col];
  const elev = maps.elevation_m[row][col];
  const pressure = maps.pressure_pa[row][col];
  const co2 = maps.co2_fraction[row][col];
  let r = 20, g = 48, b = 58;
  if (app.planetMode === "thermal") {
    const t = clamp((temp - 225) / 130, 0, 1);
    if (t < 0.5) {
      const q = t / 0.5;
      r = 16 + 64 * q; g = 47 + 34 * q; b = 94 + 110 * q;
    } else {
      const q = (t - 0.5) / 0.5;
      r = 80 + 175 * q; g = 81 + 120 * q; b = 204 - 165 * q;
    }
  } else if (app.planetMode === "lithosphere") {
    const e = clamp((elev + 3000) / 6500, 0, 1);
    r = 22 + 120 * e; g = 54 + 105 * e; b = 67 + 67 * (1 - e);
  } else if (app.planetMode === "atmosphere") {
    const p = clamp((pressure - 50000) / 70000, 0, 1);
    const c = clamp((co2 - 0.0002) / 0.005, 0, 1);
    r = 15 + 42 * c; g = 54 + 135 * p; b = 82 + 155 * p - 45 * c;
  } else if (app.planetMode === "starsilk") {
    const field = 0.5 + 0.5 * Math.sin(col * 0.47 + row * 0.31);
    r = 7 + 11 * field; g = 25 + 69 * field; b = 35 + 96 * field;
  } else if (elev < 0) {
    const depth = clamp((-elev) / 3000, 0, 1);
    const warmth = clamp((temp - 240) / 85, 0, 1);
    r = 7 + 16 * warmth; g = 34 + 42 * warmth; b = 62 + 75 * (1 - depth);
  } else {
    const height = clamp(elev / 3000, 0, 1);
    const warmth = clamp((temp - 240) / 85, 0, 1);
    r = 30 + 72 * height + 22 * warmth;
    g = 69 + 72 * (1 - height) + 30 * warmth;
    b = 67 + 28 * (1 - height);
  }
  const shade = 0.28 + 0.72 * Math.pow(z, 0.55);
  return `rgb(${Math.round(r * shade)},${Math.round(g * shade)},${Math.round(b * shade)})`;
}

function drawPlanet() {
  if (!app.state) return;
  const canvas = $("#planet-canvas");
  const { ctx, w, h } = canvasContext(canvas);
  drawSpace(ctx, w, h, 95);
  const { cx, cy, radius } = planetGeometry(canvas);

  const halo = ctx.createRadialGradient(cx, cy, radius * 0.82, cx, cy, radius * 1.17);
  halo.addColorStop(0, "rgba(38,137,177,0)");
  halo.addColorStop(0.72, "rgba(55,188,227,0.025)");
  halo.addColorStop(0.88, "rgba(75,217,255,0.14)");
  halo.addColorStop(1, "rgba(75,217,255,0)");
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(cx, cy, radius * 1.18, 0, Math.PI * 2); ctx.fill();

  const step = radius > 240 ? 3 : 4;
  const rows = app.state.planet.rows;
  const cols = app.state.planet.cols;
  const cosR = Math.cos(app.planetRotation);
  const sinR = Math.sin(app.planetRotation);
  for (let py = -radius; py <= radius; py += step) {
    const sy = -py / radius;
    for (let px = -radius; px <= radius; px += step) {
      const sx = px / radius;
      const q = sx * sx + sy * sy;
      if (q >= 1) continue;
      const sz = Math.sqrt(1 - q);
      const worldX = sx * cosR - sz * sinR;
      const worldZ = sx * sinR + sz * cosR;
      const lat = Math.asin(clamp(sy, -1, 1));
      const lon = Math.atan2(worldZ, worldX);
      const row = clamp(Math.round(((lat + Math.PI / 2) / Math.PI) * (rows - 1)), 0, rows - 1);
      let col = Math.floor(((lon + Math.PI) / (2 * Math.PI)) * cols);
      col = ((col % cols) + cols) % cols;
      ctx.fillStyle = colorForPlanet(row, col, sz);
      ctx.fillRect(cx + px, cy + py, step + 0.8, step + 0.8);
    }
  }

  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.clip();
  const sheen = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
  sheen.addColorStop(0, "rgba(220,248,255,0.16)");
  sheen.addColorStop(0.33, "rgba(255,255,255,0.01)");
  sheen.addColorStop(0.7, "rgba(0,0,0,0.14)");
  sheen.addColorStop(1, "rgba(0,0,0,0.62)");
  ctx.fillStyle = sheen; ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  drawStarsilkThreads(ctx, cx, cy, radius);
  ctx.restore();

  ctx.strokeStyle = app.state.inert ? "rgba(255,73,103,.22)" : "rgba(100,220,255,.24)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, radius + 0.5, 0, Math.PI * 2); ctx.stroke();

  if (app.hoverPoint && !app.drag) {
    const dx = app.hoverPoint.x - cx, dy = app.hoverPoint.y - cy;
    if (dx * dx + dy * dy <= radius * radius) {
      ctx.strokeStyle = app.state.inert ? "rgba(255,73,103,.68)" : "rgba(75,217,255,.72)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(app.hoverPoint.x, app.hoverPoint.y, 9, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(app.hoverPoint.x - 14, app.hoverPoint.y); ctx.lineTo(app.hoverPoint.x + 14, app.hoverPoint.y); ctx.moveTo(app.hoverPoint.x, app.hoverPoint.y - 14); ctx.lineTo(app.hoverPoint.x, app.hoverPoint.y + 14); ctx.stroke();
    }
  }
}

function drawStarsilkThreads(ctx, cx, cy, radius) {
  const showStrong = app.planetMode === "starsilk";
  const inert = app.state.inert;
  const bond = Number(app.state.star.bond_index);
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.lineWidth = showStrong ? 1.25 : 0.7;
  ctx.strokeStyle = inert
    ? (showStrong ? "rgba(154,164,169,.42)" : "rgba(130,143,149,.16)")
    : (showStrong ? "rgba(75,217,255,.68)" : "rgba(75,217,255,.20)");
  if (inert) ctx.setLineDash([5, 9]);
  const lines = showStrong ? 15 : 8;
  for (let i = 0; i < lines; i += 1) {
    const y = cy - radius * 0.72 + (i / Math.max(1, lines - 1)) * radius * 1.44;
    const warp = Math.sin(i * 1.8 + app.planetRotation) * radius * 0.14;
    ctx.beginPath();
    ctx.moveTo(cx - radius, y);
    ctx.bezierCurveTo(cx - radius * 0.35, y + warp, cx + radius * 0.38, y - warp, cx + radius, y + warp * 0.2);
    ctx.stroke();
  }
  if (!inert && bond > 0) {
    ctx.setLineDash([]);
    ctx.fillStyle = `rgba(161,239,255,${0.26 + bond * 0.22})`;
    for (let i = 0; i < 11; i += 1) {
      const angle = i * 2.399 + app.planetRotation * 0.8;
      const rr = radius * (0.18 + ((i * 37) % 70) / 100);
      ctx.beginPath(); ctx.arc(cx + Math.cos(angle) * rr, cy + Math.sin(angle) * rr * 0.6, 1.1, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

function initMacroControls() {
  const editor = $("#macro-editor");
  editor.addEventListener("input", () => { app.compiledText = null; updateMacroGutter(); });
  editor.addEventListener("scroll", () => { $("#macro-gutter").scrollTop = editor.scrollTop; });
  $("#macro-compile").addEventListener("click", compileMacro);
  $("#macro-step").addEventListener("click", macroStep);
  $("#macro-run").addEventListener("click", runMacro);
  $("#macro-pause").addEventListener("click", () => { app.macroRunning = false; renderMacroPanel(); });
  $$("[data-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      editor.value = macroPreset(button.dataset.preset);
      app.compiledText = null;
      updateMacroGutter();
    });
  });
  updateMacroGutter();
}

function macroPreset(name) {
  if (name === "atmosphere") return `# Atmospheric load and composition shift\nSET pass 0\nREPEAT 4 {\n  ADD pass 1\n  EMIT ATMOS_PRESSURE 0 18 36 850\n  EMIT ATMOS_GAS co2 0 18 36 0.00012\n}\nASSERT pass == 4`;
  if (name === "heliocide") return `# Canon hard boundary: zero Starsilk = immediate collapse\nSET armed 1\nASSERT armed == 1\nWITHDRAW LAB-STAR 1`;
  return `# Ridge-and-heat laboratory macro\nSET pulse 0\nREPEAT 6 {\n  ADD pulse 1\n  EMIT LITHO_ELEVATION 0 18 36 95\n  EMIT THERMAL_ENERGY 0 18 36 2.5e13\n}\nASSERT pulse == 6`;
}

async function compileMacro() {
  const source = $("#macro-editor").value;
  try {
    await mutate("/api/macro/load", { source });
    app.compiledText = source;
    toast(`Macro compiled: ${app.state.macro.total} deterministic instructions.`);
  } catch (_) {
    app.compiledText = null;
  }
}

async function ensureMacroCompiled() {
  if (app.compiledText !== $("#macro-editor").value || !app.state.macro.loaded) {
    await compileMacro();
  }
  return app.compiledText !== null;
}

async function macroStep() {
  if (!(await ensureMacroCompiled())) return;
  if (app.state.macro.complete) {
    toast("Macro cursor is already complete. Compile / rewind to execute again.");
    return;
  }
  try { await mutate("/api/macro/step", {}); } catch (_) { app.macroRunning = false; }
}

async function runMacro() {
  if (!(await ensureMacroCompiled())) return;
  if (app.macroRunning) return;
  app.macroRunning = true;
  renderMacroPanel();
  while (app.macroRunning && app.state && !app.state.macro.complete && !app.state.inert) {
    try {
      await mutate("/api/macro/step", {});
    } catch (_) {
      break;
    }
    await delay(90);
  }
  app.macroRunning = false;
  renderMacroPanel();
}

function updateMacroGutter() {
  const editor = $("#macro-editor");
  const lines = editor.value.split("\n").length;
  const next = app.state?.macro?.next_line ?? null;
  $("#macro-gutter").innerHTML = Array.from({ length: lines }, (_, index) => {
    const line = index + 1;
    return `<div class="${line === next ? "active-line" : ""}">${String(line).padStart(2, "0")}</div>`;
  }).join("");
}

function renderMacroPanel() {
  if (!app.state) return;
  const macro = app.state.macro;
  $("#macro-runtime-chip").textContent = app.state.inert ? "INERT" : app.macroRunning ? "RUNNING" : macro.complete ? "COMPLETE" : macro.loaded ? "LOADED" : "READY";
  $("#macro-runtime-chip").classList.toggle("failed", app.state.inert);
  $("#macro-source-hash").textContent = macro.source_hash ? `SHA ${shortHash(macro.source_hash)}` : "NOT COMPILED";
  $("#macro-progress-label").textContent = `${macro.cursor} / ${macro.total}`;
  const progress = macro.total ? (macro.cursor / macro.total) * 100 : 0;
  $("#macro-progress-bar").style.width = `${progress}%`;
  $("#macro-next-line").textContent = macro.next_line ? `LINE ${macro.next_line}` : macro.complete ? "COMPLETE" : "LINE —";
  $("#macro-run").textContent = app.macroRunning ? "Running…" : "Run";
  $("#macro-pause").disabled = !app.macroRunning;
  const registers = Object.entries(macro.registers || {});
  $("#register-list").innerHTML = registers.length
    ? registers.map(([key, value]) => `<div class="register-row"><span>${escapeHtml(key)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")
    : `<div class="empty-state">No register state yet.</div>`;
  $("#macro-result").textContent = macro.last_result ? JSON.stringify(macro.last_result, null, 2) : "Awaiting execution.";
  updateMacroGutter();
}

function initStarbindingControls() {
  ["#dive-offset", "#dive-angle", "#dive-velocity", "#dive-withdrawal"].forEach((selector) => {
    $(selector).addEventListener("input", () => { updateDiveLabels(); drawStarbinding(); });
  });
  $("#commit-dive").addEventListener("click", async () => {
    try {
      await mutate("/api/starbinding/dive", diveValues());
      const result = app.state.starbinding.history.at(-1);
      if (result.collapsed) toast(`Vector ${result.index}: heliocide ${result.event_id}.`, true);
      else if (result.hit) toast(`Vector ${result.index}: core hit; bond index ${result.bond_index.toFixed(4)}.`);
      else toast(`Vector ${result.index}: core missed. No Starsilk withdrawn.`);
    } catch (_) { return; }
  });
  $("#canonical-wave").addEventListener("click", async () => {
    try {
      const payload = await api("/api/starbinding/wave", { simulated_stars: 16, represented_per_star: 250000000 });
      app.waveReport = payload.report;
      app.state = payload.state;
      renderAll();
      toast(`Canonical wave: ${fmt(payload.report.represented_collapses, 0)} represented collapses.`);
    } catch (error) { toast(error.message, true); }
  });
  updateDiveLabels();
}

function diveValues() {
  return {
    offset_radii: Number($("#dive-offset").value) / 100,
    angle_deg: Number($("#dive-angle").value) / 10,
    velocity_fraction_c: Number($("#dive-velocity").value) / 100,
    withdrawal_fraction: Number($("#dive-withdrawal").value) / 100,
  };
}

function updateDiveLabels() {
  const v = diveValues();
  $("#offset-value").textContent = `${v.offset_radii.toFixed(2)} R`;
  $("#angle-value").textContent = `${v.angle_deg.toFixed(1)}°`;
  $("#velocity-value").textContent = `${v.velocity_fraction_c.toFixed(2)} c`;
  $("#dive-withdrawal-value").textContent = `${Math.round(v.withdrawal_fraction * 100)}%`;
}

function renderStarbindingPanel() {
  if (!app.state) return;
  const history = app.state.starbinding.history || [];
  const last = history.at(-1);
  $("#dive-count").textContent = `${history.length} RUN${history.length === 1 ? "" : "S"}`;
  const result = $("#dive-big-result");
  result.className = "big-result";
  if (!last) {
    result.textContent = "NO VECTOR COMMITTED";
    $("#dive-result-state").textContent = "UNFIRED";
    $("#dive-result-copy").textContent = "The core is not decorative. Miss it and nothing is withdrawn. Hit it and the configured withdrawal is applied.";
  } else if (!last.hit) {
    result.textContent = "CORE MISSED"; result.classList.add("miss");
    $("#dive-result-state").textContent = "MISS";
    $("#dive-result-copy").textContent = `Vector ${last.index} did not intersect the modeled stellar core. Withdrawal = 0.`;
  } else if (last.collapsed) {
    result.textContent = "HELIOCIDE"; result.classList.add("collapse");
    $("#dive-result-state").textContent = last.event_id || "COLLAPSED";
    $("#dive-result-copy").textContent = "The vector intersected the core and depleted its Starsilk to zero. Collapse occurred in the same operation.";
  } else {
    result.textContent = "CORE HIT"; result.classList.add("hit");
    $("#dive-result-state").textContent = "SURVIVED";
    $("#dive-result-copy").textContent = `Core intersected. Remaining bond index: ${last.bond_index.toFixed(6)}.`;
  }
  $("#dive-history").innerHTML = history.length
    ? [...history].reverse().map((item) => `<div class="history-row"><b>#${String(item.index).padStart(2, "0")}</b><span>${item.offset_radii.toFixed(2)}R · ${item.angle_deg.toFixed(1)}° · ${(item.velocity_fraction_c).toFixed(2)}c</span><strong class="${item.collapsed ? "collapse" : !item.hit ? "miss" : ""}">${item.collapsed ? "HELIOCIDE" : item.hit ? "HIT" : "MISS"}</strong></div>`).join("")
    : `<div class="empty-state">No vectors committed.</div>`;
  if (app.waveReport) {
    $("#wave-result").innerHTML = `<strong>${fmt(app.waveReport.represented_collapses, 0)}</strong><span>represented collapses</span>`;
  }
}

function drawStarbinding() {
  if (!app.state) return;
  const canvas = $("#starbinding-canvas");
  const { ctx, w, h } = canvasContext(canvas);
  drawSpace(ctx, w, h, 105);
  const v = diveValues();
  const starX = w * 0.72, starY = h * 0.5, starR = Math.max(36, Math.min(w, h) * 0.09);
  const startX = w * 0.08, startY = starY + v.offset_radii * starR * 0.42;
  const angle = v.angle_deg * Math.PI / 180;
  const length = w * 0.88;
  const endX = startX + Math.cos(angle) * length;
  const endY = startY + Math.sin(angle) * length;

  const starGlow = ctx.createRadialGradient(starX, starY, 0, starX, starY, starR * 1.7);
  starGlow.addColorStop(0, "rgba(255,248,185,1)"); starGlow.addColorStop(.14, "rgba(255,192,83,.95)"); starGlow.addColorStop(.48, "rgba(223,84,42,.55)"); starGlow.addColorStop(1, "rgba(223,84,42,0)");
  ctx.fillStyle = starGlow; ctx.beginPath(); ctx.arc(starX, starY, starR * 1.7, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(255,210,112,.25)"; ctx.beginPath(); ctx.arc(starX, starY, starR, 0, Math.PI * 2); ctx.stroke();

  ctx.setLineDash([9, 7]); ctx.lineWidth = 1.4; ctx.strokeStyle = "rgba(75,217,255,.8)";
  ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(endX, endY); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = "#9beeff"; ctx.beginPath(); ctx.arc(startX, startY, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(75,217,255,.72)"; ctx.font = "10px ui-monospace, monospace"; ctx.fillText(`${v.velocity_fraction_c.toFixed(2)}c`, startX + 9, startY - 8);

  const distance = distancePointToLine(starX, starY, startX, startY, endX, endY);
  const previewHit = distance <= starR && endX > starX;
  ctx.strokeStyle = previewHit ? "rgba(255,189,90,.72)" : "rgba(111,138,151,.38)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(starX, starY, starR + 8, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = previewHit ? "rgba(255,189,90,.9)" : "rgba(98,119,128,.8)"; ctx.font = "700 10px ui-monospace, monospace";
  ctx.fillText(previewHit ? "INTERSECTION PREDICTED" : "VECTOR MISSES CORE", w * 0.08, h * 0.13);

  const history = app.state.starbinding.history || [];
  history.slice(-12).forEach((item, index) => {
    const alpha = 0.12 + index / Math.max(1, history.slice(-12).length) * 0.18;
    const sy = starY + item.offset_radii * starR * 0.42;
    const a = item.angle_deg * Math.PI / 180;
    ctx.strokeStyle = item.collapsed ? `rgba(255,73,103,${alpha + .12})` : item.hit ? `rgba(255,189,90,${alpha})` : `rgba(100,130,145,${alpha})`;
    ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(startX, sy); ctx.lineTo(startX + Math.cos(a) * length, sy + Math.sin(a) * length); ctx.stroke();
  });
}

function distancePointToLine(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const denom = dx * dx + dy * dy;
  if (!denom) return Math.hypot(px - x1, py - y1);
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / denom, 0, 1);
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function initSiegeControls() {
  ["#siege-singularities", "#siege-nodes", "#siege-capacity"].forEach((selector) => {
    $(selector).addEventListener("input", () => { app.siegePreviewDirty = true; updateSiegeLabels(); drawSiege(); });
  });
  $("#solve-siege").addEventListener("click", async () => {
    const values = siegeValues();
    try {
      await mutate("/api/siege-wall/configure", values);
      app.siegePreviewDirty = false;
      drawSiege();
      if (app.state.siege_wall.fractured) toast(app.state.siege_wall.fracture_reason, true);
      else toast(`Lattice stable. Peak utilization ${(app.state.siege_wall.max_utilization * 100).toFixed(1)}%.`);
    } catch (_) { return; }
  });
  updateSiegeLabels();
}

function siegeValues() {
  return {
    singularities: Number($("#siege-singularities").value),
    nodes: Number($("#siege-nodes").value),
    capacity_m_s2: Number($("#siege-capacity").value) / 1000,
  };
}

function updateSiegeLabels() {
  const v = siegeValues();
  $("#singularity-value").textContent = String(v.singularities);
  $("#node-value").textContent = String(v.nodes);
  $("#capacity-value").textContent = `${v.capacity_m_s2.toFixed(3)} m/s²`;
}

function renderSiegePanel() {
  if (!app.state) return;
  const siege = app.state.siege_wall;
  const chip = $("#siege-status-chip");
  const gauge = $(".utilization-gauge");
  if (!siege) {
    chip.textContent = "UNSOLVED"; chip.classList.remove("failed");
    $("#siege-fracture-label").textContent = "—";
    $("#siege-utilization").style.width = "0%";
    $("#siege-utilization-label").textContent = "0%";
    $("#siege-reason").textContent = "Configure and solve the containment matrix.";
    gauge.classList.remove("fractured");
    return;
  }
  if (siege.fractured) {
    chip.textContent = "FRACTURED"; chip.classList.add("failed");
    $("#siege-fracture-label").textContent = "CAPACITY FAILURE";
    $("#siege-utilization").style.width = "100%";
    $("#siege-utilization-label").textContent = "> 100%";
    $("#siege-reason").textContent = siege.fracture_reason;
    gauge.classList.add("fractured");
  } else {
    chip.textContent = "STABLE"; chip.classList.remove("failed");
    $("#siege-fracture-label").textContent = "CONTAINED";
    const u = siege.max_utilization || 0;
    $("#siege-utilization").style.width = `${clamp(u * 100, 0, 100)}%`;
    $("#siege-utilization-label").textContent = `${(u * 100).toFixed(1)}%`;
    $("#siege-reason").textContent = `${siege.singularities.length} heliocide singularities anchored across ${siege.nodes.length} orbital nodes.`;
    gauge.classList.remove("fractured");
  }
}

function drawSiege() {
  if (!app.state) return;
  const canvas = $("#siege-canvas");
  const { ctx, w, h } = canvasContext(canvas);
  drawSpace(ctx, w, h, 120);
  const cx = w * 0.5, cy = h * 0.5, radius = Math.min(w, h) * 0.39;
  let siege = app.state.siege_wall;
  if (!siege || app.siegePreviewDirty) siege = syntheticSiegePreview();
  const fractured = Boolean(siege.fractured);

  ctx.strokeStyle = fractured ? "rgba(255,73,103,.22)" : "rgba(75,217,255,.16)";
  ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, radius * .25, 0, Math.PI * 2); ctx.stroke();

  const nodes = siege.nodes || [];
  const holes = siege.singularities || [];
  holes.forEach((hole) => {
    nodes.forEach((node) => {
      const hx = cx + hole.x * radius, hy = cy + hole.y * radius;
      const nx = cx + node.x * radius, ny = cy + node.y * radius;
      ctx.strokeStyle = fractured ? "rgba(255,73,103,.045)" : "rgba(75,217,255,.045)";
      ctx.lineWidth = .7; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(nx, ny); ctx.stroke();
    });
  });

  holes.forEach((hole, index) => {
    const x = cx + hole.x * radius, y = cy + hole.y * radius;
    const glow = ctx.createRadialGradient(x, y, 1, x, y, 15);
    glow.addColorStop(0, "rgba(0,0,0,1)"); glow.addColorStop(.34, "rgba(0,0,0,1)"); glow.addColorStop(.48, "rgba(255,106,72,.62)"); glow.addColorStop(.58, "rgba(255,73,103,.15)"); glow.addColorStop(1, "rgba(255,73,103,0)");
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, 15, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(255,143,102,.35)"; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.stroke();
    if (index === 0) { ctx.fillStyle = "rgba(255,165,137,.7)"; ctx.font = "8px ui-monospace, monospace"; ctx.fillText("HELIOCIDE SINGULARITIES", x + 12, y - 10); }
  });

  nodes.forEach((node, index) => {
    const x = cx + node.x * radius, y = cy + node.y * radius;
    const u = node.utilization ?? 0;
    const danger = fractured || u > .85;
    ctx.fillStyle = danger ? "rgba(255,73,103,.9)" : u > .6 ? "rgba(255,189,90,.9)" : "rgba(75,217,255,.9)";
    ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = danger ? "rgba(255,73,103,.22)" : "rgba(75,217,255,.18)"; ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.stroke();
    if (index % Math.max(1, Math.floor(nodes.length / 8)) === 0) {
      ctx.fillStyle = "rgba(113,143,157,.55)"; ctx.font = "7px ui-monospace, monospace"; ctx.fillText(node.id || `NODE-${index}`, x + 8, y + 3);
    }
  });

  ctx.textAlign = "center";
  ctx.font = "700 11px ui-monospace, monospace";
  ctx.fillStyle = fractured ? "rgba(255,73,103,.8)" : "rgba(75,217,255,.68)";
  ctx.fillText(fractured ? "CONTAINMENT FRACTURE" : (app.siegePreviewDirty ? "UNSOLVED GEOMETRY" : "SIEGE WALL STABLE"), cx, cy + 4);
  ctx.textAlign = "start";
}

function syntheticSiegePreview() {
  const v = siegeValues();
  return {
    fractured: false,
    singularities: Array.from({ length: v.singularities }, (_, i) => {
      const a = Math.PI * 2 * i / v.singularities;
      return { id: `BH-${i}`, x: .25 * Math.cos(a), y: .25 * Math.sin(a) };
    }),
    nodes: Array.from({ length: v.nodes }, (_, i) => {
      const a = Math.PI * 2 * i / v.nodes;
      return { id: `NODE-${i}`, x: Math.cos(a), y: Math.sin(a), utilization: null };
    }),
  };
}

function initTelemetryControls() {
  $$("#telemetry-filter button").forEach((button) => {
    button.addEventListener("click", () => {
      app.telemetryFilter = button.dataset.filter;
      $$("#telemetry-filter button").forEach((node) => node.classList.toggle("active", node === button));
      renderTelemetry();
    });
  });
}

function renderTelemetry() {
  if (!app.state) return;
  const events = app.state.telemetry || [];
  const filtered = app.telemetryFilter === "all" ? events : events.filter((event) => event.kind === app.telemetryFilter);
  $("#telemetry-count").textContent = `${filtered.length} EVENT${filtered.length === 1 ? "" : "S"}`;
  $("#telemetry-list").innerHTML = filtered.length
    ? [...filtered].reverse().map((event) => `<div class="telemetry-row kind-${escapeHtml(event.kind)}"><div class="seq">#${String(event.sequence).padStart(4, "0")}</div><div class="kind">${escapeHtml(event.kind)}</div><div class="message">${escapeHtml(event.message)}</div><div class="payload">${escapeHtml(JSON.stringify(event.data))}</div></div>`).join("")
    : `<div class="empty-state large">No matching state mutations.</div>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[ch]));
}

async function init() {
  initNavigation();
  initPlanetControls();
  initMacroControls();
  initStarbindingControls();
  initSiegeControls();
  initTelemetryControls();
  window.addEventListener("resize", () => requestAnimationFrame(drawActiveCanvases));
  try {
    app.state = await api("/api/state");
    app.siegePreviewDirty = !app.state.siege_wall;
    renderAll();
  } catch (error) {
    toast(`Laboratory backend unavailable: ${error.message}`, true);
  }
}

init();

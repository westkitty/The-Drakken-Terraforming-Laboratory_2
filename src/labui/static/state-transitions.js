"use strict";

/* State Transition Director
   Visualizes state changes already committed by the deterministic backend.
   It owns no simulation variables and never fabricates an authoritative result. */
(() => {
  const fx = { effects: [], canvases: new Map(), lastTransition: "NOMINAL" };
  const now = () => performance.now();
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
  const easeInOut = (t) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  function installRoot() {
    if (!document.querySelector("#cc-transition-root")) {
      document.body.insertAdjacentHTML("beforeend", `<div id="cc-transition-root" aria-hidden="true"><div class="cc-transition-vignette"></div><div class="cc-transition-grid"></div><div class="cc-transition-scan"></div><div class="cc-transition-flash"></div><div class="cc-null-bars"><i></i><i></i><i></i><i></i><i></i></div><div class="cc-event-feed"></div></div>`);
    }
    const status = document.querySelector(".topbar-status");
    if (status && !document.querySelector(".cc-transition-readout")) status.insertAdjacentHTML("afterbegin", `<div class="cc-transition-readout"><i></i><span>TRANSITION<strong>NOMINAL</strong></span></div>`);
  }

  function installCanvas(selector, key) {
    const base = document.querySelector(selector), wrap = base?.parentElement;
    if (!base || !wrap || fx.canvases.has(key)) return;
    const canvas = document.createElement("canvas"); canvas.className = "cc-state-fx"; canvas.dataset.fxStage = key; canvas.setAttribute("aria-hidden", "true"); wrap.appendChild(canvas); fx.canvases.set(key, canvas);
  }
  function installCanvases() { installCanvas("#planet-canvas", "planet"); installCanvas("#incubator-canvas", "incubator"); installCanvas("#starbinding-canvas", "starbinding"); installCanvas("#siege-canvas", "siege"); }

  function setReadout(text, tone = "teal") {
    fx.lastTransition = text;
    const node = document.querySelector(".cc-transition-readout strong"), dot = document.querySelector(".cc-transition-readout i");
    if (node) node.textContent = text;
    if (dot) { const colors = { red: "#ff435f", orange: "#ff7b37", violet: "#c178ff", cyan: "#35e8ff", teal: "#35f0c3" }; const c = colors[tone] || colors.teal; dot.style.background = c; dot.style.boxShadow = `0 0 12px ${c}`; }
  }
  function announce(code, title, detail, tone = "cyan") {
    setReadout(code, tone); const feed = document.querySelector(".cc-event-feed"); if (!feed) return;
    const card = document.createElement("div"); card.className = "cc-transition-card"; card.dataset.tone = tone; card.innerHTML = `<b>${escapeHtml(code)}</b><strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span>`; feed.prepend(card); while (feed.children.length > 2) feed.lastElementChild?.remove(); setTimeout(() => card.remove(), 3900);
  }
  function pulseBody(className, duration) { document.body.classList.remove(className); void document.body.offsetWidth; document.body.classList.add(className); setTimeout(() => document.body.classList.remove(className), duration); }
  function syncPersistentState() { if (!app.state) return; document.body.classList.toggle("cc-state-inert", Boolean(app.state.inert)); document.body.classList.toggle("cc-state-collapsed", app.state.star?.state === "collapsed"); document.body.classList.toggle("cc-state-fractured", Boolean(app.state.siege_wall?.fractured)); }

  function snapshot(state) {
    if (!state) return null; const specimen = state.specimens?.active, history = state.starbinding?.history || [];
    return { revision: state.revision, inert: Boolean(state.inert), planetHash: state.planet?.state_hash, starState: state.star?.state, bond: Number(state.star?.bond_index ?? 1), helio: state.star?.heliocide_event?.event_id || null, macroCursor: Number(state.macro?.cursor || 0), diveCount: history.length, lastDive: history.length ? history[history.length - 1] : null, siegeExists: Boolean(state.siege_wall), siegeFractured: Boolean(state.siege_wall?.fractured), siegeUtilization: Number(state.siege_wall?.max_utilization || 0), specimenId: specimen?.specimen_id || null, specimenActive: Boolean(specimen?.active), specimenField: specimen?.field_state || null, specimenPulses: Number(specimen?.pulses || 0), specimenProfile: specimen?.profile_id || null, specimenPosition: specimen?.position ? { ...specimen.position } : null };
  }

  function addEffect(stage, kind, data = {}, duration = 1400) { fx.effects.push({ stage, kind, data, start: now(), duration }); }
  function projectCell(row, col, stage, canvas) {
    if (!app.state || row == null || col == null) return null; const rect = canvas.getBoundingClientRect(), radius = Math.min(rect.width, rect.height) * .395, cx = rect.width * .5, cy = rect.height * .49;
    const lat = ((Number(row) / (app.state.planet.rows - 1)) * Math.PI) - Math.PI / 2, lon = ((Number(col) / app.state.planet.cols) * Math.PI * 2) - Math.PI; let x, z;
    if (stage === "incubator") { const rlon = lon - app.specimenRotation; x = Math.cos(lat) * Math.sin(rlon); z = Math.cos(lat) * Math.cos(rlon); }
    else { const rlon = lon - app.planetRotation; x = Math.cos(lat) * Math.cos(rlon); z = Math.cos(lat) * Math.sin(rlon); }
    if (z < -.04) return null; return { x: cx + x * radius, y: cy - Math.sin(lat) * radius, z, radius, cx, cy };
  }
  function sizeCanvas(canvas) { const rect = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2), w = Math.max(1, Math.round(rect.width * dpr)), h = Math.max(1, Math.round(rect.height * dpr)); if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; } const ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, rect.width, rect.height); return { ctx, w: rect.width, h: rect.height }; }
  function colorFor(kind) { return ({ heat: "255,105,48", cool: "102,225,255", uplift: "53,240,195", fracture: "255,69,55", pressure: "71,185,255", co2: "103,255,159", thermal: "255,105,48", elevation: "53,240,195", stress: "255,69,55", atmosphere: "71,185,255", specimen: "53,240,195" })[kind] || "53,232,255"; }

  function drawPlanetBurst(ctx, effect, canvas, stage, t) {
    const p = projectCell(effect.data.row, effect.data.col, stage, canvas); if (!p) return; const q = easeOut(t), inv = 1 - t, kind = effect.data.visual || effect.kind, rgb = colorFor(kind); ctx.save(); ctx.globalCompositeOperation = "screen";
    if (kind === "fracture" || kind === "stress") { ctx.strokeStyle = `rgba(${rgb},${.85 * inv})`; ctx.shadowBlur = 12; ctx.shadowColor = `rgb(${rgb})`; ctx.lineWidth = 1.2; for (let i = 0; i < 7; i += 1) { const a = i * Math.PI * 2 / 7 + .31; ctx.beginPath(); ctx.moveTo(p.x, p.y); for (let s = 1; s <= 5; s += 1) { const d = q * (12 + s * 10), x = p.x + Math.cos(a + Math.sin(i * 5 + s) * .12) * d, y = p.y + Math.sin(a + Math.cos(i * 3 + s) * .12) * d; ctx.lineTo(x, y); } ctx.stroke(); } }
    else if (kind === "uplift" || kind === "elevation") { ctx.strokeStyle = `rgba(${rgb},${.8 * inv})`; ctx.shadowBlur = 10; ctx.shadowColor = `rgb(${rgb})`; for (let ring = 1; ring <= 5; ring += 1) { const r = q * ring * 11; ctx.beginPath(); for (let side = 0; side < 6; side += 1) { const a = side * Math.PI / 3, x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r * .7; if (side === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.closePath(); ctx.stroke(); } }
    else if (kind === "cool") { ctx.strokeStyle = `rgba(${rgb},${.9 * inv})`; ctx.shadowBlur = 13; ctx.shadowColor = `rgb(${rgb})`; for (let i = 0; i < 3; i += 1) { const r = q * (22 + i * 22); ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke(); } }
    else if (kind === "pressure" || kind === "atmosphere") { ctx.strokeStyle = `rgba(${rgb},${.75 * inv})`; ctx.shadowBlur = 9; ctx.shadowColor = `rgb(${rgb})`; for (let i = 0; i < 4; i += 1) { const r = q * (20 + i * 20); ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * .42, .2, 0, Math.PI * 2); ctx.stroke(); } }
    else if (kind === "co2") { ctx.fillStyle = `rgba(${rgb},${.07 * inv})`; ctx.strokeStyle = `rgba(${rgb},${.55 * inv})`; ctx.shadowBlur = 14; ctx.shadowColor = `rgb(${rgb})`; for (let i = 0; i < 9; i += 1) { const a = i * 2.399 + t * 2, r = q * (16 + (i % 4) * 14); ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * .55, 7 + i % 3 * 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); } }
    else { const radius = q * 68, bloom = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, Math.max(1, radius)); bloom.addColorStop(0, `rgba(255,245,220,${.82 * inv})`); bloom.addColorStop(.18, `rgba(${rgb},${.65 * inv})`); bloom.addColorStop(1, `rgba(${rgb},0)`); ctx.fillStyle = bloom; ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = `rgba(${rgb},${.85 * inv})`; ctx.beginPath(); ctx.arc(p.x, p.y, radius * .82, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  }

  function drawSpecimenPulse(ctx, effect, canvas, stage, t) {
    const p = projectCell(effect.data.row, effect.data.col, stage, canvas); if (!p) return; const profile = effect.data.profile || "experimental_egg", q = easeOut(t), inv = 1 - t; ctx.save(); ctx.globalCompositeOperation = "screen";
    if (profile === "fault_tongue") { ctx.strokeStyle = `rgba(255,120,56,${.82 * inv})`; ctx.shadowBlur = 12; ctx.shadowColor = "#ff7838"; for (let arm = 0; arm < 6; arm += 1) { const a = arm * Math.PI / 3; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(a) * q * 76, p.y + Math.sin(a) * q * 58); ctx.stroke(); } }
    else if (profile === "obsidian_gul") { const grad = ctx.createLinearGradient(p.x - 90 * q, p.y + 28, p.x, p.y); grad.addColorStop(0, "rgba(255,61,20,0)"); grad.addColorStop(1, `rgba(255,109,54,${.78 * inv})`); ctx.strokeStyle = grad; ctx.lineWidth = 5; ctx.shadowBlur = 18; ctx.shadowColor = "#ff5a2b"; ctx.beginPath(); ctx.moveTo(p.x - 95 * q, p.y + 30); ctx.bezierCurveTo(p.x - 56 * q, p.y - 26, p.x - 18, p.y - 18, p.x, p.y); ctx.stroke(); }
    else if (profile === "tremorhound") { ctx.strokeStyle = `rgba(193,120,255,${.78 * inv})`; ctx.shadowBlur = 12; ctx.shadowColor = "#c178ff"; for (let i = 0; i < 4; i += 1) { ctx.beginPath(); ctx.arc(p.x, p.y, q * (18 + i * 19), 0, Math.PI * 2); ctx.stroke(); } }
    else if (profile === "vortenbray") { ctx.strokeStyle = `rgba(102,225,255,${.76 * inv})`; ctx.shadowBlur = 13; ctx.shadowColor = "#66e1ff"; for (let i = 0; i < 6; i += 1) { const a = i * Math.PI / 3 + t * .8; ctx.beginPath(); ctx.ellipse(p.x + Math.cos(a) * q * 24, p.y + Math.sin(a) * q * 16, q * 34, q * 13, a, 0, Math.PI * 2); ctx.stroke(); } }
    else { ctx.strokeStyle = `rgba(53,240,195,${.78 * inv})`; ctx.shadowBlur = 12; ctx.shadowColor = "#35f0c3"; for (let i = 0; i < 4; i += 1) { ctx.beginPath(); ctx.ellipse(p.x, p.y, q * (24 + i * 14), q * (9 + i * 6), t * 1.4 + i * .5, 0, Math.PI * 2); ctx.stroke(); } }
    ctx.restore();
  }

  function drawStarbinding(ctx, effect, w, h, t) { const q = easeInOut(t), inv = 1 - t, cy = h * .5, hit = Boolean(effect.data.hit), collapsed = Boolean(effect.data.collapsed); ctx.save(); ctx.globalCompositeOperation = "screen"; const beamColor = collapsed ? "255,111,47" : hit ? "53,240,195" : "53,232,255"; ctx.strokeStyle = `rgba(${beamColor},${.9 * Math.min(1, t * 3)})`; ctx.shadowBlur = 18; ctx.shadowColor = `rgb(${beamColor})`; ctx.lineWidth = 2; const targetX = w * (hit ? .66 : .88), targetY = cy + Number(effect.data.offset_radii || 0) * 7; ctx.beginPath(); ctx.moveTo(w * .06, cy); ctx.lineTo(lerp(w * .06, targetX, q), lerp(cy, targetY, q)); ctx.stroke(); if (t > .52) { const iq = easeOut((t - .52) / .48); ctx.strokeStyle = `rgba(${beamColor},${.75 * (1 - iq)})`; ctx.beginPath(); ctx.arc(targetX, targetY, iq * (collapsed ? 92 : 45), 0, Math.PI * 2); ctx.stroke(); if (collapsed) { ctx.fillStyle = `rgba(0,0,0,${Math.min(1, iq * 1.4)})`; ctx.shadowColor = "#fff"; ctx.shadowBlur = 22; ctx.beginPath(); ctx.arc(targetX, targetY, iq * 28, 0, Math.PI * 2); ctx.fill(); } } if (!hit && t > .55) { ctx.fillStyle = `rgba(53,232,255,${.65 * inv})`; ctx.font = "700 11px ui-monospace, monospace"; ctx.fillText("VECTOR MISSED CORE", w * .55, h * .18); } ctx.restore(); }
  function drawSiege(ctx, effect, w, h, t) { const q = easeOut(t), inv = 1 - t, cx = w * .5, cy = h * .5, fractured = effect.kind === "latticeFracture"; ctx.save(); ctx.globalCompositeOperation = "screen"; ctx.translate(cx, cy); ctx.strokeStyle = fractured ? `rgba(255,67,95,${.8 * inv})` : `rgba(53,240,195,${.7 * inv})`; ctx.shadowBlur = 16; ctx.shadowColor = fractured ? "#ff435f" : "#35f0c3"; for (let ring = 1; ring <= 5; ring += 1) { ctx.lineWidth = ring === 5 ? 2 : 1; ctx.beginPath(); ctx.ellipse(0, 0, q * ring * 53, q * ring * 28, ring * .17, 0, Math.PI * 2); ctx.stroke(); } if (fractured) for (let arm = 0; arm < 9; arm += 1) { const a = arm * 2.399; ctx.beginPath(); ctx.moveTo(0, 0); const d = q * Math.min(w, h) * .45; ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d); ctx.stroke(); } ctx.restore(); }
  function drawSolverSweep(ctx, w, h, t) { const y = lerp(h * .08, h * .92, t); ctx.save(); ctx.globalCompositeOperation = "screen"; const grad = ctx.createLinearGradient(0, y - 10, 0, y + 10); grad.addColorStop(0, "rgba(53,232,255,0)"); grad.addColorStop(.5, `rgba(53,232,255,${.32 * (1 - t)})`); grad.addColorStop(1, "rgba(53,232,255,0)"); ctx.fillStyle = grad; ctx.fillRect(0, y - 10, w, 20); ctx.restore(); }

  function drawAmbientField(ctx, canvas, stage, time, w, h) {
    if ((stage !== "planet" && stage !== "incubator") || !app.state) return;
    const radius = Math.min(w, h) * .395, cx = w * .5, cy = h * .49, bond = Number(app.state.star?.bond_index ?? 1);
    // Hidden stations have a zero-sized canvas. Do not feed a zero-radius stage
    // into modulo/gradient math: browsers correctly reject the resulting NaN.
    if (!Number.isFinite(radius) || radius <= 1 || !Number.isFinite(cx) || !Number.isFinite(cy)) return;
    ctx.save(); ctx.globalCompositeOperation = "screen"; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.clip();
    if (!app.state.inert && bond > 0) { ctx.lineWidth = 1.1; ctx.setLineDash([2, 7]); ctx.lineDashOffset = -(time * .018) % 18; ctx.shadowBlur = 8; ctx.shadowColor = "#35e8ff"; for (let i = 0; i < 5; i += 1) { const y = cy - radius * .62 + i * radius * .31, warp = Math.sin(time * .0007 + i * 1.71) * radius * .12; ctx.strokeStyle = `rgba(53,232,255,${.07 + .08 * bond})`; ctx.beginPath(); ctx.moveTo(cx - radius * .92, y); ctx.bezierCurveTo(cx - radius * .42, y + warp, cx + radius * .28, y - warp, cx + radius * .92, y + warp * .15); ctx.stroke(); } ctx.setLineDash([]); }
    const scanY = cy - radius + ((time * .035) % (radius * 2)); const grad = ctx.createLinearGradient(cx - radius, scanY, cx + radius, scanY); grad.addColorStop(0, "rgba(53,232,255,0)"); grad.addColorStop(.5, app.state.inert ? "rgba(255,67,95,.07)" : "rgba(53,232,255,.09)"); grad.addColorStop(1, "rgba(53,232,255,0)"); ctx.fillStyle = grad; ctx.fillRect(cx - radius, scanY - 1, radius * 2, 2); ctx.restore();
  }

  function renderEffects(time) { fx.effects = fx.effects.filter((effect) => time - effect.start < effect.duration + 30); for (const [stage, canvas] of fx.canvases) { const { ctx, w, h } = sizeCanvas(canvas); drawAmbientField(ctx, canvas, stage, time, w, h); for (const effect of fx.effects) { if (effect.stage !== stage) continue; const t = Math.min(1, Math.max(0, (time - effect.start) / effect.duration)); if (stage === "planet" || stage === "incubator") { if (effect.kind === "specimenPulse") drawSpecimenPulse(ctx, effect, canvas, stage, t); else if (effect.kind === "solver") drawSolverSweep(ctx, w, h, t); else drawPlanetBurst(ctx, effect, canvas, stage, t); } else if (stage === "starbinding") drawStarbinding(ctx, effect, w, h, t); else if (stage === "siege") drawSiege(ctx, effect, w, h, t); } } requestAnimationFrame(renderEffects); }

  function emissionEffect(emission) { if (!emission || !Array.isArray(emission.args)) return null; const channel = String(emission.channel || ""), args = emission.args; let row, col, visual; if (channel === "THERMAL_ENERGY") { row = Number(args[1]); col = Number(args[2]); visual = Number(args[3]) < 0 ? "cool" : "thermal"; } else if (channel === "LITHO_ELEVATION") { row = Number(args[1]); col = Number(args[2]); visual = "elevation"; } else if (channel === "LITHO_STRESS") { row = Number(args[1]); col = Number(args[2]); visual = "stress"; } else if (channel === "ATMOS_PRESSURE") { row = Number(args[1]); col = Number(args[2]); visual = "atmosphere"; } else if (channel === "ATMOS_GAS") { row = Number(args[2]); col = Number(args[3]); visual = "co2"; } else return null; return Number.isFinite(row) && Number.isFinite(col) ? { row, col, visual } : null; }

  function transitions(before, after, path, body) {
    if (!after) return; syncPersistentState(); if (path === "/api/reset") { const feed = document.querySelector(".cc-event-feed"); if (feed) feed.innerHTML = ""; }
    if (before && !before.inert && after.inert) { pulseBody("cc-fx-nullification", 2100); announce("ABSOLUTE NULLIFICATION", "Syrin exception seized runtime", "Active Starsilk threads are inert. Physical simulation remains; Starsilk execution does not.", "red"); }
    else if (before?.inert && !after.inert) { pulseBody("cc-fx-restored", 1600); announce("RUNTIME RECONSTITUTED", "Deterministic baseline restored", "New Starsilk runtime established from full laboratory reset.", "teal"); }
    if (before && before.starState !== "collapsed" && after.starState === "collapsed") { pulseBody("cc-fx-heliocide", 1900); announce("HELIOCIDE", "Stellar core crossed the hard zero boundary", after.helio ? `${after.helio} // black-hole state transition committed.` : "Black-hole state transition committed.", "orange"); }
    if (path === "/api/planet/brush") { const data = { row: Number(body.row), col: Number(body.col), visual: String(body.tool || "heat") }; addEffect("planet", data.visual, data, 1450); announce("PLANETARY COMMIT", `${String(body.tool || "FIELD").toUpperCase()} intervention`, `Cell ${body.row} / ${body.col} // intensity ${body.intensity} // radius ${body.radius}`, data.visual === "fracture" ? "orange" : "cyan"); }
    else if (path === "/api/planet/step") { addEffect("planet", "solver", {}, 850); announce("SOLVER STEP", "Coupled planetary state advanced", `Δt ${body.seconds ?? 1} s // atmosphere · lithosphere · thermal`, "cyan"); }
    if (before && after.macroCursor > before.macroCursor) { pulseBody("cc-fx-macro-commit", 800); const result = app.state.macro?.last_result, emissions = result?.emissions || []; for (const emission of emissions) { const data = emissionEffect(emission); if (!data) continue; addEffect("planet", data.visual, data, 1350); addEffect("incubator", data.visual, data, 1350); } const channel = emissions[0]?.channel || (result?.stellar_events?.length ? "STELLAR WITHDRAWAL" : "REGISTER MUTATION"); announce("REALITY LOOP COMMIT", channel.replaceAll("_", " "), `Instruction ${after.macroCursor} / ${app.state.macro?.total || after.macroCursor} committed to authoritative state.`, emissions.length ? "teal" : "cyan"); }
    if (after.diveCount > (before?.diveCount || 0) && after.lastDive) { addEffect("starbinding", "dive", after.lastDive, after.lastDive.collapsed ? 1900 : 1300); const title = after.lastDive.collapsed ? "Core intersection → heliocide" : after.lastDive.hit ? "Core intersection confirmed" : "Vector passed outside core"; announce("STARBINDING VECTOR", title, `Offset ${Number(after.lastDive.offset_radii).toFixed(2)} R // withdrawal ${(Number(after.lastDive.withdrawal_fraction) * 100).toFixed(0)}%`, after.lastDive.collapsed ? "orange" : after.lastDive.hit ? "teal" : "cyan"); }
    if (after.siegeExists && !before?.siegeExists) { addEffect("siege", after.siegeFractured ? "latticeFracture" : "latticeLock", {}, 1600); if (after.siegeFractured) pulseBody("cc-fx-lattice-fracture", 1300); announce(after.siegeFractured ? "LATTICE FRACTURE" : "LATTICE LOCK", after.siegeFractured ? "Containment matrix rejected" : "Singularity matrix stabilized", after.siegeFractured ? (app.state.siege_wall?.fracture_reason || "Capacity boundary exceeded.") : `Maximum utilization ${(after.siegeUtilization * 100).toFixed(2)}%`, after.siegeFractured ? "red" : "teal"); }
    else if (before && !before.siegeFractured && after.siegeFractured) { addEffect("siege", "latticeFracture", {}, 1800); pulseBody("cc-fx-lattice-fracture", 1300); announce("CONTAINMENT FRACTURE", "Siege Wall node capacity failed", app.state.siege_wall?.fracture_reason || "Anchoring matrix crossed a hard fracture boundary.", "red"); }
    else if (before?.siegeFractured && !after.siegeFractured && after.siegeExists) { addEffect("siege", "latticeLock", {}, 1500); announce("CONTAINMENT RECOVERED", "Siege Wall matrix stabilized", `Maximum utilization ${(after.siegeUtilization * 100).toFixed(2)}%`, "teal"); }
    if (after.specimenId && after.specimenId !== before?.specimenId) { pulseBody("cc-fx-hatch", 1500); const specimen = app.state.specimens?.active; addEffect("incubator", "specimenPulse", { row: specimen?.position?.row, col: specimen?.position?.col, profile: after.specimenProfile }, 1700); announce("NOTEBOOK HATCH", `${specimen?.name || "Specimen"} field instantiated`, `${after.specimenId} // shared planetary solver linked.`, after.specimenProfile === "experimental_egg" ? "teal" : "orange"); }
    if (after.specimenPulses > (before?.specimenPulses || 0) && after.specimenPosition) { const data = { row: after.specimenPosition.row, col: after.specimenPosition.col, profile: after.specimenProfile }; addEffect("incubator", "specimenPulse", data, 1050); addEffect("planet", "specimenPulse", data, 1050); if ((after.specimenPulses % 6) === 0 || after.specimenPulses === 1) announce("NOTEBOOK PULSE", `${String(after.specimenProfile || "SPECIMEN").replaceAll("_", " ").toUpperCase()} // pulse ${String(after.specimenPulses).padStart(3, "0")}`, `Planet cell ${after.specimenPosition.row} / ${after.specimenPosition.col} mutated in shared state.`, after.specimenProfile === "tremorhound" ? "violet" : "teal"); }
    if (before?.specimenActive && !after.specimenActive && after.specimenField === "terminated") announce("FIELD TERMINATED", "Notebook program closed", `${after.specimenId || "Specimen"} remains in history; active field emission stopped.`, "orange");
  }

  function wrapMutationPipeline() { if (mutate._ccTransitionWrapped) return; const originalMutate = mutate; const wrapped = async function transitionAwareMutate(path, body = {}) { const before = snapshot(app.state), result = await originalMutate(path, body), after = snapshot(app.state); transitions(before, after, path, body || {}); return result; }; wrapped._ccTransitionWrapped = true; mutate = wrapped; }
  function wrapRenderPipeline() { const originalRenderAll = renderAll; renderAll = function transitionAwareRenderAll() { originalRenderAll(); syncPersistentState(); }; }
  function init() { installRoot(); installCanvases(); wrapMutationPipeline(); wrapRenderPipeline(); syncPersistentState(); requestAnimationFrame(renderEffects); }
  init();
})();

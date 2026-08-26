"use strict";

(() => {
  Object.assign(app, {
    specimenProfile: "fault_tongue",
    specimenTarget: { row: 18, col: 36 },
    specimenRotation: 0.45,
    specimenDrag: null,
    specimenRunning: false,
  });

  const navSpacer = $(".nav-spacer");
  navSpacer.insertAdjacentHTML("beforebegin", `
    <button class="nav-button" data-view="incubator" title="Drakken specimen incubator">
      <span class="nav-icon specimen-icon">⬡</span><span>Incubator</span>
    </button>`);

  const telemetryView = $("#view-telemetry");
  $(".eyebrow", telemetryView).textContent = "STATION 06";
  telemetryView.insertAdjacentHTML("beforebegin", `
    <section class="lab-view" id="view-incubator" data-view-panel="incubator">
      <div class="view-heading">
        <div>
          <div class="eyebrow">STATION 05 // NOTEBOOK PROGRAM</div>
          <h2>Drakken Egg & Specimen Incubator</h2>
          <p>Hatch a deterministic Drakken phenotype into the live planetary solver, then watch its Notebook field rewrite the world.</p>
        </div>
        <div class="runtime-chip" id="specimen-field-chip">NO SPECIMEN</div>
      </div>
      <div class="incubator-layout">
        <aside class="instrument-stack incubator-library">
          <section class="instrument-card">
            <div class="instrument-header"><span>PHENOTYPE ARCHIVE</span><span>CANON-ANCHORED MODELS</span></div>
            <div class="specimen-picker" id="specimen-picker"></div>
          </section>
          <section class="instrument-card">
            <div class="instrument-header"><span>NOTEBOOK PARAMETERS</span><span id="phenotype-lock">LOCKED</span></div>
            <div class="phenotype-controls" id="phenotype-controls">
              <label>Thermal <strong data-value="thermal">+0.35</strong><input data-phenotype="thermal" type="range" min="-100" max="100" value="35"></label>
              <label>Elevation <strong data-value="elevation">+0.35</strong><input data-phenotype="elevation" type="range" min="-100" max="100" value="35"></label>
              <label>Stress <strong data-value="stress">+0.35</strong><input data-phenotype="stress" type="range" min="-100" max="100" value="35"></label>
              <label>Pressure <strong data-value="pressure">+0.20</strong><input data-phenotype="pressure" type="range" min="-100" max="100" value="20"></label>
              <label>CO₂ <strong data-value="co2">+0.15</strong><input data-phenotype="co2" type="range" min="0" max="100" value="15"></label>
            </div>
            <p class="microcopy">Archive profiles are locked laboratory interpretations. Experimental Egg is tunable and explicitly non-canon.</p>
          </section>
        </aside>

        <section class="visual-card incubator-stage-card">
          <div class="card-chrome"><div><span class="chrome-dot live"></span> INCUBATION FIELD // SHARED PLANET</div><div id="specimen-position">TARGET 18 / 36</div></div>
          <div class="canvas-wrap incubator-canvas-wrap">
            <canvas id="incubator-canvas" aria-label="Drakken specimen planetary field"></canvas>
            <div class="canvas-hud top-left"><span>CLICK</span> hatch target &nbsp;·&nbsp; <span>DRAG</span> rotate</div>
            <div class="canvas-hud bottom-left" id="specimen-canvas-status">NO ACTIVE FIELD</div>
            <div class="canvas-hud bottom-right" id="specimen-pulse-readout">PULSE 000</div>
          </div>
          <div class="incubator-commandbar">
            <button class="primary-button" id="specimen-hatch">Hatch selected phenotype</button>
            <button class="ghost-button" id="specimen-pulse">Pulse +1</button>
            <button class="ghost-button" id="specimen-run">Run 24</button>
            <button class="ghost-button" id="specimen-pause">Pause</button>
            <button class="danger-outline" id="specimen-terminate">Terminate field</button>
          </div>
        </section>

        <aside class="instrument-stack incubator-dossier">
          <section class="instrument-card specimen-dossier-card">
            <div class="instrument-header"><span>SPECIMEN DOSSIER</span><span id="specimen-class">—</span></div>
            <h3 id="specimen-name">Select a phenotype</h3>
            <p id="specimen-behavior" class="specimen-behavior">—</p>
            <div class="archive-note" id="specimen-archive-note">Archive evidence appears here.</div>
          </section>
          <section class="instrument-card">
            <div class="instrument-header"><span>FIELD CONSEQUENCES</span><span id="specimen-id">—</span></div>
            <div class="metric-grid specimen-metrics">
              <div><span>Pulses</span><strong id="specimen-pulses">0</strong></div>
              <div><span>Trail</span><strong id="specimen-trail">0</strong></div>
              <div><span>Thermal</span><strong id="specimen-thermal">0 J</strong></div>
              <div><span>Elevation</span><strong id="specimen-elevation">0 m</strong></div>
              <div><span>Stress</span><strong id="specimen-stress">0 Pa</strong></div>
              <div><span>Pressure</span><strong id="specimen-pressure">0 Pa</strong></div>
            </div>
          </section>
          <section class="instrument-card specimen-boundary-card">
            <div class="instrument-header"><span>MODEL BOUNDARY</span><span>NO INVENTED BIOLOGY</span></div>
            <p id="specimen-status-note">Named incident behavior is canon-anchored. Numerical strength and movement are deterministic laboratory coefficients.</p>
          </section>
        </aside>
      </div>
    </section>`);

  const filter = $("#telemetry-filter");
  if (filter) filter.insertAdjacentHTML("beforeend", `<button data-filter="specimen">Specimens</button>`);

  function catalog() { return app.state?.specimens?.catalog || []; }
  function profile() { return catalog().find((item) => item.profile_id === app.specimenProfile) || catalog()[0]; }
  function activeSpecimen() { return app.state?.specimens?.active || null; }

  function initSpecimenNavigation() {
    const button = $('.nav-button[data-view="incubator"]');
    button.addEventListener("click", () => {
      app.view = "incubator";
      $$(".nav-button[data-view]").forEach((item) => item.classList.toggle("active", item === button));
      $$("[data-view-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.viewPanel === app.view));
      requestAnimationFrame(drawIncubator);
    });
  }

  function phenotypePayload() {
    const result = {};
    $$("[data-phenotype]").forEach((input) => { result[input.dataset.phenotype] = Number(input.value) / 100; });
    return result;
  }

  function syncExperimentalControls(selected) {
    const experimental = selected?.profile_id === "experimental_egg";
    $("#phenotype-lock").textContent = experimental ? "TUNABLE // NON-CANON" : "ARCHIVE LOCK";
    $$("[data-phenotype]").forEach((input) => {
      input.disabled = !experimental;
      const key = input.dataset.phenotype;
      const value = experimental ? Number(input.value) / 100 : Number(selected?.phenotype?.[key] ?? 0);
      $(`[data-value="${key}"]`).textContent = `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
    });
  }

  function renderSpecimenPicker() {
    const selected = profile();
    $("#specimen-picker").innerHTML = catalog().map((item) => `
      <button class="specimen-option${item.profile_id === app.specimenProfile ? " active" : ""}" data-profile="${escapeHtml(item.profile_id)}">
        <i style="--specimen-accent:${escapeHtml(item.accent)}"></i><span><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.classification)}</small></span>
      </button>`).join("");
    $$(".specimen-option").forEach((button) => button.addEventListener("click", () => {
      app.specimenProfile = button.dataset.profile;
      renderIncubator();
    }));
    if (!selected) return;
    $("#specimen-name").textContent = selected.name;
    $("#specimen-class").textContent = selected.classification;
    $("#specimen-behavior").textContent = selected.behavior;
    $("#specimen-archive-note").textContent = selected.archive_note;
    syncExperimentalControls(selected);
  }

  function renderIncubator() {
    if (!app.state || !$("#view-incubator")) return;
    renderSpecimenPicker();
    const specimen = activeSpecimen();
    const chip = $("#specimen-field-chip");
    const inert = app.state.inert;
    chip.classList.toggle("failed", inert || specimen?.field_state === "nullified");
    chip.textContent = specimen ? String(specimen.field_state).toUpperCase() : (inert ? "STARSILK INERT" : "NO SPECIMEN");
    $("#specimen-position").textContent = specimen
      ? `CELL ${String(specimen.position.row).padStart(2, "0")} / ${String(specimen.position.col).padStart(2, "0")}`
      : `TARGET ${String(app.specimenTarget.row).padStart(2, "0")} / ${String(app.specimenTarget.col).padStart(2, "0")}`;
    $("#specimen-canvas-status").textContent = specimen ? `${specimen.name.toUpperCase()} // ${String(specimen.field_state).toUpperCase()}` : "NO ACTIVE FIELD";
    $("#specimen-pulse-readout").textContent = `PULSE ${String(specimen?.pulses || 0).padStart(3, "0")}`;
    $("#specimen-id").textContent = specimen?.specimen_id || "—";
    $("#specimen-pulses").textContent = specimen?.pulses || 0;
    $("#specimen-trail").textContent = specimen?.trail?.length || 0;
    $("#specimen-thermal").textContent = specimen ? `${fmt(specimen.effect_totals.thermal_j, 0)} J` : "0 J";
    $("#specimen-elevation").textContent = specimen ? `${fmt(specimen.effect_totals.elevation_m, 1)} m` : "0 m";
    $("#specimen-stress").textContent = specimen ? `${fmt(specimen.effect_totals.stress_pa, 0)} Pa` : "0 Pa";
    $("#specimen-pressure").textContent = specimen ? `${fmt(specimen.effect_totals.pressure_pa, 0)} Pa` : "0 Pa";
    $("#specimen-status-note").textContent = specimen?.status_note || "Named incident behavior is canon-anchored. Numerical strength and movement are deterministic laboratory coefficients.";
    const active = Boolean(specimen?.active) && !inert;
    $("#specimen-hatch").disabled = inert || Boolean(specimen?.active);
    $("#specimen-pulse").disabled = !active;
    $("#specimen-run").disabled = !active;
    $("#specimen-pause").disabled = !app.specimenRunning;
    $("#specimen-terminate").disabled = !specimen;
    requestAnimationFrame(drawIncubator);
  }

  function specimenProjection(row, col, canvas) {
    const rect = canvas.getBoundingClientRect();
    const r = Math.min(rect.width, rect.height) * 0.39;
    const cx = rect.width * 0.5, cy = rect.height * 0.5;
    const lat = ((row / (app.state.planet.rows - 1)) * Math.PI) - Math.PI / 2;
    const lon = ((col / app.state.planet.cols) * Math.PI * 2) - Math.PI;
    const rotated = lon - app.specimenRotation;
    const z = Math.cos(lat) * Math.cos(rotated);
    if (z < 0) return null;
    return { x: cx + Math.cos(lat) * Math.sin(rotated) * r, y: cy - Math.sin(lat) * r, z, r, cx, cy };
  }

  function drawIncubator() {
    if (!app.state || app.view !== "incubator") return;
    const canvas = $("#incubator-canvas");
    const { ctx, w, h } = canvasContext(canvas);
    drawSpace(ctx, w, h, 100);
    const radius = Math.min(w, h) * 0.39, cx = w * 0.5, cy = h * 0.5;
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.clip();
    const maps = app.state.planet.maps;
    for (let row = 0; row < app.state.planet.rows; row += 1) {
      for (let col = 0; col < app.state.planet.cols; col += 1) {
        const p = specimenProjection(row, col, canvas); if (!p) continue;
        const temp = maps.temperature_k[row][col], elev = maps.elevation_m[row][col];
        const t = clamp((temp - 225) / 130, 0, 1), e = clamp((elev + 3000) / 6500, 0, 1);
        ctx.fillStyle = `rgba(${Math.round(18 + 95 * t + 35 * e)},${Math.round(55 + 120 * e)},${Math.round(69 + 120 * (1 - t))},${0.42 + p.z * 0.48})`;
        ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
      }
    }
    ctx.restore();
    const rim = ctx.createRadialGradient(cx - radius * .35, cy - radius * .35, radius * .1, cx, cy, radius * 1.1);
    rim.addColorStop(0, "rgba(80,245,201,.05)"); rim.addColorStop(.75, "rgba(9,19,24,.05)"); rim.addColorStop(1, "rgba(0,0,0,.72)");
    ctx.fillStyle = rim; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(66,245,197,.32)"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();

    const target = specimenProjection(app.specimenTarget.row, app.specimenTarget.col, canvas);
    if (target) {
      ctx.strokeStyle = "rgba(66,245,197,.72)"; ctx.beginPath(); ctx.arc(target.x, target.y, 8, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(target.x - 12, target.y); ctx.lineTo(target.x + 12, target.y); ctx.moveTo(target.x, target.y - 12); ctx.lineTo(target.x, target.y + 12); ctx.stroke();
    }

    const specimen = activeSpecimen();
    if (specimen) {
      const trail = specimen.trail || [];
      ctx.strokeStyle = specimen.field_state === "nullified" ? "rgba(255,73,103,.55)" : "rgba(66,245,197,.48)"; ctx.lineWidth = 2; ctx.beginPath();
      let started = false;
      trail.forEach((point) => { const p = specimenProjection(point.row, point.col, canvas); if (!p) { started = false; return; } if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y); });
      ctx.stroke();
      const pos = specimenProjection(specimen.position.row, specimen.position.col, canvas);
      if (pos) drawFieldSignature(ctx, pos.x, pos.y, specimen, specimen.pulses);
    }
  }

  function drawFieldSignature(ctx, x, y, specimen, pulse) {
    const nullified = specimen.field_state === "nullified";
    const accent = nullified ? "255,73,103" : "66,245,197";
    ctx.save(); ctx.translate(x, y); ctx.strokeStyle = `rgba(${accent},.72)`; ctx.fillStyle = `rgba(${accent},.95)`;
    if (specimen.profile_id === "fault_tongue") {
      for (let arm = 0; arm < 6; arm += 1) { const a = arm * Math.PI / 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 24, Math.sin(a) * 24); ctx.stroke(); }
    } else if (specimen.profile_id === "vortenbray") {
      for (let r = 7; r <= 25; r += 8) { ctx.globalAlpha = 1 - r / 38; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke(); }
    } else if (specimen.profile_id === "tremorhound") {
      ctx.beginPath(); ctx.arc(0, 0, 10 + (pulse % 5) * 4, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 25, 0, Math.PI * 2); ctx.stroke();
    } else if (specimen.profile_id === "obsidian_gul") {
      ctx.beginPath(); ctx.moveTo(-28, 12); ctx.quadraticCurveTo(-8, -18, 0, 0); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.ellipse(0, 0, 28, 18, pulse * .08, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }

  function pointToCell(event, canvas) {
    const rect = canvas.getBoundingClientRect(), radius = Math.min(rect.width, rect.height) * .39, cx = rect.width * .5, cy = rect.height * .5;
    const sx = (event.clientX - rect.left - cx) / radius, sy = -(event.clientY - rect.top - cy) / radius;
    const q = sx * sx + sy * sy; if (q > 1) return null;
    const z = Math.sqrt(Math.max(0, 1 - q));
    const lat = Math.asin(clamp(sy, -1, 1));
    const lon = Math.atan2(sx, z) + app.specimenRotation;
    const row = clamp(Math.round(((lat + Math.PI / 2) / Math.PI) * (app.state.planet.rows - 1)), 0, app.state.planet.rows - 1);
    let col = Math.floor((((lon + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI) * app.state.planet.cols);
    return { row, col };
  }

  function initSpecimenControls() {
    $$("[data-phenotype]").forEach((input) => input.addEventListener("input", () => syncExperimentalControls(profile())));
    $("#specimen-hatch").addEventListener("click", async () => {
      const selected = profile();
      const body = { profile_id: selected.profile_id, ...app.specimenTarget };
      if (selected.profile_id === "experimental_egg") body.phenotype = phenotypePayload();
      await mutate("/api/specimen/hatch", body); toast(`${selected.name} hatched into the shared planetary solver.`);
    });
    $("#specimen-pulse").addEventListener("click", () => mutate("/api/specimen/pulse", { steps: 1 }));
    $("#specimen-run").addEventListener("click", async () => {
      app.specimenRunning = true; renderIncubator();
      try { for (let i = 0; i < 24 && app.specimenRunning; i += 1) { await mutate("/api/specimen/pulse", { steps: 1 }); await delay(65); } }
      finally { app.specimenRunning = false; renderIncubator(); }
    });
    $("#specimen-pause").addEventListener("click", () => { app.specimenRunning = false; renderIncubator(); });
    $("#specimen-terminate").addEventListener("click", async () => { app.specimenRunning = false; await mutate("/api/specimen/terminate", {}); });
    const canvas = $("#incubator-canvas");
    canvas.addEventListener("pointerdown", (event) => { app.specimenDrag = { x: event.clientX, rotation: app.specimenRotation, moved: false }; canvas.setPointerCapture(event.pointerId); });
    canvas.addEventListener("pointermove", (event) => { if (!app.specimenDrag) return; const dx = event.clientX - app.specimenDrag.x; if (Math.abs(dx) > 3) app.specimenDrag.moved = true; app.specimenRotation = app.specimenDrag.rotation + dx * .008; drawIncubator(); });
    canvas.addEventListener("pointerup", (event) => { const drag = app.specimenDrag; app.specimenDrag = null; if (drag && !drag.moved) { const cell = pointToCell(event, canvas); if (cell) { app.specimenTarget = cell; renderIncubator(); } } });
  }

  const previousRenderAll = renderAll;
  renderAll = function renderAllWithIncubator() { previousRenderAll(); renderIncubator(); };
  const previousDrawActive = drawActiveCanvases;
  drawActiveCanvases = function drawActiveWithIncubator() { previousDrawActive(); if (app.view === "incubator") drawIncubator(); };

  initSpecimenNavigation();
  initSpecimenControls();
})();

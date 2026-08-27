"use strict";

/* Display-first command shell.
   The simulation remains authoritative. This layer only changes presentation,
   layout, visibility, and interaction with existing controls. */
(() => {
  document.body.classList.add("display-first");
  const drawerMap = new Map();
  const $q = (s, r=document) => r.querySelector(s);
  const $qa = (s, r=document) => Array.from(r.querySelectorAll(s));

  function makeDrawer(view, side, label, nodes) {
    const actual = nodes.filter(Boolean);
    if (!actual.length) return null;
    const drawer = document.createElement("section");
    drawer.className = `df-drawer df-drawer-${side}`;
    drawer.dataset.side = side;
    drawer.innerHTML = `<button class="df-drawer-handle" type="button" aria-expanded="false"><span>${label}</span><i>${side === "left" ? "›" : side === "right" ? "‹" : "⌃"}</i></button><div class="df-drawer-frame"><div class="df-drawer-head"><b>${label}</b><button class="df-drawer-close" type="button" aria-label="Close ${label}">×</button></div><div class="df-drawer-body"></div></div>`;
    const body = $q(".df-drawer-body", drawer);
    actual.forEach((node) => body.appendChild(node));
    view.appendChild(drawer);
    const handle = $q(".df-drawer-handle", drawer);
    const close = $q(".df-drawer-close", drawer);
    const setOpen = (open) => {
      drawer.classList.toggle("open", open);
      handle.setAttribute("aria-expanded", open ? "true" : "false");
      view.classList.toggle(`df-${side}-open`, open);
      requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    };
    handle.addEventListener("click", () => setOpen(!drawer.classList.contains("open")));
    close.addEventListener("click", () => setOpen(false));
    drawer._setOpen = setOpen;
    return drawer;
  }

  function addStationChip(view) {
    const heading = $q(":scope > .view-heading", view);
    const title = $q("h2", heading)?.textContent?.trim() || view.dataset.viewPanel?.toUpperCase() || "LABORATORY";
    const eyebrow = $q(".eyebrow", heading)?.textContent?.trim() || "DRAKKEN SYSTEMS";
    const chip = document.createElement("div");
    chip.className = "df-station-chip";
    chip.innerHTML = `<span>${eyebrow}</span><strong>${title}</strong><em data-df-summary>DISPLAY NOMINAL</em>`;
    view.appendChild(chip);
  }

  function addDisplayControls() {
    const status = $q(".topbar-status");
    if (!status || $q("#df-hud-toggle")) return;
    const hud = document.createElement("button");
    hud.id = "df-hud-toggle";
    hud.className = "ghost-button df-hud-toggle";
    hud.type = "button";
    hud.textContent = "HUD";
    hud.title = "Toggle floating display instruments (H)";
    status.prepend(hud);
    hud.addEventListener("click", () => {
      document.body.classList.toggle("df-hud-expanded");
      hud.classList.toggle("active", document.body.classList.contains("df-hud-expanded"));
    });
  }

  function installView(viewName, config) {
    const view = $q(`#view-${viewName}`);
    if (!view) return;
    view.classList.add("df-view");
    addStationChip(view);
    const entry = {};
    if (config.left) entry.left = makeDrawer(view, "left", config.left.label, config.left.nodes.map((s) => typeof s === "string" ? $q(s, view) : s));
    if (config.right) entry.right = makeDrawer(view, "right", config.right.label, config.right.nodes.map((s) => typeof s === "string" ? $q(s, view) : s));
    if (config.bottom) entry.bottom = makeDrawer(view, "bottom", config.bottom.label, config.bottom.nodes.map((s) => typeof s === "string" ? $q(s, view) : s));
    drawerMap.set(viewName, entry);
  }

  function installDrawers() {
    installView("planet", {
      left: { label: "FIELD LAYERS", nodes: ["#planet-mode"] },
      right: { label: "CORE + TELEMETRY", nodes: [".instrument-stack"] },
      bottom: { label: "TERRAFORMING CONTROLS", nodes: ["#planet-tools"] },
    });
    installView("incubator", {
      left: { label: "PHENOTYPE ARCHIVE", nodes: [".incubator-library"] },
      right: { label: "SPECIMEN DOSSIER", nodes: [".incubator-dossier"] },
      bottom: { label: "INCUBATION CONTROLS", nodes: [".incubator-commandbar"] },
    });
    installView("macro", {
      right: { label: "RUNTIME INSPECTOR", nodes: [".macro-side"] },
      bottom: { label: "EXECUTION CONTROLS", nodes: [".editor-controls"] },
    });
    installView("starbinding", {
      right: { label: "VECTOR TELEMETRY", nodes: [".instrument-stack"] },
      bottom: { label: "VECTOR CONTROLS", nodes: [".vector-controls"] },
    });
    installView("siege", {
      right: { label: "LATTICE TELEMETRY", nodes: [".instrument-stack"] },
      bottom: { label: "LATTICE CONTROLS", nodes: [".siege-controls"] },
    });
    installView("telemetry", {
      left: { label: "EVENT FILTERS", nodes: ["#telemetry-filter"] },
    });
  }

  function closeDrawers(viewName = app.view) {
    const entry = drawerMap.get(viewName);
    if (!entry) return;
    Object.values(entry).filter(Boolean).forEach((drawer) => drawer._setOpen(false));
  }

  function toggleDrawer(side) {
    const drawer = drawerMap.get(app.view)?.[side];
    if (drawer) drawer._setOpen(!drawer.classList.contains("open"));
  }

  function installStageDismiss() {
    $qa(".canvas-wrap, .editor-shell, .telemetry-card").forEach((stage) => {
      stage.addEventListener("pointerdown", (event) => {
        if (event.target.closest("button,input,textarea,select,a")) return;
        closeDrawers();
      });
    });
  }

  function installNavigationHooks() {
    $qa(".nav-button[data-view]").forEach((button) => {
      button.addEventListener("click", () => {
        for (const name of drawerMap.keys()) if (name !== button.dataset.view) closeDrawers(name);
        requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
      });
    });
  }

  function installKeyboard() {
    document.addEventListener("keydown", (event) => {
      const editing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement;
      if (event.key === "Escape") { closeDrawers(); return; }
      if (editing) return;
      if (event.key === "[") { event.preventDefault(); toggleDrawer("left"); }
      else if (event.key === "]") { event.preventDefault(); toggleDrawer("right"); }
      else if (event.key === "\\") { event.preventDefault(); toggleDrawer("bottom"); }
      else if (event.key.toLowerCase() === "h") { event.preventDefault(); $q("#df-hud-toggle")?.click(); }
    });
  }

  function summaryText() {
    if (!app.state) return "AWAITING STATE";
    if (app.state.inert) return "STARSILK NULLIFIED";
    if (app.state.star?.state === "collapsed") return "HELIOCIDE STATE";
    if (app.view === "incubator") {
      const s = app.state.specimens?.active;
      return s ? `${s.name.toUpperCase()} // PULSE ${String(s.pulses || 0).padStart(3,"0")}` : "INCUBATION FIELD READY";
    }
    if (app.view === "siege") return app.state.siege_wall ? (app.state.siege_wall.fractured ? "CONTAINMENT FRACTURE" : "LATTICE STABLE") : "LATTICE UNSOLVED";
    if (app.view === "macro") return app.state.macro?.loaded ? `CURSOR ${app.state.macro.cursor}/${app.state.macro.total}` : "RUNTIME READY";
    if (app.view === "starbinding") return `${app.state.starbinding?.history?.length || 0} VECTORS COMMITTED`;
    if (app.view === "telemetry") return `${app.state.telemetry?.length || 0} EVENTS`;
    return `BOND ${Number(app.state.star?.bond_index ?? 1).toFixed(4)} // STEP ${app.state.planet?.steps ?? 0}`;
  }

  function updateDisplaySummary() {
    const active = $q(`.df-view[data-view-panel="${app.view}"] [data-df-summary]`);
    if (active) active.textContent = summaryText();
  }

  function wrapRender() {
    const original = renderAll;
    renderAll = function displayFirstRender() {
      original();
      updateDisplaySummary();
    };
  }

  function installEdgeHint() {
    const hint = document.createElement("div");
    hint.className = "df-edge-hint";
    hint.innerHTML = `<span>[</span> left&nbsp;&nbsp;<span>]</span> right&nbsp;&nbsp;<span>\\</span> controls&nbsp;&nbsp;<span>H</span> HUD`;
    document.body.appendChild(hint);
  }

  function init() {
    addDisplayControls();
    installDrawers();
    installStageDismiss();
    installNavigationHooks();
    installKeyboard();
    installEdgeHint();
    wrapRender();
    updateDisplaySummary();
    requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
  }

  init();
})();

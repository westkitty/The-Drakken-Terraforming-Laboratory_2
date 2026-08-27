"use strict";

/* v1.8.6 Station 01 visibility watchdog.
   This script is linked directly after app.js; server.py expands app.js in place,
   therefore this executes after every optional presentation script. It does not
   mutate simulation state. */
(() => {
  const BUILD = "1.8.6";
  const view = document.querySelector("#view-planet");
  const wrap = view?.querySelector(".planet-canvas-wrap");
  const base = view?.querySelector("#planet-canvas");
  const svg = view?.querySelector("#planet-static-scene");
  const badge = view?.querySelector("#planet-render-identity");
  if (!view || !wrap || !base || !svg) return;

  const hideSelectors = [
    ".core-space-surface",
    ".cc-globe-layer",
    ".v17-space-layer",
    ".v17-globe-layer",
    ".v18-lighting-overlay",
    ".v18-orbital-overlay",
  ];

  function important(node, property, value) {
    node?.style?.setProperty(property, value, "important");
  }

  function enforce() {
    important(wrap, "position", "relative");
    important(wrap, "isolation", "isolate");
    important(wrap, "overflow", "hidden");
    important(wrap, "background", "#000205");

    for (const [property, value] of [
      ["position", "absolute"], ["inset", "0"], ["display", "block"],
      ["visibility", "visible"], ["opacity", "1"], ["width", "100%"],
      ["height", "100%"], ["z-index", "2"], ["pointer-events", "none"],
    ]) important(svg, property, value);

    for (const [property, value] of [
      ["position", "absolute"], ["inset", "0"], ["display", "block"],
      ["visibility", "visible"], ["opacity", "0"], ["background", "transparent"],
      ["width", "100%"], ["height", "100%"], ["z-index", "30"],
      ["pointer-events", "auto"],
    ]) important(base, property, value);

    const dynamicPlanet = wrap.querySelector(".core-planet-surface");
    if (dynamicPlanet) {
      for (const [property, value] of [
        ["position", "absolute"], ["inset", "0"], ["display", "block"],
        ["visibility", "visible"], ["opacity", "1"], ["background", "transparent"],
        ["z-index", "4"], ["pointer-events", "none"],
      ]) important(dynamicPlanet, property, value);
    }

    for (const selector of hideSelectors) {
      wrap.querySelectorAll(selector).forEach((node) => {
        important(node, "display", "none");
        important(node, "visibility", "hidden");
        important(node, "opacity", "0");
      });
    }

    wrap.dataset.sceneOwner = "svg-core-v186";
    document.documentElement.dataset.drakkenBuild = BUILD;
    if (badge) {
      const rect = wrap.getBoundingClientRect();
      const dynamic = Boolean(dynamicPlanet);
      badge.textContent = `SCENE ${BUILD} // SVG ON // ${Math.round(rect.width)}×${Math.round(rect.height)} // CORE ${dynamic ? "ON" : "WAIT"}`;
    }
  }

  enforce();
  const observer = new MutationObserver(() => enforce());
  observer.observe(wrap, { childList: true, attributes: true, subtree: false, attributeFilter: ["class", "style"] });
  if (typeof ResizeObserver === "function") new ResizeObserver(enforce).observe(wrap);
  for (const delay of [0, 50, 180, 600, 1500, 3500]) setTimeout(enforce, delay);

  window.__drakkenSceneDiagnostics = () => {
    const nodes = [svg, wrap.querySelector(".core-planet-surface"), base].filter(Boolean);
    return {
      build: BUILD,
      owner: wrap.dataset.sceneOwner,
      wrap: wrap.getBoundingClientRect().toJSON?.() || { width: wrap.clientWidth, height: wrap.clientHeight },
      layers: nodes.map((node) => {
        const cs = getComputedStyle(node);
        const r = node.getBoundingClientRect();
        return { id: node.id || node.className, width: r.width, height: r.height, display: cs.display, visibility: cs.visibility, opacity: cs.opacity, zIndex: cs.zIndex };
      }),
    };
  };
})();

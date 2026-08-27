"use strict";

/* v1.8.6-HF1 Station 01 paint-starvation hotfix.
   This file loads after every optional presentation script. It performs only
   finite enforcement passes: no DOM observer can feed style
   mutations back into itself and starve the browser's paint/image-load work. */
(() => {
  const BUILD = "1.8.6-HF1";
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

  function setBadge(state) {
    if (!badge) return;
    const rect = wrap.getBoundingClientRect();
    badge.textContent = `SCENE ${BUILD} // ${state} // ${Math.round(rect.width)}×${Math.round(rect.height)}`;
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

    wrap.dataset.sceneOwner = "svg-core-v186-hf1";
    document.documentElement.dataset.drakkenBuild = BUILD;
    setBadge(svg.complete && svg.naturalWidth > 0 ? "SVG LOADED" : "SVG WAITING");
  }

  svg.addEventListener("load", () => { enforce(); setBadge("SVG LOADED"); }, { once: true });
  svg.addEventListener("error", () => setBadge("SVG LOAD ERROR"), { once: true });

  // All optional presentation scripts execute before this file. A few bounded
  // passes cover layout settling without any observer feedback loop.
  enforce();
  for (const delay of [0, 60, 240, 900, 2200]) setTimeout(enforce, delay);
  window.addEventListener("resize", enforce, { passive: true });

  window.__drakkenSceneDiagnostics = () => {
    const nodes = [svg, wrap.querySelector(".core-planet-surface"), base].filter(Boolean);
    return {
      build: BUILD,
      owner: wrap.dataset.sceneOwner,
      svg: { complete: svg.complete, naturalWidth: svg.naturalWidth, naturalHeight: svg.naturalHeight, src: svg.currentSrc || svg.src },
      wrap: { width: wrap.clientWidth, height: wrap.clientHeight },
      layers: nodes.map((node) => {
        const cs = getComputedStyle(node);
        const r = node.getBoundingClientRect();
        return { id: node.id || node.className, width: r.width, height: r.height, display: cs.display, visibility: cs.visibility, opacity: cs.opacity, zIndex: cs.zIndex };
      }),
    };
  };
})();

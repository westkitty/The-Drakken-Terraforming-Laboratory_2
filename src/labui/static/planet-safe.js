"use strict";

/* v1.9 single-globe guard. No observers, no alternate planet creation. */
(() => {
  const BUILD = "1.9.0";
  const view = document.querySelector("#view-planet");
  const wrap = view?.querySelector(".planet-canvas-wrap");
  const hit = view?.querySelector("#planet-canvas");
  const backdrop = view?.querySelector("#planet-static-scene");
  const badge = view?.querySelector("#planet-render-identity");
  if (!view || !wrap || !hit) return;

  function ensure() {
    // The legacy canvas is input-only, permanently. Inline !important protects
    // this invariant from every older presentation stylesheet.
    hit.style.setProperty("opacity", "0", "important");
    hit.style.setProperty("background", "transparent", "important");
    hit.style.setProperty("pointer-events", "auto", "important");
    hit.style.setProperty("z-index", "30", "important");
    wrap.dataset.sceneOwner = "command-center-single-globe";
    document.documentElement.dataset.drakkenBuild = BUILD;
    const globe = wrap.querySelector(".cc-globe-layer");
    if (badge) {
      const r = wrap.getBoundingClientRect();
      const renderer = document.body.classList.contains("cc-canvas-renderer") ? "CANVAS" : "WEBGL";
      badge.textContent = `SCENE 1.9 // SINGLE GLOBE // ${globe ? renderer : "WAIT"} // ${Math.round(r.width)}×${Math.round(r.height)}`;
    }
  }

  // Keep the proven interaction surface aligned with the concept-scale globe.
  if (typeof planetGeometry === "function" && !window.__drakkenConceptGeometry) {
    planetGeometry = function conceptPlanetGeometry(canvas) {
      const rect = canvas.getBoundingClientRect();
      return { cx: rect.width * .5, cy: rect.height * .465, radius: Math.max(90, Math.min(rect.width, rect.height) * .345) };
    };
    window.__drakkenConceptGeometry = true;
  }

  ensure();
  for (const delay of [0, 80, 300, 1100]) setTimeout(ensure, delay);
  window.addEventListener("resize", ensure, { passive: true });

  // Lightweight chamber parallax: the world remains fixed while the distant
  // room/star system shifts a few pixels under the pointer, creating depth
  // without another rendering stack.
  wrap.addEventListener("pointermove", (event) => {
    if (!backdrop) return;
    const r = wrap.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const nx = ((event.clientX - r.left) / r.width - .5) * 2;
    const ny = ((event.clientY - r.top) / r.height - .5) * 2;
    backdrop.style.transform = `scale(1.025) translate(${(-nx * 7).toFixed(2)}px, ${(-ny * 4).toFixed(2)}px)`;
  }, { passive: true });
  wrap.addEventListener("pointerleave", () => {
    if (backdrop) backdrop.style.transform = "scale(1.025) translate(0,0)";
  }, { passive: true });
})();

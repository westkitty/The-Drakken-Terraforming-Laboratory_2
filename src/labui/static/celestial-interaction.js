"use strict";

/* v1.8 celestial interaction overlay.
   Presentation only. It augments the dependable v1.7 Canvas scene without
   replacing the deterministic simulation or its fallback globe. */
(() => {
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fract = (v) => v - Math.floor(v);
  const hash = (i, salt) => fract(Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453123);
  const stages = [];

  function orbitPoint(cx, cy, rx, ry, angle, tilt = -0.17) {
    const ox = Math.cos(angle) * rx, oy = Math.sin(angle) * ry;
    const ct = Math.cos(tilt), st = Math.sin(tilt);
    return { x: cx + ox * ct - oy * st, y: cy + ox * st + oy * ct, depth: Math.sin(angle) };
  }

  class CelestialInteraction {
    constructor(base, kind) {
      this.base = base;
      this.kind = kind;
      this.wrap = base.parentElement;
      this.pointer = { x: 0, y: 0 };
      this.hits = [];
      this.hover = null;
      this.selected = null;
      this.focused = null;
      this.lastStarState = null;
      this.collapseAt = 0;
      this.overlay = document.createElement("canvas");
      this.overlay.className = "v18-orbital-overlay";
      this.overlay.setAttribute("aria-hidden", "true");
      this.lighting = document.createElement("canvas");
      this.lighting.className = "v18-lighting-overlay";
      this.lighting.setAttribute("aria-hidden", "true");
      const hud = this.wrap.querySelector(".cc-globe-hud");
      this.wrap.insertBefore(this.lighting, hud || base);
      this.wrap.insertBefore(this.overlay, hud || base);
      this.inspector = this.makeInspector();
      this.asteroids = Array.from({ length: 56 }, (_, i) => ({
        a: hash(i + 1, 8.4) * TAU,
        lane: .92 + hash(i + 1, 10.2) * .16,
        size: .28 + hash(i + 1, 12.7) * .72,
      }));
      this.installInteraction();
    }

    makeInspector() {
      const el = document.createElement("aside");
      el.className = "v18-system-inspector";
      el.innerHTML = `
        <div class="v18-system-head"><span>CELESTIAL TARGET</span><button type="button" data-v18-close aria-label="Clear target">×</button></div>
        <strong data-v18-name>—</strong><em data-v18-type>—</em>
        <dl><dt>STATE</dt><dd data-v18-state>—</dd><dt>TRACK</dt><dd data-v18-track>—</dd><dt>DEPTH</dt><dd data-v18-depth>—</dd></dl>
        <button class="v18-focus-button" type="button" data-v18-focus>FOCUS LOCK</button>
        <small>LAB VISUAL REFERENCE // ORBITAL SCENERY IS NON-CANON</small>`;
      this.wrap.appendChild(el);
      el.querySelector("[data-v18-close]").addEventListener("click", () => {
        this.selected = null; this.focused = null; el.classList.remove("open");
      });
      el.querySelector("[data-v18-focus]").addEventListener("click", () => {
        if (!this.selected) return;
        this.focused = this.focused === this.selected ? null : this.selected;
        this.updateInspector();
      });
      return el;
    }

    installInteraction() {
      this.wrap.addEventListener("pointermove", (event) => {
        const r = this.wrap.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const x = event.clientX - r.left, y = event.clientY - r.top;
        this.pointer.x = (x / r.width - .5) * 2;
        this.pointer.y = (y / r.height - .5) * 2;
        const hit = this.hitAt(x, y);
        this.hover = hit?.id || null;
        this.wrap.classList.toggle("v18-system-hover", Boolean(hit));
      }, { passive: true });
      this.wrap.addEventListener("pointerleave", () => {
        this.hover = null; this.wrap.classList.remove("v18-system-hover");
      }, { passive: true });
      this.wrap.addEventListener("click", (event) => {
        const r = this.wrap.getBoundingClientRect();
        const hit = this.hitAt(event.clientX - r.left, event.clientY - r.top);
        if (!hit) return;
        event.stopPropagation(); this.selected = hit.id; this.inspector.classList.add("open"); this.updateInspector(hit);
      }, true);
      this.wrap.addEventListener("dblclick", (event) => {
        const r = this.wrap.getBoundingClientRect();
        const hit = this.hitAt(event.clientX - r.left, event.clientY - r.top);
        if (!hit) return;
        event.preventDefault(); event.stopPropagation(); this.selected = hit.id;
        this.focused = this.focused === hit.id ? null : hit.id;
        this.inspector.classList.add("open"); this.updateInspector(hit);
      }, true);
    }

    hitAt(x, y) {
      let best = null, bd = Infinity;
      for (const hit of this.hits) {
        const d = Math.hypot(x - hit.x, y - hit.y);
        if (d <= hit.radius && d < bd) { best = hit; bd = d; }
      }
      return best;
    }

    updateInspector(explicit = null) {
      const hit = explicit || this.hits.find((item) => item.id === this.selected);
      if (!hit) { this.inspector.classList.remove("open"); return; }
      const star = app.state?.star;
      const isStar = hit.id === "LAB-STAR";
      this.inspector.querySelector("[data-v18-name]").textContent = hit.id;
      this.inspector.querySelector("[data-v18-type]").textContent = hit.type;
      this.inspector.querySelector("[data-v18-state]").textContent = isStar ? String(star?.state || "active").toUpperCase() : "VISUAL REFERENCE";
      this.inspector.querySelector("[data-v18-track]").textContent = isStar ? `BOND ${Number(star?.bond_index ?? 1).toFixed(4)}` : hit.track;
      this.inspector.querySelector("[data-v18-depth]").textContent = hit.depth == null ? "PRIMARY" : `${hit.depth >= 0 ? "+" : ""}${hit.depth.toFixed(2)}`;
      this.inspector.querySelector("[data-v18-focus]").textContent = this.focused === hit.id ? "RELEASE FOCUS" : "FOCUS LOCK";
    }

    size(canvas, cap = 1.5) {
      const r = canvas.getBoundingClientRect();
      const q = document.body.dataset.irQuality || "high";
      const dpr = Math.min(window.devicePixelRatio || 1, q === "economy" ? 1 : q === "balanced" ? 1.2 : cap);
      const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      const ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { ctx, w: r.width, h: r.height };
    }

    systemGeometry(w, h, t) {
      const compact = w < 780;
      const cx = w * (compact ? .80 : .84) + this.pointer.x * 9;
      const cy = h * (compact ? .20 : .235) + this.pointer.y * 5;
      const sr = Math.max(6.5, Math.min(w, h) * (compact ? .011 : .015));
      const defs = [
        ["ORBITAL-01", "INNER ROCKY BODY", 2.55, .017, .5],
        ["ORBITAL-02", "TEMPERATE REFERENCE BODY", 3.85, .0105, 2.1],
        ["ORBITAL-03", "OUTER BLUE BODY", 5.25, .0068, 4.35],
        ["ORBITAL-04", "RINGED OUTER BODY", 6.8, .0039, 5.65],
        ["RELAY-01", "ORBITAL RELAY", 4.55, .0132, 3.32],
      ];
      const bodies = defs.map(([id, type, orbit, speed, phase], i) => {
        const rx = sr * orbit * 2.25, ry = rx * (.265 + Math.min(i, 3) * .027);
        const p = orbitPoint(cx, cy, rx, ry, phase + t * speed);
        return { id, type, orbit, rx, ry, ...p, radius: id === "RELAY-01" ? 9 : Math.max(8, sr * (.55 + i * .08)), track: `ORBIT ${orbit.toFixed(2)} SU` };
      });
      return { cx, cy, sr, bodies };
    }

    drawLighting() {
      if (!app.state) return;
      const { ctx, w, h } = this.size(this.lighting, 1.35);
      ctx.clearRect(0, 0, w, h); if (w < 4 || h < 4) return;
      const r = Math.min(w, h) * .395, cx = w * .5, cy = h * .49;
      const collapsed = app.state.star?.state === "collapsed";
      const inert = app.state.inert;
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip();
      const shade = ctx.createLinearGradient(cx + r * .82, cy - r * .72, cx - r * .82, cy + r * .72);
      if (collapsed) { shade.addColorStop(0, "rgba(3,9,20,.34)"); shade.addColorStop(.55, "rgba(0,2,8,.58)"); shade.addColorStop(1, "rgba(0,0,3,.82)"); }
      else { shade.addColorStop(0, "rgba(0,0,0,0)"); shade.addColorStop(.46, "rgba(0,0,0,.04)"); shade.addColorStop(.64, "rgba(0,2,8,.30)"); shade.addColorStop(1, "rgba(0,0,4,.68)"); }
      ctx.fillStyle = shade; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      if (!inert && !collapsed) {
        ctx.globalCompositeOperation = "screen";
        const bond = clamp(Number(app.state.star?.bond_index ?? 1), 0, 1);
        for (let i = 0; i < 8; i += 1) {
          const y = cy - r * .58 + i / 7 * r * 1.16;
          ctx.strokeStyle = `rgba(53,239,205,${(.025 + (i % 3) * .012) * bond})`; ctx.lineWidth = .8;
          ctx.beginPath(); ctx.moveTo(cx - r * .82, y); ctx.quadraticCurveTo(cx + Math.sin(i * 1.7) * r * .25, y - r * .22, cx + r * .82, y + r * .08); ctx.stroke();
        }
      }
      ctx.restore();
      const a = Math.atan2(-.38, .62);
      ctx.strokeStyle = inert ? "rgba(255,75,102,.24)" : collapsed ? "rgba(113,145,255,.24)" : "rgba(132,241,255,.64)";
      ctx.lineWidth = 2.0; ctx.shadowBlur = collapsed ? 5 : 10; ctx.shadowColor = ctx.strokeStyle;
      ctx.beginPath(); ctx.arc(cx, cy, r + 1, a - 1.15, a + 1.15); ctx.stroke(); ctx.shadowBlur = 0;
    }

    drawOrbitalOverlay(time) {
      if (!app.state) return;
      const { ctx, w, h } = this.size(this.overlay, 1.35);
      ctx.clearRect(0, 0, w, h); if (w < 4 || h < 4) return;
      const t = time * .001, g = this.systemGeometry(w, h, t);
      this.hits = [{ id: "LAB-STAR", type: "PRIMARY STELLAR CORE", x: g.cx, y: g.cy, radius: Math.max(16, g.sr * 2.5), track: `BOND ${Number(app.state.star?.bond_index ?? 1).toFixed(4)}`, depth: null }];
      const state = app.state.star?.state || "active";
      if (state !== this.lastStarState) { if (state === "collapsed") this.collapseAt = time; this.lastStarState = state; }
      if (state === "collapsed") this.drawBlackHole(ctx, g.cx, g.cy, g.sr, (time - this.collapseAt) / 1000);
      else {
        const bond = clamp(Number(app.state.star?.bond_index ?? 1), 0, 1);
        ctx.strokeStyle = `rgba(255,192,103,${.12 + bond * .22})`; ctx.lineWidth = .8;
        ctx.beginPath(); ctx.arc(g.cx, g.cy, g.sr * (2.0 + bond * .25), 0, TAU); ctx.stroke();
      }

      for (const asteroid of this.asteroids) {
        const p = orbitPoint(g.cx, g.cy, g.sr * 5.95 * 2.25 * asteroid.lane, g.sr * 5.95 * 2.25 * .34 * asteroid.lane, asteroid.a + t * .0018);
        ctx.fillStyle = `rgba(173,196,204,${.10 + (p.depth + 1) * .06})`; ctx.beginPath(); ctx.arc(p.x, p.y, asteroid.size, 0, TAU); ctx.fill();
      }

      for (const body of g.bodies) {
        if (body.id === "RELAY-01") this.drawRelay(ctx, body.x, body.y, g.sr, t);
        this.hits.push(body);
      }
      const moonParent = g.bodies.find((b) => b.id === "ORBITAL-03");
      if (moonParent) {
        const ma = t * .018 + .85, mr = Math.max(9, g.sr * 1.35);
        const mx = moonParent.x + Math.cos(ma) * mr, my = moonParent.y + Math.sin(ma) * mr * .45;
        this.hits.push({ id: "ORBITAL-03-M1", type: "SATELLITE MOON", x: mx, y: my, radius: 8, track: "LOCAL SATELLITE", depth: moonParent.depth + .02 });
      }

      const active = this.hover || this.selected;
      if (active) {
        const hit = this.hits.find((x) => x.id === active);
        if (hit) this.drawTarget(ctx, hit, t, active === this.selected);
      }
      if (this.focused) {
        const hit = this.hits.find((x) => x.id === this.focused);
        if (hit) this.drawFocusLink(ctx, hit, w, h, t);
      }
      if (this.selected) this.updateInspector();
    }

    drawRelay(ctx, x, y, sr, t) {
      const r = Math.max(3, sr * .24); ctx.save(); ctx.translate(x, y); ctx.rotate(t * .5);
      ctx.strokeStyle = "rgba(86,244,211,.70)"; ctx.fillStyle = "rgba(10,75,73,.55)";
      ctx.beginPath(); ctx.moveTo(0, -r * 1.7); ctx.lineTo(r, r); ctx.lineTo(0, r * .35); ctx.lineTo(-r, r); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    }

    drawTarget(ctx, hit, t, selected) {
      const r = hit.radius + 6, pulse = .82 + Math.sin(t * 5) * .18;
      ctx.strokeStyle = selected ? `rgba(58,244,207,${.72 * pulse})` : `rgba(78,218,255,${.58 * pulse})`; ctx.lineWidth = 1.1;
      for (let i = 0; i < 4; i += 1) { const a = i * Math.PI / 2; ctx.beginPath(); ctx.arc(hit.x, hit.y, r, a + .08, a + .48); ctx.stroke(); }
      ctx.fillStyle = "rgba(184,235,244,.78)"; ctx.font = "700 7px ui-monospace,monospace"; ctx.fillText(hit.id, hit.x + r + 5, hit.y - 2);
    }

    drawFocusLink(ctx, hit, w, h, t) {
      const tx = Math.min(w - 255, Math.max(w * .55, hit.x + 40)), ty = Math.max(64, Math.min(h - 90, hit.y - 55));
      ctx.strokeStyle = `rgba(57,239,207,${.18 + .06 * Math.sin(t * 3)})`; ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.moveTo(hit.x, hit.y); ctx.lineTo(tx, ty); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = "rgba(57,239,207,.28)"; ctx.beginPath(); ctx.arc(hit.x, hit.y, hit.radius + 15, 0, TAU); ctx.stroke();
    }

    drawBlackHole(ctx, cx, cy, sr, age) {
      const rr = sr * 2.4;
      const cover = ctx.createRadialGradient(cx, cy, 0, cx, cy, sr * 9.2);
      cover.addColorStop(0, "rgba(0,0,0,1)"); cover.addColorStop(.18, "rgba(0,0,0,1)"); cover.addColorStop(.42, "rgba(0,0,2,.90)"); cover.addColorStop(.72, "rgba(0,0,4,.40)"); cover.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = cover; ctx.beginPath(); ctx.arc(cx, cy, sr * 9.2, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(-.2); ctx.strokeStyle = "rgba(255,145,67,.62)"; ctx.lineWidth = Math.max(1.2, sr * .18); ctx.shadowBlur = sr * 2; ctx.shadowColor = "#ff7630";
      ctx.beginPath(); ctx.ellipse(0, 0, rr * 1.5, rr * .28, 0, 0, TAU); ctx.stroke(); ctx.restore(); ctx.shadowBlur = 0;
      ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(cx, cy, sr * 1.38, 0, TAU); ctx.fill();
      ctx.strokeStyle = "rgba(126,211,255,.30)"; ctx.lineWidth = .9; ctx.beginPath(); ctx.arc(cx, cy, rr * 1.12, -.9, 1.2); ctx.stroke();
      if (age < 2.2) { const p = clamp(age / 2.2, 0, 1); ctx.strokeStyle = `rgba(255,176,92,${(1 - p) * .58})`; ctx.beginPath(); ctx.arc(cx, cy, sr * (2 + p * 12), 0, TAU); ctx.stroke(); }
    }

    frame(time) { this.drawLighting(); this.drawOrbitalOverlay(time); }
  }

  function install(id, kind) {
    const base = document.querySelector(id); if (!base) return;
    stages.push(new CelestialInteraction(base, kind));
  }
  function frame(time) {
    for (const stage of stages) {
      const panel = document.querySelector(stage.kind === "planet" ? "#view-planet" : "#view-incubator");
      if (app.state && panel?.classList.contains("active")) stage.frame(time);
    }
    requestAnimationFrame(frame);
  }
  install("#planet-canvas", "planet"); install("#incubator-canvas", "incubator"); requestAnimationFrame(frame);
})();

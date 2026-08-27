"use strict";

/* v1.7 dependable celestial display.
   Presentation only: state remains owned by the deterministic Python session.
   This layer deliberately uses Canvas2D so a missing WebGL context can never
   erase the globe again. */
(() => {
  const stages = new Map();
  const fract = (v) => v - Math.floor(v);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const hash = (i, salt) => fract(Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453123);

  function sampleMap(map, rowF, colF) {
    const rows = map.length, cols = map[0].length;
    const r0 = clamp(Math.floor(rowF), 0, rows - 1), r1 = clamp(r0 + 1, 0, rows - 1);
    const baseCol = Math.floor(colF), c0 = ((baseCol % cols) + cols) % cols, c1 = (c0 + 1) % cols;
    const fr = rowF - r0, fc = colF - baseCol;
    const a = map[r0][c0] * (1 - fc) + map[r0][c1] * fc;
    const b = map[r1][c0] * (1 - fc) + map[r1][c1] * fc;
    return a * (1 - fr) + b * fr;
  }

  class CelestialStage {
    constructor(base, kind) {
      this.base = base;
      this.kind = kind;
      this.wrap = base.parentElement;
      this.pointer = { x: 0, y: 0 };
      this.space = document.createElement("canvas");
      this.space.className = "v17-space-layer";
      this.space.setAttribute("aria-hidden", "true");
      this.globe = document.createElement("canvas");
      this.globe.className = "v17-globe-layer";
      this.globe.setAttribute("aria-hidden", "true");
      this.wrap.insertBefore(this.space, this.wrap.firstChild);
      const hud = this.wrap.querySelector(".cc-globe-hud");
      this.wrap.insertBefore(this.globe, hud || base);
      this.stars = this.makeStars();
      this.lastGlobeKey = "";
      this.wrap.classList.add("v17-celestial-ready");
      this.wrap.addEventListener("pointermove", (event) => {
        const rect = this.wrap.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        this.pointer.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
        this.pointer.y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
      }, { passive: true });
      this.wrap.addEventListener("pointerleave", () => {
        this.pointer.x *= .2; this.pointer.y *= .2;
      }, { passive: true });
    }

    makeStars() {
      const stars = [];
      const counts = [110, 86, 62, 34];
      for (let layer = 0; layer < counts.length; layer += 1) {
        for (let i = 0; i < counts[layer]; i += 1) {
          const id = layer * 300 + i + 1;
          stars.push({
            layer,
            x: hash(id, 1.2), y: hash(id, 2.9), depth: .12 + hash(id, 4.8) * .88,
            size: .38 + hash(id, 7.6) * 1.55, phase: hash(id, 10.4) * Math.PI * 2,
            warm: hash(id, 13.1) > .915,
          });
        }
      }
      return stars;
    }

    size(canvas, maxDpr = 1.6) {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      const width = Math.max(1, Math.round(rect.width * dpr)), height = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; this.lastGlobeKey = ""; }
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { ctx, w: rect.width, h: rect.height };
    }

    renderSpace(time) {
      const { ctx, w, h } = this.size(this.space, 1.45);
      if (w < 4 || h < 4) return;
      const t = time * .001;
      const rotation = this.kind === "incubator" ? (app.specimenRotation || 0) : (app.planetRotation || 0);
      ctx.clearRect(0, 0, w, h);
      const bg = ctx.createRadialGradient(w * .48, h * .48, 0, w * .48, h * .48, Math.max(w, h) * .8);
      bg.addColorStop(0, "#071723"); bg.addColorStop(.42, "#020910"); bg.addColorStop(1, "#000205");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
      const haze = ctx.createRadialGradient(w * .22, h * .18, 0, w * .22, h * .18, Math.min(w, h) * .65);
      haze.addColorStop(0, "rgba(18,92,130,.09)"); haze.addColorStop(.55, "rgba(12,43,69,.025)"); haze.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = haze; ctx.fillRect(0, 0, w, h);

      for (const star of this.stars) {
        const parallax = 1.28 - star.depth;
        let x = star.x * w + (this.pointer.x * 28 + Math.sin(rotation) * 22 + t * (star.layer + 1) * .12) * parallax;
        let y = star.y * h + (this.pointer.y * 17 + Math.cos(rotation * .63) * 8) * parallax;
        x = ((x % w) + w) % w; y = ((y % h) + h) % h;
        const pulse = .74 + Math.sin(t * (.7 + star.depth * 2.1) + star.phase) * .23;
        const alpha = (.13 + (1 - star.depth) * .7) * pulse;
        const size = star.size * (.46 + (1 - star.depth) * 1.45);
        ctx.fillStyle = star.warm ? `rgba(255,220,178,${alpha})` : `rgba(184,228,247,${alpha})`;
        if (size > 1.45) { ctx.shadowBlur = 6 + size * 2; ctx.shadowColor = star.warm ? "#ffb76b" : "#79d9ff"; }
        ctx.beginPath(); ctx.arc(x, y, Math.max(.3, size), 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      }
      this.drawDistantSystem(ctx, w, h, t);
    }

    drawDistantSystem(ctx, w, h, t) {
      const compact = w < 780;
      const cx = w * (compact ? .80 : .84) + this.pointer.x * 9;
      const cy = h * (compact ? .20 : .235) + this.pointer.y * 5;
      const sr = Math.max(6.5, Math.min(w, h) * (compact ? .011 : .015));
      ctx.save();
      const corona = ctx.createRadialGradient(cx, cy, 0, cx, cy, sr * 8.5);
      corona.addColorStop(0, "rgba(255,255,244,1)"); corona.addColorStop(.08, "rgba(255,236,174,.98)");
      corona.addColorStop(.24, "rgba(255,170,69,.44)"); corona.addColorStop(.56, "rgba(255,99,27,.09)"); corona.addColorStop(1, "rgba(255,80,20,0)");
      ctx.fillStyle = corona; ctx.beginPath(); ctx.arc(cx, cy, sr * 8.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff8d6"; ctx.shadowBlur = sr * 2.8; ctx.shadowColor = "#ffae48";
      ctx.beginPath(); ctx.arc(cx, cy, sr, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;

      const radii = compact ? [2.7, 4.25, 6.0] : [2.55, 3.85, 5.25, 6.8];
      const planets = [
        { s:.34, c:"#a9d9e8", v:.017, p:.5 }, { s:.48, c:"#bc8c6c", v:.0105, p:2.1 },
        { s:.64, c:"#5d94c1", v:.0068, p:4.35, moon:true }, { s:.43, c:"#b9a86d", v:.0039, p:5.65, ring:true },
      ];
      for (let i = 0; i < radii.length; i += 1) {
        const rx = sr * radii[i] * 2.25, ry = rx * (.265 + i * .027);
        ctx.strokeStyle = `rgba(95,185,214,${.07 + i * .018})`; ctx.lineWidth = .7;
        ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, -.17, 0, Math.PI * 2); ctx.stroke();
        const p = planets[i], a = p.p + t * p.v, px = cx + Math.cos(a) * rx, py = cy + Math.sin(a) * ry;
        const pr = Math.max(1.25, sr * p.s);
        const grad = ctx.createRadialGradient(px-pr*.35, py-pr*.35, 0, px, py, pr);
        grad.addColorStop(0, "rgba(255,255,255,.9)"); grad.addColorStop(.25, p.c); grad.addColorStop(1, "rgba(5,9,13,.96)");
        ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
        if (p.ring) { ctx.strokeStyle = "rgba(220,199,137,.48)"; ctx.beginPath(); ctx.ellipse(px, py, pr*2.0, pr*.55, -.22, 0, Math.PI*2); ctx.stroke(); }
        if (p.moon) { const ma=a*2.65+.85,mr=pr*2.25;ctx.fillStyle="rgba(205,222,229,.74)";ctx.beginPath();ctx.arc(px+Math.cos(ma)*mr,py+Math.sin(ma)*mr*.45,Math.max(.6,pr*.22),0,Math.PI*2);ctx.fill(); }
      }
      ctx.restore();
    }

    renderGlobe() {
      if (!app.state) return;
      const { ctx, w, h } = this.size(this.globe, 1.55);
      if (w < 4 || h < 4) return;
      const rotation = this.kind === "incubator" ? (app.specimenRotation || 0) : (app.planetRotation || 0);
      const mode = this.kind === "planet" ? app.planetMode : "composite";
      const key = [app.state.revision, mode, rotation.toFixed(4), Math.round(w), Math.round(h), app.state.inert].join("|");
      if (key === this.lastGlobeKey) return;
      this.lastGlobeKey = key; ctx.clearRect(0, 0, w, h);
      const radius = Math.min(w, h) * .395, cx = w * .5, cy = h * .49;
      const halo = ctx.createRadialGradient(cx, cy, radius*.72, cx, cy, radius*1.17);
      halo.addColorStop(0,"rgba(43,211,255,0)"); halo.addColorStop(.72,"rgba(43,211,255,.025)");
      halo.addColorStop(.89,app.state.inert?"rgba(255,79,104,.13)":"rgba(59,225,255,.20)"); halo.addColorStop(1,"rgba(53,232,255,0)");
      ctx.fillStyle=halo;ctx.beginPath();ctx.arc(cx,cy,radius*1.18,0,Math.PI*2);ctx.fill();

      const maps=app.state.planet.maps,rows=app.state.planet.rows,cols=app.state.planet.cols;
      const quality=document.body.dataset.irQuality||"high"; const step=quality==="economy"?4:quality==="balanced"?3:2;
      const cosR=Math.cos(rotation),sinR=Math.sin(rotation);
      ctx.save();ctx.beginPath();ctx.arc(cx,cy,radius,0,Math.PI*2);ctx.clip();
      for(let py=-radius;py<=radius;py+=step){const sy=-py/radius;for(let px=-radius;px<=radius;px+=step){const sx=px/radius,q=sx*sx+sy*sy;if(q>=1)continue;const sz=Math.sqrt(1-q);let lon;
        if(this.kind==="incubator"){const wx=sx*cosR+sz*sinR,wz=-sx*sinR+sz*cosR;lon=Math.atan2(wx,wz);}else{const wx=sx*cosR-sz*sinR,wz=sx*sinR+sz*cosR;lon=Math.atan2(wz,wx);}
        const lat=Math.asin(clamp(sy,-1,1));const rowF=clamp(((lat+Math.PI/2)/Math.PI)*(rows-1),0,rows-1);let colF=((lon+Math.PI)/(2*Math.PI))*cols;colF=((colF%cols)+cols)%cols;
        const temp=sampleMap(maps.temperature_k,rowF,colF),elev=sampleMap(maps.elevation_m,rowF,colF),pressure=sampleMap(maps.pressure_pa,rowF,colF),co2=sampleMap(maps.co2_fraction,rowF,colF),stress=maps.stress_pa?sampleMap(maps.stress_pa,rowF,colF):0;
        let r,g,b;if(mode==="thermal"){const v=clamp((temp-220)/150,0,1);r=18+237*v;g=42+145*(1-Math.abs(v-.55)*1.7);b=105+125*(1-v);}else if(mode==="lithosphere"){const e=clamp((elev+4200)/8500,0,1);r=18+160*e;g=62+120*e;b=72+42*(1-e);}else if(mode==="atmosphere"){const p=clamp((pressure-30000)/100000,0,1),c=clamp(co2/.006,0,1);r=10+56*c;g=55+150*p;b=98+145*p-48*c;}else if(mode==="starsilk"){const field=.5+.5*Math.sin(colF*.54+rowF*.27);r=4+18*field;g=35+135*field;b=61+183*field;}else if(elev<0){const d=clamp(-elev/3800,0,1),warm=clamp((temp-235)/90,0,1);r=4+18*warm;g=25+65*warm;b=70+95*(1-d);}else{const e=clamp(elev/4200,0,1),warm=clamp((temp-235)/100,0,1);r=24+92*e+42*warm;g=68+95*(1-e)+30*warm;b=62+38*(1-e);}
        const light=clamp(.18+.76*(sz*.72+sx*(-.22)+sy*.28),.12,1.08),micro=.93+.07*Math.sin(lon*41+Math.sin(lat*19)*2.1)*Math.sin(lat*53-lon*17);r*=light*micro;g*=light*micro;b*=light*micro;
        const hot=clamp((temp-315)/70,0,1);if(mode==="composite"&&hot>0){r+=230*hot;g+=52*hot;b+=5*hot;}
        const sn=clamp(Math.log10(1+Math.max(0,stress))/9,0,1),ca=Math.pow(1-Math.abs(Math.sin(lon*67+Math.sin(lat*29)*3.2)),18),cb=Math.pow(1-Math.abs(Math.sin(lon*31-lat*71)),22),crack=sn*Math.max(ca,cb);if(crack>.01){r+=255*crack;g+=74*crack;b+=12*crack;}
        if(app.state.inert){const gray=.299*r+.587*g+.114*b;r=gray*.82;g=gray*.9;b=gray*.94;}
        const rim=Math.pow(1-sz,2.1);r+=18*rim;g+=75*rim;b+=105*rim;ctx.fillStyle=`rgb(${Math.min(255,r)|0},${Math.min(255,g)|0},${Math.min(255,b)|0})`;ctx.fillRect(cx+px,cy+py,step+1,step+1);
      }}
      if((mode==="composite"||mode==="atmosphere")&&!app.state.inert){ctx.globalCompositeOperation="screen";for(let i=0;i<18;i++){const yy=cy-radius*.72+(i/17)*radius*1.44,wob=Math.sin(i*2.31+rotation*1.7)*radius*.13;ctx.strokeStyle=`rgba(160,224,236,${.016+(i%4)*.008})`;ctx.lineWidth=1.1+(i%3)*.45;ctx.beginPath();ctx.moveTo(cx-radius*.86,yy);ctx.bezierCurveTo(cx-radius*.3,yy+wob,cx+radius*.25,yy-wob,cx+radius*.88,yy+wob*.2);ctx.stroke();}}
      ctx.restore();
      const sheen=ctx.createLinearGradient(cx-radius,cy-radius,cx+radius,cy+radius);sheen.addColorStop(0,"rgba(226,251,255,.16)");sheen.addColorStop(.32,"rgba(255,255,255,.01)");sheen.addColorStop(.72,"rgba(0,0,0,.16)");sheen.addColorStop(1,"rgba(0,0,0,.68)");ctx.fillStyle=sheen;ctx.beginPath();ctx.arc(cx,cy,radius,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle=app.state.inert?"rgba(255,79,104,.34)":"rgba(92,237,255,.54)";ctx.lineWidth=1.35;ctx.beginPath();ctx.arc(cx,cy,radius+.5,0,Math.PI*2);ctx.stroke();
    }

    frame(time) { this.renderSpace(time); this.renderGlobe(); }
  }

  function install(baseId, kind) {
    const base=document.querySelector(baseId); if(!base||base.dataset.v17Installed)return;
    base.dataset.v17Installed="1"; stages.set(kind,new CelestialStage(base,kind));
  }

  function frame(time) {
    if (app.state) {
      for (const [kind, stage] of stages) {
        const panel=document.querySelector(kind==="planet"?"#view-planet":"#view-incubator");
        if(panel?.classList.contains("active")) stage.frame(time);
      }
    }
    requestAnimationFrame(frame);
  }

  install("#planet-canvas","planet"); install("#incubator-canvas","incubator"); requestAnimationFrame(frame);
})();

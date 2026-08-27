"use strict";

/* v1.8.4 Guaranteed Planet renderer.
   This is deliberately loaded immediately after the confirmed-working
   display-first shell. It owns only presentation. Authoritative state and all
   mutations remain in app.js / the Python session. */
(() => {
  const base = document.querySelector("#planet-canvas");
  if (!base || !base.parentElement) return;
  const wrap = base.parentElement;
  let resizeObserver = null;
  let redrawFrame = 0;
  let lastSpaceFrame = 0;
  let pointerX = 0;
  let pointerY = 0;

  function makeCanvas(id, className, before) {
    let canvas = document.querySelector(`#${id}`);
    if (canvas) return canvas;
    canvas = document.createElement("canvas");
    canvas.id = id;
    canvas.className = className;
    canvas.setAttribute("aria-hidden", "true");
    wrap.insertBefore(canvas, before);
    return canvas;
  }

  const space = makeCanvas("core-space-surface", "core-space-surface", base);
  const planet = makeCanvas("core-planet-surface", "core-planet-surface", base);

  function context(canvas, maxDpr = 1.6) {
    const rect = wrap.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error(`2D context unavailable for ${canvas.id}`);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w: rect.width, h: rect.height };
  }

  const fract = (v) => v - Math.floor(v);
  const hash = (i, salt) => fract(Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453123);
  const clampLocal = (v, a, b) => Math.min(b, Math.max(a, v));
  const stars = [];
  [135, 96, 62, 34].forEach((count, layer) => {
    for (let i = 0; i < count; i += 1) {
      const id = layer * 317 + i + 1;
      stars.push({
        layer,
        x: hash(id, 1.2), y: hash(id, 2.9), depth: .10 + hash(id, 4.8) * .90,
        size: .35 + hash(id, 7.6) * 1.65, phase: hash(id, 10.4) * Math.PI * 2,
        warm: hash(id, 13.1) > .92,
      });
    }
  });

  function drawSpace(time) {
    const { ctx, w, h } = context(space, 1.45);
    if (w < 8 || h < 8) return false;
    const t = time * .001;
    ctx.clearRect(0, 0, w, h);
    const bg = ctx.createRadialGradient(w*.48,h*.47,0,w*.48,h*.47,Math.max(w,h)*.82);
    bg.addColorStop(0,"#071723"); bg.addColorStop(.43,"#020912"); bg.addColorStop(1,"#000205");
    ctx.fillStyle=bg; ctx.fillRect(0,0,w,h);
    const haze=ctx.createRadialGradient(w*.18,h*.20,0,w*.18,h*.20,Math.min(w,h)*.74);
    haze.addColorStop(0,"rgba(22,105,150,.10)"); haze.addColorStop(.5,"rgba(8,38,66,.025)"); haze.addColorStop(1,"rgba(0,0,0,0)");
    ctx.fillStyle=haze; ctx.fillRect(0,0,w,h);

    const rotation = Number(app?.planetRotation || 0);
    for (const star of stars) {
      const parallax = 1.30 - star.depth;
      let x = star.x*w + (pointerX*34 + Math.sin(rotation)*18 + t*(star.layer+1)*.08)*parallax;
      let y = star.y*h + (pointerY*21 + Math.cos(rotation*.63)*7)*parallax;
      x=((x%w)+w)%w; y=((y%h)+h)%h;
      const pulse=.78+Math.sin(t*(.55+star.depth*1.8)+star.phase)*.20;
      const alpha=(.14+(1-star.depth)*.70)*pulse;
      const size=star.size*(.44+(1-star.depth)*1.45);
      ctx.fillStyle=star.warm?`rgba(255,219,176,${alpha})`:`rgba(188,230,249,${alpha})`;
      if(size>1.5){ctx.shadowBlur=5+size*2;ctx.shadowColor=star.warm?"#ffb66a":"#77d9ff";}
      ctx.beginPath();ctx.arc(x,y,Math.max(.3,size),0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    }
    drawDistantSystem(ctx,w,h,t);
    return true;
  }

  function drawDistantSystem(ctx,w,h,t) {
    const compact=w<800,cx=w*(compact?.80:.835)+pointerX*8,cy=h*(compact?.19:.215)+pointerY*4;
    const sr=Math.max(7,Math.min(w,h)*(compact?.012:.015));
    const state=app?.state?.star;
    const collapsed=state?.state==="collapsed";
    const bond=clampLocal(Number(state?.bond_index ?? 1),0,1);
    if(collapsed){
      const lens=ctx.createRadialGradient(cx,cy,sr*.55,cx,cy,sr*7.5);
      lens.addColorStop(0,"rgba(0,0,0,1)");lens.addColorStop(.15,"rgba(0,0,0,1)");lens.addColorStop(.22,"rgba(255,170,74,.86)");lens.addColorStop(.30,"rgba(255,72,40,.18)");lens.addColorStop(.55,"rgba(82,199,255,.06)");lens.addColorStop(1,"rgba(0,0,0,0)");
      ctx.fillStyle=lens;ctx.beginPath();ctx.arc(cx,cy,sr*7.5,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#000";ctx.beginPath();ctx.arc(cx,cy,sr*1.12,0,Math.PI*2);ctx.fill();
    } else {
      const corona=ctx.createRadialGradient(cx,cy,0,cx,cy,sr*(7.6+bond*2));
      corona.addColorStop(0,"rgba(255,255,246,1)");corona.addColorStop(.08,"rgba(255,236,174,.98)");corona.addColorStop(.24,`rgba(255,170,69,${.30+bond*.25})`);corona.addColorStop(.58,"rgba(255,99,27,.08)");corona.addColorStop(1,"rgba(255,80,20,0)");
      ctx.fillStyle=corona;ctx.beginPath();ctx.arc(cx,cy,sr*(7.6+bond*2),0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#fff8d6";ctx.shadowBlur=sr*3;ctx.shadowColor="#ffae48";ctx.beginPath();ctx.arc(cx,cy,sr*(.72+bond*.28),0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    }
    const radii=compact?[2.7,4.25,6.0]:[2.55,3.85,5.25,6.8];
    const bodies=[{s:.34,c:"#a9d9e8",v:.017,p:.5},{s:.48,c:"#bc8c6c",v:.0105,p:2.1},{s:.64,c:"#5d94c1",v:.0068,p:4.35,moon:true},{s:.43,c:"#b9a86d",v:.0039,p:5.65,ring:true}];
    radii.forEach((r,i)=>{
      const rx=sr*r*2.25,ry=rx*(.265+i*.027),b=bodies[i],a=b.p+t*b.v;
      ctx.strokeStyle=`rgba(95,185,214,${.08+i*.02})`;ctx.lineWidth=.8;ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,-.17,0,Math.PI*2);ctx.stroke();
      const px=cx+Math.cos(a)*rx,py=cy+Math.sin(a)*ry,pr=Math.max(1.35,sr*b.s);
      const g=ctx.createRadialGradient(px-pr*.35,py-pr*.35,0,px,py,pr);g.addColorStop(0,"rgba(255,255,255,.92)");g.addColorStop(.25,b.c);g.addColorStop(1,"rgba(5,9,13,.98)");ctx.fillStyle=g;ctx.beginPath();ctx.arc(px,py,pr,0,Math.PI*2);ctx.fill();
      if(b.ring){ctx.strokeStyle="rgba(220,199,137,.52)";ctx.beginPath();ctx.ellipse(px,py,pr*2.05,pr*.56,-.22,0,Math.PI*2);ctx.stroke();}
      if(b.moon){const ma=a*2.65+.85,mr=pr*2.25;ctx.fillStyle="rgba(205,222,229,.82)";ctx.beginPath();ctx.arc(px+Math.cos(ma)*mr,py+Math.sin(ma)*mr*.45,Math.max(.7,pr*.22),0,Math.PI*2);ctx.fill();}
    });
  }

  function drawFallbackSphere(ctx,cx,cy,radius) {
    const g=ctx.createRadialGradient(cx-radius*.34,cy-radius*.32,radius*.04,cx,cy,radius);
    g.addColorStop(0,"#8ce5e2");g.addColorStop(.15,"#4aa6a8");g.addColorStop(.48,"#1e6570");g.addColorStop(.76,"#0a2938");g.addColorStop(1,"#01070c");
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy,radius,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle="rgba(95,233,255,.44)";ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(cx,cy,radius+.5,0,Math.PI*2);ctx.stroke();
  }

  function drawPlanet() {
    if (!app?.state) return false;
    const { ctx, w, h } = context(planet, 1.6);
    if (w < 8 || h < 8) return false;
    ctx.clearRect(0,0,w,h);
    const geo = typeof planetGeometry === "function" ? planetGeometry(planet) : {cx:w*.5,cy:h*.49,radius:Math.max(90,Math.min(w,h)*.395)};
    const {cx,cy,radius}=geo;
    drawFallbackSphere(ctx,cx,cy,radius);
    const halo=ctx.createRadialGradient(cx,cy,radius*.82,cx,cy,radius*1.17);halo.addColorStop(0,"rgba(38,137,177,0)");halo.addColorStop(.72,"rgba(55,188,227,.025)");halo.addColorStop(.88,"rgba(75,217,255,.16)");halo.addColorStop(1,"rgba(75,217,255,0)");ctx.fillStyle=halo;ctx.beginPath();ctx.arc(cx,cy,radius*1.18,0,Math.PI*2);ctx.fill();
    try {
      const state=app.state,rows=state.planet.rows,cols=state.planet.cols,rot=Number(app.planetRotation||0),cosR=Math.cos(rot),sinR=Math.sin(rot),step=radius>250?3:4;
      for(let py=-radius;py<=radius;py+=step){const sy=-py/radius;for(let px=-radius;px<=radius;px+=step){const sx=px/radius,q=sx*sx+sy*sy;if(q>=1)continue;const sz=Math.sqrt(1-q),worldX=sx*cosR-sz*sinR,worldZ=sx*sinR+sz*cosR,lat=Math.asin(clampLocal(sy,-1,1)),lon=Math.atan2(worldZ,worldX);const row=clampLocal(Math.round(((lat+Math.PI/2)/Math.PI)*(rows-1)),0,rows-1);let col=Math.floor(((lon+Math.PI)/(2*Math.PI))*cols);col=((col%cols)+cols)%cols;ctx.fillStyle=typeof colorForPlanet==="function"?colorForPlanet(row,col,sz):"#256c73";ctx.fillRect(cx+px,cy+py,step+.8,step+.8);}}
      ctx.save();ctx.beginPath();ctx.arc(cx,cy,radius,0,Math.PI*2);ctx.clip();const sheen=ctx.createLinearGradient(cx-radius,cy-radius,cx+radius,cy+radius);sheen.addColorStop(0,"rgba(220,248,255,.18)");sheen.addColorStop(.34,"rgba(255,255,255,.01)");sheen.addColorStop(.7,"rgba(0,0,0,.14)");sheen.addColorStop(1,"rgba(0,0,0,.64)");ctx.fillStyle=sheen;ctx.fillRect(cx-radius,cy-radius,radius*2,radius*2);if(typeof drawStarsilkThreads==="function")drawStarsilkThreads(ctx,cx,cy,radius);ctx.restore();
    } catch(error) {
      console.error("Guaranteed core planet map pass degraded to fallback sphere.",error);
    }
    wrap.dataset.corePlanetFrame = "painted";
    return true;
  }

  function schedule() {
    if (!app?.state || app.view !== "planet") return;
    if (redrawFrame) cancelAnimationFrame(redrawFrame);
    redrawFrame=requestAnimationFrame(()=>{redrawFrame=0;drawPlanet();});
  }

  const previousRenderAll=renderAll;
  if(typeof previousRenderAll==="function") renderAll=function coreSurfaceRenderAll(){previousRenderAll();schedule();};
  const previousDrawActive=drawActiveCanvases;
  if(typeof previousDrawActive==="function") drawActiveCanvases=function coreSurfaceDrawActive(){previousDrawActive();schedule();};

  if(typeof ResizeObserver==="function"){resizeObserver=new ResizeObserver(schedule);resizeObserver.observe(wrap);}
  wrap.addEventListener("pointermove",event=>{const r=wrap.getBoundingClientRect();if(r.width&&r.height){pointerX=((event.clientX-r.left)/r.width-.5)*2;pointerY=((event.clientY-r.top)/r.height-.5)*2;}schedule();},{passive:true});
  base.addEventListener("pointerup",schedule,{passive:true});
  window.addEventListener("resize",schedule,{passive:true});
  document.querySelectorAll('.nav-button[data-view="planet"]').forEach(button=>button.addEventListener("click",()=>setTimeout(schedule,0)));
  for(const ms of [0,40,160,500,1200])setTimeout(schedule,ms);

  function animate(time){
    if(app?.view==="planet" && time-lastSpaceFrame>33){lastSpaceFrame=time;try{drawSpace(time);}catch(error){console.error("Guaranteed space renderer failed.",error);}}
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
})();

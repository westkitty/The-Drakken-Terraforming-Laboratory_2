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

/* v1.6 direct-manipulation interaction layer. Simulation mutations still route
   through the existing authoritative API; this block only changes interaction. */
(() => {
  const q=(s,r=document)=>r.querySelector(s), qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const camera={planet:{zoom:1,velocity:0},incubator:{zoom:1,velocity:0}};
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let paletteCell=null, momentumFrame=0;

  function stageCanvas(kind){ return q(kind==='planet'?'#planet-canvas':'#incubator-canvas'); }
  function setZoom(kind,value){
    const next=clamp(value,.72,1.72); camera[kind].zoom=next;
    q(`#view-${kind}`)?.style.setProperty('--ir-zoom',String(next));
    q('#ir-camera-readout')?.replaceChildren(document.createTextNode(`${Math.round(next*100)}%`));
  }
  function zoomBy(kind,delta){ setZoom(kind,camera[kind].zoom*Math.exp(delta)); }
  function resetCamera(kind){
    setZoom(kind,1); camera[kind].velocity=0;
    if(kind==='planet') app.planetRotation=.45; else app.specimenRotation=.45;
  }
  function rotationKey(kind){ return kind==='planet'?'planetRotation':'specimenRotation'; }

  function installCamera(kind){
    const canvas=stageCanvas(kind); if(!canvas) return;
    canvas.closest('.canvas-wrap')?.classList.add('ir-direct-stage');
    let sample=null, pinching=null;
    canvas.addEventListener('pointerdown',e=>{ sample={x:e.clientX,t:performance.now()}; camera[kind].velocity=0; },true);
    canvas.addEventListener('pointermove',e=>{
      if(!sample || !(e.buttons&1)) return;
      const now=performance.now(),dt=Math.max(4,now-sample.t),dx=e.clientX-sample.x;
      camera[kind].velocity=(dx*.008)*(16.67/dt); sample={x:e.clientX,t:now};
    },true);
    const release=()=>{ sample=null; if(!reduced) coast(kind); };
    canvas.addEventListener('pointerup',release,true); canvas.addEventListener('pointercancel',release,true);
    canvas.addEventListener('wheel',e=>{ e.preventDefault(); zoomBy(kind,-e.deltaY*.00115); },{passive:false});
    canvas.addEventListener('dblclick',e=>{ e.preventDefault(); if(e.shiftKey) resetCamera(kind); else zoomBy(kind,.22); });
    canvas.addEventListener('touchstart',e=>{
      if(e.touches.length===2){ const [a,b]=e.touches; pinching={d:Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY),z:camera[kind].zoom}; }
    },{passive:true});
    canvas.addEventListener('touchmove',e=>{
      if(e.touches.length!==2||!pinching)return; const [a,b]=e.touches; const d=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY); setZoom(kind,pinching.z*d/Math.max(1,pinching.d));
    },{passive:true});
    canvas.addEventListener('touchend',()=>{pinching=null},{passive:true});
  }
  function coast(kind){
    cancelAnimationFrame(momentumFrame); let v=camera[kind].velocity; if(Math.abs(v)<.002)return;
    const tick=()=>{ v*=.935; camera[kind].velocity=v; app[rotationKey(kind)]+=v; if(typeof drawActiveCanvases==='function') drawActiveCanvases(); if(Math.abs(v)>.001) momentumFrame=requestAnimationFrame(tick); };
    momentumFrame=requestAnimationFrame(tick);
  }

  function addInspector(){
    const view=q('#view-planet'),canvas=q('#planet-canvas'); if(!view||!canvas)return;
    const panel=document.createElement('aside'); panel.id='ir-cell-inspector'; panel.className='ir-float-card';
    panel.innerHTML='<b>LIVE CELL</b><strong id="ir-cell-id">—</strong><dl><dt>TEMP</dt><dd id="ir-temp">—</dd><dt>ELEV</dt><dd id="ir-elev">—</dd><dt>PRESS</dt><dd id="ir-pressure">—</dd><dt>CO₂</dt><dd id="ir-co2">—</dd><dt>STRESS</dt><dd id="ir-stress">—</dd></dl><small>RIGHT-CLICK // DIRECT TERRAFORM</small>';
    view.appendChild(panel);
    canvas.addEventListener('pointermove',e=>{
      if(!app.state)return; const r=canvas.getBoundingClientRect(); const cell=planetCellFromPoint(e.clientX-r.left,e.clientY-r.top,canvas); if(!cell){panel.classList.remove('visible');return;}
      const m=app.state.planet.maps,row=cell.row,col=cell.col; panel.classList.add('visible');
      q('#ir-cell-id').textContent=`${String(row).padStart(2,'0')} / ${String(col).padStart(2,'0')}`;
      q('#ir-temp').textContent=`${Number(m.temperature_k[row][col]).toFixed(1)} K`;
      q('#ir-elev').textContent=`${Number(m.elevation_m[row][col]).toFixed(0)} m`;
      q('#ir-pressure').textContent=`${(Number(m.pressure_pa[row][col])/1000).toFixed(2)} kPa`;
      q('#ir-co2').textContent=`${(Number(m.co2_fraction[row][col])*1e6).toFixed(1)} ppm`;
      q('#ir-stress').textContent=`${Number(m.stress_pa?.[row]?.[col]||0).toExponential(2)} Pa`;
    });
    canvas.addEventListener('pointerleave',()=>panel.classList.remove('visible'));
  }

  const tools=[['heat','HEAT','△'],['cool','COOL','▽'],['uplift','UPLIFT','↑'],['fracture','FRACTURE','✦'],['pressure','PRESSURE','◉'],['co2','CO₂','C']];
  function installRadialPalette(){
    const canvas=q('#planet-canvas'); if(!canvas)return;
    const menu=document.createElement('div'); menu.id='ir-radial'; menu.innerHTML=tools.map(([id,label,icon],i)=>`<button data-tool="${id}" style="--i:${i}"><i>${icon}</i><span>${label}</span></button>`).join('')+'<div class="ir-radial-core">COMMIT</div>';
    document.body.appendChild(menu);
    const hide=()=>menu.classList.remove('open');
    canvas.addEventListener('contextmenu',e=>{
      e.preventDefault(); if(app.state?.inert)return; const r=canvas.getBoundingClientRect(); const cell=planetCellFromPoint(e.clientX-r.left,e.clientY-r.top,canvas); if(!cell)return;
      paletteCell=cell; menu.style.left=`${e.clientX}px`;menu.style.top=`${e.clientY}px`;menu.classList.add('open');
    });
    qa('button',menu).forEach(btn=>btn.addEventListener('click',async()=>{
      if(!paletteCell)return; const tool=btn.dataset.tool; app.planetTool=tool;
      qa('#planet-tools .tool-button').forEach(n=>n.classList.toggle('active',n.dataset.tool===tool));
      await mutate('/api/planet/brush',{tool,row:paletteCell.row,col:paletteCell.col,intensity:Number(q('#tool-intensity')?.value||45),radius:Number(q('#tool-radius')?.value||3)});
      hide(); toast(`${tool.toUpperCase()} committed at cell ${paletteCell.row}/${paletteCell.col}.`);
    }));
    document.addEventListener('pointerdown',e=>{if(!menu.contains(e.target)&&e.target!==canvas)hide();},true);
  }

  function installStarbindingAim(){
    const canvas=q('#starbinding-canvas'),angle=q('#dive-angle'),offset=q('#dive-offset'); if(!canvas||!angle||!offset)return;
    const tip=document.createElement('div');tip.className='ir-aim-tip';tip.textContent='CLICK // AIM ANGLE   SHIFT+CLICK // OFFSET';canvas.parentElement.appendChild(tip);
    canvas.addEventListener('click',e=>{
      const r=canvas.getBoundingClientRect(),nx=clamp((e.clientX-r.left)/r.width,0,1),ny=clamp((e.clientY-r.top)/r.height,0,1);
      if(e.shiftKey){offset.value=String(Math.round((.5-ny)*1200));offset.dispatchEvent(new Event('input',{bubbles:true}));}
      else {angle.value=String(Math.round((nx-.5)*300));angle.dispatchEvent(new Event('input',{bubbles:true}));}
    });
  }

  function installSiegeInspector(){
    const canvas=q('#siege-canvas'),view=q('#view-siege');if(!canvas||!view)return;
    const tip=document.createElement('div');tip.id='ir-node-tip';tip.className='ir-float-card';view.appendChild(tip);
    canvas.addEventListener('pointermove',e=>{
      const nodes=app.state?.siege_wall?.nodes||[];if(!nodes.length){tip.classList.remove('visible');return;}const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,cx=r.width/2,cy=r.height/2,rr=Math.min(r.width,r.height)*.36;
      let best=null,bd=Infinity;for(const n of nodes){const px=cx+n.x*rr,py=cy+n.y*rr,d=Math.hypot(px-x,py-y);if(d<bd){bd=d;best=n;}}
      if(!best||bd>28){tip.classList.remove('visible');return;}tip.classList.add('visible');tip.style.left=`${Math.min(r.width-180,x+16)}px`;tip.style.top=`${Math.max(40,y-12)}px`;tip.innerHTML=`<b>${best.id}</b><strong>${best.utilization==null?'UNSOLVED':(best.utilization*100).toFixed(1)+'%'}</strong><small>${best.load_m_s2==null?'NO LOAD':Number(best.load_m_s2).toExponential(2)+' m/s²'}</small>`;
    }); canvas.addEventListener('pointerleave',()=>tip.classList.remove('visible'));
  }

  function clickDrawer(side){ q(`.lab-view.active .df-drawer-${side} > .df-drawer-handle`)?.click(); }
  function installSwipeEdges(){
    ['left','right','bottom'].forEach(side=>{const z=document.createElement('div');z.className=`ir-edge-zone ir-edge-${side}`;z.setAttribute('aria-label',`Open ${side} controls`);document.body.appendChild(z);let s=null;z.addEventListener('pointerdown',e=>{s={x:e.clientX,y:e.clientY};z.setPointerCapture(e.pointerId)});z.addEventListener('pointerup',e=>{if(!s)return;const dx=e.clientX-s.x,dy=e.clientY-s.y;const ok=side==='left'?dx>34:side==='right'?dx<-34:dy<-34;if(ok)clickDrawer(side);s=null;});});
  }

  function installCommandPalette(){
    const overlay=document.createElement('div');overlay.id='ir-command';overlay.innerHTML='<div class="ir-command-box"><div class="ir-command-head"><b>COMMAND INDEX</b><span>ESC</span></div><input id="ir-command-input" placeholder="Search stations and actions…" autocomplete="off"><div id="ir-command-list"></div></div>';document.body.appendChild(overlay);
    const commands=[['Planet','planet'],['Macro Runtime','macro'],['Starbinding','starbinding'],['Siege Wall','siege'],['Incubator','incubator'],['Telemetry','telemetry'],['Left controls','left'],['Right telemetry','right'],['Bottom controls','bottom'],['Toggle HUD','hud'],['Reset camera','camera']];
    const input=q('#ir-command-input'),list=q('#ir-command-list');
    const render=()=>{const term=input.value.trim().toLowerCase();list.innerHTML=commands.filter(c=>c[0].toLowerCase().includes(term)).map((c,i)=>`<button data-cmd="${c[1]}"><span>${c[0]}</span><kbd>${i+1}</kbd></button>`).join('');qa('button',list).forEach(b=>b.addEventListener('click',()=>run(b.dataset.cmd)));};
    const run=cmd=>{if(['planet','macro','starbinding','siege','incubator','telemetry'].includes(cmd))q(`.nav-button[data-view="${cmd}"]`)?.click();else if(['left','right','bottom'].includes(cmd))clickDrawer(cmd);else if(cmd==='hud')q('#df-hud-toggle')?.click();else if(cmd==='camera'){resetCamera('planet');resetCamera('incubator');}overlay.classList.remove('open');};
    const open=()=>{overlay.classList.add('open');input.value='';render();setTimeout(()=>input.focus(),0)};input.addEventListener('input',render);overlay.addEventListener('pointerdown',e=>{if(e.target===overlay)overlay.classList.remove('open')});
    document.addEventListener('keydown',e=>{const editing=e.target.matches?.('input,textarea,select');if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();open();return;}if(!editing&&e.key==='/'){e.preventDefault();open();return;}if(e.key==='Escape')overlay.classList.remove('open');if(!editing&&/^[1-6]$/.test(e.key)){const stations=['planet','macro','starbinding','siege','incubator','telemetry'];q(`.nav-button[data-view="${stations[Number(e.key)-1]}"]`)?.click();}if(!editing&&app.view==='planet'){if(e.key==='ArrowLeft')app.planetRotation-=.12;else if(e.key==='ArrowRight')app.planetRotation+=.12;else if(e.key==='+'||e.key==='=')zoomBy('planet',.12);else if(e.key==='-')zoomBy('planet',-.12);else if(e.key==='0')resetCamera('planet');}if(app.view==='macro'&&(e.metaKey||e.ctrlKey)&&e.key==='Enter'){e.preventDefault();q('#macro-compile')?.click();setTimeout(()=>q('#macro-run')?.click(),50);}if(app.view==='macro'&&e.key==='F10'){e.preventDefault();q('#macro-step')?.click();}});
  }

  function installResponsiveReadout(){
    const node=document.createElement('div');node.id='ir-camera-readout';node.textContent='100%';document.body.appendChild(node);
    let last=performance.now(),samples=[];const tick=t=>{samples.push(t-last);last=t;if(samples.length>45)samples.shift();const avg=samples.reduce((a,b)=>a+b,0)/samples.length;document.body.dataset.irQuality=avg>28?'economy':avg>20?'balanced':'high';requestAnimationFrame(tick)};requestAnimationFrame(tick);
  }

  function init(){
    document.body.classList.add('interaction-v16');installCamera('planet');installCamera('incubator');addInspector();installRadialPalette();installStarbindingAim();installSiegeInspector();installSwipeEdges();installCommandPalette();installResponsiveReadout();setZoom('planet',1);setZoom('incubator',1);
  }
  init();
})();

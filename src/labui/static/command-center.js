"use strict";

/* Command-center renderer.
   Presentation-only animation is intentionally separate from deterministic
   simulation state. All mutations still travel through the existing API. */
(() => {
  document.body.classList.add("command-center");

  const glStages = new Map();
  const hudStages = new Map();
  let webglAvailable = true;
  let lastFrame = 0;

  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const deg = (r) => r * 180 / Math.PI;

  function installStationIntro() {
    const library = $(".incubator-library");
    if (!library || $(".cc-station-intro", library)) return;
    library.insertAdjacentHTML("afterbegin", `
      <section class="cc-station-intro">
        <div class="eyebrow">STATION 05 // NOTEBOOK PROGRAM</div>
        <h2>Drakken Egg &amp; Specimen Incubator</h2>
        <p>Hatch a deterministic Drakken phenotype into the shared planetary solver, then watch its Notebook field rewrite the world.</p>
      </section>`);
  }

  function floatingPanels(kind) {
    const shared = `
      <div class="cc-holo-platform"></div><div class="cc-beam"></div><div class="cc-orbit"></div>
      <div class="cc-stage-label"><strong>SHARED PLANET</strong><span class="cc-stage-status">FIELD NOMINAL</span></div>
      <div class="cc-floating-panel cc-layer-stack"><b>LAYER STACK</b>
        <span data-cc-mode="composite" class="active">TOPOGRAPHY</span><span data-cc-mode="thermal">THERMAL</span>
        <span data-cc-mode="atmosphere">ATMOSPHERIC</span><span>PRESSURE</span><span data-cc-mode="lithosphere">STRESS</span><span data-cc-mode="starsilk">STARSILK FIELD</span>
      </div>
      <div class="cc-floating-panel cc-stability"><b>FIELD STABILITY</b><div class="ring"><span class="cc-stability-value">100%</span></div><small class="cc-stability-label">STABLE</small></div>
      <div class="cc-floating-panel cc-orbital-context"><b>ORBITAL CONTEXT</b><div class="mini-orbit"><i></i></div><dl><dt>STAR</dt><dd>K2 V</dd><dt>ROTATION</dt><dd>24.7 h</dd><dt>AXIAL</dt><dd>23.4°</dd></dl></div>
      <div class="cc-floating-panel cc-field-card"><b>NOTEBOOK FIELD</b><div class="cc-field-glyph"><i></i></div><span class="cc-field-pulse">PULSE 000</span></div>`;
    if (kind === "planet") return shared.replace("NOTEBOOK FIELD", "STARSILK FIELD");
    return shared;
  }

  function installStage(baseId, kind) {
    const base = $(baseId);
    if (!base || base.dataset.ccInstalled) return;
    base.dataset.ccInstalled = "1";
    const wrap = base.parentElement;
    const glCanvas = document.createElement("canvas");
    glCanvas.className = "cc-globe-layer";
    glCanvas.setAttribute("aria-hidden", "true");
    const hudCanvas = document.createElement("canvas");
    hudCanvas.className = "cc-globe-hud";
    hudCanvas.setAttribute("aria-hidden", "true");
    wrap.insertBefore(glCanvas, base);
    wrap.insertBefore(hudCanvas, base);
    wrap.insertAdjacentHTML("beforeend", floatingPanels(kind));
    try {
      glStages.set(kind, new GlobeRenderer(glCanvas, kind));
    } catch (error) {
      console.warn("Command-center WebGL unavailable; using cinematic Canvas renderer.", error);
      document.body.classList.add("cc-canvas-renderer");
      glStages.set(kind, new CanvasGlobeRenderer(glCanvas, kind));
    }
    hudStages.set(kind, { canvas: hudCanvas, kind });
  }

  class GlobeRenderer {
    constructor(canvas, kind) {
      this.canvas = canvas;
      this.kind = kind;
      this.gl = canvas.getContext("webgl2", { alpha: true, antialias: true, premultipliedAlpha: false });
      if (!this.gl) throw new Error("WebGL2 is unavailable");
      this.lastRevision = -1;
      this.program = this.createProgram(VERTEX_SHADER, FRAGMENT_SHADER);
      this.locations = this.getLocations();
      this.buffers = this.createSphere(72, 144);
      this.texture = this.gl.createTexture();
      this.stressTexture = this.gl.createTexture();
      for (const texture of [this.texture, this.stressTexture]) {
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
      }
      this.gl.enable(this.gl.BLEND);
      this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
      this.gl.enable(this.gl.DEPTH_TEST);
      this.gl.depthFunc(this.gl.LEQUAL);
    }

    createShader(type, source) {
      const shader = this.gl.createShader(type);
      this.gl.shaderSource(shader, source);
      this.gl.compileShader(shader);
      if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
        throw new Error(this.gl.getShaderInfoLog(shader) || "shader compilation failed");
      }
      return shader;
    }

    createProgram(vertex, fragment) {
      const program = this.gl.createProgram();
      this.gl.attachShader(program, this.createShader(this.gl.VERTEX_SHADER, vertex));
      this.gl.attachShader(program, this.createShader(this.gl.FRAGMENT_SHADER, fragment));
      this.gl.linkProgram(program);
      if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
        throw new Error(this.gl.getProgramInfoLog(program) || "shader link failed");
      }
      return program;
    }

    getLocations() {
      const gl = this.gl, p = this.program;
      return {
        position: gl.getAttribLocation(p, "aPosition"), normal: gl.getAttribLocation(p, "aNormal"), uv: gl.getAttribLocation(p, "aUv"),
        rotation: gl.getUniformLocation(p, "uRotation"), tilt: gl.getUniformLocation(p, "uTilt"), aspect: gl.getUniformLocation(p, "uAspect"),
        scale: gl.getUniformLocation(p, "uScale"), yOffset: gl.getUniformLocation(p, "uYOffset"), mode: gl.getUniformLocation(p, "uMode"),
        inert: gl.getUniformLocation(p, "uInert"), time: gl.getUniformLocation(p, "uTime"), atmosphere: gl.getUniformLocation(p, "uAtmosphere"),
        data: gl.getUniformLocation(p, "uData"), stress: gl.getUniformLocation(p, "uStress"),
      };
    }

    createSphere(latSegments, lonSegments) {
      const positions = [], normals = [], uvs = [], indices = [];
      for (let y = 0; y <= latSegments; y += 1) {
        const v = y / latSegments;
        const lat = (v - 0.5) * Math.PI;
        const cl = Math.cos(lat), sl = Math.sin(lat);
        for (let x = 0; x <= lonSegments; x += 1) {
          const u = x / lonSegments;
          const lon = (u - 0.5) * Math.PI * 2;
          const px = cl * Math.cos(lon), py = sl, pz = cl * Math.sin(lon);
          positions.push(px, py, pz); normals.push(px, py, pz); uvs.push(u, 1 - v);
        }
      }
      const stride = lonSegments + 1;
      for (let y = 0; y < latSegments; y += 1) {
        for (let x = 0; x < lonSegments; x += 1) {
          const a = y * stride + x, b = a + stride, c = b + 1, d = a + 1;
          indices.push(a, b, d, b, c, d);
        }
      }
      const gl = this.gl;
      const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      const bind = (data, location, size) => {
        const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0); return buffer;
      };
      bind(positions, this.locations.position, 3); bind(normals, this.locations.normal, 3); bind(uvs, this.locations.uv, 2);
      const indexBuffer = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
      gl.bindVertexArray(null);
      return { vao, count: indices.length };
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(rect.width * dpr)), height = Math.max(1, Math.round(rect.height * dpr));
      if (this.canvas.width !== width || this.canvas.height !== height) { this.canvas.width = width; this.canvas.height = height; }
      this.gl.viewport(0, 0, width, height);
      return { width: rect.width, height: rect.height, aspect: rect.width / Math.max(1, rect.height) };
    }

    updateTexture() {
      if (!app.state || this.lastRevision === app.state.revision) return;
      this.lastRevision = app.state.revision;
      const planet = app.state.planet, rows = planet.rows, cols = planet.cols;
      const data = new Uint8Array(rows * cols * 4);
      const stressData = new Uint8Array(rows * cols * 4);
      let i = 0, si = 0;
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const temp = planet.maps.temperature_k[row][col];
          const elev = planet.maps.elevation_m[row][col];
          const pressure = planet.maps.pressure_pa[row][col];
          const co2 = planet.maps.co2_fraction[row][col];
          data[i++] = Math.round(clamp01((temp - 210) / 180) * 255);
          data[i++] = Math.round(clamp01((elev + 5000) / 11000) * 255);
          data[i++] = Math.round(clamp01((pressure - 20000) / 130000) * 255);
          data[i++] = Math.round(clamp01(co2 / 0.008) * 255);
          const stress = planet.maps.stress_pa ? planet.maps.stress_pa[row][col] : 0;
          const sn = clamp01(Math.log10(1 + Math.max(0, stress)) / 9);
          stressData[si++] = Math.round(sn * 255); stressData[si++] = 0; stressData[si++] = 0; stressData[si++] = 255;
        }
      }
      const gl = this.gl; gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.bindTexture(gl.TEXTURE_2D, this.texture); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, cols, rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
      gl.bindTexture(gl.TEXTURE_2D, this.stressTexture); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, cols, rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, stressData);
    }

    render(time) {
      if (!app.state) return;
      const { aspect } = this.resize(); this.updateTexture();
      const gl = this.gl; gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(this.program); gl.bindVertexArray(this.buffers.vao); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.texture); gl.uniform1i(this.locations.data, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.stressTexture); gl.uniform1i(this.locations.stress, 1);
      const rotation = this.kind === "incubator" ? app.specimenRotation - Math.PI / 2 : app.planetRotation;
      gl.uniform1f(this.locations.rotation, rotation); gl.uniform1f(this.locations.tilt, -0.10); gl.uniform1f(this.locations.aspect, aspect);
      gl.uniform1f(this.locations.yOffset, this.kind === "incubator" ? 0.035 : 0.02); gl.uniform1f(this.locations.time, time * 0.001);
      gl.uniform1f(this.locations.mode, modeValue(this.kind)); gl.uniform1f(this.locations.inert, app.state.inert ? 1 : 0);
      gl.uniform1f(this.locations.scale, 0.79); gl.uniform1f(this.locations.atmosphere, 0); gl.depthMask(true); gl.drawElements(gl.TRIANGLES, this.buffers.count, gl.UNSIGNED_SHORT, 0);
      gl.uniform1f(this.locations.scale, 0.825); gl.uniform1f(this.locations.atmosphere, 1); gl.depthMask(false); gl.blendFunc(gl.SRC_ALPHA, gl.ONE); gl.drawElements(gl.TRIANGLES, this.buffers.count, gl.UNSIGNED_SHORT, 0);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(true); gl.bindVertexArray(null);
    }
  }


  function sampleMap(map, rowF, colF) {
    const rows=map.length, cols=map[0].length;
    const r0=Math.max(0,Math.min(rows-1,Math.floor(rowF))), r1=Math.max(0,Math.min(rows-1,r0+1));
    const c0=((Math.floor(colF)%cols)+cols)%cols, c1=(c0+1)%cols;
    const fr=rowF-r0, fc=colF-Math.floor(colF);
    const a=map[r0][c0]*(1-fc)+map[r0][c1]*fc, b=map[r1][c0]*(1-fc)+map[r1][c1]*fc;
    return a*(1-fr)+b*fr;
  }

  class CanvasGlobeRenderer {
    constructor(canvas, kind) { this.canvas=canvas; this.kind=kind; this.lastKey=""; }
    resize() {
      const rect=this.canvas.getBoundingClientRect(), dpr=Math.min(window.devicePixelRatio||1,1.6);
      const width=Math.max(1,Math.round(rect.width*dpr)),height=Math.max(1,Math.round(rect.height*dpr));
      if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;this.lastKey="";}
      const ctx=this.canvas.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);return{ctx,w:rect.width,h:rect.height};
    }
    render(time){
      if(!app.state)return; const {ctx,w,h}=this.resize(); const rotation=this.kind==="incubator"?app.specimenRotation:app.planetRotation;
      const key=[app.state.revision,this.kind==="planet"?app.planetMode:"composite",rotation.toFixed(4),Math.round(w),Math.round(h),app.state.inert].join("|");
      if(key===this.lastKey)return; this.lastKey=key; ctx.clearRect(0,0,w,h);
      const radius=Math.min(w,h)*.395,cx=w*.5,cy=h*.49;
      // Halo and faint projector bloom.
      let halo=ctx.createRadialGradient(cx,cy,radius*.72,cx,cy,radius*1.16);halo.addColorStop(0,"rgba(42,207,255,0)");halo.addColorStop(.72,"rgba(42,207,255,.025)");halo.addColorStop(.88,app.state.inert?"rgba(255,80,104,.12)":"rgba(58,224,255,.19)");halo.addColorStop(1,"rgba(53,232,255,0)");ctx.fillStyle=halo;ctx.beginPath();ctx.arc(cx,cy,radius*1.18,0,Math.PI*2);ctx.fill();
      const rows=app.state.planet.rows,cols=app.state.planet.cols,maps=app.state.planet.maps;
      const step=2; const cosR=Math.cos(rotation),sinR=Math.sin(rotation);
      ctx.save();ctx.beginPath();ctx.arc(cx,cy,radius,0,Math.PI*2);ctx.clip();
      for(let py=-radius;py<=radius;py+=step){const sy=-py/radius;for(let px=-radius;px<=radius;px+=step){const sx=px/radius,q=sx*sx+sy*sy;if(q>=1)continue;const sz=Math.sqrt(1-q);let lon;
        if(this.kind==="incubator"){const worldX=sx*cosR+sz*sinR,worldZ=-sx*sinR+sz*cosR;lon=Math.atan2(worldX,worldZ);}else{const worldX=sx*cosR-sz*sinR,worldZ=sx*sinR+sz*cosR;lon=Math.atan2(worldZ,worldX);}
        const lat=Math.asin(clamp(sy,-1,1));const rowF=clamp(((lat+Math.PI/2)/Math.PI)*(rows-1),0,rows-1);let colF=((lon+Math.PI)/(2*Math.PI))*cols;colF=((colF%cols)+cols)%cols;
        const temp=sampleMap(maps.temperature_k,rowF,colF),elev=sampleMap(maps.elevation_m,rowF,colF),pressure=sampleMap(maps.pressure_pa,rowF,colF),co2=sampleMap(maps.co2_fraction,rowF,colF),stress=maps.stress_pa?sampleMap(maps.stress_pa,rowF,colF):0;const mode=this.kind==="planet"?app.planetMode:"composite";let r,g,b;
        if(mode==="thermal"){const t=clamp((temp-220)/150,0,1);r=18+237*t;g=42+145*(1-Math.abs(t-.55)*1.7);b=105+125*(1-t);}else if(mode==="lithosphere"){const e=clamp((elev+4200)/8500,0,1);r=18+160*e;g=62+120*e;b=72+42*(1-e);}else if(mode==="atmosphere"){const pp=clamp((pressure-30000)/100000,0,1),c=clamp(co2/.006,0,1);r=10+56*c;g=55+150*pp;b=98+145*pp-48*c;}else if(mode==="starsilk"){const field=.5+.5*Math.sin(col*.54+row*.27);r=4+18*field;g=35+135*field;b=61+183*field;}else if(elev<0){const depth=clamp(-elev/3800,0,1),warm=clamp((temp-235)/90,0,1);r=4+18*warm;g=25+65*warm;b=70+95*(1-depth);}else{const e=clamp(elev/4200,0,1),warm=clamp((temp-235)/100,0,1);r=24+92*e+42*warm;g=68+95*(1-e)+30*warm;b=62+38*(1-e);}
        const light=clamp(.18+.76*(sz*.72+sx*(-.22)+sy*.28),.12,1.08),rim=Math.pow(1-sz,2.1);
        const micro=.93+.07*Math.sin(lon*41.0+Math.sin(lat*19.0)*2.1)*Math.sin(lat*53.0-lon*17.0);r*=light*micro;g*=light*micro;b*=light*micro;
        const hot=clamp((temp-315)/70,0,1);if(mode==="composite"&&hot>0){r+=230*hot;g+=52*hot;b+=5*hot;}
        const stressN=clamp(Math.log10(1+Math.max(0,stress))/9.0,0,1);const crackA=Math.pow(1-Math.abs(Math.sin(lon*67.0+Math.sin(lat*29.0)*3.2)),18);const crackB=Math.pow(1-Math.abs(Math.sin(lon*31.0-lat*71.0)),22);const crack=stressN*Math.max(crackA,crackB);
        if(crack>.01){r+=255*crack;g+=74*crack;b+=12*crack;}
        if(mode==="lithosphere"&&stressN>0){r+=210*stressN*.45;g+=48*stressN*.2;}
        if(app.state.inert){const gray=.299*r+.587*g+.114*b;r=gray*.82;g=gray*.9;b=gray*.94;}
        r+=18*rim;g+=75*rim;b+=105*rim;ctx.fillStyle=`rgb(${Math.min(255,r)|0},${Math.min(255,g)|0},${Math.min(255,b)|0})`;ctx.fillRect(cx+px,cy+py,step+1,step+1);
      }}
      // Atmospheric cloud bands are visual only and deterministic for state + view.
      if((this.kind==="incubator"||app.planetMode==="composite"||app.planetMode==="atmosphere")&&!app.state.inert){ctx.globalCompositeOperation="screen";for(let i=0;i<18;i++){const yy=cy-radius*.72+(i/17)*radius*1.44;const wobble=Math.sin(i*2.31+rotation*1.7)*radius*.13;ctx.strokeStyle=`rgba(160,224,236,${.018+(i%4)*.008})`;ctx.lineWidth=1.2+(i%3)*.5;ctx.beginPath();ctx.moveTo(cx-radius*.86,yy);ctx.bezierCurveTo(cx-radius*.3,yy+wobble,cx+radius*.25,yy-wobble,cx+radius*.88,yy+wobble*.2);ctx.stroke();}}
      // Fine holographic sample grid.
      ctx.globalCompositeOperation="screen";for(let row=1;row<rows-1;row+=2){for(let col=0;col<cols;col+=3){const p=projectCell(row,col,this.kind,this.canvas);if(!p||p.z<.08)continue;const a=.035+.07*p.z;ctx.fillStyle=app.state.inert?`rgba(185,195,199,${a})`:`rgba(69,221,255,${a})`;ctx.fillRect(p.x-1,p.y-1,2,2);}}
      ctx.restore();
      // Glass, night-side falloff, and hard atmospheric edge.
      const sheen=ctx.createLinearGradient(cx-radius,cy-radius,cx+radius,cy+radius);sheen.addColorStop(0,"rgba(226,251,255,.15)");sheen.addColorStop(.32,"rgba(255,255,255,.01)");sheen.addColorStop(.72,"rgba(0,0,0,.16)");sheen.addColorStop(1,"rgba(0,0,0,.68)");ctx.fillStyle=sheen;ctx.beginPath();ctx.arc(cx,cy,radius,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle=app.state.inert?"rgba(255,79,104,.30)":"rgba(92,237,255,.48)";ctx.lineWidth=1.25;ctx.beginPath();ctx.arc(cx,cy,radius+.5,0,Math.PI*2);ctx.stroke();
    }
  }

  function modeValue(kind) {
    if (kind === "incubator") return 0;
    return ({ composite: 0, thermal: 1, lithosphere: 2, atmosphere: 3, starsilk: 4 })[app.planetMode] ?? 0;
  }

  const VERTEX_SHADER = `#version 300 es
    precision highp float;
    in vec3 aPosition; in vec3 aNormal; in vec2 aUv;
    uniform float uRotation; uniform float uTilt; uniform float uAspect; uniform float uScale; uniform float uYOffset;
    out vec3 vNormal; out vec3 vPosition; out vec2 vUv;
    mat3 rotY(float a){float c=cos(a),s=sin(a);return mat3(c,0.,-s,0.,1.,0.,s,0.,c);}
    mat3 rotX(float a){float c=cos(a),s=sin(a);return mat3(1.,0.,0.,0.,c,-s,0.,s,c);}
    void main(){mat3 r=rotX(uTilt)*rotY(uRotation);vec3 p=r*aPosition;vNormal=normalize(r*aNormal);vPosition=p;vUv=aUv;
      float perspective=1.0+p.z*.045;gl_Position=vec4(p.x*uScale/uAspect*perspective,p.y*uScale*perspective+uYOffset,-p.z*.35,1.0);}`;

  const FRAGMENT_SHADER = `#version 300 es
    precision highp float;
    uniform sampler2D uData; uniform sampler2D uStress; uniform float uMode; uniform float uInert; uniform float uTime; uniform float uAtmosphere;
    in vec3 vNormal; in vec3 vPosition; in vec2 vUv; out vec4 outColor;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
    vec3 thermal(float t){vec3 cold=vec3(.02,.08,.25),mid=vec3(.08,.62,.87),hot=vec3(1.,.23,.04);return t<.55?mix(cold,mid,t/.55):mix(mid,hot,(t-.55)/.45);}
    void main(){
      float facing=clamp(vNormal.z,0.,1.); float fres=pow(1.-facing,2.2);
      if(uAtmosphere>.5){float a=(.08+fres*.72)*smoothstep(-.18,.35,vNormal.z);vec3 ac=uInert>.5?vec3(.42,.47,.50):vec3(.08,.72,1.0);outColor=vec4(ac,a*.48);return;}
      vec4 d=texture(uData,vUv); float t=d.r,e=d.g,p=d.b,c=d.a; float stress=texture(uStress,vUv).r; float elev=e*11000.-5000.;
      vec3 col;
      if(uMode<.5){
        float land=smoothstep(-180.,120.,elev); vec3 ocean=mix(vec3(.008,.045,.095),vec3(.015,.17,.25),clamp(elev/-5000.,0.,1.));
        vec3 soil=mix(vec3(.06,.19,.16),vec3(.42,.31,.15),clamp((elev-200.)/4500.,0.,1.)); col=mix(ocean,soil,land);
        float heat=smoothstep(.55,.88,t); col=mix(col,vec3(1.0,.16,.025),heat*.67);
        float cloud=noise(vUv*vec2(21.,10.)+vec2(uTime*.012,0.))+noise(vUv*vec2(37.,18.)-vec2(uTime*.009,0.))*.45;
        cloud=smoothstep(.92,1.18,cloud)*smoothstep(.15,.82,p); col=mix(col,vec3(.68,.86,.91),cloud*.46);
      } else if(uMode<1.5){col=thermal(t);} else if(uMode<2.5){col=mix(vec3(.015,.08,.075),vec3(.75,.52,.16),e);}
      else if(uMode<3.5){col=mix(vec3(.015,.09,.18),vec3(.08,.85,.98),p);col=mix(col,vec3(.69,.22,.10),c*.62);} else {float field=.5+.5*sin(vUv.x*82.+sin(vUv.y*29.)*2.);col=mix(vec3(.005,.045,.07),vec3(.05,.78,.98),field*.72);}
      vec3 light=normalize(vec3(-.45,.60,.80)); float ndl=max(dot(vNormal,light),0.); float shade=.18+.78*ndl+.19*facing; col*=shade;
      float gx=1.-smoothstep(.43,.49,abs(fract(vUv.x*36.)-.5)); float gy=1.-smoothstep(.43,.49,abs(fract(vUv.y*18.)-.5)); float grid=max(gx,gy)*.12;
      col+=vec3(.06,.72,.92)*grid*facing; col+=vec3(.10,.48,.68)*fres*.19;
      float crack=max(pow(1.-abs(sin(vUv.x*210.+sin(vUv.y*91.)*3.)),18.),pow(1.-abs(sin(vUv.x*97.-vUv.y*180.)),22.))*smoothstep(.08,.72,stress);
      col+=vec3(1.,.20,.018)*crack*1.35; if(uMode>1.5&&uMode<2.5) col+=vec3(.7,.06,.01)*stress*.38;
      if(uInert>.5){float g=dot(col,vec3(.299,.587,.114));col=mix(col,vec3(g)*vec3(.85,.91,.94),.72);}
      outColor=vec4(col,1.0);
    }`;

  function sizeHud(canvas) {
    const rect = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(rect.width * dpr)), h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, rect.width, rect.height);
    return { ctx, w: rect.width, h: rect.height };
  }

  function projectCell(row, col, kind, canvas) {
    if (!app.state) return null;
    const rect = canvas.getBoundingClientRect(); const radius = Math.min(rect.width, rect.height) * .395; const cx = rect.width*.5, cy = rect.height*.49;
    const lat = ((row / (app.state.planet.rows - 1))*Math.PI)-Math.PI/2; const lon=((col/app.state.planet.cols)*Math.PI*2)-Math.PI;
    let x,z;
    if (kind === "incubator") { const rlon=lon-app.specimenRotation; x=Math.cos(lat)*Math.sin(rlon); z=Math.cos(lat)*Math.cos(rlon); }
    else { const rlon=lon-app.planetRotation; x=Math.cos(lat)*Math.cos(rlon); z=Math.cos(lat)*Math.sin(rlon); }
    if (z < -.03) return null; return { x:cx+x*radius, y:cy-Math.sin(lat)*radius, z, radius, cx, cy };
  }

  function drawHud(stage, time) {
    if (!app.state) return;
    const { canvas, kind } = stage, { ctx, w, h } = sizeHud(canvas); const radius=Math.min(w,h)*.395,cx=w*.5,cy=h*.49;
    // Fine orbit arcs and projected equator lines.
    ctx.save(); ctx.translate(cx,cy); ctx.strokeStyle="rgba(53,232,255,.16)"; ctx.lineWidth=1; ctx.setLineDash([3,8]);
    for (const [sx,sy,rot] of [[1.42,.45,-.12],[1.25,.61,.22],[1.10,.33,-.42]]) { ctx.save(); ctx.rotate(rot); ctx.beginPath(); ctx.ellipse(0,0,radius*sx,radius*sy,0,0,Math.PI*2); ctx.stroke(); ctx.restore(); }
    ctx.setLineDash([]); ctx.restore();
    // Holographic scan meridians.
    ctx.save(); ctx.globalCompositeOperation="screen"; ctx.strokeStyle="rgba(63,222,255,.12)";
    for(let i=-2;i<=2;i+=1){ctx.beginPath();ctx.ellipse(cx+i*radius*.16,cy,radius*.47,radius,.02*i,0,Math.PI*2);ctx.stroke();}
    ctx.restore();

    const specimen=app.state.specimens?.active;
    if(specimen){
      const trail=specimen.trail||[]; ctx.save(); ctx.globalCompositeOperation="screen"; ctx.lineWidth=2.1; ctx.strokeStyle=specimen.field_state==="nullified"?"rgba(255,79,104,.62)":"rgba(53,240,195,.78)"; ctx.shadowBlur=12;ctx.shadowColor=ctx.strokeStyle;ctx.beginPath(); let started=false;
      for(const point of trail){const p=projectCell(point.row,point.col,kind,canvas);if(!p){started=false;continue;}if(!started){ctx.moveTo(p.x,p.y);started=true;}else ctx.lineTo(p.x,p.y);}ctx.stroke();ctx.shadowBlur=0;
      const pos=projectCell(specimen.position.row,specimen.position.col,kind,canvas); if(pos) drawSpecimenGlyph(ctx,pos.x,pos.y,specimen,time); ctx.restore();
    }
    if(kind==="incubator" && app.specimenTarget){const p=projectCell(app.specimenTarget.row,app.specimenTarget.col,kind,canvas);if(p){ctx.save();ctx.strokeStyle="rgba(53,240,195,.72)";ctx.shadowBlur=8;ctx.shadowColor="#35f0c3";ctx.beginPath();ctx.arc(p.x,p.y,8,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(p.x-13,p.y);ctx.lineTo(p.x+13,p.y);ctx.moveTo(p.x,p.y-13);ctx.lineTo(p.x,p.y+13);ctx.stroke();ctx.restore();}}
    if(kind==="planet" && app.hoverPoint && !app.drag){ctx.save();ctx.strokeStyle=app.state.inert?"rgba(255,79,104,.8)":"rgba(53,232,255,.82)";ctx.shadowBlur=8;ctx.shadowColor=ctx.strokeStyle;ctx.beginPath();ctx.arc(app.hoverPoint.x,app.hoverPoint.y,9,0,Math.PI*2);ctx.stroke();ctx.restore();}
  }

  function drawSpecimenGlyph(ctx,x,y,specimen,time){const nullified=specimen.field_state==="nullified", accent=nullified?"#ff4f68":"#35f0c3";ctx.save();ctx.translate(x,y);ctx.rotate(Math.sin(time*.0007)*.05);ctx.strokeStyle=accent;ctx.fillStyle=accent;ctx.shadowBlur=14;ctx.shadowColor=accent;const pulse=specimen.pulses||0;
    if(specimen.profile_id==="fault_tongue"){for(let ring=1;ring<=4;ring+=1){ctx.beginPath();for(let arm=0;arm<6;arm+=1){const a=arm*Math.PI/3,rr=7+ring*6;const px=Math.cos(a)*rr,py=Math.sin(a)*rr;if(arm===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}ctx.closePath();ctx.stroke();}}
    else if(specimen.profile_id==="vortenbray"){for(let r=9;r<35;r+=8){ctx.globalAlpha=1-r/48;ctx.beginPath();ctx.arc(0,0,r+Math.sin(time*.003+r)*2,0,Math.PI*2);ctx.stroke();}ctx.globalAlpha=1;}
    else if(specimen.profile_id==="tremorhound"){for(let r=10;r<=34;r+=12){ctx.beginPath();ctx.arc(0,0,r+(pulse%5),0,Math.PI*2);ctx.stroke();}}
    else if(specimen.profile_id==="obsidian_gul"){ctx.beginPath();ctx.moveTo(-38,14);ctx.bezierCurveTo(-24,-18,-9,-13,0,0);ctx.stroke();for(let i=0;i<4;i+=1){ctx.beginPath();ctx.moveTo(-i*7,5);ctx.lineTo(-i*11-7,-8-i*2);ctx.stroke();}}
    else {for(let i=0;i<3;i+=1){ctx.beginPath();ctx.ellipse(0,0,28+i*6,12+i*3,time*.00035+i*.65,0,Math.PI*2);ctx.stroke();}}
    ctx.beginPath();ctx.arc(0,0,4.5,0,Math.PI*2);ctx.fill();ctx.restore();}

  function updateOverlays(kind) {
    const stage = hudStages.get(kind); if(!stage||!app.state) return; const wrap=stage.canvas.parentElement;
    const bond=Number(app.state.star.bond_index); const stressMax=Number(app.state.planet.stats.stress_max_pa||0); const stressPenalty=Math.min(22,Math.log10(1+Math.max(0,stressMax))*2.15); const stable=Math.max(0,Math.min(100,98.7-(1-bond)*8-stressPenalty-(app.state.inert?98:0)));
    const stability=$(".cc-stability-value",wrap); if(stability) stability.textContent=`${stable.toFixed(1)}%`;
    const stableLabel=$(".cc-stability-label",wrap); if(stableLabel) stableLabel.textContent=app.state.inert?"NULLIFIED":stable>85?"STABLE":"DEGRADED";
    const specimen=app.state.specimens?.active; const pulse=$(".cc-field-pulse",wrap); if(pulse) pulse.textContent=`PULSE ${String(specimen?.pulses||0).padStart(3,"0")}`;
    const status=$(".cc-stage-status",wrap); if(status) status.textContent=app.state.inert?"STARSILK FIELD NULLIFIED":specimen?.active?"NOTEBOOK FIELD ACTIVE":"STARSILK FIELD ACTIVE";
    $$("[data-cc-mode]",wrap).forEach((node)=>node.classList.toggle("active",kind==="planet"?node.dataset.ccMode===app.planetMode:node.dataset.ccMode==="composite"));
  }

  function frame(time) {
    if (app.state) {
      for (const [kind, renderer] of glStages) {
        const panel = kind === "planet" ? $("#view-planet") : $("#view-incubator");
        if (panel?.classList.contains("active")) { renderer.render(time); drawHud(hudStages.get(kind), time); updateOverlays(kind); }
      }
    }
    lastFrame=time; requestAnimationFrame(frame);
  }

  function patchPlanetGeometry() {
    if (typeof planetGeometry !== "function") return;
    planetGeometry = function commandCenterPlanetGeometry(canvas) {
      const rect=canvas.getBoundingClientRect(); const radius=Math.max(90,Math.min(rect.width,rect.height)*.395);
      return {cx:rect.width*.5,cy:rect.height*.49,radius};
    };
  }

  function patchReset() {
    const reset=$("#reset-lab"); if(!reset) return;
    reset.addEventListener("click",()=>{ if(app.specimenRunning) app.specimenRunning=false; },{capture:true});
  }

  function init() {
    installStationIntro(); installStage("#planet-canvas","planet"); installStage("#incubator-canvas","incubator"); patchPlanetGeometry(); patchReset();
    window.addEventListener("resize",()=>{ for(const r of glStages.values()) r.lastRevision=-1; });
    requestAnimationFrame(frame);
  }

  init();
})();

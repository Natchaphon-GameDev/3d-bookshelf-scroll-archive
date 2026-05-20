/* =========================================================
   3D SCENE — shelf, lighting, dust, scroll-driven camera
   ========================================================= */

(function initScene() {
  if (window.innerWidth < 768) {
    // mobile fallback — don't bother with WebGL
    document.getElementById('loader').classList.add('gone');
    setTimeout(() => document.getElementById('loader').remove(), 900);
    return;
  }

  // -------- renderer --------
  const stage = document.getElementById('stage');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = false;
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0a0604, 22, 75);

  const camera = new THREE.PerspectiveCamera(38, window.innerWidth/window.innerHeight, 0.1, 200);
  camera.position.set(15, 5, 18);

  // -------- post-processing (depth of field) --------
  let composer = null, bokehPass = null;
  try {
    if (THREE.EffectComposer && THREE.RenderPass && THREE.BokehPass) {
      composer = new THREE.EffectComposer(renderer);
      composer.setSize(window.innerWidth, window.innerHeight);
      composer.addPass(new THREE.RenderPass(scene, camera));
      bokehPass = new THREE.BokehPass(scene, camera, {
        focus: 6.0,
        aperture: 0.0004,
        maxblur: 0.0035,
        width: window.innerWidth,
        height: window.innerHeight
      });
      composer.addPass(bokehPass);
    }
  } catch (e) {
    console.warn('DOF unavailable:', e);
    composer = null; bokehPass = null;
  }

  // -------- lighting --------
  // warm key
  const key = new THREE.SpotLight(0xffb066, 3.4, 80, Math.PI/3, 0.55, 1.0);
  key.position.set(8, 14, 8);
  key.target.position.set(-20, 0, 0);
  scene.add(key, key.target);

  // cool fill (dialed back to keep highlights warm)
  const fill = new THREE.DirectionalLight(0x4a6a9a, 0.45);
  fill.position.set(-15, 10, -10);
  scene.add(fill);

  // very low ambient
  const amb = new THREE.AmbientLight(0x2a1810, 1.1);
  scene.add(amb);

  // moving "shaft" light following the camera position along shelf
  const shaft = new THREE.SpotLight(0xffd089, 4.0, 30, Math.PI/3.2, 0.5, 1.0);
  shaft.position.set(0, 10, 6);
  shaft.target.position.set(0, 0, 0);
  scene.add(shaft, shaft.target);

  // -------- shelf --------
  const shelfGroup = new THREE.Group();
  scene.add(shelfGroup);

  // procedural wood grain texture — horizontal grain, occasional knots, fiber noise
  function makeWoodTexture(baseHex, darkHex, lightHex) {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, 1024, 256);

    // wavy dark grain lines
    for (let i = 0; i < 90; i++) {
      const y = Math.random() * 256;
      const w = 500 + Math.random() * 600;
      const x = Math.random() * 1024 - w/2;
      ctx.strokeStyle = `rgba(10, 6, 3, ${0.06 + Math.random() * 0.22})`;
      ctx.lineWidth = 0.5 + Math.random() * 1.4;
      ctx.beginPath();
      const yOff = Math.random() * 6;
      ctx.moveTo(x, y);
      for (let dx = 0; dx <= w; dx += 18) {
        ctx.lineTo(x + dx, y + Math.sin(dx * 0.02 + i * 1.3) * yOff);
      }
      ctx.stroke();
    }

    // lighter highlight bands
    for (let i = 0; i < 28; i++) {
      const y = Math.random() * 256;
      ctx.strokeStyle = `rgba(${lightHex[0]}, ${lightHex[1]}, ${lightHex[2]}, ${0.05 + Math.random()*0.1})`;
      ctx.lineWidth = 0.6 + Math.random() * 0.8;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let dx = 0; dx <= 1024; dx += 24) {
        ctx.lineTo(dx, y + Math.sin(dx * 0.018 + i*2.4) * 2.5);
      }
      ctx.stroke();
    }

    // knots — dark concentric ovals
    for (let k = 0; k < 5; k++) {
      const kx = 80 + Math.random() * 864;
      const ky = 25 + Math.random() * 206;
      const kr = 6 + Math.random() * 16;
      for (let r = kr; r > 0; r -= 1.6) {
        ctx.strokeStyle = `rgba(8, 4, 2, ${0.35 + (kr-r)/kr * 0.25})`;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.ellipse(kx, ky, r * 1.2, r, 0.2, 0, Math.PI*2);
        ctx.stroke();
      }
      const grad = ctx.createRadialGradient(kx, ky, 0, kx, ky, kr);
      grad.addColorStop(0, 'rgba(4,2,1,0.85)');
      grad.addColorStop(1, 'rgba(8,4,2,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(kx, ky, kr*1.2, kr, 0.2, 0, Math.PI*2);
      ctx.fill();
    }

    // fiber noise overlay
    const img = ctx.getImageData(0, 0, 1024, 256);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const nv = (Math.random() - 0.5) * 18;
      d[i] = Math.max(0, Math.min(255, d[i] + nv));
      d[i+1] = Math.max(0, Math.min(255, d[i+1] + nv));
      d[i+2] = Math.max(0, Math.min(255, d[i+2] + nv));
    }
    ctx.putImageData(img, 0, 0);

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    return tex;
  }

  const woodTex = makeWoodTexture('#3a2817', [10,6,3], [140, 100, 60]);
  woodTex.repeat.set(4, 1);
  const woodBackTex = makeWoodTexture('#251609', [6,3,1], [100, 70, 40]);
  woodBackTex.repeat.set(6, 1);

  const SHELF_LENGTH = 130;
  const SHELF_DEPTH = 5.5;
  const PROJECT_SPACING = 11;
  const PROJECT_START_X = 3;

  // shelf top plank
  const plankGeo = new THREE.BoxGeometry(SHELF_LENGTH, 0.4, SHELF_DEPTH);
  const plankMat = new THREE.MeshPhongMaterial({
    map: woodTex, color: 0xffffff, flatShading: false,
    shininess: 2, specular: 0x0a0604
  });
  const plank = new THREE.Mesh(plankGeo, plankMat);
  plank.position.set(PROJECT_START_X - SHELF_LENGTH/2 + 10, -0.2, 0);
  shelfGroup.add(plank);

  // shelf back panel (vertical grain via swapped repeat)
  const backGeo = new THREE.BoxGeometry(SHELF_LENGTH, 7, 0.3);
  const back = new THREE.Mesh(backGeo, new THREE.MeshPhongMaterial({
    map: woodBackTex, color: 0xffffff, shininess: 0, specular: 0x000000
  }));
  back.position.set(PROJECT_START_X - SHELF_LENGTH/2 + 10, 3.5, -2.6);
  shelfGroup.add(back);

  // shelf above (suggesting more shelves)
  const top = new THREE.Mesh(plankGeo, plankMat);
  top.position.set(PROJECT_START_X - SHELF_LENGTH/2 + 10, 7.0, 0);
  shelfGroup.add(top);

  // ---------- VOLUMETRIC GOD-RAYS ----------
  function makeShaftTexture() {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 512;
    const ctx = c.getContext('2d');
    // vertical falloff (top = bright, bottom = fade)
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0.0, 'rgba(255,210,140,0)');
    g.addColorStop(0.25, 'rgba(255,215,150,0.55)');
    g.addColorStop(0.55, 'rgba(255,200,120,0.35)');
    g.addColorStop(0.85, 'rgba(255,190,100,0.10)');
    g.addColorStop(1.0, 'rgba(255,170,80,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 512);
    // horizontal soft edges via destination-out
    const m = ctx.createLinearGradient(0, 0, 128, 0);
    m.addColorStop(0.0, 'rgba(0,0,0,1)');
    m.addColorStop(0.30, 'rgba(0,0,0,0)');
    m.addColorStop(0.70, 'rgba(0,0,0,0)');
    m.addColorStop(1.0, 'rgba(0,0,0,1)');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = m;
    ctx.fillRect(0, 0, 128, 512);
    return new THREE.CanvasTexture(c);
  }
  const shaftTex = makeShaftTexture();
  const shafts = [];
  // anchor a shaft above each project — every 2nd one for visual rhythm
  for (let i = 0; i < PROJECTS.length; i++) {
    if (i % 2 !== 0 && i !== 4) continue;
    const sx = PROJECT_START_X - i * PROJECT_SPACING + ((i%4===0) ? 0.4 : -0.4);
    // two crossed planes per shaft so it reads from multiple angles
    for (let p = 0; p < 2; p++) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(3.6, 13),
        new THREE.MeshBasicMaterial({
          map: shaftTex,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide
        })
      );
      m.position.set(sx, 3.5, 1.0 + p * 0.3);
      // tilt: light comes from above-back
      m.rotation.z = 0.20 + (Math.random()-0.5) * 0.05;
      m.rotation.x = -0.10;
      m.rotation.y = p === 0 ? 0.0 : Math.PI / 2;
      m.userData = {
        baseX: sx,
        baseOpacity: 0.35 + Math.random() * 0.25,
        pulseSeed: Math.random() * 6.28
      };
      scene.add(m);
      shafts.push(m);
    }
  }

  // shelf below
  const bottom = new THREE.Mesh(plankGeo, plankMat);
  bottom.position.set(PROJECT_START_X - SHELF_LENGTH/2 + 10, -7.0, 0);
  shelfGroup.add(bottom);

  // vertical supports every so often — share wood tex
  const supportMat = new THREE.MeshPhongMaterial({
    map: woodBackTex, color: 0xaaaaaa, shininess: 0, specular: 0x000000
  });
  for (let i = 0; i < 12; i++) {
    const sx = PROJECT_START_X + 6 - i * 12;
    const support = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 14, 0.4),
      supportMat
    );
    support.position.set(sx, 0, -2.4);
    shelfGroup.add(support);
  }

  // floor / lower plane for atmospheric depth
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 60),
    new THREE.MeshPhongMaterial({ color: 0x0d0a08, flatShading: true, shininess: 0, specular: 0x000000 })
  );
  floor.rotation.x = -Math.PI/2;
  floor.position.set(0, -7.6, 0);
  scene.add(floor);

  // -------- place project objects --------
  const projectObjects = [];
  PROJECTS.forEach((p, i) => {
    const obj = makeProjectObject(p, i);
    const x = PROJECT_START_X - i * PROJECT_SPACING;
    // base sits on the shelf top — different objects have different heights
    let baseY = 0;
    if (p.objectType === 'cartridge') baseY = 1.5;
    else if (p.objectType === 'cd')   baseY = 0.5;
    else if (p.objectType === 'disk') baseY = 0.4;
    else if (p.objectType === 'box')  baseY = 1.1;
    else if (p.objectType === 'cabinet') baseY = 2.1;
    else if (p.objectType === 'tablet')  baseY = 1.0;
    else if (p.objectType === 'scroll')  baseY = 0.5;
    else if (p.objectType === 'fossil')  baseY = 0.4;

    obj.position.set(x, baseY, 0);
    obj.userData.baseY = baseY;
    obj.userData.baseX = x;
    obj.userData.idx = i;
    obj.userData.dustLevel = p.dustLevel;

    // per-project diorama props (small personal touch)
    if (window.makeProjectProps) {
      const props = window.makeProjectProps(p, x, baseY);
      props.userData.idx = i;
      shelfGroup.add(props);
      obj.userData.props = props;
    }

    // small initial random rotation for visual variety
    obj.rotation.y = (Math.random() - 0.5) * 0.08;

    // sediment / burial for oldest projects (dustLevel > 0.7)
    if (p.dustLevel > 0.65) {
      const burial = Math.min(0.9, (p.dustLevel - 0.65) / 0.35) * 1.6;
      obj.userData.buriedAmount = burial;
      obj.position.y -= burial * 0.7;
      // add sediment pile around it
      const sed = new THREE.Mesh(
        new THREE.ConeGeometry(2.6, 0.6 + burial*0.5, 8, 1, true),
        new THREE.MeshPhongMaterial({ color: 0x2a1a10, flatShading: true, shininess: 0, specular: 0x000000, transparent: true, opacity: 0.85 })
      );
      sed.position.set(x, -0.3 + burial*0.1, 0.4);
      sed.scale.y = 0.4;
      sed.userData.sediment = true;
      sed.userData.baseScaleY = 0.4;
      shelfGroup.add(sed);
      obj.userData.sediment = sed;
    }

    // glow halo
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(3.0, 16, 12),
      new THREE.MeshBasicMaterial({
        color: p.coverColor,
        transparent: true, opacity: 0,
        side: THREE.BackSide, depthWrite: false
      })
    );
    halo.position.set(x, baseY, 0);
    obj.userData.halo = halo;
    shelfGroup.add(halo);

    // per-project dust cloud (intensity scales by dustLevel)
    if (p.dustLevel > 0.05) {
      const n = Math.floor(30 + p.dustLevel * 120);
      const positions = new Float32Array(n * 3);
      for (let k = 0; k < n; k++) {
        positions[k*3]   = x + (Math.random() - 0.5) * 5;
        positions[k*3+1] = baseY + (Math.random() - 0.3) * 3;
        positions[k*3+2] = (Math.random() - 0.5) * 3;
      }
      const dgeo = new THREE.BufferGeometry();
      dgeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const dmat = new THREE.PointsMaterial({
        color: 0xf4e8d0,
        size: 0.05 + p.dustLevel * 0.08,
        transparent: true,
        opacity: 0.25 + p.dustLevel * 0.45,
        depthWrite: false
      });
      const dust = new THREE.Points(dgeo, dmat);
      shelfGroup.add(dust);
      obj.userData.dust = dust;
    }

    // cobweb decals for oldest few
    if (p.dustLevel > 0.5) {
      const web = new THREE.Mesh(
        new THREE.PlaneGeometry(1.4 + p.dustLevel, 1.4 + p.dustLevel),
        new THREE.MeshBasicMaterial({
          map: makeCobwebTexture(),
          color: 0xc8b896,
          transparent: true, opacity: 0.25 + p.dustLevel * 0.3,
          depthWrite: false
        })
      );
      web.position.set(x - 1.2, baseY + 0.8, 0.6);
      web.rotation.z = Math.PI/4;
      shelfGroup.add(web);
      obj.userData.web = web;
    }

    shelfGroup.add(obj);
    projectObjects.push(obj);
  });

  function makeCobwebTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const x = c.getContext('2d');
    x.clearRect(0,0,256,256);
    x.strokeStyle = 'rgba(255,240,210,0.85)';
    x.lineWidth = 1;
    // radial lines
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      x.beginPath();
      x.moveTo(0, 0);
      x.lineTo(Math.cos(a) * 256, Math.sin(a) * 256);
      x.stroke();
    }
    // arcs
    for (let r = 30; r < 240; r += 22) {
      x.beginPath();
      for (let i = 0; i <= 8; i++) {
        const a = (i / 8) * TAU;
        const dx = Math.cos(a) * r * (0.9 + Math.random()*0.15);
        const dy = Math.sin(a) * r * (0.9 + Math.random()*0.15);
        if (i === 0) x.moveTo(dx, dy);
        else x.lineTo(dx, dy);
      }
      x.stroke();
    }
    return new THREE.CanvasTexture(c);
  }

  // -------- global atmospheric dust motes --------
  function makeAmbientDust(count = 400) {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i*3]   = (Math.random() - 0.5) * SHELF_LENGTH;
      positions[i*3+1] = (Math.random() - 0.2) * 12;
      positions[i*3+2] = (Math.random() - 0.5) * 12;
      velocities[i*3]   = (Math.random() - 0.5) * 0.005;
      velocities[i*3+1] = (Math.random() * 0.004) + 0.001;
      velocities[i*3+2] = (Math.random() - 0.5) * 0.004;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xf4e8d0,
      size: 0.06,
      transparent: true, opacity: 0.45,
      depthWrite: false
    });
    const pts = new THREE.Points(geo, mat);
    pts.userData.velocities = velocities;
    return pts;
  }
  const ambientDust = makeAmbientDust(450);
  scene.add(ambientDust);

  // -------- chapters --------
  const CHAPTERS = [
    { from: 0.00, to: 0.08, num: 'I',   title: 'a long wooden shelf' },
    { from: 0.86, to: 0.95, num: 'III', title: 'where it all began' },
  ];

  // -------- camera path (keyframes) --------
  // Each keyframe = { t, pos[3], look[3] }
  // Project focus calculator: project i is centered at t = focusT(i)
  function focusT(i) {
    // First project at 0.18, last at 0.83
    return 0.18 + i * (0.65 / (PROJECTS.length - 1));
  }

  const camKeyframes = [];
  // Intro wide — angled view down the shelf
  camKeyframes.push({ t: 0.00, pos: [10, 5, 14],  look: [-2, 1.5, 0] });
  camKeyframes.push({ t: 0.08, pos: [7, 3.5, 10], look: [PROJECT_START_X - 2, 1.5, 0] });
  // approach first project (slow, dramatic)
  camKeyframes.push({ t: 0.14, pos: [PROJECT_START_X + 4, 2.6, 6], look: [PROJECT_START_X, 1.2, 0] });
  // per-project centered
  for (let i = 0; i < PROJECTS.length; i++) {
    const x = PROJECT_START_X - i * PROJECT_SPACING;
    // alternating angle for visual rhythm
    const angleSign = (i % 2 === 0) ? 1 : -1;
    const sideOffset = 1.4 * angleSign;
    // older projects: camera lower (looking down at buried), closer
    const yPos = i < 7 ? 2.4 : 1.8 - (i-7) * 0.2;
    const yLook = projectObjects[i].userData.baseY * 0.7;
    camKeyframes.push({
      t: focusT(i),
      pos: [x + sideOffset, yPos, 5.2],
      look: [x, yLook, 0]
    });
  }
  // deep archive — drift down past the oldest
  const lastX = PROJECT_START_X - (PROJECTS.length - 1) * PROJECT_SPACING;
  camKeyframes.push({ t: 0.88, pos: [lastX - 5, 1.5, 5.5], look: [lastX - 2, 0.4, 0] });
  // outro pullback
  camKeyframes.push({ t: 0.94, pos: [lastX - 12, 4, 14], look: [-30, 1.5, 0] });
  camKeyframes.push({ t: 1.00, pos: [-50, 9, 32], look: [-40, 1, 0] });

  camKeyframes.sort((a, b) => a.t - b.t);

  // smooth lerp between keyframes
  function ease(t) { return t * t * (3 - 2 * t); } // smoothstep
  function lerp(a, b, t) { return a + (b - a) * t; }
  function lerp3(a, b, t) { return [lerp(a[0],b[0],t), lerp(a[1],b[1],t), lerp(a[2],b[2],t)]; }

  function sampleCamera(t) {
    let k = 0;
    while (k < camKeyframes.length - 1 && camKeyframes[k+1].t < t) k++;
    const a = camKeyframes[k], b = camKeyframes[Math.min(k+1, camKeyframes.length-1)];
    const span = (b.t - a.t) || 1e-6;
    const f = ease(Math.max(0, Math.min(1, (t - a.t) / span)));
    return { pos: lerp3(a.pos, b.pos, f), look: lerp3(a.look, b.look, f) };
  }

  // -------- progress rail ticks --------
  (function() {
    const ticks = document.getElementById('rail-ticks');
    for (let i = 0; i < PROJECTS.length; i++) {
      const s = document.createElement('span');
      ticks.appendChild(s);
    }
  })();

  // -------- ACTIVE PROJECT updater --------
  // Margin note positions — varied per project to read like marginalia, not a panel
  const NOTE_POS = [
    { left: '6vw',  top: '24vh', rot: -1.8 },
    { left: '5.5vw',top: '68vh', rot:  1.2 },
    { left: '7vw',  top: '30vh', rot: -2.2 },
    { left: '6vw',  top: '62vh', rot:  1.6 },
    { left: '5.5vw',top: '22vh', rot: -1.0 },
    { left: '7vw',  top: '66vh', rot:  2.4 },
    { left: '6vw',  top: '28vh', rot: -1.5 },
    { left: '5.5vw',top: '70vh', rot:  1.0 },
    { left: '6.5vw',top: '25vh', rot: -2.0 },
    { left: '7vw',  top: '64vh', rot:  1.5 },
  ];
  const noteEl = document.getElementById('m-note');
  let noteTimeout = null;
  function setMarginNote(i) {
    clearTimeout(noteTimeout);
    noteEl.classList.remove('show');
    if (i < 0 || !PROJECTS[i] || !PROJECTS[i].marginNote) return;
    noteTimeout = setTimeout(() => {
      const pos = NOTE_POS[i] || NOTE_POS[0];
      noteEl.style.left = pos.left;
      noteEl.style.top = pos.top;
      noteEl.style.setProperty('--rot', pos.rot + 'deg');
      noteEl.querySelector('.m-text').textContent = PROJECTS[i].marginNote;
      noteEl.classList.add('show');
    }, 380);
  }

  let currentProject = -1;
  function setActiveProject(i) {
    if (i === currentProject) return;
    const prev = currentProject;
    currentProject = i;
    setMarginNote(i);
    // SFX: shelf-bump + per-object reveal on focus change (after first project)
    if (window.Sound && i >= 0 && prev !== -1) {
      window.Sound.shelfBump();
    }
    if (window.Sound && i >= 0) {
      const objType = PROJECTS[i].objectType;
      // delay reveal slightly so it lands after the bump
      setTimeout(() => window.Sound.reveal(objType), 120);
    }
    const panel = document.getElementById('ppanel');
    if (i < 0 || i >= PROJECTS.length) {
      panel.classList.remove('show');
      return;
    }
    const p = PROJECTS[i];
    document.getElementById('pp-idx').textContent = 'No. ' + String(i+1).padStart(2,'0');
    const statusEl = document.getElementById('pp-status');
    statusEl.textContent = p.status;
    statusEl.className = 'pp-status ' + p.status;
    document.getElementById('pp-title').innerHTML = p.title;
    document.getElementById('pp-year').textContent = p.year;
    document.getElementById('pp-genre').textContent = p.genre;
    document.getElementById('pp-object').textContent = p.objectType;
    document.getElementById('pp-desc').textContent = p.shortDescription;
    document.getElementById('pp-tech').innerHTML = p.tech.map(t => `<span>${t}</span>`).join('');
    const acts = document.getElementById('pp-actions');
    acts.innerHTML = '';
    acts.innerHTML += `<a class="ghost" onclick="openDetail(${i})">Details →</a>`;
    if (p.links.play)   acts.innerHTML += `<a href="${p.links.play}"   onclick="event.preventDefault();openDetail(${i})">Play</a>`;
    if (p.links.devlog) acts.innerHTML += `<a href="${p.links.devlog}" onclick="event.preventDefault();openDetail(${i})" class="ghost">Devlog</a>`;
    panel.classList.add('show');
  }

  // -------- update loop --------
  let scrollT = 0;
  let scrollVel = 0;
  let lastShakeT = -1;

  function updateScroll() {
    const max = document.body.scrollHeight - window.innerHeight;
    const newT = Math.max(0, Math.min(1, window.scrollY / Math.max(1, max)));
    scrollVel = newT - scrollT;
    scrollT = newT;
  }
  window.addEventListener('scroll', updateScroll, { passive: true });

  // Tweaks state
  const tweaks = {
    warm: 1.0, cool: 0.6, dust: 1.0, bump: 1.0, grain: 0.10,
    dof: 0.5, walk: 1.0,
    paletteIdx: 0
  };
  const PALETTES = [
    { name: 'walnut',   key: 0xffb066, fill: 0x4a6a9a, fog: 0x0a0604, floor: 0x0d0a08 },
    { name: 'ash',      key: 0xc8c0a8, fill: 0x6a7a8a, fog: 0x080808, floor: 0x0a0a0a },
    { name: 'ember',    key: 0xff7a3a, fill: 0x3a2870, fog: 0x100604, floor: 0x10060a },
    { name: 'iceberg',  key: 0x9ac8ff, fill: 0x2a5070, fog: 0x06080c, floor: 0x06080c },
  ];

  function applyTweaks() {
    key.intensity = 3.4 * tweaks.warm;
    shaft.intensity = 4.0 * tweaks.warm;
    fill.intensity = 0.45 * tweaks.cool;
    document.querySelector('.grain').style.opacity = tweaks.grain;
    const pal = PALETTES[tweaks.paletteIdx];
    key.color.setHex(pal.key);
    shaft.color.setHex(pal.key);
    fill.color.setHex(pal.fill);
    scene.fog.color.setHex(pal.fog);
    floor.material.color.setHex(pal.floor);
  }
  applyTweaks();

  // Tweaks DOM wiring
  ['warm','cool','dust','bump','grain','dof','walk'].forEach(k => {
    const el = document.getElementById('t-'+k);
    if (el) el.oninput = (e) => { tweaks[k] = parseFloat(e.target.value); applyTweaks(); };
  });
  // palette swatches
  const pSw = document.getElementById('t-palette');
  PALETTES.forEach((pal, i) => {
    const b = document.createElement('button');
    b.style.setProperty('--c', '#' + pal.key.toString(16).padStart(6,'0'));
    if (i === 0) b.classList.add('on');
    b.onclick = () => {
      tweaks.paletteIdx = i;
      [...pSw.children].forEach(c => c.classList.remove('on'));
      b.classList.add('on');
      applyTweaks();
    };
    pSw.appendChild(b);
  });

  // tick: animate camera, dust, project states
  const clock = new THREE.Clock();
  let prevT = 0;

  function tick() {
    const dt = clock.getDelta();
    const tnow = clock.elapsedTime;

    // -------- camera path with walking-gait noise --------
    const cam = sampleCamera(scrollT);
    // multi-octave sin-based noise — gives a less mechanical feel
    const n = (t, s) => Math.sin(t*0.7 + s) * 0.6
                      + Math.sin(t*1.3 + s*2.1) * 0.30
                      + Math.sin(t*2.4 + s*3.7) * 0.15;
    // walk amplitude is user-tunable via tweaks.walk (0 = locked, 1 = default, 2 = drunken)
    const wA = tweaks.walk;
    // gait — vertical bounce at ~1.8Hz, side-to-side at half that
    const gaitBob = Math.sin(tnow * 1.8) * 0.04 * wA;
    const gaitSway = Math.sin(tnow * 0.9 + 1.3) * 0.06 * wA;
    // velocity-driven lean (look longer when scrolling fast)
    const lean = Math.max(-1, Math.min(1, scrollVel * 80));
    const walkX = n(tnow, 1.0) * 0.10 * wA + gaitSway;
    const walkY = n(tnow, 2.0) * 0.06 * wA + gaitBob;
    const walkZ = n(tnow, 3.0) * 0.05 * wA;
    camera.position.set(
      cam.pos[0] + walkX,
      cam.pos[1] + walkY,
      cam.pos[2] + walkZ + lean * 0.4
    );
    // subtle look-at drift — gaze wanders (also scaled by walk)
    const driftX = n(tnow, 4.0) * 0.35 * wA;
    const driftY = n(tnow, 5.0) * 0.20 * wA;
    camera.lookAt(
      cam.look[0] + driftX + lean * 0.3,
      cam.look[1] + driftY,
      cam.look[2]
    );

    // shaft light follows camera target softly
    shaft.position.set(cam.look[0] + 2, 9, 6);
    shaft.target.position.set(cam.look[0], 1, 0);
    shaft.target.updateMatrixWorld();

    // -------- project activation --------
    // find currently most-centered project
    let activeIdx = -1;
    let bestDist = Infinity;
    projectObjects.forEach((obj, i) => {
      const ft = focusT(i);
      const d = Math.abs(scrollT - ft);
      if (d < 0.05 && d < bestDist) { bestDist = d; activeIdx = i; }
    });

    // chapter logic
    const inIntro = scrollT < 0.07;
    const inOutro = scrollT > 0.93;
    const inDeep = scrollT >= 0.83 && scrollT <= 0.92;

    document.getElementById('intro').style.opacity = (1 - Math.min(1, scrollT / 0.07)).toFixed(2);
    document.getElementById('outro').classList.toggle('show', inOutro);
    document.getElementById('chapter').classList.toggle('show', inDeep);
    if (inDeep) {
      document.getElementById('chapter-num').textContent = 'III';
      document.getElementById('chapter-title').textContent = 'where it all began';
    }

    setActiveProject(inIntro || inOutro ? -1 : activeIdx);

    // -------- per-project opening animations --------
    projectObjects.forEach((obj, i) => {
      const ft = focusT(i);
      const dist = Math.abs(scrollT - ft);
      // 0 = far, 1 = focused
      const focus = Math.max(0, 1 - dist / 0.05);
      const eased = ease(focus);
      obj.userData.focus = eased;

      // lift + tilt forward as it approaches focus
      const baseY = obj.userData.baseY;
      const buried = obj.userData.buriedAmount || 0;
      const dust = obj.userData.dustLevel || 0;

      // excavation: oldest reveal as camera approaches
      const buryReduce = buried * (1 - eased * 0.9);
      obj.position.y = baseY - buryReduce * 0.7 + eased * 0.3;

      // gentle bob
      obj.position.y += Math.sin(tnow * 0.8 + i) * 0.03 * (1 - dust*0.5);

      // sediment shrink on excavation
      if (obj.userData.sediment) {
        obj.userData.sediment.scale.y = obj.userData.sediment.userData.baseScaleY * (1 - eased * 0.85);
      }

      // halo glow on focus
      obj.userData.halo.material.opacity = eased * 0.18 * (1 - dust * 0.6);
      obj.userData.halo.position.y = obj.position.y;

      // type-specific opening
      const t = obj.userData.type;
      const openMesh = obj.userData.openMesh;
      if (t === 'cartridge') {
        obj.rotation.x = -eased * 0.35;
        obj.rotation.y = (i%2===0 ? 1 : -1) * eased * 0.3;
        obj.position.z = eased * 0.6;
      } else if (t === 'cd' && openMesh) {
        openMesh.rotation.x = -eased * (Math.PI * 0.7);
        obj.rotation.y = eased * 0.15;
      } else if (t === 'disk' && openMesh) {
        openMesh.position.z = eased * 1.2;
        openMesh.position.y = 0.05 + eased * 0.08;
      } else if (t === 'box' && openMesh) {
        openMesh.rotation.x = -eased * (Math.PI * 0.55);
      } else if (t === 'cabinet' && openMesh) {
        // flicker on
        const flicker = (Math.sin(tnow * 30) * 0.5 + 0.5) * (Math.random() > 0.92 ? 0.4 : 1);
        openMesh.material.opacity = eased * (0.7 + flicker * 0.3);
      } else if (t === 'tablet') {
        obj.rotation.y = eased * 0.25;
      } else if (t === 'scroll' && openMesh) {
        openMesh.scale.z = 0.01 + eased * 1.0;
        openMesh.position.y = 0;
      } else if (t === 'fossil') {
        obj.rotation.y = eased * 0.4;
        if (openMesh) openMesh.material.opacity = 0.55 + eased * 0.35;
      }

      // dust cloud — drift, and reduce on excavation
      if (obj.userData.dust) {
        obj.userData.dust.material.opacity =
          (0.25 + dust * 0.45) * (1 - eased * 0.55) * tweaks.dust;
        const pos = obj.userData.dust.geometry.attributes.position;
        for (let k = 0; k < pos.count; k++) {
          let y = pos.getY(k) + 0.003 + Math.sin(tnow + k) * 0.001;
          if (y > baseY + 3) y = baseY - 0.3;
          pos.setY(k, y);
        }
        pos.needsUpdate = true;
      }

      // web fades on excavation
      if (obj.userData.web) {
        obj.userData.web.material.opacity =
          (0.25 + dust * 0.3) * (1 - eased * 0.7);
      }
    });

    // -------- god-rays: pulse opacity, fade with focal proximity --------
    shafts.forEach((m, k) => {
      const dx = Math.abs(camera.position.x - m.userData.baseX);
      // visible when within ~14 units of camera
      const proxFade = Math.max(0, 1 - dx / 14);
      const pulse = 0.7 + 0.3 * Math.sin(tnow * 0.4 + m.userData.pulseSeed);
      m.material.opacity = m.userData.baseOpacity * proxFade * pulse * tweaks.dust;
    });

    // -------- moth flutter (if any project has one) --------
    projectObjects.forEach(obj => {
      const mp = obj.userData.props;
      if (mp && mp.userData.moth) {
        const m = mp.userData.moth;
        const b = m.userData.base;
        m.position.x = b[0] + Math.sin(tnow * 2.7) * 0.12;
        m.position.y = b[1] + Math.sin(tnow * 4.1 + 0.5) * 0.08;
        m.position.z = b[2] + Math.sin(tnow * 3.3 + 1.0) * 0.08;
        m.rotation.z = Math.sin(tnow * 8) * 0.3;
      }
    });

    // -------- ambient dust drift --------
    const pos = ambientDust.geometry.attributes.position;
    const vel = ambientDust.userData.velocities;
    for (let i = 0; i < pos.count; i++) {
      const ix = i*3;
      pos.array[ix]   += vel[ix];
      pos.array[ix+1] += vel[ix+1];
      pos.array[ix+2] += vel[ix+2];
      // wrap
      if (pos.array[ix+1] > 12) pos.array[ix+1] = -1;
      if (pos.array[ix] > 70) pos.array[ix] -= SHELF_LENGTH;
      if (pos.array[ix] < -70) pos.array[ix] += SHELF_LENGTH;
    }
    pos.needsUpdate = true;
    ambientDust.material.opacity = 0.45 * tweaks.dust;

    // -------- camera "shelf bump" between projects --------
    // detect crossings of mid-points
    for (let i = 0; i < PROJECTS.length - 1; i++) {
      const mid = (focusT(i) + focusT(i+1)) / 2;
      const wasBefore = prevT < mid;
      const isAfter = scrollT >= mid;
      if (wasBefore !== isAfter && Math.abs(scrollT - mid) < 0.01) {
        // trigger small shake
        bumpShake = 0.6 * tweaks.bump;
      }
    }

    if (bumpShake > 0.001) {
      camera.position.x += (Math.random() - 0.5) * bumpShake * 0.04;
      camera.position.y += (Math.random() - 0.5) * bumpShake * 0.05;
      bumpShake *= 0.85;
    }

    // -------- dust-puff SFX when an old project is being excavated --------
    projectObjects.forEach((obj, i) => {
      const dust = obj.userData.dustLevel || 0;
      if (dust > 0.5 && obj.userData.focus > 0.55 && !obj.userData._dustPlayed) {
        obj.userData._dustPlayed = true;
        if (window.Sound) window.Sound.dustPuff();
      } else if (obj.userData.focus < 0.2) {
        obj.userData._dustPlayed = false;
      }
    });

    // -------- update progress rail --------
    document.getElementById('rail-fill').style.height = (scrollT * 100).toFixed(2) + '%';
    document.getElementById('rail-marker').style.top  = (scrollT * 100).toFixed(2) + '%';
    // year roughly maps to nearest project
    if (activeIdx >= 0) {
      document.getElementById('rail-year').textContent = PROJECTS[activeIdx].year;
    } else if (scrollT < 0.1) {
      document.getElementById('rail-year').textContent = '2026';
    } else if (scrollT > 0.93) {
      document.getElementById('rail-year').textContent = '2015';
    }

    // -------- DOF focus follows active project --------
    if (bokehPass) {
      let focusDist = 8;
      if (activeIdx >= 0) {
        focusDist = camera.position.distanceTo(projectObjects[activeIdx].position);
      } else {
        // intro/outro/transit — focus further out for wider field
        focusDist = 14;
      }
      // smooth (snap a bit faster so focused object stays sharp)
      const cur = bokehPass.uniforms.focus.value;
      bokehPass.uniforms.focus.value = cur + (focusDist - cur) * 0.15;
      // aperture & maxblur scaled by user-tweakable strength
      const dofStrength = tweaks.dof; // 0 = off, 1 = strong
      const baseAp = (activeIdx >= 0) ? 0.0008 : 0.0002;
      const targetAp = baseAp * dofStrength;
      const curAp = bokehPass.uniforms.aperture.value;
      bokehPass.uniforms.aperture.value = curAp + (targetAp - curAp) * 0.1;
      bokehPass.uniforms.maxblur.value = 0.0035 * dofStrength;
    }

    prevT = scrollT;
    window.__frameN = (window.__frameN||0) + 1;
    if (composer) composer.render();
    else renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }

  let bumpShake = 0;

  // -------- resize --------
  window.addEventListener('resize', () => {
    if (window.innerWidth < 768) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (composer) composer.setSize(window.innerWidth, window.innerHeight);
    if (bokehPass) {
      bokehPass.uniforms.aspect && (bokehPass.uniforms.aspect.value = camera.aspect);
    }
  });

  // -------- music (procedural ambient pad via sound.js) --------
  document.getElementById('musicBtn').onclick = () => {
    if (!window.Sound) return;
    const playing = window.Sound.toggleMusic();
    document.getElementById('musicBtn').style.color = playing ? '#d4a04a' : '';
  };

  // -------- kick off --------
  updateScroll();
  tick();

  // hide loader after a moment (give fonts/canvas time)
  setTimeout(() => {
    const loader = document.getElementById('loader');
    loader.classList.add('gone');
    setTimeout(() => loader.style.display = 'none', 900);
  }, 1400);

})();

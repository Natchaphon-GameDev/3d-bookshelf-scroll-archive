/* =========================================================
   3D OBJECT FACTORIES — low poly, flat-shaded
   Each returns a THREE.Group sized roughly to fit on the shelf.
   Each group has userData: { open: 0..1, dust: refs[], glow: meshRef }
   ========================================================= */

const TAU = Math.PI * 2;

// label canvas → CanvasTexture with title + emblem
function makeLabelTexture(title, year, coverColor, accentColor, emblem) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const x = c.getContext('2d');

  // background — cream paper with subtle gradient
  const g = x.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#f4e8d0');
  g.addColorStop(1, '#d8c9aa');
  x.fillStyle = g;
  x.fillRect(0, 0, 512, 512);

  // border
  x.strokeStyle = accentColor; x.lineWidth = 8;
  x.strokeRect(18, 18, 476, 476);
  x.strokeStyle = coverColor; x.lineWidth = 2;
  x.strokeRect(34, 34, 444, 444);

  // top stripe
  x.fillStyle = coverColor;
  x.fillRect(34, 34, 444, 60);

  // simple pixel-art emblem (a 8x8 grid based on hash of title)
  const seed = title.split('').reduce((a,c)=>a+c.charCodeAt(0), 0);
  const rand = (i) => ((Math.sin(seed*9.1 + i*7.3) * 43758.5453) % 1 + 1) % 1;
  const cell = 22;
  const gx = 256 - cell * 4, gy = 200;
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 4; j++) { // mirror across vertical axis
      if (rand(i*8+j) > 0.45) {
        x.fillStyle = j % 2 === 0 ? coverColor : accentColor;
        x.fillRect(gx + j*cell, gy + i*cell, cell - 1, cell - 1);
        x.fillRect(gx + (7-j)*cell, gy + i*cell, cell - 1, cell - 1);
      }
    }
  }

  // title (serif-ish bold)
  x.fillStyle = '#3a2817';
  x.font = '600 44px "Cormorant Garamond", Georgia, serif';
  x.textAlign = 'center';
  x.fillText(title, 256, 432);

  // year (mono small)
  x.fillStyle = accentColor;
  x.font = '500 16px "JetBrains Mono", monospace';
  x.fillText(String(year).toUpperCase(), 256, 462);

  // top stripe text
  x.fillStyle = '#f4e8d0';
  x.font = '500 18px "JetBrains Mono", monospace';
  x.textAlign = 'left';
  x.fillText('MASTER • PORT', 56, 72);
  x.textAlign = 'right';
  x.fillText('N° ' + (emblem||'01'), 456, 72);

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

// flat-shaded material helper (Phong + flatShading + zero specular = matte faceted)
function flat(color) {
  return new THREE.MeshPhongMaterial({
    color,
    flatShading: true,
    shininess: 0,
    specular: 0x000000
  });
}

// ---------- CARTRIDGE (SNES/N64 style) ----------
function makeCartridge(p, idx) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 3.0, 0.6),
    flat(p.coverColor)
  );
  // slight bevel via narrower top
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.5, 0.6),
    flat(p.accentColor)
  );
  top.position.y = 1.55;
  g.add(body, top);

  // contacts at bottom
  const contacts = new THREE.Mesh(
    new THREE.BoxGeometry(2.0, 0.18, 0.5),
    flat('#2a1c10')
  );
  contacts.position.y = -1.55;
  g.add(contacts);

  // label on front
  const labelTex = makeLabelTexture(p.title, p.year, p.coverColor, p.accentColor, String(idx+1).padStart(2,'0'));
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 2.2),
    new THREE.MeshLambertMaterial({ map: labelTex })
  );
  label.position.z = 0.31;
  label.position.y = -0.1;
  g.add(label);

  // back ridges
  for (let i = 0; i < 5; i++) {
    const r = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 0.08, 0.05),
      flat(p.accentColor)
    );
    r.position.set(0, 1.0 - i*0.18, -0.32);
    g.add(r);
  }

  g.userData = { type: 'cartridge', baseY: 0, openMesh: null };
  return g;
}

// ---------- CD CASE (clamshell) ----------
function makeCDCase(p, idx) {
  const g = new THREE.Group();
  const baseTray = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 0.18, 2.6),
    flat('#1a120a')
  );
  baseTray.position.y = -0.05;
  g.add(baseTray);

  // disc
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(1.05, 1.05, 0.04, 32),
    new THREE.MeshLambertMaterial({ color: 0xddd9c4 })
  );
  disc.position.y = 0.06;
  g.add(disc);
  const discHole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 0.06, 16),
    flat('#0a0604')
  );
  discHole.position.y = 0.07;
  g.add(discHole);
  // rainbow shimmer ring
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.3, 1.0, 32),
    new THREE.MeshBasicMaterial({ color: p.coverColor, transparent: true, opacity: 0.25, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI/2;
  ring.position.y = 0.085;
  g.add(ring);

  // lid (hinged at back)
  const lid = new THREE.Group();
  const lidPanel = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 0.1, 2.6),
    flat('#2a1c10')
  );
  lidPanel.position.set(0, 0, 0);
  lid.add(lidPanel);
  // label inside lid
  const labelTex = makeLabelTexture(p.title, p.year, p.coverColor, p.accentColor, String(idx+1).padStart(2,'0'));
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 2.2),
    new THREE.MeshLambertMaterial({ map: labelTex })
  );
  label.rotation.x = Math.PI/2;
  label.position.y = 0.06;
  lid.add(label);
  // pivot at back edge
  lid.position.set(0, 0.08, -1.3);
  lid.userData.pivot = true;
  g.add(lid);

  g.userData = { type: 'cd', baseY: 0, openMesh: lid };
  return g;
}

// ---------- FLOPPY DISK ----------
function makeDisk(p, idx) {
  const g = new THREE.Group();
  // sleeve
  const sleeve = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 0.12, 2.6),
    flat(p.accentColor)
  );
  g.add(sleeve);
  // disk body emerging
  const diskBody = new THREE.Group();
  const dBody = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.16, 2.4),
    flat(p.coverColor)
  );
  diskBody.add(dBody);
  // metal slider
  const slider = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.18, 0.55),
    flat('#c8c4b8')
  );
  slider.position.set(0, 0.02, -1.05);
  diskBody.add(slider);
  // hub
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.35, 0.18, 12),
    flat('#1a120a')
  );
  hub.position.y = -0.1;
  diskBody.add(hub);
  // label
  const labelTex = makeLabelTexture(p.title, p.year, p.coverColor, p.accentColor, String(idx+1).padStart(2,'0'));
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 1.3),
    new THREE.MeshLambertMaterial({ map: labelTex })
  );
  label.rotation.x = -Math.PI/2;
  label.position.set(0, 0.09, 0.4);
  diskBody.add(label);

  diskBody.position.set(0, 0.05, 0);
  diskBody.userData.slideOut = true;
  g.add(diskBody);

  g.userData = { type: 'disk', baseY: 0, openMesh: diskBody };
  return g;
}

// ---------- CARDBOARD BOX ----------
function makeBox(p, idx) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 2.2, 2.2),
    flat(p.coverColor)
  );
  g.add(body);
  // top crease lines
  for (let s of [-1, 1]) {
    const fold = new THREE.Mesh(
      new THREE.BoxGeometry(2.81, 0.04, 0.04),
      flat(p.accentColor)
    );
    fold.position.set(0, 1.11, s * 1.1);
    g.add(fold);
  }
  // lid
  const lid = new THREE.Group();
  const lidTop = new THREE.Mesh(
    new THREE.BoxGeometry(2.85, 0.18, 2.25),
    flat(p.accentColor)
  );
  lid.add(lidTop);
  const labelTex = makeLabelTexture(p.title, p.year, p.coverColor, p.accentColor, String(idx+1).padStart(2,'0'));
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(2.3, 1.7),
    new THREE.MeshLambertMaterial({ map: labelTex })
  );
  label.rotation.x = -Math.PI/2;
  label.position.y = 0.1;
  lid.add(label);
  lid.position.set(0, 1.1, -1.1); // pivot back edge
  g.add(lid);
  // front label too
  const front = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 1.6),
    new THREE.MeshLambertMaterial({ map: labelTex })
  );
  front.position.set(0, 0, 1.11);
  g.add(front);

  g.userData = { type: 'box', baseY: 0, openMesh: lid };
  return g;
}

// ---------- ARCADE CABINET ----------
function makeCabinet(p, idx) {
  const g = new THREE.Group();
  const cab = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 4.2, 1.6),
    flat(p.accentColor)
  );
  g.add(cab);
  // marquee
  const marquee = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.5, 1.4),
    flat(p.coverColor)
  );
  marquee.position.y = 2.4;
  g.add(marquee);
  // screen
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.3, 1.0),
    new THREE.MeshBasicMaterial({ color: 0x0a0a12 })
  );
  screen.position.set(0, 0.7, 0.81);
  g.add(screen);
  // screen content (flickers via opacity in update)
  const labelTex = makeLabelTexture(p.title, p.year, p.coverColor, p.accentColor, String(idx+1).padStart(2,'0'));
  const screenLabel = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 0.9),
    new THREE.MeshBasicMaterial({ map: labelTex, transparent: true, opacity: 0 })
  );
  screenLabel.position.set(0, 0.7, 0.82);
  g.add(screenLabel);
  // control panel
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.4, 0.8),
    flat(p.coverColor)
  );
  panel.position.set(0, -0.3, 0.6);
  panel.rotation.x = 0.3;
  g.add(panel);
  // joystick + buttons
  const stick = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 0.25, 8),
    flat('#d54a3a')
  );
  stick.position.set(-0.4, -0.15, 0.7);
  g.add(stick);
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.08, 12),
      flat(['#f4e8d0', '#d4a04a', '#c14b6e'][i])
    );
    b.position.set(0.1 + i*0.22, -0.12, 0.65);
    g.add(b);
  }

  g.userData = { type: 'cabinet', baseY: 0, openMesh: screenLabel };
  return g;
}

// ---------- TABLET ----------
function makeTablet(p, idx) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.0, 0.18, 2.8),
    flat(p.accentColor)
  );
  body.rotation.x = -0.6; // propped against shelf back
  g.add(body);
  const labelTex = makeLabelTexture(p.title, p.year, p.coverColor, p.accentColor, String(idx+1).padStart(2,'0'));
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.7, 2.5),
    new THREE.MeshLambertMaterial({ map: labelTex })
  );
  screen.rotation.x = Math.PI/2 - 0.6;
  screen.position.y = 0.1 * Math.cos(0.6);
  screen.position.z = -0.1 * Math.sin(0.6);
  g.add(screen);
  // small home button
  const home = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 0.02, 16),
    flat(p.coverColor)
  );
  home.rotation.x = Math.PI/2 - 0.6;
  home.position.set(0, 0.18, 1.15);
  g.add(home);

  g.userData = { type: 'tablet', baseY: 0, openMesh: screen };
  return g;
}

// ---------- SCROLL ----------
function makeScroll(p, idx) {
  const g = new THREE.Group();
  const paperCol = '#e6d6a8';
  const rodCol = p.accentColor;
  // two end rods
  for (let s of [-1, 1]) {
    const rod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 2.4, 12),
      flat(rodCol)
    );
    rod.rotation.z = Math.PI/2;
    rod.position.x = s * 1.0;
    g.add(rod);
    const knob = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 12, 8),
      flat(p.coverColor)
    );
    knob.position.x = s * 1.35;
    g.add(knob);
  }
  // middle rolled paper (cylinder)
  const rolled = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 2.0, 16),
    flat(paperCol)
  );
  rolled.rotation.z = Math.PI/2;
  g.add(rolled);
  // unfurling sheet
  const sheet = new THREE.Group();
  const sheetMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 1.6),
    new THREE.MeshLambertMaterial({ color: paperCol, side: THREE.DoubleSide })
  );
  sheetMesh.rotation.x = -Math.PI/2;
  sheet.add(sheetMesh);
  const labelTex = makeLabelTexture(p.title, p.year, p.coverColor, p.accentColor, String(idx+1).padStart(2,'0'));
  const labelMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.7, 1.4),
    new THREE.MeshLambertMaterial({ map: labelTex, transparent: true, opacity: 0.95 })
  );
  labelMesh.rotation.x = -Math.PI/2;
  labelMesh.position.y = 0.01;
  sheet.add(labelMesh);
  sheet.position.set(0, 0, 0);
  sheet.scale.set(1, 1, 0.01);
  g.add(sheet);

  g.userData = { type: 'scroll', baseY: 0, openMesh: sheet };
  return g;
}

// ---------- FOSSIL (irregular rock with pixel emblem) ----------
function makeFossil(p, idx) {
  const g = new THREE.Group();
  const rockGeo = new THREE.IcosahedronGeometry(1.4, 0);
  // jitter vertices for irregularity
  const pos = rockGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const ox = pos.getX(i), oy = pos.getY(i), oz = pos.getZ(i);
    const f = 0.85 + 0.3 * Math.sin(i*1.3 + ox*2 + oy*3);
    pos.setXYZ(i, ox*f, oy*f*0.9, oz*f);
  }
  rockGeo.computeVertexNormals();
  const rock = new THREE.Mesh(rockGeo, flat('#3a2c1a'));
  rock.scale.set(1.3, 0.7, 1.0);
  g.add(rock);
  // amber inset (translucent)
  const amber = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 14, 10),
    new THREE.MeshLambertMaterial({ color: p.coverColor, transparent: true, opacity: 0.75 })
  );
  amber.scale.set(1.2, 0.5, 1.0);
  amber.position.set(0, 0.45, 0);
  g.add(amber);
  // pixel art inside amber (small box matrix)
  const seed = p.title.length;
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      if (((Math.sin(seed + i*7 + j*11) * 100) % 1) > 0.4) continue;
      if (i === 0 || i === 5 || j === 0 || j === 5) continue;
      const px = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.04, 0.06),
        flat(p.accentColor)
      );
      px.position.set((j-2.5) * 0.07, 0.5, (i-2.5) * 0.07);
      g.add(px);
    }
  }

  g.userData = { type: 'fossil', baseY: 0, openMesh: amber };
  return g;
}

// ---------- DISPATCH ----------
function makeProjectObject(p, idx) {
  switch (p.objectType) {
    case 'cartridge': return makeCartridge(p, idx);
    case 'cd':        return makeCDCase(p, idx);
    case 'disk':      return makeDisk(p, idx);
    case 'box':       return makeBox(p, idx);
    case 'cabinet':   return makeCabinet(p, idx);
    case 'tablet':    return makeTablet(p, idx);
    case 'scroll':    return makeScroll(p, idx);
    case 'fossil':    return makeFossil(p, idx);
    default:          return makeCartridge(p, idx);
  }
}

// Expose to global
window.makeProjectObject = makeProjectObject;
window.flat = flat;

/* =========================================================
   PER-PROJECT DIORAMA PROPS — one small "this is mine" detail per shelf
   Returns a THREE.Group placed at world (x, shelfY, 0).
   ========================================================= */
function makeProjectProps(p, x, baseY) {
  const props = new THREE.Group();
  const SHELF_Y = -0.3; // top of shelf top plank

  // small generic shelf shadow under every object
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.0, 1.6),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI/2;
  shadow.position.set(x, SHELF_Y + 0.01, 0);
  props.add(shadow);

  // pick a prop based on project id
  switch (p.id) {
    case 'masterport': {
      // bright yellow sticky note leaning against the cartridge
      const note = new THREE.Mesh(
        new THREE.PlaneGeometry(0.55, 0.55),
        flat(0xfff09a)
      );
      note.position.set(x + 1.4, SHELF_Y + 0.3, 0.5);
      note.rotation.z = -0.18;
      note.rotation.y = -0.3;
      props.add(note);
      // a tiny scribble line
      const ink = new THREE.Mesh(
        new THREE.PlaneGeometry(0.35, 0.04),
        flat(0x3a2817)
      );
      ink.position.set(x + 1.4, SHELF_Y + 0.35, 0.51);
      ink.rotation.z = -0.18;
      ink.rotation.y = -0.3;
      props.add(ink);
      break;
    }
    case 'neondrift': {
      // small stack of plain CD-Rs spilling next to the case
      for (let i = 0; i < 4; i++) {
        const disc = new THREE.Mesh(
          new THREE.CylinderGeometry(0.55, 0.55, 0.04, 24),
          flat(0xe8dcb4)
        );
        disc.position.set(x - 1.7 + i*0.04, SHELF_Y + 0.04 + i*0.05, 0.7);
        disc.rotation.y = i * 0.3;
        props.add(disc);
      }
      break;
    }
    case 'hollowtide': {
      // half-empty glass of water
      const glass = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.13, 0.45, 14, 1, true),
        new THREE.MeshPhongMaterial({
          color: 0x9ac8d4, flatShading: true, shininess: 50,
          transparent: true, opacity: 0.4, side: THREE.DoubleSide
        })
      );
      glass.position.set(x + 1.6, SHELF_Y + 0.23, 0.7);
      props.add(glass);
      const water = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.12, 0.22, 14),
        new THREE.MeshPhongMaterial({ color: 0x4a7a9a, transparent: true, opacity: 0.7 })
      );
      water.position.set(x + 1.6, SHELF_Y + 0.13, 0.7);
      props.add(water);
      break;
    }
    case 'staticgarden': {
      // tiny potted plant — square pot, sprouting cone
      const pot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.26, 0.18, 0.35, 6),
        flat(0x8a5430)
      );
      pot.position.set(x - 1.7, SHELF_Y + 0.18, 0.6);
      props.add(pot);
      // a couple of "leaves" (cones)
      for (let i = 0; i < 3; i++) {
        const leaf = new THREE.Mesh(
          new THREE.ConeGeometry(0.12, 0.55, 4),
          flat(0x6a8a3a)
        );
        const a = i * 2.1;
        leaf.position.set(x - 1.7 + Math.cos(a)*0.08, SHELF_Y + 0.55, 0.6 + Math.sin(a)*0.08);
        leaf.rotation.z = (Math.random()-0.5) * 0.4;
        leaf.rotation.x = (Math.random()-0.5) * 0.3;
        props.add(leaf);
      }
      break;
    }
    case 'lastlibrary': {
      // a stack of index cards held with a paper clip
      for (let i = 0; i < 5; i++) {
        const card = new THREE.Mesh(
          new THREE.BoxGeometry(1.0, 0.012, 0.7),
          flat(0xe6d6a8)
        );
        card.position.set(x + 1.5 + i*0.01, SHELF_Y + 0.04 + i*0.015, 0.4);
        card.rotation.y = i * 0.05;
        props.add(card);
      }
      // small paperclip suggestion (a torus)
      const clip = new THREE.Mesh(
        new THREE.TorusGeometry(0.08, 0.015, 6, 10),
        flat(0xc8c8c8)
      );
      clip.position.set(x + 1.3, SHELF_Y + 0.13, 0.55);
      clip.rotation.x = Math.PI/2;
      props.add(clip);
      break;
    }
    case 'pulse': {
      // small black wrist-band (heart-rate monitor) coiled
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(0.32, 0.06, 8, 18),
        flat(0x1a1612)
      );
      band.position.set(x - 1.7, SHELF_Y + 0.08, 0.7);
      band.rotation.x = Math.PI/2;
      band.scale.set(1, 1, 0.4);
      props.add(band);
      // tiny red pulse-LED
      const led = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xff4040 })
      );
      led.position.set(x - 1.55, SHELF_Y + 0.10, 0.78);
      props.add(led);
      break;
    }
    case 'wirebound': {
      // little spool of tangled wire next to the arcade cab
      const spool = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.32, 0.18, 14),
        flat(0x8a4030)
      );
      spool.position.set(x + 1.6, SHELF_Y + 0.09, 0.6);
      spool.rotation.z = Math.PI/2;
      props.add(spool);
      // a wire loop
      const wire = new THREE.Mesh(
        new THREE.TorusGeometry(0.22, 0.018, 6, 18),
        flat(0xd4a04a)
      );
      wire.position.set(x + 1.6, SHELF_Y + 0.09, 0.7);
      wire.rotation.y = 0.6;
      props.add(wire);
      // single soldering-iron tip leaning on shelf
      const ironHandle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 0.7, 8),
        flat(0x3a2817)
      );
      ironHandle.position.set(x - 1.5, SHELF_Y + 0.08, 0.4);
      ironHandle.rotation.z = Math.PI/2 - 0.3;
      props.add(ironHandle);
      const ironTip = new THREE.Mesh(
        new THREE.ConeGeometry(0.05, 0.25, 8),
        flat(0xc8c4b8)
      );
      ironTip.position.set(x - 0.84, SHELF_Y + 0.30, 0.4);
      ironTip.rotation.z = -Math.PI/2 + 0.3;
      props.add(ironTip);
      break;
    }
    case 'mothlight': {
      // small desk lamp casting a warm pool
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.05, 0.65, 8),
        flat(0x2a1c10)
      );
      stem.position.set(x + 1.7, SHELF_Y + 0.35, 0.6);
      props.add(stem);
      const shade = new THREE.Mesh(
        new THREE.ConeGeometry(0.22, 0.3, 10, 1, true),
        flat(0xd4a04a)
      );
      shade.position.set(x + 1.7, SHELF_Y + 0.75, 0.6);
      props.add(shade);
      // warm light
      const lamp = new THREE.PointLight(0xffc080, 0.6, 4, 2);
      lamp.position.set(x + 1.7, SHELF_Y + 0.55, 0.6);
      props.add(lamp);
      // tiny moth (a 2-triangle thing) near lamp
      const moth = new THREE.Mesh(
        new THREE.PlaneGeometry(0.12, 0.08),
        new THREE.MeshBasicMaterial({ color: 0xa89878, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
      );
      moth.position.set(x + 1.55, SHELF_Y + 0.85, 0.65);
      moth.userData.moth = true;
      moth.userData.base = [x + 1.55, SHELF_Y + 0.85, 0.65];
      props.add(moth);
      props.userData.moth = moth;
      break;
    }
    case 'faultline': {
      // small spiral-bound notebook with a pencil
      const book = new THREE.Mesh(
        new THREE.BoxGeometry(1.0, 0.08, 0.7),
        flat(0x5a3a1c)
      );
      book.position.set(x + 1.5, SHELF_Y + 0.05, 0.4);
      book.rotation.y = -0.2;
      props.add(book);
      // spiral binding
      for (let i = 0; i < 6; i++) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.04, 0.012, 4, 8),
          flat(0xc8c4b8)
        );
        ring.position.set(x + 1.05, SHELF_Y + 0.06, 0.4 - 0.3 + i*0.12);
        ring.rotation.y = -0.2;
        ring.rotation.z = Math.PI/2;
        props.add(ring);
      }
      // pencil on top
      const pen = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, 0.55, 6),
        flat(0xd4a04a)
      );
      pen.position.set(x + 1.5, SHELF_Y + 0.13, 0.55);
      pen.rotation.z = Math.PI/2;
      pen.rotation.y = 0.3;
      props.add(pen);
      break;
    }
    case 'firstcause': {
      // magnifying glass propped over the fossil
      const handle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.8, 8),
        flat(0x3a2010)
      );
      handle.position.set(x + 1.5, SHELF_Y + 0.45, 0.4);
      handle.rotation.z = 0.7;
      props.add(handle);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.28, 0.04, 8, 18),
        flat(0x2a1810)
      );
      ring.position.set(x + 1.0, SHELF_Y + 0.7, 0.4);
      ring.rotation.y = -0.2;
      props.add(ring);
      const lens = new THREE.Mesh(
        new THREE.CircleGeometry(0.26, 24),
        new THREE.MeshPhongMaterial({
          color: 0xb8d0e0, transparent: true, opacity: 0.32, side: THREE.DoubleSide
        })
      );
      lens.position.set(x + 1.0, SHELF_Y + 0.7, 0.41);
      lens.rotation.y = -0.2;
      props.add(lens);
      // a small museum-style number card next to fossil
      const card = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.02, 0.32),
        flat(0xf4e8d0)
      );
      card.position.set(x - 1.4, SHELF_Y + 0.01, 0.6);
      card.rotation.y = 0.25;
      props.add(card);
      break;
    }
    case 'mmv': {
      // watering can (farming/life sim)
      const canBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.22, 0.38, 10),
        flat(0x5a9a6a)
      );
      canBody.position.set(x - 1.6, SHELF_Y + 0.2, 0.6);
      props.add(canBody);
      const spout = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.06, 0.32, 8),
        flat(0x4a8a5a)
      );
      spout.position.set(x - 1.38, SHELF_Y + 0.28, 0.6);
      spout.rotation.z = -0.55;
      props.add(spout);
      const canHandle = new THREE.Mesh(
        new THREE.TorusGeometry(0.12, 0.025, 6, 10, Math.PI),
        flat(0x3a7a4a)
      );
      canHandle.position.set(x - 1.6, SHELF_Y + 0.28, 0.6);
      canHandle.rotation.z = Math.PI / 2;
      props.add(canHandle);
      // small potted plant beside it
      const pot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.10, 0.22, 7),
        flat(0x8a5430)
      );
      pot.position.set(x + 1.6, SHELF_Y + 0.12, 0.7);
      props.add(pot);
      const leaf = new THREE.Mesh(
        new THREE.ConeGeometry(0.1, 0.38, 5),
        flat(0x6a9a4a)
      );
      leaf.position.set(x + 1.6, SHELF_Y + 0.42, 0.7);
      props.add(leaf);
      break;
    }
    case 'automata': {
      // gear sitting flat on the shelf
      const gearBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.30, 0.30, 0.08, 8),
        flat(0xb8b4aa)
      );
      gearBody.position.set(x + 1.55, SHELF_Y + 0.05, 0.65);
      gearBody.rotation.y = Math.PI / 8;
      props.add(gearBody);
      for (let i = 0; i < 8; i++) {
        const tooth = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, 0.08, 0.11),
          flat(0xa0a098)
        );
        const a = (i / 8) * Math.PI * 2;
        tooth.position.set(
          x + 1.55 + Math.cos(a) * 0.34,
          SHELF_Y + 0.05,
          0.65 + Math.sin(a) * 0.34
        );
        tooth.rotation.y = a;
        props.add(tooth);
      }
      const gearHole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.09, 0.10, 10),
        flat(0x1a120a)
      );
      gearHole.position.set(x + 1.55, SHELF_Y + 0.05, 0.65);
      props.add(gearHole);
      // small bolt next to it
      const bolt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 0.18, 6),
        flat(0xc8c4b8)
      );
      bolt.position.set(x - 1.55, SHELF_Y + 0.09, 0.55);
      props.add(bolt);
      const boltHead = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.09, 0.06, 6),
        flat(0xb8b4aa)
      );
      boltHead.position.set(x - 1.55, SHELF_Y + 0.19, 0.55);
      props.add(boltHead);
      break;
    }
  }

  return props;
}

window.makeProjectProps = makeProjectProps;

// Game-world additions for "Echoes of History": memory fragments, the guiding
// beam, drifting dust, the Timeline Wall, reading plaques and confetti.
import * as THREE from 'three';
import { FRAGMENTS, PLAQUES } from './content.js';

function glowTexture(inner = 'rgba(255,230,160,1)', outer = 'rgba(255,200,80,0)') {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(0.25, inner.replace(/,1\)$/, ',0.55)'));
  gradient.addColorStop(1, outer);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function beamTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 256, 0, 0);
  gradient.addColorStop(0, 'rgba(255,220,130,0.9)');
  gradient.addColorStop(0.35, 'rgba(255,210,110,0.35)');
  gradient.addColorStop(1, 'rgba(255,200,90,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 4, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const textRedraws = [];
/** Repaint every text texture (called once the web fonts have loaded). */
export function refreshTextTextures() {
  for (const redraw of textRedraws) redraw();
}

function textTexture(lines, { width = 1024, height = 256, background = '#14110d', color = '#f5e6c4', font = '600 64px "Bodoni Moda", Didot, Georgia, serif', border = '#c9a45c' } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const draw = () => {
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
    if (border) {
      context.strokeStyle = border;
      context.lineWidth = 6;
      context.strokeRect(10, 10, width - 20, height - 20);
    }
    context.fillStyle = color;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    const list = Array.isArray(lines) ? lines : [lines];
    list.forEach((line, index) => {
      context.font = typeof line === 'object' ? line.font : font;
      const text = typeof line === 'object' ? line.text : line;
      context.fillText(text, width / 2, height / 2 + (index - (list.length - 1) / 2) * (height / (list.length + 0.6)));
    });
    texture.needsUpdate = true;
  };
  draw();
  textRedraws.push(draw);
  return texture;
}

const standard = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.1, ...extra });

/** Small stylised model for each fragment. Sized to roughly 0.5 units. */
function fragmentModel(fragment) {
  const group = new THREE.Group();
  const glow = { emissive: new THREE.Color(fragment.color), emissiveIntensity: 0.35 };
  switch (fragment.shape) {
    case 'ticket': {
      const card = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.3, 0.02), standard('#e9d8a6', glow));
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.06, 0.025), standard('#8b1e1e'));
      stripe.position.y = 0.07;
      const stub = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.3, 0.026), standard('#b99a5a'));
      stub.position.x = 0.16;
      group.add(card, stripe, stub);
      break;
    }
    case 'stamp': {
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.22), standard('#2f3b4a', glow));
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.18, 12), standard('#6b4a2b'));
      neck.position.y = 0.14;
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 12), standard('#8a5a33'));
      knob.position.y = 0.27;
      group.add(base, neck, knob);
      break;
    }
    case 'chalk': {
      // A small blackboard with the chalk resting on its ledge (nothing overlaps the writing).
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.36, 0.03), [
        standard('#5a3b22'), standard('#5a3b22'), standard('#5a3b22'), standard('#5a3b22'),
        new THREE.MeshBasicMaterial({ map: textTexture([{ text: 'E = mc²', font: 'italic 120px Georgia, serif' }], { width: 512, height: 300, background: '#1e3a2c', color: '#f4f1e6', border: '#6b4a2b' }) }),
        standard('#5a3b22'),
      ]);
      board.position.y = 0.06;
      const ledge = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.03, 0.08), standard('#6b4a2b'));
      ledge.position.set(0, -0.135, 0.03);
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.2, 12), standard('#f7f5ee', { ...glow, emissiveIntensity: 0.25 }));
      stick.rotation.z = Math.PI / 2;
      stick.position.set(0.12, -0.098, 0.04);
      group.add(board, ledge, stick);
      break;
    }
    case 'medal': {
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.035, 36), standard('#e0b64a', { metalness: 0.9, roughness: 0.25, ...glow }));
      disc.rotation.x = Math.PI / 2;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.018, 10, 40), standard('#f1cf6b', { metalness: 0.95, roughness: 0.2 }));
      const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.26, 0.01), standard('#1f4e8c'));
      ribbon.position.y = 0.3;
      group.add(disc, rim, ribbon);
      break;
    }
    case 'salt': {
      const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), standard('#7a5230', { side: THREE.DoubleSide }));
      group.add(bowl);
      for (let i = 0; i < 14; i += 1) {
        const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.035 + Math.random() * 0.03), standard('#ffffff', { ...glow, emissiveIntensity: 0.5, roughness: 0.2 }));
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 0.12;
        crystal.position.set(Math.cos(angle) * radius, -0.02 + Math.random() * 0.08, Math.sin(angle) * radius);
        crystal.rotation.set(Math.random() * 3, Math.random() * 3, 0);
        group.add(crystal);
      }
      break;
    }
    case 'badge':
    default: {
      const face = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 36), new THREE.MeshStandardMaterial({ map: textTexture([{ text: 'QUIT', font: '800 150px "Josefin Sans", Futura, sans-serif' }, { text: 'INDIA', font: '800 150px "Josefin Sans", Futura, sans-serif' }], { width: 512, height: 512, background: '#ff9f43', color: '#ffffff', border: '#ffffff' }), roughness: 0.4, emissive: new THREE.Color('#ff9f43'), emissiveIntensity: 0.2 }));
      face.rotation.x = Math.PI / 2;
      face.rotation.y = Math.PI / 2;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.02, 10, 40), standard('#138808'));
      group.add(face, ring);
      break;
    }
  }
  group.traverse((child) => { if (child.isMesh) child.castShadow = true; });
  return group;
}

export function createWorldExtras({ scene, surfaceHeightAt }) {
  const glowMap = glowTexture();
  const clockOffset = Math.random() * 10;

  // ---------------------------------------------------------------- fragments
  const fragments = FRAGMENTS.map((fragment, index) => {
    const [x, z] = fragment.position;
    const floor = surfaceHeightAt(x, z) + (z < -4 ? 0.175 : 0);
    const root = new THREE.Group();
    root.position.set(x, floor, z);
    const model = fragmentModel(fragment);
    model.scale.setScalar(1.6);
    model.position.y = 1.25;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap, color: fragment.color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85 }));
    halo.scale.setScalar(2.2);
    halo.position.y = 1.25;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 48), new THREE.MeshBasicMaterial({ color: fragment.color, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    const sparkleGeometry = new THREE.BufferGeometry();
    const sparkleCount = 24;
    const sparklePositions = new Float32Array(sparkleCount * 3);
    sparkleGeometry.setAttribute('position', new THREE.BufferAttribute(sparklePositions, 3));
    const sparkles = new THREE.Points(sparkleGeometry, new THREE.PointsMaterial({ map: glowMap, color: fragment.color, size: 0.12, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
    root.add(ring, halo, model, sparkles);
    root.visible = false;
    scene.add(root);
    return { fragment, root, model, halo, ring, sparkles, sparklePositions, sparkleCount, phase: index * 1.3, collected: false, collectAnim: 0 };
  });

  // ------------------------------------------------------------------- beacon
  const beacon = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.35, 16, 24, 1, true),
    new THREE.MeshBasicMaterial({ map: beamTexture(), color: '#ffd27a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
  );
  beam.position.y = 8;
  const beaconRing = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.05, 48), new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  beaconRing.rotation.x = -Math.PI / 2;
  beaconRing.position.y = 0.05;
  beacon.add(beam, beaconRing);
  beacon.visible = false;
  scene.add(beacon);
  const beaconTarget = new THREE.Vector3();
  let beaconActive = false;

  // --------------------------------------------------------------------- dust
  const dustCount = 500;
  const dustPositions = new Float32Array(dustCount * 3);
  const dustSeeds = new Float32Array(dustCount);
  for (let i = 0; i < dustCount; i += 1) {
    dustPositions[i * 3] = -20 + Math.random() * 40;
    dustPositions[i * 3 + 1] = 1.5 + Math.random() * 9;
    dustPositions[i * 3 + 2] = -44 + Math.random() * 39;
    dustSeeds[i] = Math.random() * 100;
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  // Soft round motes (a glow sprite), not square pixels.
  const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({ map: glowMap, color: '#fff2cf', size: 0.05, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(dust);

  // ------------------------------------------------------------ timeline wall
  const wallZ = -44.2;
  const wallFloor = 1.1 + 0.175;
  const timeline = new THREE.Group();
  timeline.position.set(0, wallFloor, wallZ);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(14, 5.2, 0.4), standard('#1b1a1f', { roughness: 0.3, metalness: 0.4 }));
  panel.position.y = 3.1;
  const frameMaterial = standard('#c9a45c', { metalness: 0.9, roughness: 0.25 });
  for (const [w, h, x, y] of [[14.4, 0.2, 0, 5.8], [14.4, 0.2, 0, 0.4], [0.2, 5.6, -7.1, 3.1], [0.2, 5.6, 7.1, 3.1]]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.5), frameMaterial);
    bar.position.set(x, y, 0.05);
    timeline.add(bar);
  }
  const title = new THREE.Mesh(new THREE.PlaneGeometry(8, 0.9), new THREE.MeshBasicMaterial({ map: textTexture('THE TIMELINE OF HISTORY', { width: 1600, height: 180, font: '600 92px "Bodoni Moda", Didot, Georgia, serif' }), transparent: false }));
  title.position.set(0, 5.05, 0.22);
  // The line of time running through the slots.
  const lineMaterial = new THREE.MeshStandardMaterial({ color: '#3a3326', emissive: new THREE.Color('#ffcf6b'), emissiveIntensity: 0 });
  const timeLine = new THREE.Mesh(new THREE.BoxGeometry(12.4, 0.06, 0.05), lineMaterial);
  timeLine.position.set(0, 2.2, 0.23);
  timeline.add(panel, title, timeLine);
  const slots = FRAGMENTS.map((fragment, index) => {
    const x = -5.5 + index * 2.2;
    const niche = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 0.1), standard('#2a2730', { roughness: 0.6 }));
    niche.position.set(x, 3.3, 0.2);
    const yearMaterial = new THREE.MeshBasicMaterial({ map: textTexture('?  ?  ?  ?', { width: 512, height: 160, font: '600 84px "Bodoni Moda", Didot, Georgia, serif', background: '#15131a', color: '#6f6656', border: null }) });
    const year = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.45), yearMaterial);
    year.position.set(x, 1.65, 0.23);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), lineMaterial);
    dot.position.set(x, 2.2, 0.25);
    timeline.add(niche, year, dot);
    return { fragment, x, year, yearMaterial, model: null };
  });
  // Floating shards of the broken wall.
  const shards = [];
  const shardMaterial = standard('#3b3643', { roughness: 0.35, metalness: 0.5, emissive: new THREE.Color('#7b5cff'), emissiveIntensity: 0.18 });
  for (let i = 0; i < 26; i += 1) {
    const shard = new THREE.Mesh(new THREE.TetrahedronGeometry(0.15 + Math.random() * 0.3), shardMaterial);
    const home = new THREE.Vector3(-6.5 + Math.random() * 13, 1 + Math.random() * 4.5, 0.8 + Math.random() * 2.2);
    shard.position.copy(home);
    shard.castShadow = true;
    timeline.add(shard);
    shards.push({ mesh: shard, home, spin: new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(0.8), phase: Math.random() * 10 });
  }
  // The one spotlight in the hall: it picks out the Timeline Wall, and brightens once restored.
  const wallLight = new THREE.SpotLight('#ffe2a8', 45, 22, 0.55, 0.6, 1.2);
  wallLight.position.set(0, 9.5, 8);
  wallLight.target.position.set(0, 3, 0);
  timeline.add(wallLight, wallLight.target);
  timeline.traverse((child) => { if (child.isMesh) child.receiveShadow = true; });
  scene.add(timeline);
  let restoreProgress = 0; // 0 = broken, 1 = restored
  let restoring = false;

  // Each restored memory sits still on its own brass shelf, scaled to fit inside
  // its niche so nothing pokes into the wall or its neighbours.
  const shelfMaterial = standard('#c9a45c', { metalness: 0.85, roughness: 0.3 });
  function placeInSlot(slot) {
    if (slot.model) return;
    const model = fragmentModel(slot.fragment);
    const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
    const scale = Math.min(1.1 / Math.max(size.x, size.y), 0.5 / Math.max(size.z, 0.01));
    model.scale.setScalar(scale);
    const fitted = new THREE.Box3().setFromObject(model);
    const shelfTop = 2.66;
    const shelfFront = 0.62;
    // Rest the model on the shelf, centred in the niche, with its back clear of the wall.
    model.position.set(
      slot.x - (fitted.min.x + fitted.max.x) / 2,
      shelfTop - fitted.min.y + 0.01,
      shelfFront - 0.08 - fitted.max.z,
    );
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, shelfFront - 0.2), shelfMaterial);
    shelf.position.set(slot.x, shelfTop - 0.03, 0.2 + (shelfFront - 0.2) / 2);
    timeline.add(shelf, model);
    slot.model = model;
    slot.yearMaterial.map = textTexture(String(slot.fragment.year), { width: 512, height: 160, font: '700 96px "Bodoni Moda", Didot, Georgia, serif', background: '#15131a', color: '#ffd98a', border: null });
    slot.yearMaterial.needsUpdate = true;
  }

  // ------------------------------------------------------------------ plaques
  const plaques = PLAQUES.map((plaque) => {
    const [x, z] = plaque.position;
    const floor = surfaceHeightAt(x, z) + 0.175;
    const group = new THREE.Group();
    group.position.set(x, floor, z);
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 1.05, 12), frameMaterial);
    stand.position.y = 0.52;
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.6, 0.05), standard('#15131a'));
    board.position.set(0, 1.15, 0);
    board.rotation.x = -0.5;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 0.52), new THREE.MeshBasicMaterial({ map: textTexture([{ text: plaque.title.split(' (')[0], font: '600 64px "Bodoni Moda", Didot, Georgia, serif' }, { text: 'Press E to read', font: '400 44px "Josefin Sans", Futura, sans-serif' }], { width: 768, height: 440 }) }));
    face.position.set(0, 1.155, 0.03);
    face.rotation.x = -0.5;
    group.add(stand, board, face);
    group.traverse((child) => { if (child.isMesh) child.castShadow = true; });
    scene.add(group);
    return { ...plaque, group };
  });

  // ----------------------------------------------------------------- confetti
  const confettiCount = 420;
  const confettiGeometry = new THREE.PlaneGeometry(0.08, 0.14);
  const confettiMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, vertexColors: false });
  const confetti = new THREE.InstancedMesh(confettiGeometry, confettiMaterial, confettiCount);
  confetti.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const palette = ['#ffcf4d', '#ff6b6b', '#4ecdc4', '#ffffff', '#ff9f43', '#6fa8dc', '#138808'].map((c) => new THREE.Color(c));
  const pieces = [];
  for (let i = 0; i < confettiCount; i += 1) {
    confetti.setColorAt(i, palette[i % palette.length]);
    pieces.push({ position: new THREE.Vector3(), velocity: new THREE.Vector3(), rotation: new THREE.Euler(), spin: new THREE.Vector3(), life: 0 });
  }
  confetti.visible = false;
  confetti.frustumCulled = false;
  scene.add(confetti);
  const dummy = new THREE.Object3D();

  function burst(origin, spread = 1) {
    confetti.visible = true;
    for (const piece of pieces) {
      piece.position.copy(origin).add(new THREE.Vector3((Math.random() - 0.5) * 2 * spread, Math.random() * 1.5, (Math.random() - 0.5) * 2 * spread));
      piece.velocity.set((Math.random() - 0.5) * 7, 4 + Math.random() * 6, (Math.random() - 0.5) * 7);
      piece.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      piece.spin.set(Math.random() * 8, Math.random() * 8, Math.random() * 8);
      piece.life = 5 + Math.random() * 3;
    }
  }

  // ------------------------------------------------------------------- update
  const temp = new THREE.Vector3();
  function update(time, delta, playerPosition) {
    const t = time + clockOffset;
    for (const item of fragments) {
      if (!item.root.visible) continue;
      if (item.collected) {
        item.collectAnim += delta;
        const k = Math.min(item.collectAnim / 0.6, 1);
        item.model.position.y = 1.25 + k * 2.6;
        item.model.scale.setScalar(1.6 * (1 - k));
        item.halo.material.opacity = 0.85 * (1 - k);
        item.halo.scale.setScalar(2.2 + k * 3);
        item.ring.material.opacity = 0.45 * (1 - k);
        if (k >= 1) item.root.visible = false;
        continue;
      }
      item.model.position.y = 1.25 + Math.sin(t * 1.8 + item.phase) * 0.12;
      item.model.rotation.y += delta * 0.9;
      item.halo.material.opacity = 0.65 + Math.sin(t * 3 + item.phase) * 0.2;
      item.ring.scale.setScalar(1 + Math.sin(t * 2 + item.phase) * 0.08);
      for (let i = 0; i < item.sparkleCount; i += 1) {
        const a = t * (0.6 + (i % 5) * 0.15) + i * 2.4;
        const r = 0.45 + (i % 3) * 0.12;
        item.sparklePositions[i * 3] = Math.cos(a) * r;
        item.sparklePositions[i * 3 + 1] = 0.6 + ((t * 0.35 + i * 0.37) % 1.4);
        item.sparklePositions[i * 3 + 2] = Math.sin(a) * r;
      }
      item.sparkles.geometry.attributes.position.needsUpdate = true;
    }

    if (beaconActive) {
      beacon.visible = true;
      beacon.position.lerp(beaconTarget, Math.min(delta * 6, 1));
      const near = playerPosition ? Math.hypot(playerPosition.x - beacon.position.x, playerPosition.z - beacon.position.z) : 99;
      const fade = THREE.MathUtils.clamp((near - 2.5) / 4, 0, 1);
      beam.material.opacity = (0.55 + Math.sin(t * 2.5) * 0.15) * fade;
      beaconRing.material.opacity = (0.35 + Math.sin(t * 2.5) * 0.15) * Math.max(fade, 0.3);
      beaconRing.scale.setScalar(1 + ((t * 0.6) % 1) * 0.6);
      beam.rotation.y += delta * 0.4;
    } else {
      beacon.visible = false;
    }

    for (let i = 0; i < dustCount; i += 1) {
      const s = dustSeeds[i];
      dustPositions[i * 3] += Math.sin(t * 0.21 + s) * delta * 0.06;
      dustPositions[i * 3 + 1] += (Math.sin(t * 0.17 + s * 1.3) * 0.05 - 0.012) * delta;
      if (dustPositions[i * 3 + 1] < 1.3) dustPositions[i * 3 + 1] = 10.5;
    }
    dustGeometry.attributes.position.needsUpdate = true;

    // Timeline wall: shards drift while broken, fly home when restored.
    if (restoring) restoreProgress = Math.min(1, restoreProgress + delta / 3);
    const eased = restoreProgress * restoreProgress * (3 - 2 * restoreProgress);
    for (const shard of shards) {
      const drift = 1 - eased;
      temp.copy(shard.home);
      temp.x += Math.sin(t * 0.5 + shard.phase) * 0.25 * drift;
      temp.y += Math.sin(t * 0.8 + shard.phase) * 0.2 * drift;
      // Restored: the shards fly back into the wall panel and disappear.
      shard.mesh.position.copy(temp).lerp(new THREE.Vector3(shard.home.x * 0.95, 3.1 + (shard.home.y - 3.1) * 0.4, -0.1), eased);
      shard.mesh.visible = eased < 0.98;
      shard.mesh.rotation.x += shard.spin.x * delta * drift;
      shard.mesh.rotation.y += shard.spin.y * delta * drift;
      shard.mesh.scale.setScalar(1 - eased * 0.85);
    }
    lineMaterial.emissiveIntensity = eased * (1.2 + Math.sin(t * 2) * 0.2);
    wallLight.intensity = 45 + eased * 70;
    shardMaterial.emissiveIntensity = 0.18 + eased * 0.8;

    if (confetti.visible) {
      let alive = 0;
      for (let i = 0; i < confettiCount; i += 1) {
        const piece = pieces[i];
        if (piece.life > 0) {
          piece.life -= delta;
          piece.velocity.y -= 9.8 * delta * 0.35;
          piece.velocity.multiplyScalar(1 - delta * 0.9);
          piece.position.addScaledVector(piece.velocity, delta);
          piece.rotation.x += piece.spin.x * delta;
          piece.rotation.y += piece.spin.y * delta;
          alive += 1;
        }
        dummy.position.copy(piece.position);
        dummy.rotation.copy(piece.rotation);
        dummy.scale.setScalar(piece.life > 0 ? 1 : 0);
        dummy.updateMatrix();
        confetti.setMatrixAt(i, dummy.matrix);
      }
      confetti.instanceMatrix.needsUpdate = true;
      if (!alive) confetti.visible = false;
    }
  }

  return {
    fragments,
    plaques,
    timelinePosition: new THREE.Vector3(0, wallFloor, wallZ + 2),
    update,
    burst,
    showFragments(collectedIds) {
      for (const item of fragments) {
        const collected = collectedIds.includes(item.fragment.id);
        item.collected = collected;
        item.root.visible = !collected;
      }
    },
    hideFragments() {
      for (const item of fragments) item.root.visible = false;
    },
    /** Returns the fragment the player is standing on, if any. */
    fragmentAt(position, radius = 1.3) {
      return fragments.find((item) => item.root.visible && !item.collected && Math.hypot(position.x - item.root.position.x, position.z - item.root.position.z) < radius) || null;
    },
    collect(item) {
      item.collected = true;
      item.collectAnim = 0;
    },
    nearestFragment(position) {
      let best = null;
      let bestDistance = Infinity;
      for (const item of fragments) {
        if (!item.root.visible || item.collected) continue;
        const distance = position.distanceTo(item.root.position);
        if (distance < bestDistance) { best = item; bestDistance = distance; }
      }
      return best;
    },
    setBeacon(target) {
      beaconActive = Boolean(target);
      if (!target) return;
      const first = !beacon.visible;
      beaconTarget.set(target.x, target.y ?? 0, target.z);
      if (first) beacon.position.copy(beaconTarget);
    },
    restoreTimeline(instant = false) {
      for (const slot of slots) placeInSlot(slot);
      restoring = true;
      if (instant) restoreProgress = 1;
    },
    get timelineRestored() {
      return restoring;
    },
  };
}

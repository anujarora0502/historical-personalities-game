// Scenery that makes the world feel alive: a busy street with traffic, lamps,
// trees and a city skyline; a fountain, flags and banners on the grounds; and a
// grand hall with a red carpet, chandeliers, busts, paintings and velvet ropes.
import * as THREE from 'three';

const HALL_FLOOR = 1.1 + 0.175; // top of the checkerboard tiles

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.05, ...extra });
const brass = mat('#c9a45c', { metalness: 0.9, roughness: 0.28 });
const marble = mat('#f1ede4', { roughness: 0.25, metalness: 0.05 });
const darkMetal = mat('#1f2226', { metalness: 0.6, roughness: 0.4 });
const velvet = mat('#7d1420', { roughness: 0.85 });
const bulb = new THREE.MeshStandardMaterial({ color: '#fff4d6', emissive: new THREE.Color('#ffd98a'), emissiveIntensity: 1.6 });

function mesh(geometry, material, x = 0, y = 0, z = 0, { cast = true, receive = true } = {}) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(x, y, z);
  object.castShadow = cast;
  object.receiveShadow = receive;
  return object;
}

const decorRedraws = [];
/** Repaint painted signs (called once the web fonts have loaded). */
export function refreshDecorText() {
  for (const redraw of decorRedraws) redraw();
}

function canvasTexture(width, height, draw, { text = false } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const paint = () => {
    draw(canvas.getContext('2d'), width, height);
    texture.needsUpdate = true;
  };
  paint();
  if (text) decorRedraws.push(paint);
  return texture;
}

// Deterministic pseudo-random numbers so the scenery is the same every visit.
function seeded(seed) {
  let value = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

// ------------------------------------------------------------------- traffic
function buildCar(color, random) {
  const car = new THREE.Group();
  const paint = mat(color, { metalness: 0.55, roughness: 0.25 });
  const glass = mat('#1c2630', { metalness: 0.8, roughness: 0.1 });
  const trim = mat('#15171a', { roughness: 0.7 });
  const body = mesh(new THREE.BoxGeometry(4.2, 0.62, 1.8), paint, 0, 0.62, 0);
  const cabin = mesh(new THREE.BoxGeometry(2.2, 0.55, 1.6), paint, -0.25, 1.2, 0);
  const windows = mesh(new THREE.BoxGeometry(2.24, 0.42, 1.64), glass, -0.25, 1.22, 0, { cast: false });
  const bumperFront = mesh(new THREE.BoxGeometry(0.12, 0.25, 1.8), trim, 2.12, 0.45, 0);
  const bumperBack = mesh(new THREE.BoxGeometry(0.12, 0.25, 1.8), trim, -2.12, 0.45, 0);
  car.add(body, cabin, windows, bumperFront, bumperBack);
  const headlight = new THREE.MeshStandardMaterial({ color: '#fffbe8', emissive: new THREE.Color('#fff2c4'), emissiveIntensity: 2 });
  const taillight = new THREE.MeshStandardMaterial({ color: '#ff3b30', emissive: new THREE.Color('#ff2a1f'), emissiveIntensity: 1.5 });
  for (const side of [-0.6, 0.6]) {
    car.add(mesh(new THREE.BoxGeometry(0.06, 0.14, 0.34), headlight, 2.16, 0.7, side, { cast: false }));
    car.add(mesh(new THREE.BoxGeometry(0.06, 0.12, 0.34), taillight, -2.16, 0.72, side, { cast: false }));
  }
  const wheels = [];
  const tire = mat('#111214', { roughness: 0.9 });
  const rim = mat('#b8bcc2', { metalness: 0.85, roughness: 0.3 });
  for (const x of [-1.35, 1.35]) {
    for (const z of [-0.88, 0.88]) {
      const wheel = new THREE.Group();
      wheel.position.set(x, 0.36, z);
      const t = mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.26, 20), tire);
      t.rotation.x = Math.PI / 2;
      const r = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.28, 10), rim);
      r.rotation.x = Math.PI / 2;
      wheel.add(t, r);
      car.add(wheel);
      wheels.push(wheel);
    }
  }
  car.userData.wheels = wheels;
  car.scale.setScalar(0.9 + random() * 0.15);
  return car;
}

// ----------------------------------------------------------------- the street
function buildStreet(scene, colliders, random, cars) {
  // Traffic in both lanes (the road runs along x at z = 24..36).
  const palette = ['#b3202a', '#1f4e8c', '#f2f2f2', '#2b2b2b', '#d9a441', '#3e7d5a', '#8a8f96', '#6a2c70'];
  const lanes = [{ z: 27.4, direction: 1 }, { z: 32.6, direction: -1 }];
  for (let i = 0; i < 9; i += 1) {
    const lane = lanes[i % 2];
    const car = buildCar(palette[i % palette.length], random);
    car.position.set(-90 + random() * 180, 0.1, lane.z);
    car.rotation.y = lane.direction > 0 ? 0 : Math.PI;
    scene.add(car);
    cars.push({ car, lane, speed: 7 + random() * 6 });
  }
  // The visitor stays on the museum side of the road.
  colliders.push({ minX: -90, maxX: 90, minZ: 24, maxZ: 25 });

  // Zebra crossing in front of the gate.
  const stripe = mat('#f4f1ea', { roughness: 0.8 });
  for (let i = 0; i < 7; i += 1) {
    const bar = mesh(new THREE.BoxGeometry(0.7, 0.02, 11), stripe, -4.2 + i * 1.4, 0.11, 30, { cast: false });
    scene.add(bar);
  }

  // Street lamps on both pavements.
  for (const z of [22.6, 37.6]) {
    for (let x = -60; x <= 60; x += 15) {
      if (z < 30 && Math.abs(x) < 6) continue;
      const lamp = new THREE.Group();
      lamp.position.set(x, 0.2, z);
      lamp.add(mesh(new THREE.CylinderGeometry(0.08, 0.13, 5.2, 10), darkMetal, 0, 2.6, 0));
      const arm = mesh(new THREE.BoxGeometry(0.08, 0.08, 1.2), darkMetal, 0, 5.1, z < 30 ? 0.5 : -0.5);
      const head = mesh(new THREE.CylinderGeometry(0.28, 0.18, 0.28, 12), darkMetal, 0, 5.0, z < 30 ? 1.05 : -1.05);
      const light = mesh(new THREE.SphereGeometry(0.16, 12, 8), bulb, 0, 4.88, z < 30 ? 1.05 : -1.05, { cast: false });
      lamp.add(arm, head, light);
      scene.add(lamp);
      if (z < 30) colliders.push({ minX: x - 0.2, maxX: x + 0.2, minZ: z - 0.2, maxZ: z + 0.2 });
    }
  }

  // Trees along the far pavement.
  const trunkMat = mat('#5b3a24', { roughness: 0.9 });
  const leafMats = [mat('#2f6b3a', { roughness: 0.85 }), mat('#3f8a4a', { roughness: 0.85 }), mat('#285a33', { roughness: 0.85 })];
  const tree = (x, z, size = 1) => {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.add(mesh(new THREE.CylinderGeometry(0.16 * size, 0.24 * size, 2.6 * size, 8), trunkMat, 0, 1.3 * size, 0));
    for (let i = 0; i < 5; i += 1) {
      const blob = mesh(new THREE.IcosahedronGeometry((0.9 + random() * 0.5) * size, 1), leafMats[i % 3], (random() - 0.5) * 1.4 * size, (2.8 + random() * 1.2) * size, (random() - 0.5) * 1.4 * size);
      group.add(blob);
    }
    scene.add(group);
    return group;
  };
  for (let x = -67.5; x <= 67.5; x += 15) tree(x, 38.8, 1.1);

  // City skyline across the road.
  const windowsTexture = (seed) => canvasTexture(128, 256, (context, w, h) => {
    const r = seeded(seed);
    context.fillStyle = '#2a2d33';
    context.fillRect(0, 0, w, h);
    for (let y = 10; y < h - 10; y += 22) {
      for (let x = 10; x < w - 10; x += 22) {
        const lit = r() > 0.45;
        context.fillStyle = lit ? `rgba(255, ${210 + Math.floor(r() * 40)}, 150, ${0.55 + r() * 0.4})` : 'rgba(120,140,160,0.35)';
        context.fillRect(x, y, 12, 14);
      }
    }
  });
  const facadeColors = ['#8d8378', '#a79a88', '#6f7478', '#9c8472', '#7d6f63'];
  for (let x = -84; x <= 84; x += 12) {
    const height = 10 + random() * 16;
    const width = 9 + random() * 2;
    const map = windowsTexture(Math.floor(x + 200));
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(width / 8, height / 14);
    const building = mesh(new THREE.BoxGeometry(width, height, 8), [
      mat(facadeColors[Math.abs(x) % 5]), mat(facadeColors[Math.abs(x) % 5]),
      mat('#55595e'), mat('#55595e'),
      new THREE.MeshStandardMaterial({ map, roughness: 0.6, emissive: new THREE.Color('#ffffff'), emissiveMap: map, emissiveIntensity: 0.25 }),
      mat(facadeColors[Math.abs(x) % 5]),
    ], x, height / 2, 46);
    scene.add(building);
    scene.add(mesh(new THREE.BoxGeometry(width + 0.4, 0.4, 8.4), mat('#4a4d52'), x, height + 0.2, 46));
  }
}

// ---------------------------------------------------------------- the grounds
function buildGrounds(scene, colliders, random, animated) {
  // Fountain in the forecourt.
  const fountain = new THREE.Group();
  fountain.position.set(0, 0, 11);
  const basin = mesh(new THREE.CylinderGeometry(2.6, 2.8, 0.7, 40), marble, 0, 0.35, 0);
  const rim = mesh(new THREE.TorusGeometry(2.62, 0.14, 10, 48), marble, 0, 0.72, 0);
  rim.rotation.x = Math.PI / 2;
  const waterMaterial = new THREE.MeshStandardMaterial({ color: '#4fa3c7', roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.85, emissive: new THREE.Color('#1c5f7a'), emissiveIntensity: 0.25 });
  const water = mesh(new THREE.CylinderGeometry(2.45, 2.45, 0.05, 40), waterMaterial, 0, 0.62, 0, { cast: false });
  const column = mesh(new THREE.CylinderGeometry(0.22, 0.32, 1.6, 16), marble, 0, 1.4, 0);
  const bowl = mesh(new THREE.CylinderGeometry(1.0, 0.4, 0.35, 32), marble, 0, 2.2, 0);
  const bowlWater = mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.04, 32), waterMaterial, 0, 2.36, 0, { cast: false });
  const finial = mesh(new THREE.SphereGeometry(0.16, 16, 10), brass, 0, 2.62, 0);
  fountain.add(basin, rim, water, column, bowl, bowlWater, finial);
  // Falling water droplets.
  const dropCount = 260;
  const drops = new Float32Array(dropCount * 3);
  const dropState = [];
  for (let i = 0; i < dropCount; i += 1) {
    dropState.push({ angle: random() * Math.PI * 2, speed: 0.6 + random() * 0.5, life: random(), radius: 0.9 + random() * 0.15 });
  }
  const dropGeometry = new THREE.BufferGeometry();
  dropGeometry.setAttribute('position', new THREE.BufferAttribute(drops, 3));
  const dropPoints = new THREE.Points(dropGeometry, new THREE.PointsMaterial({ color: '#d9f2ff', size: 0.06, transparent: true, opacity: 0.8, depthWrite: false }));
  fountain.add(dropPoints);
  scene.add(fountain);
  colliders.push({ minX: -2.3, maxX: 2.3, minZ: 8.7, maxZ: 13.3 });
  animated.push((time, delta) => {
    for (let i = 0; i < dropCount; i += 1) {
      const d = dropState[i];
      d.life += delta * d.speed;
      if (d.life > 1) d.life -= 1;
      const r = d.radius + d.life * 0.9;
      drops[i * 3] = Math.cos(d.angle) * r;
      drops[i * 3 + 1] = 2.35 - d.life * d.life * 1.7;
      drops[i * 3 + 2] = Math.sin(d.angle) * r;
    }
    dropGeometry.attributes.position.needsUpdate = true;
    water.scale.setScalar(1 + Math.sin(time * 2) * 0.004);
  });

  // Flags either side of the path.
  const flagTexture = (a, b) => canvasTexture(256, 160, (context, w, h) => {
    context.fillStyle = a;
    context.fillRect(0, 0, w, h);
    context.fillStyle = b;
    context.fillRect(0, h * 0.42, w, h * 0.16);
    context.beginPath();
    context.arc(w / 2, h / 2, h * 0.2, 0, Math.PI * 2);
    context.fill();
  });
  const flags = [];
  for (const [x, a, b] of [[-9, '#7d1420', '#e8c47a'], [9, '#1f3f6b', '#e8c47a']]) {
    const pole = mesh(new THREE.CylinderGeometry(0.06, 0.08, 9, 10), brass, x, 4.5, 17);
    const top = mesh(new THREE.SphereGeometry(0.14, 12, 8), brass, x, 9.05, 17);
    const geometry = new THREE.PlaneGeometry(2.4, 1.5, 16, 4);
    geometry.translate(1.2, 0, 0);
    const flag = mesh(geometry, new THREE.MeshStandardMaterial({ map: flagTexture(a, b), side: THREE.DoubleSide, roughness: 0.8 }), x + 0.06, 8.1, 17, { cast: false });
    flag.userData.base = Float32Array.from(geometry.attributes.position.array);
    scene.add(pole, top, flag);
    flags.push(flag);
    colliders.push({ minX: x - 0.2, maxX: x + 0.2, minZ: 16.8, maxZ: 17.2 });
  }
  animated.push((time) => {
    for (const flag of flags) {
      const position = flag.geometry.attributes.position;
      const base = flag.userData.base;
      for (let i = 0; i < position.count; i += 1) {
        const x = base[i * 3];
        position.array[i * 3 + 2] = Math.sin(x * 2.2 - time * 4) * 0.12 * (x / 2.4);
      }
      position.needsUpdate = true;
    }
  });

  // Trees in the side gardens.
  const trunkMat = mat('#5b3a24', { roughness: 0.9 });
  const leaf = mat('#356f40', { roughness: 0.85 });
  for (const x of [-26, 26]) {
    for (const z of [12, 2, -10, -24, -38]) {
      const group = new THREE.Group();
      group.position.set(x, 0, z);
      group.add(mesh(new THREE.CylinderGeometry(0.2, 0.3, 3, 8), trunkMat, 0, 1.5, 0));
      group.add(mesh(new THREE.ConeGeometry(1.8, 4.5, 10), leaf, 0, 4.8, 0));
      group.add(mesh(new THREE.ConeGeometry(1.4, 3.2, 10), leaf, 0, 6.6, 0));
      scene.add(group);
      colliders.push({ minX: x - 0.4, maxX: x + 0.4, minZ: z - 0.4, maxZ: z + 0.4 });
    }
  }

  // Banners on the museum facade, between the columns.
  const banner = (lines, color) => canvasTexture(256, 768, (context, w, h) => {
    context.fillStyle = color;
    context.fillRect(0, 0, w, h);
    context.strokeStyle = '#e8c47a';
    context.lineWidth = 8;
    context.strokeRect(16, 16, w - 32, h - 32);
    context.fillStyle = '#f7ecd2';
    context.textAlign = 'center';
    context.font = '600 24px "Josefin Sans", Futura, sans-serif';
    context.fillText('THE GRAND MUSEUM', w / 2, 80);
    context.font = 'italic 700 60px "Bodoni Moda", Didot, Georgia, serif';
    lines.forEach((line, i) => context.fillText(line, w / 2, h / 2 - 40 + i * 80));
    context.font = '600 22px "Josefin Sans", Futura, sans-serif';
    context.fillText('NOW SHOWING', w / 2, h - 70);
  }, { text: true });
  for (const [x, lines, color] of [[-12.75, ['Echoes', 'of History'], '#7d1420'], [-8.25, ['Mahatma', 'Gandhi'], '#8a4b14'], [8.25, ['Albert', 'Einstein'], '#1f3f6b'], [12.75, ['Echoes', 'of History'], '#7d1420']]) {
    const plane = mesh(new THREE.PlaneGeometry(2.4, 7.2), new THREE.MeshStandardMaterial({ map: banner(lines, color), roughness: 0.8 }), x, 7.6, -3.7, { cast: false });
    const rod = mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.7, 8), brass, x, 11.25, -3.68);
    rod.rotation.z = Math.PI / 2;
    scene.add(plane, rod);
  }
}

// -------------------------------------------------------------- the great hall
function buildHall(scene, colliders, random, animated) {
  // Red carpet from the doors to the Timeline Wall.
  const carpet = mesh(new THREE.BoxGeometry(3.2, 0.03, 35.5), velvet, 0, HALL_FLOOR + 0.015, -22.6, { cast: false });
  const carpetEdge = mat('#c9a45c', { metalness: 0.6, roughness: 0.4 });
  scene.add(carpet);
  for (const x of [-1.62, 1.62]) scene.add(mesh(new THREE.BoxGeometry(0.06, 0.035, 35.5), carpetEdge, x, HALL_FLOOR + 0.017, -22.6, { cast: false }));

  // A coffered cream-and-gold ceiling (instead of the dark underside of the roof).
  const coffers = canvasTexture(512, 512, (context, w, h) => {
    context.fillStyle = '#e9dfca';
    context.fillRect(0, 0, w, h);
    const cell = w / 4;
    for (let y = 0; y < 4; y += 1) {
      for (let x = 0; x < 4; x += 1) {
        const gradient = context.createLinearGradient(x * cell, y * cell, (x + 1) * cell, (y + 1) * cell);
        gradient.addColorStop(0, '#d8cbb0');
        gradient.addColorStop(1, '#f3ebdb');
        context.fillStyle = gradient;
        context.fillRect(x * cell + 12, y * cell + 12, cell - 24, cell - 24);
        context.strokeStyle = '#b8924a';
        context.lineWidth = 3;
        context.strokeRect(x * cell + 20, y * cell + 20, cell - 40, cell - 40);
        context.fillStyle = '#c9a45c';
        context.beginPath();
        context.arc(x * cell + cell / 2, y * cell + cell / 2, 7, 0, Math.PI * 2);
        context.fill();
      }
    }
  });
  coffers.wrapS = coffers.wrapT = THREE.RepeatWrapping;
  coffers.repeat.set(6, 6);
  const ceiling = mesh(new THREE.PlaneGeometry(43.4, 40.4), new THREE.MeshStandardMaterial({ map: coffers, roughness: 0.8, emissive: new THREE.Color('#fff4de'), emissiveMap: coffers, emissiveIntensity: 0.35 }), 0, 11.95, -24.5, { cast: false });
  ceiling.rotation.x = Math.PI / 2;
  scene.add(ceiling);

  // Chandeliers.
  for (const z of [-12, -24, -36]) {
    const chandelier = new THREE.Group();
    chandelier.position.set(0, 9.6, z);
    chandelier.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 6), brass, 0, 1.2, 0, { cast: false }));
    const ring = mesh(new THREE.TorusGeometry(1.4, 0.06, 8, 40), brass, 0, 0, 0, { cast: false });
    ring.rotation.x = Math.PI / 2;
    const ring2 = mesh(new THREE.TorusGeometry(0.8, 0.05, 8, 32), brass, 0, 0.5, 0, { cast: false });
    ring2.rotation.x = Math.PI / 2;
    chandelier.add(ring, ring2);
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2;
      chandelier.add(mesh(new THREE.SphereGeometry(0.1, 10, 8), bulb, Math.cos(a) * 1.4, 0.12, Math.sin(a) * 1.4, { cast: false }));
      if (i % 2 === 0) chandelier.add(mesh(new THREE.SphereGeometry(0.08, 10, 8), bulb, Math.cos(a) * 0.8, 0.6, Math.sin(a) * 0.8, { cast: false }));
    }
    chandelier.add(mesh(new THREE.SphereGeometry(0.22, 14, 10), brass, 0, -0.2, 0, { cast: false }));
    scene.add(chandelier);
  }

  // Marble busts on plinths along the side aisles.
  const bust = (x, z, seed) => {
    const r = seeded(seed);
    const group = new THREE.Group();
    group.position.set(x, HALL_FLOOR, z);
    group.add(mesh(new THREE.BoxGeometry(1, 1.3, 1), mat('#2a2622', { roughness: 0.4, metalness: 0.2 }), 0, 0.65, 0));
    group.add(mesh(new THREE.BoxGeometry(1.15, 0.1, 1.15), brass, 0, 1.33, 0));
    group.add(mesh(new THREE.CylinderGeometry(0.42, 0.55, 0.55, 20), marble, 0, 1.65, 0));
    group.add(mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.3, 14), marble, 0, 2.05, 0));
    const head = mesh(new THREE.SphereGeometry(0.3, 20, 16), marble, 0, 2.4, 0);
    head.scale.set(0.9, 1.1 + r() * 0.1, 1);
    group.add(head);
    group.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
    scene.add(group);
    colliders.push({ minX: x - 0.55, maxX: x + 0.55, minZ: z - 0.55, maxZ: z + 0.55 });
  };
  for (const z of [-8, -17, -27]) {
    bust(-18.5, z, 7 + z);
    bust(18.5, z, 13 - z);
  }

  // Paintings on the side walls.
  const painting = (seed) => canvasTexture(384, 288, (context, w, h) => {
    const r = seeded(seed);
    const hue = Math.floor(r() * 360);
    const sky = context.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, `hsl(${hue}, 45%, ${55 + r() * 15}%)`);
    sky.addColorStop(1, `hsl(${(hue + 40) % 360}, 40%, ${30 + r() * 15}%)`);
    context.fillStyle = sky;
    context.fillRect(0, 0, w, h);
    context.fillStyle = `hsla(${(hue + 180) % 360}, 50%, 70%, 0.9)`;
    context.beginPath();
    context.arc(w * (0.2 + r() * 0.6), h * 0.3, 20 + r() * 30, 0, Math.PI * 2);
    context.fill();
    for (let layer = 0; layer < 3; layer += 1) {
      context.fillStyle = `hsla(${(hue + 90 + layer * 25) % 360}, 35%, ${25 + layer * 12}%, 0.95)`;
      context.beginPath();
      context.moveTo(0, h);
      for (let x = 0; x <= w; x += 16) context.lineTo(x, h * (0.55 + layer * 0.12) + Math.sin(x * 0.02 + r() * 6) * 18);
      context.lineTo(w, h);
      context.fill();
    }
  });
  const frameMaterial = mat('#b8913f', { metalness: 0.85, roughness: 0.3 });
  for (const side of [-1, 1]) {
    for (const z of [-7, -17, -27, -37]) {
      const x = side * 21.62;
      const frame = mesh(new THREE.BoxGeometry(0.12, 2.5, 3.3), frameMaterial, x, HALL_FLOOR + 3.3, z);
      const canvasMesh = mesh(new THREE.PlaneGeometry(2.9, 2.1), new THREE.MeshStandardMaterial({ map: painting(Math.floor(100 + side * 17 + z * 3)), roughness: 0.7 }), x - side * 0.07, HALL_FLOOR + 3.3, z, { cast: false });
      canvasMesh.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      scene.add(frame, canvasMesh);
    }
  }

  // Velvet ropes in front of the Timeline Wall.
  const posts = [];
  for (let x = -7; x <= 7.01; x += 2.8) {
    const post = new THREE.Group();
    post.position.set(x, HALL_FLOOR, -40.5);
    post.add(mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.06, 16), brass, 0, 0.03, 0));
    post.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.95, 10), brass, 0, 0.5, 0));
    post.add(mesh(new THREE.SphereGeometry(0.07, 12, 8), brass, 0, 1.0, 0));
    scene.add(post);
    posts.push(x);
  }
  for (let i = 0; i < posts.length - 1; i += 1) {
    const a = new THREE.Vector3(posts[i], HALL_FLOOR + 0.9, -40.5);
    const b = new THREE.Vector3(posts[i + 1], HALL_FLOOR + 0.9, -40.5);
    const mid = a.clone().lerp(b, 0.5);
    mid.y -= 0.25;
    const rope = mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 16, 0.035, 8), velvet, 0, 0, 0);
    scene.add(rope);
  }
  colliders.push({ minX: -7.2, maxX: 7.2, minZ: -40.7, maxZ: -40.3 });

  // Benches and potted palms.
  const wood = mat('#6b4428', { roughness: 0.7 });
  for (const [x, z] of [[-10.5, -31], [10.5, -31], [-10.5, -9], [10.5, -9]]) {
    const bench = new THREE.Group();
    bench.position.set(x, HALL_FLOOR, z);
    bench.add(mesh(new THREE.BoxGeometry(2.4, 0.12, 0.7), wood, 0, 0.5, 0));
    for (const bx of [-1, 1]) bench.add(mesh(new THREE.BoxGeometry(0.1, 0.45, 0.6), darkMetal, bx, 0.22, 0));
    scene.add(bench);
    colliders.push({ minX: x - 1.25, maxX: x + 1.25, minZ: z - 0.4, maxZ: z + 0.4 });
  }
  const pot = mat('#2f2a26', { roughness: 0.5, metalness: 0.3 });
  const frond = mat('#2f7040', { roughness: 0.8, side: THREE.DoubleSide });
  for (const [x, z] of [[-5.5, -6], [5.5, -6], [-9, -42.5], [9, -42.5]]) {
    const palm = new THREE.Group();
    palm.position.set(x, HALL_FLOOR, z);
    palm.add(mesh(new THREE.CylinderGeometry(0.42, 0.32, 0.8, 16), pot, 0, 0.4, 0));
    palm.add(mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.4, 8), wood, 0, 1.4, 0));
    for (let i = 0; i < 7; i += 1) {
      const leafMesh = mesh(new THREE.PlaneGeometry(0.35, 1.3), frond, 0, 2.0, 0, { cast: false });
      leafMesh.rotation.set(-1.0, (i / 7) * Math.PI * 2, 0, 'YXZ');
      leafMesh.translateY(0.55);
      palm.add(leafMesh);
    }
    scene.add(palm);
    colliders.push({ minX: x - 0.5, maxX: x + 0.5, minZ: z - 0.5, maxZ: z + 0.5 });
  }
}

export function createDecor({ scene, colliders }) {
  const random = seeded(42);
  const cars = [];
  const animated = [];
  buildStreet(scene, colliders, random, cars);
  buildGrounds(scene, colliders, random, animated);
  buildHall(scene, colliders, random, animated);
  return {
    update(time, delta) {
      for (const { car, lane, speed } of cars) {
        car.position.x += lane.direction * speed * delta;
        if (car.position.x > 95) car.position.x = -95;
        if (car.position.x < -95) car.position.x = 95;
        for (const wheel of car.userData.wheels) wheel.rotation.z -= (speed * delta) / 0.36;
      }
      for (const step of animated) step(time, delta);
    },
  };
}

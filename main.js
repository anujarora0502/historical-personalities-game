import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { BrowserAudioInterface, ConversationAgent, InteractionType } from 'sarvam-conv-ai-sdk/browser';

// Resolve files in public/ against Vite's base URL so the game also works when
// hosted under a sub-path (e.g. GitHub Pages at /<repo>/).
const assetUrl = (path) => `${import.meta.env.BASE_URL}${path}`;

const app = document.querySelector('#app');
const roomName = document.querySelector('#room-name');
const roomDetail = document.querySelector('#room-detail');
const locationLabel = document.querySelector('#location-label');

const scene = new THREE.Scene();
const skyColor = new THREE.Color('#7ec0ee'); // Bright daylight sky
scene.background = skyColor;
scene.fog = new THREE.FogExp2(skyColor, 0.005); // Light atmospheric fog

const camera = new THREE.PerspectiveCamera(64, innerWidth / innerHeight, 0.1, 250);
camera.position.set(0, 2.2, 26); // Start outside the new entrance gate

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
app.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.enableZoom = false;
controls.minDistance = 0.01;
controls.maxDistance = 100;
// Set target just slightly in front of the camera so dragging rotates the camera in place
controls.target.set(0, 2.2, 25.99);

const clock = new THREE.Clock();
const characters = [];
const elevationZones = [];
const galleryDoors = [];
const colliders = [
  // Museum inner walls & pillars
  { minX: -23, maxX: -21, minZ: -46, maxZ: -3 }, // Left wall
  { minX: 21, maxX: 23, minZ: -46, maxZ: -3 },   // Right wall
  { minX: -23, maxX: 23, minZ: -46, maxZ: -44 }, // Back wall
  { minX: -23, maxX: -3.8, minZ: -4.5, maxZ: -3.5 }, // Front wall left
  { minX: 3.8, maxX: 23, minZ: -4.5, maxZ: -3.5 },   // Front wall right
  { minX: -14.8, maxX: -13.2, minZ: -12.8, maxZ: -11.2 },
  { minX: 13.2, maxX: 14.8, minZ: -12.8, maxZ: -11.2 },
  { minX: -14.8, maxX: -13.2, minZ: -22.8, maxZ: -21.2 },
  { minX: 13.2, maxX: 14.8, minZ: -22.8, maxZ: -21.2 },
  { minX: -14.8, maxX: -13.2, minZ: -32.8, maxZ: -31.2 },
  { minX: 13.2, maxX: 14.8, minZ: -32.8, maxZ: -31.2 },
];
const keys = new Set();
let jumpVelocity = 0;
let isJumping = false;
let talkingFighter = null;
let speakingCharacter = null;
let nearbyFighter = null;
let sarvamAgent = null;
let sarvamStarting = false;
let sarvamOutputLevel = 0;
let sarvamTargetLevel = 0;
let conversationDismissed = false;

// Bright daylight lighting setup
scene.add(new THREE.HemisphereLight('#ffffff', '#888899', 1.0)); // Bright ambient
const sun = new THREE.DirectionalLight('#fffff0', 3.0); // Bright sun
sun.position.set(-15, 25, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0005;
sun.shadow.blurSamples = 16;
sun.shadow.radius = 4;
scene.add(sun);

const sky = new Sky();
sky.scale.setScalar(100);
sky.material.uniforms.turbidity.value = 2;
sky.material.uniforms.rayleigh.value = 1.0;
sky.material.uniforms.mieCoefficient.value = 0.005;
sky.material.uniforms.mieDirectionalG.value = 0.85;
sky.material.uniforms.sunPosition.value.copy(sun.position).normalize();
scene.add(sky);

const materials = {
  floor: new THREE.MeshStandardMaterial({ color: '#b5b8b9', roughness: 0.4, metalness: 0.1 }), // Bright concrete
  wood: new THREE.MeshStandardMaterial({ color: '#5c3a21', roughness: 0.9 }),
  asphalt: new THREE.MeshStandardMaterial({ color: '#1a1d21', roughness: 0.8 }),
  sidewalk: new THREE.MeshStandardMaterial({ color: '#8a8880', roughness: 0.7 }),
  monument: new THREE.MeshStandardMaterial({ color: '#e8e5df', roughness: 0.3, metalness: 0.1 }), // White marble
  monumentDark: new THREE.MeshStandardMaterial({ color: '#6a6b6d', roughness: 0.2, metalness: 0.4 }), // Medium marble
  paving: new THREE.MeshStandardMaterial({ color: '#e5e3dc', roughness: 0.2, metalness: 0.1 }), // Lighter paving
  terrace: new THREE.MeshStandardMaterial({ color: '#7b8082', roughness: 0.8 }),
  floorDark: new THREE.MeshStandardMaterial({ color: '#1a1a1f', roughness: 0.05, metalness: 0.6 }), // Highly reflective black tile
  doorGlass: new THREE.MeshPhysicalMaterial({ color: '#ffffff', transmission: 0.95, opacity: 1, metalness: 0.1, roughness: 0.0, ior: 1.5 }), // Realistic glass
  gold: new THREE.MeshStandardMaterial({ color: '#ffc845', roughness: 0.1, metalness: 1.0 }), // Pure shiny gold
  wall: new THREE.MeshStandardMaterial({ color: '#d1cbbd', roughness: 0.9 }), // Bright museum walls
};

function box(width, height, depth, x, y, z, material, castShadow = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function addLabel(text, x, y, z, rotation = 0, scale = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 160;
  const context = canvas.getContext('2d');

  // Clean minimalist dark board
  context.fillStyle = '#111111';
  context.fillRect(0, 0, canvas.width, canvas.height);

  // Thin silver border
  context.strokeStyle = '#cccccc';
  context.lineWidth = 4;
  context.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

  // Clean white sans-serif text
  context.fillStyle = '#ffffff';
  context.font = 'bold 56px "Inter", -apple-system, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text.toUpperCase(), canvas.width / 2, canvas.height / 2 + 4);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.52), new THREE.MeshBasicMaterial({ map: texture }));
  plaque.position.set(x, y, z);
  plaque.rotation.y = rotation;
  plaque.scale.setScalar(scale);
  scene.add(plaque);
}

const ground = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), materials.floor);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

function addSteps(x, z, width, count, direction = 1) {
  for (let i = 0; i < count; i += 1) {
    const height = 0.22 * (i + 1);
    const depth = 0.7;
    box(width, height, depth, x, height / 2, z + direction * i * depth, materials.paving, false);
    elevationZones.push({ x, z: z + direction * i * depth, width, depth, height });
  }
}

function addTerrace(x, z, width, depth, height) {
  box(width, height, depth, x, height / 2, z, materials.terrace, true);
  box(width + 0.4, 0.12, depth + 0.4, x, height + 0.06, z, materials.paving, false);
  elevationZones.push({ x, z, width, depth, height });
}

function surfaceHeightAt(x, z) {
  let height = 0;
  for (const zone of elevationZones) {
    if (Math.abs(x - zone.x) <= zone.width / 2 && Math.abs(z - zone.z) <= zone.depth / 2) height = Math.max(height, zone.height);
  }
  return height;
}

function galleryLight(x, z, color = '#fff0c2') {
  const light = new THREE.PointLight(color, 7, 12, 2);
  light.position.set(x, 4.4, z);
  light.castShadow = true;
  scene.add(light);
}

function addGalleryBuilding() {
  const front = -4;
  const back = -45;
  const side = 22;
  const height = 11;
  const floorY = 5 * 0.22; // 1.1

  // Grand steps leading up to the museum
  addSteps(0, front + 3.5, side * 2, 5, -1);
  // Main building platform
  addTerrace(0, (front + back) / 2, side * 2, front - back, floorY);

  // Main building shell (walls)
  box(0.5, height, back - front, -side, floorY + height / 2, (front + back) / 2, materials.wall, true);
  box(0.5, height, back - front, side, floorY + height / 2, (front + back) / 2, materials.wall, true);
  box(side * 2, height, 0.5, 0, floorY + height / 2, back, materials.wall, true);

  // Front Wall (left, right, and top over entrance)
  box(18, height, 0.5, -13, floorY + height / 2, front, materials.wall, true);
  box(18, height, 0.5, 13, floorY + height / 2, front, materials.wall, true);
  box(8, height - 6.5, 0.5, 0, floorY + 6.5 + (height - 6.5) / 2, front, materials.wall, true);

  // Roof (lowered slightly so it intersects the walls, preventing anti-aliasing gaps)
  box(side * 2 + 1, 1.2, front - back + 1, 0, floorY + height + 0.5, (front + back) / 2, materials.monumentDark, true);

  // Massive Colonnade at the front
  box(side * 2, 1.5, 3, 0, floorY + height - 0.75, front + 1.5, materials.monument, true); // Architrave

  const pedimentShape = new THREE.Shape();
  pedimentShape.moveTo(-22, 0);
  pedimentShape.lineTo(22, 0);
  pedimentShape.lineTo(0, 3.5); // 3.5 units high in the center
  pedimentShape.lineTo(-22, 0);
  const pedimentGeo = new THREE.ExtrudeGeometry(pedimentShape, { depth: 3, bevelEnabled: false });
  // Center the geometry so it's easier to place
  pedimentGeo.translate(0, 0, -1.5);
  const pediment = new THREE.Mesh(pedimentGeo, materials.monumentDark);
  pediment.position.set(0, floorY + height, front + 1.5);
  pediment.castShadow = true;
  scene.add(pediment);

  // Columns
  for (let x = -side + 2.5; x <= side - 2.5; x += 4.5) {
    if (Math.abs(x) > 4) { // Leave center wide open for grand entrance
      const column = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, height - 1.5, 16), materials.monument);
      column.position.set(x, floorY + (height - 1.5) / 2, front + 1.5);
      column.castShadow = true;
      scene.add(column);
    }
  }

  // Huge Sign
  addLabel('THE GRAND MUSEUM', 0, floorY + height - 0.75, front + 3.01, 0, 3.5);

  // Entrance Doors (taller and wider, pushed back into the wall)
  for (const x of [-2, 2]) {
    const door = new THREE.Mesh(new THREE.BoxGeometry(3.8, 6.5, 0.2), materials.doorGlass);
    door.position.set(x, floorY + 3.25, front - 0.1);
    door.castShadow = true;
    scene.add(door);
    galleryDoors.push({ door, closedX: x, openX: x + (x < 0 ? -2.5 : 2.5) });
  }

  // Polished black-and-white hall floor (placed just above the terrace)
  for (let row = 0; row < 16; row += 1) {
    for (let column = -8; column <= 8; column += 1) {
      const tile = (row + column) % 2 === 0 ? materials.paving : materials.floorDark;
      box(2.4, 0.05, 2.4, column * 2.4, floorY + 0.15, front - 2 - row * 2.4, tile, false);
    }
  }

  // Interior columns to make the inside look grand
  for (const z of [-12, -22, -32]) {
    for (const x of [-14, 14]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, height, 12), materials.monumentDark);
      col.position.set(x, floorY + height / 2, z);
      col.castShadow = true;
      scene.add(col);
    }
    // Art alcoves
    for (const x of [-21.5, 21.5]) {
      box(0.2, 5, 4, x, floorY + 2.5, z, materials.gold, false);
      galleryLight(x > 0 ? x - 2 : x + 2, z, '#ffddaa');
    }
  }

  // Main interior lights
  galleryLight(0, -10, '#ffecd1');
  galleryLight(0, -25, '#ffecd1');
}

addGalleryBuilding();

function buildPark() {
  // Road (raised slightly to prevent Z-fighting flicker)
  box(160, 0.1, 12, 0, 0.05, 30, materials.asphalt, false);

  // Road lines
  for (let i = -70; i <= 70; i += 8) {
    box(3, 0.12, 0.3, i, 0.06, 30, materials.monument, false);
  }

  // Sidewalks
  box(160, 0.2, 3, 0, 0.1, 22.5, materials.sidewalk, false);
  box(160, 0.2, 3, 0, 0.1, 37.5, materials.sidewalk, false);

  // Museum Boundary Walls (4 sides) - Tighter property boundary
  const wallDepth = 0.6;
  // Front Left wall
  box(26, 2.5, wallDepth, -17, 1.25, 21.2, materials.monumentDark, true);
  colliders.push({ minX: -30, maxX: -4, minZ: 20.9, maxZ: 21.5 });
  // Front Right wall
  box(26, 2.5, wallDepth, 17, 1.25, 21.2, materials.monumentDark, true);
  colliders.push({ minX: 4, maxX: 30, minZ: 20.9, maxZ: 21.5 });

  // Left Side wall
  box(wallDepth, 2.5, 71.2, -30, 1.25, -14.4, materials.monumentDark, true);
  colliders.push({ minX: -30.3, maxX: -29.7, minZ: -50, maxZ: 21.2 });
  // Right Side wall
  box(wallDepth, 2.5, 71.2, 30, 1.25, -14.4, materials.monumentDark, true);
  colliders.push({ minX: 29.7, maxX: 30.3, minZ: -50, maxZ: 21.2 });

  // Back wall
  box(60.6, 2.5, wallDepth, 0, 1.25, -50, materials.monumentDark, true);
  colliders.push({ minX: -30, maxX: 30, minZ: -50.3, maxZ: -49.7 });

  // Entrance Pillars
  for (const px of [-4, 4]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.5, 1.2), materials.monument);
    pillar.position.set(px, 1.75, 21.2);
    pillar.castShadow = true;
    scene.add(pillar);

    // Pillar caps
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 1.4), materials.gold);
    cap.position.set(px, 3.7, 21.2);
    scene.add(cap);

    // Pillar collision
    colliders.push({ minX: px - 0.6, maxX: px + 0.6, minZ: 20.6, maxZ: 21.8 });
  }
}
buildPark();

// Hedges framing the entrance path, loaded from stylized_bush.glb.
new GLTFLoader().load(assetUrl('stylized_bush.glb'), (gltf) => {
  const bushModel = gltf.scene;
  bushModel.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      child.frustumCulled = false;
    }
  });

  const placeBush = (x, z, scale) => {
    const b = bushModel.clone();
    b.scale.setScalar(scale);
    b.position.set(x, 0, z);
    b.updateMatrixWorld(true);

    const bounds = new THREE.Box3().setFromObject(b);
    b.position.y = -bounds.min.y; // Sit precisely on the ground

    // Re-calculate bounds after adjusting Y
    b.updateMatrixWorld(true);
    const finalBounds = new THREE.Box3().setFromObject(b);

    scene.add(b);
    colliders.push({
      minX: finalBounds.min.x, maxX: finalBounds.max.x,
      minZ: finalBounds.min.z, maxZ: finalBounds.max.z
    });
  };

  // Place bushes strictly in a neat line framing the entrance pathway
  for (let z = 6; z <= 20; z += 3.5) {
    // Skip the left bush nearest the museum (z = 6) so the info desk stays visible.
    if (z > 6.1) placeBush(-6, z, 1.4);
    placeBush(6, z, 1.4);
  }
});

const einsteinExhibit = {
  name: 'Albert Einstein',
  era: '1879 - 1945  |  Physics & Cosmology',
  dialogue: true,
  sarvamAppId: import.meta.env.VITE_SARVAM_EINSTEIN_APP_ID || 'Conversatio-71192055-48ab',
  userIdentifier: 'user123',
  agentVariables: {
    call_summary: '',
    engagement_level: '',
    gender: '',
    primary_topic: '',
    user_name: 'Museum Visitor',
  },
  faceOffset: Math.PI,
};

const gandhiExhibit = {
  name: 'Mahatma Gandhi',
  era: '1869 - 1948  |  Civil Rights & Freedom',
  dialogue: true,
  sarvamAppId: import.meta.env.VITE_SARVAM_GANDHI_APP_ID || import.meta.env.VITE_SARVAM_APP_ID || 'Conversatio-e9177db5-caa4',
  userIdentifier: 'user123',
  agentVariables: {
    call_outcome: '',
    call_summary: '',
    caller_name: 'Museum Visitor',
    gender: '',
    topics_discussed: '',
    user_name: 'Museum Visitor',
  },
  faceOffset: Math.PI,
};

const guideExhibit = {
  name: 'Gallery Guide',
  era: 'Gallery Welcome',
  dialogue: true,
  isGuide: true,
  sarvamAppId: import.meta.env.VITE_SARVAM_GUIDE_APP_ID || 'Conversatio-9f72aaa2-f2f0',
  proximityRadius: 4.5,
  agentVariables: {
    call_summary: '',
    gender: 'female',
    orientation_outcome: '',
  },
  faceOffset: 0,
};

const TILE_OFFSET = 0.175; // The checkerboard hall tiles sit this far above the base terrain.

/**
 * Loads a custom character GLB, scales it to a common height, places it at (x, z)
 * and registers it for proximity conversations and procedural animation.
 * `partNames` maps animation slots (head, mouth, leftArm, ...) to node names in the GLB.
 */
function loadCharacter({ url, exhibit, x, y = 0, z, roam, partNames, attachHandsToArms = false, onLoad }) {
  new GLTFLoader().load(url, (gltf) => {
    const model = gltf.scene;
    model.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = true;
      child.receiveShadow = true;
      child.frustumCulled = false;
    });
    const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
    model.scale.setScalar(Math.min(2.45 / size.y, 3.7 / Math.max(size.x, size.z)));
    const fitted = new THREE.Box3().setFromObject(model);
    model.position.set(
      x - (fitted.min.x + fitted.max.x) / 2,
      y - fitted.min.y,
      z - (fitted.min.z + fitted.max.z) / 2,
    );
    model.userData.exhibit = exhibit;
    scene.add(model);

    const parts = {};
    for (const [slot, name] of Object.entries(partNames)) {
      const part = model.getObjectByName(name);
      if (part) parts[slot] = part;
    }
    // Parent the hands to the sleeves so they swing with the arms instead of
    // staying behind (Object3D.attach keeps their current world transform).
    if (attachHandsToArms) {
      model.updateMatrixWorld(true);
      if (parts.leftArm && parts.leftHand) parts.leftArm.attach(parts.leftHand);
      if (parts.rightArm && parts.rightHand) parts.rightArm.attach(parts.rightHand);
    }

    const character = registerCharacter(model, exhibit);
    character.roam = roam;
    character.parts = parts;
    character.mouthBaseScaleY = parts.mouth?.scale.y || 0.025;
    onLoad?.(model);
  }, undefined, (error) => console.error(`Unable to load ${exhibit.name} model (${url}):`, error));
}

loadCharacter({
  url: assetUrl('einstein-custom.glb?v=2'),
  exhibit: einsteinExhibit,
  x: -4,
  y: TILE_OFFSET,
  z: -26,
  roam: true,
  partNames: {
    head: 'Head', mouth: 'Mouth',
    leftArm: 'Left_Arm', rightArm: 'Right_Arm',
    leftLeg: 'Left_Leg', rightLeg: 'Right_Leg',
    leftShoe: 'Left_Shoe', rightShoe: 'Right_Shoe',
    leftHand: 'Left_Hand', rightHand: 'Right_Hand',
  },
});

loadCharacter({
  url: assetUrl('gandhi-custom.glb?v=2'),
  exhibit: gandhiExhibit,
  x: 4,
  y: TILE_OFFSET,
  z: -26,
  roam: true,
  partNames: {
    head: 'Gandhi_Head', mouth: 'Gandhi_Mouth',
    leftArm: 'Gandhi_Arm', rightArm: 'Gandhi_Arm.001',
    leftLeg: 'Gandhi_Left_Leg', rightLeg: 'Gandhi_Right_Leg',
    leftShoe: 'Gandhi_Shoe_L', rightShoe: 'Gandhi_Shoe_R',
    rightHand: 'Gandhi_Hand.001', stick: 'Gandhi_Stick',
  },
});

loadCharacter({
  url: assetUrl('guide-custom.glb?v=2'),
  exhibit: guideExhibit,
  x: -5.5,
  z: 0.8,
  roam: false,
  attachHandsToArms: true,
  partNames: {
    head: 'Guide_Head', mouth: 'Guide_Mouth',
    leftArm: 'Guide_Arm_L', rightArm: 'Guide_Arm_R',
    leftLeg: 'Guide_Leg_L', rightLeg: 'Guide_Leg_R',
    leftShoe: 'Guide_Shoe_L', rightShoe: 'Guide_Shoe_R',
    leftHand: 'Guide_Hand_L', rightHand: 'Guide_Hand_R',
  },
  onLoad: addInfoDesk,
});

// Info desk in front of the gallery guide (centered at x = -5.5).
function addInfoDesk() {
  box(2.2, 0.72, 0.9, -5.5, 0.36, 1.5, materials.monumentDark);
  box(2.4, 0.08, 1.05, -5.5, 0.76, 1.5, materials.wood);
  addLabel('INFO DESK', -5.5, 0.8, 2.11, 0, 0.8);
}

function roomAt(position) {
  if (position.z < -4) {
    return ['The Grand Museum', 'Walk close to a character to talk to them.'];
  }
  return ['Museum Grounds', 'Walk toward the entrance and approach a character to talk.'];
}

function nearbyExhibit() {
  let closest = null;
  let closestDistance = Infinity;
  for (const character of characters) {
    const distance = camera.position.distanceTo(character.position);
    const radius = character.root.userData.exhibit.proximityRadius || 4.4;
    if (distance < radius && distance < closestDistance) {
      closest = character.root.userData.exhibit;
      closestDistance = distance;
    }
  }
  return closest;
}

function stopConversation() {
  sarvamAgent?.stop().catch(() => {});
  sarvamAgent = null;
  sarvamOutputLevel = 0;
  sarvamTargetLevel = 0;
}

function updateInteraction() {
  const nearby = nearbyExhibit();
  if (nearby && nearbyFighter !== nearby && !conversationDismissed) {
    stopConversation();
    nearbyFighter = nearby;
    openExhibit(nearby);
    startSarvamConversation();
  } else if (!nearby) {
    nearbyFighter = null;
    conversationDismissed = false;
    if (sarvamAgent) {
      stopConversation();
      setCharacterState(talkingFighter, 'idle');
      setSpeaking(talkingFighter, false);
    }
  }
}

function startNearbyConversationFromGesture() {
  const nearby = nearbyExhibit();
  if (!nearby || nearbyFighter === nearby || conversationDismissed) return;
  nearbyFighter = nearby;
  openExhibit(nearby);
  startSarvamConversation();
}

function registerCharacter(root, exhibit) {
  const position = new THREE.Vector3();
  root.getWorldPosition(position);
  const character = {
    root,
    exhibit,
    position,
    baseY: root.position.y,
    talkOffset: Math.random() * 4,
    parts: {},
    motionState: 'idle',
    roam: false,
    roamCenter: position.clone(),
    roamTarget: new THREE.Vector3(),
    roamWait: 0,
    roamSpeed: 0.65,
    mouthBaseScaleY: 0.025,
  };
  root.userData.character = character;
  characters.push(character);
  return character;
}

function openExhibit(exhibit) {
  if (exhibit.dialogue) {
    talkingFighter = exhibit;
  }
}

function findCharacter(exhibit) {
  return characters.find(({ root }) => root.userData.exhibit === exhibit);
}

function setCharacterState(exhibit, state) {
  const character = findCharacter(exhibit);
  if (character) character.motionState = state;
}

function setSpeaking(exhibit, isSpeaking) {
  const character = findCharacter(exhibit);
  if (isSpeaking) {
    speakingCharacter = character || null;
    document.body.classList.toggle('speaking', Boolean(isSpeaking));
  } else if (!exhibit || speakingCharacter === character) {
    speakingCharacter = null;
    document.body.classList.remove('speaking');
  }
}

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) keys.add(key);
  if (key === ' ' && !isJumping) {
    jumpVelocity = 5.4;
    isJumping = true;
    event.preventDefault();
  }
  startNearbyConversationFromGesture();
});
window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));
window.addEventListener('pointerdown', startNearbyConversationFromGesture);

const sarvamConfig = {
  apiKey: import.meta.env.VITE_SARVAM_API_KEY,
  orgId: import.meta.env.VITE_SARVAM_ORG_ID,
  workspaceId: import.meta.env.VITE_SARVAM_WORKSPACE_ID,
  appId: import.meta.env.VITE_SARVAM_APP_ID,
};

async function startSarvamConversation() {
  if (sarvamAgent || sarvamStarting) return;
  const appId = talkingFighter?.sarvamAppId || sarvamConfig.appId;
  if (!sarvamConfig.apiKey || !sarvamConfig.orgId || !sarvamConfig.workspaceId || !appId) return;
  sarvamStarting = true;
  try {
    sarvamAgent = new ConversationAgent({
      apiKey: sarvamConfig.apiKey,
      platform: 'browser',
      config: {
        org_id: sarvamConfig.orgId,
        workspace_id: sarvamConfig.workspaceId,
        app_id: appId,
        user_identifier_type: 'custom',
        user_identifier: talkingFighter?.userIdentifier || `museum-visitor-${crypto.randomUUID()}`,
        interaction_type: InteractionType.CALL,
        input_sample_rate: 16000,
        output_sample_rate: 16000,
        agent_variables: talkingFighter?.agentVariables || { user_name: 'Museum Visitor' },
      },
      audioInterface: new BrowserAudioInterface(16000, {
        outputLevelCallback: ({ rms }) => {
          // Use decoded agent audio rather than a timer for mouth movement.
          sarvamTargetLevel = Math.min(1, rms * 8);
        },
      }),
      audioCallback: async () => {
        // Audio chunks are the authoritative signal that the agent is speaking.
        setCharacterState(talkingFighter, 'speaking');
        setSpeaking(talkingFighter, true);
      },
      stateCallback: (state) => {
        const normalizedState = String(state).toLowerCase();
        setCharacterState(talkingFighter, normalizedState);
        setSpeaking(talkingFighter, normalizedState === 'speaking');
      },
      endCallback: async () => {
        sarvamAgent = null;
        sarvamOutputLevel = 0;
        sarvamTargetLevel = 0;
        conversationDismissed = true;
        nearbyFighter = talkingFighter;
        setCharacterState(talkingFighter, 'idle');
        setSpeaking(talkingFighter, false);
      },
    });
    await sarvamAgent.start();
    const connected = await sarvamAgent.waitForConnect(10);
    if (!connected) throw new Error('Sarvam connection timed out');
  } catch (error) {
    console.error('Sarvam connection error:', error);
    stopConversation();
    nearbyFighter = null;
  } finally {
    sarvamStarting = false;
  }
}

const forward = new THREE.Vector3();
const sideways = new THREE.Vector3();
const visitorPosition = new THREE.Vector3();
function updateCharacters(time, delta) {
  visitorPosition.copy(camera.position);
  const smoothing = sarvamTargetLevel > sarvamOutputLevel ? 1 - Math.exp(-delta * 11) : 1 - Math.exp(-delta * 7);
  sarvamOutputLevel = THREE.MathUtils.lerp(sarvamOutputLevel, sarvamTargetLevel, smoothing);
  for (const character of characters) {
    const { root, baseY, talkOffset } = character;
    root.getWorldPosition(character.position);
    const distance = Math.hypot(character.position.x - visitorPosition.x, character.position.z - visitorPosition.z);
    const interactionRadius = character.exhibit.proximityRadius || 4.4;
    const isInProximity = distance <= interactionRadius;
    const isRoaming = character.roam && (!isInProximity || conversationDismissed) && !sarvamAgent && !sarvamStarting;
    let isWalking = false;
    if (isRoaming) {
      if (character.roamWait > 0) {
        character.roamWait -= delta;
      } else {
        if (!character.roamTarget.lengthSq() || Math.hypot(root.position.x - character.roamTarget.x, root.position.z - character.roamTarget.z) < 0.25) {
          const angle = Math.random() * Math.PI * 2;
          const radius = 1.5 + Math.random() * 2.3;
          character.roamTarget.set(
            character.roamCenter.x + Math.cos(angle) * radius,
            root.position.y,
            character.roamCenter.z + Math.sin(angle) * radius,
          );
          character.roamWait = 0.4 + Math.random() * 1.4;
        } else {
          const offsetX = character.roamTarget.x - root.position.x;
          const offsetZ = character.roamTarget.z - root.position.z;
          const targetDistance = Math.hypot(offsetX, offsetZ);
          const step = Math.min(character.roamSpeed * delta, targetDistance);
          root.position.x += (offsetX / targetDistance) * step;
          root.position.z += (offsetZ / targetDistance) * step;
          isWalking = step > 0;
        }
      }
    }
    root.position.y = THREE.MathUtils.lerp(root.position.y, baseY + surfaceHeightAt(root.position.x, root.position.z), Math.min(delta * 5, 1));
    if (distance < (character.exhibit.isGuide ? 12 : 6)) {
      const desiredRotation = Math.atan2(visitorPosition.x - character.position.x, visitorPosition.z - character.position.z) + (character.exhibit.faceOffset || 0);
      let turn = desiredRotation - root.rotation.y;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      root.rotation.y += turn * Math.min(delta * 4.5, 1);
    } else if (isWalking) {
      const desiredRotation = Math.atan2(character.roamTarget.x - root.position.x, character.roamTarget.z - root.position.z) + (character.exhibit.faceOffset || 0);
      let turn = desiredRotation - root.rotation.y;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      root.rotation.y += turn * Math.min(delta * 4.5, 1);
    }

    const { parts } = character;
    if (!parts.head || !parts.mouth) continue;
    const isSpeaking = character.motionState === 'speaking';
    const isListening = character.motionState === 'listening';
    const gesture = Math.sin(time * (isSpeaking ? 7 : 2.2) + talkOffset);
    const armGesture = isWalking ? gesture * 0.08 : 0;
    const stride = isWalking ? gesture * 0.16 : 0;
    const mouthLevel = isSpeaking ? Math.max(sarvamOutputLevel, 0.18) : 0;
    parts.head.rotation.x = isSpeaking ? gesture * 0.05 : isListening ? Math.abs(gesture) * 0.035 : 0;
    parts.head.rotation.z = isListening ? gesture * 0.025 : 0;
    if (parts.leftArm) parts.leftArm.rotation.z = -0.16 + armGesture;
    if (parts.rightArm) parts.rightArm.rotation.z = 0.16 - armGesture;
    if (parts.leftLeg) parts.leftLeg.rotation.x = stride;
    if (parts.rightLeg) parts.rightLeg.rotation.x = -stride;
    if (parts.leftShoe) parts.leftShoe.rotation.x = stride;
    if (parts.rightShoe) parts.rightShoe.rotation.x = -stride;
    if (parts.leftHand) parts.leftHand.rotation.z = isWalking ? gesture * 0.08 : 0;
    if (parts.rightHand) parts.rightHand.rotation.z = isWalking ? -gesture * 0.08 : 0;
    if (parts.stick) parts.stick.rotation.z = isWalking ? -gesture * 0.06 : 0;
    parts.mouth.scale.y = character.mouthBaseScaleY * (1 + mouthLevel * 1.5);
  }
}

function updateGalleryDoors(delta) {
  const distanceToEntrance = Math.hypot(camera.position.x, camera.position.z + 3.5);
  const isOpen = distanceToEntrance < 8.5;
  for (const { door, closedX, openX } of galleryDoors) {
    door.position.x = THREE.MathUtils.lerp(door.position.x, isOpen ? openX : closedX, Math.min(delta * 5, 1));
  }
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  sideways.crossVectors(camera.up, forward).normalize();
  const movement = new THREE.Vector3();
  if (keys.has('w') || keys.has('arrowup')) movement.add(forward);
  if (keys.has('s') || keys.has('arrowdown')) movement.sub(forward);
  if (keys.has('a') || keys.has('arrowleft')) movement.add(sideways);
  if (keys.has('d') || keys.has('arrowright')) movement.sub(sideways);
  if (isJumping) {
    jumpVelocity -= 15 * delta;
    const nextY = camera.position.y + jumpVelocity * delta;
    const groundY = 1.65 + surfaceHeightAt(camera.position.x, camera.position.z);
    if (nextY <= groundY) {
      const dy = groundY - camera.position.y;
      camera.position.y = groundY;
      controls.target.y += dy;
      jumpVelocity = 0;
      isJumping = false;
    } else {
      const dy = nextY - camera.position.y;
      camera.position.y = nextY;
      controls.target.y += dy;
    }
  }
  if (movement.lengthSq()) {
    movement.normalize().multiplyScalar(delta * 4.2);
    const next = camera.position.clone().add(movement);
    next.x = THREE.MathUtils.clamp(next.x, -70, 70);
    next.z = THREE.MathUtils.clamp(next.z, -70, 70);

    // Collision Detection against walls and pillars
    const radius = 0.8;
    for (const wall of colliders) {
      const closestX = Math.max(wall.minX, Math.min(next.x, wall.maxX));
      const closestZ = Math.max(wall.minZ, Math.min(next.z, wall.maxZ));
      const dx = next.x - closestX;
      const dz = next.z - closestZ;
      const distanceSq = dx * dx + dz * dz;
      if (distanceSq < radius * radius) {
        const distance = Math.sqrt(distanceSq) || 0.001;
        const overlap = radius - distance;
        next.x += (dx / distance) * overlap;
        next.z += (dz / distance) * overlap;
      }
    }

    next.y = isJumping ? camera.position.y : 1.65 + surfaceHeightAt(next.x, next.z);
    const change = next.sub(camera.position);
    camera.position.add(change);
    controls.target.add(change);
  }
  let name, detail;
  if (talkingFighter && (sarvamAgent || sarvamStarting)) {
    if (locationLabel) locationLabel.textContent = "YOU ARE TALKING TO";
    name = talkingFighter.name;
    detail = talkingFighter.era;
  } else {
    if (locationLabel) locationLabel.textContent = "YOU ARE EXPLORING";
    [name, detail] = roomAt(camera.position);
  }
  roomName.textContent = name;
  roomDetail.textContent = detail;
  updateInteraction();
  updateCharacters(elapsed, delta);
  updateGalleryDoors(delta);
  controls.update();
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

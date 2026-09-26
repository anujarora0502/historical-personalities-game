import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { BrowserAudioInterface, ConversationAgent, InteractionType } from 'sarvam-conv-ai-sdk/browser';
import { DIALOGUE, FRAGMENTS, FRAGMENT_REMARKS, GAME_SUBTITLE, GAME_TITLE } from './src/content.js';
import { MissionLog, loadSave } from './src/missions.js';
import { GameUI } from './src/ui.js';
import { createWorldExtras } from './src/world-extras.js';
import { initAudio, sfx, toggleMute } from './src/audio.js';

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
controls.enabled = false; // enabled once the visit starts
controls.enableZoom = false;
controls.minDistance = 0.01;
controls.maxDistance = 100;
// Set target just slightly in front of the camera so dragging rotates the camera in place
controls.target.set(0, 2.2, 25.99);

const timer = new THREE.Timer();
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
let sarvamAgent = null;
let sarvamStarting = false;
let sarvamOutputLevel = 0;
let sarvamTargetLevel = 0;

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

// Point lights don't cast shadows here: VSM shadow maps don't support them (three.js skips them).
function galleryLight(x, z, color = '#fff0c2') {
  const light = new THREE.PointLight(color, 7, 12, 2);
  light.position.set(x, 4.4, z);
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
  id: 'einstein',
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
  id: 'gandhi',
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
  id: 'guide',
  name: 'Gallery Guide',
  era: 'Gallery Welcome',
  dialogue: true,
  isGuide: true,
  sarvamAppId: import.meta.env.VITE_SARVAM_GUIDE_APP_ID || 'Conversatio-9f72aaa2-f2f0',
  proximityRadius: 4.5,
  interactRadius: 4.2, // she stands behind the info desk
  agentVariables: {
    call_summary: '',
    gender: 'female',
    orientation_outcome: '',
  },
  faceOffset: 0,
};

const TILE_OFFSET = 0.175; // The checkerboard hall tiles sit this far above the base terrain.

// Which parts of each GLB belong to which body segment. Names follow three.js'
// sanitising, which drops dots ("Gandhi_Arm.001" -> "Gandhi_Arm001").
const RIGS = {
  guide: {
    facing: 1, // the face points along +Z in the model
    head: /^Guide_(Head|Brow|Eye|Iris|Hair|Earring|Mouth|Lip|Teeth|Nose)/,
    leftArm: /^Guide_(Arm_L|Hand_L|Finger_L_\d|Thumb_L)$/,
    rightArm: /^Guide_(Arm_R|Hand_R|Finger_R_\d|Thumb_R)$/,
    leftLeg: /^Guide_(Leg|Shoe)_L$/,
    rightLeg: /^Guide_(Leg|Shoe)_R$/,
    lowerBody: /^Guide_Skirt$/,
    eyes: /^Guide_(Eye|Iris)_[LR]$/,
    torso: 'Guide_Torso',
    mouthPrefix: 'Guide_',
    armRest: 0.05,
  },
  gandhi: {
    facing: -1,
    head: /^Gandhi_(Head|Ear|Eye|Glasses|Iris|Mouth|Lip|Teeth|Nose)/,
    leftArm: /^Gandhi_(Arm|Hand|Finger_L_\d|Thumb_L)$/,
    rightArm: /^Gandhi_(Arm001|Hand001|Finger_R_\d|Thumb_R|Stick)$/,
    leftLeg: /^Gandhi_(Left_Leg|Shoe_L)$/,
    rightLeg: /^Gandhi_(Right_Leg|Shoe_R)$/,
    lowerBody: /^Gandhi_Dhoti$/,
    eyes: /^Gandhi_(Eye|Iris)_[LR]$/,
    torso: 'Gandhi_Torso',
    mouthPrefix: 'Gandhi_',
    armRest: 0.08,
    rightArmSwing: 0.3, // the right hand holds his walking stick
    gestureArms: ['left'],
  },
  einstein: {
    facing: -1,
    head: /^(Head|Cheek_|Ear_|Eye_|Eyebrow_|ForeheadLine_|Glasses|Hair_|HairStrand_|Iris_|LowerEyelid_|UpperEyelid_|Moustache|Mouth|Lips|Teeth|Nose|SweptHair_)/,
    leftArm: /^(Left_Arm|LCuff|Left_Hand|Finger_L_\d|Thumb_L)$/,
    rightArm: /^(Right_Arm|RCuff|Right_Hand|Finger_R_\d|Thumb_R)$/,
    leftLeg: /^(Left_Leg|Left_Shoe|Sole_L|Lace_L_\d)$/,
    rightLeg: /^(Right_Leg|Right_Shoe|Sole_R|Lace_R_\d)$/,
    eyes: /^(Eye|Iris)_[LR]$/,
    torso: 'Torso',
    mouthPrefix: '',
    armRest: 0.08,
  },
};

/**
 * Splits a character made of separate meshes into a simple joint hierarchy:
 * hips -> upper body -> head / shoulders, plus hip joints for the legs.
 * Each joint is a Group placed where the real joint would be, so rotating it
 * swings the limb from the shoulder or hip instead of around the limb's middle.
 */
function buildRig(model, spec) {
  model.updateMatrixWorld(true);
  const meshes = [];
  model.traverse((child) => { if (child.isMesh) meshes.push(child); });
  const container = meshes[0].parent;
  const pick = (pattern) => (pattern ? meshes.filter((mesh) => pattern.test(mesh.name)) : []);
  const boundsOf = (objects) => objects.reduce((box, object) => box.expandByObject(object), new THREE.Box3());
  const makeJoint = (parent, worldPoint, objects) => {
    const joint = new THREE.Group();
    parent.add(joint);
    parent.updateMatrixWorld(true);
    joint.position.copy(parent.worldToLocal(worldPoint.clone()));
    joint.updateMatrixWorld(true);
    for (const object of objects) joint.attach(object);
    joint.userData.restPosition = joint.position.clone();
    return joint;
  };

  const groups = {
    head: pick(spec.head),
    leftArm: pick(spec.leftArm),
    rightArm: pick(spec.rightArm),
    leftLeg: pick(spec.leftLeg),
    rightLeg: pick(spec.rightLeg),
  };
  const lowerBody = new Set([...pick(spec.lowerBody), ...groups.leftLeg, ...groups.rightLeg]);
  const upperBodyParts = meshes.filter((mesh) => !lowerBody.has(mesh));

  const hipPoint = (legParts) => {
    const box = boundsOf(legParts);
    const center = box.getCenter(new THREE.Vector3());
    return new THREE.Vector3(center.x, box.max.y, center.z);
  };
  const shoulderPoint = (armParts) => {
    const sleeve = armParts.filter((part) => /Arm/.test(part.name));
    const box = boundsOf(sleeve.length ? sleeve : armParts);
    const center = box.getCenter(new THREE.Vector3());
    return new THREE.Vector3(center.x, box.max.y - (box.max.y - box.min.y) * 0.08, center.z);
  };
  const leftHip = hipPoint(groups.leftLeg);
  const rightHip = hipPoint(groups.rightLeg);
  const bodyCenter = boundsOf(upperBodyParts).getCenter(new THREE.Vector3());
  const waistPoint = new THREE.Vector3(bodyCenter.x, (leftHip.y + rightHip.y) / 2, bodyCenter.z);
  const headMesh = groups.head.find((part) => /Head$/.test(part.name)) || groups.head[0];
  const headBox = boundsOf([headMesh]);
  const neckPoint = headBox.getCenter(new THREE.Vector3());
  neckPoint.y = headBox.min.y + (headBox.max.y - headBox.min.y) * 0.12;
  const leftShoulder = shoulderPoint(groups.leftArm);
  const rightShoulder = shoulderPoint(groups.rightArm);

  const rig = {
    container,
    containerRestY: container.position.y,
    facing: spec.facing,
    armRest: spec.armRest ?? 0.08,
    rightArmSwing: spec.rightArmSwing ?? 1,
    gestureArms: spec.gestureArms || ['left', 'right'],
    leftLeg: makeJoint(container, leftHip, groups.leftLeg),
    rightLeg: makeJoint(container, rightHip, groups.rightLeg),
  };
  rig.upperBody = makeJoint(container, waistPoint, upperBodyParts);
  rig.head = makeJoint(rig.upperBody, neckPoint, groups.head);
  rig.head.rotation.order = 'YXZ';
  rig.leftArm = makeJoint(rig.upperBody, leftShoulder, groups.leftArm);
  rig.rightArm = makeJoint(rig.upperBody, rightShoulder, groups.rightArm);
  rig.torso = container.getObjectByName(spec.torso);
  rig.torsoRestScale = rig.torso?.scale.clone();
  rig.mouth = buildMouth(container, spec.mouthPrefix);
  rig.eyes = pick(spec.eyes).map((eye) => ({ eye, restScaleY: eye.scale.y }));
  return rig;
}

/**
 * The mouth is one lip mesh (upper and lower lip joined at tapered corners,
 * closed at rest) in front of a dark mouth interior and a row of upper teeth.
 * Speaking bends the lip mesh: the middle of the lower lip drops and the upper
 * lip lifts slightly, while the corners stay joined.
 */
function buildMouth(container, prefix) {
  const lips = container.getObjectByName(`${prefix}Lips`);
  const inner = container.getObjectByName(`${prefix}Mouth_Inner`);
  if (!lips || !inner) return null;
  const base = Float32Array.from(lips.geometry.attributes.position.array);
  let halfWidth = 0;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < base.length; i += 3) {
    halfWidth = Math.max(halfWidth, Math.abs(base[i]));
    minY = Math.min(minY, base[i + 1]);
    maxY = Math.max(maxY, base[i + 1]);
  }
  return {
    lips,
    inner,
    base,
    halfWidth,
    height: maxY - minY,
    innerRest: { position: inner.position.clone(), scale: inner.scale.clone() },
  };
}

function animateMouth(mouth, open, shape) {
  const { lips, inner, base, halfWidth, height, innerRest } = mouth;
  const position = lips.geometry.attributes.position;
  const array = position.array;
  const gap = open * height * 0.75;
  const narrow = 1 - open * 0.1 * shape;
  for (let i = 0; i < array.length; i += 3) {
    const x = base[i];
    const y = base[i + 1];
    const u = x / halfWidth;
    const bow = Math.max(0, 1 - u * u); // full movement in the middle, none at the corners
    array[i] = x * narrow;
    array[i + 1] = y >= 0 ? y + gap * 0.22 * bow : y - gap * bow;
    array[i + 2] = base[i + 2];
  }
  position.needsUpdate = true;
  lips.geometry.computeVertexNormals();
  inner.position.y = innerRest.position.y - gap * 0.3;
  inner.scale.y = innerRest.scale.y + gap * 0.4;
  inner.scale.x = innerRest.scale.x * narrow;
}

/**
 * Loads a custom character GLB, scales it to a common height, places it at (x, z)
 * and registers it for proximity conversations and procedural animation.
 */
function loadCharacter({ url, exhibit, rig, x, y = 0, z, roam, onLoad }) {
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

    const character = registerCharacter(model, exhibit);
    character.roam = roam;
    character.rig = buildRig(model, rig);
    onLoad?.(model);
  }, undefined, (error) => console.error(`Unable to load ${exhibit.name} model (${url}):`, error));
}

loadCharacter({
  url: assetUrl('einstein-custom.glb?v=8'),
  exhibit: einsteinExhibit,
  rig: RIGS.einstein,
  x: -4,
  y: TILE_OFFSET,
  z: -26,
  roam: true,
});

loadCharacter({
  url: assetUrl('gandhi-custom.glb?v=8'),
  exhibit: gandhiExhibit,
  rig: RIGS.gandhi,
  x: 4,
  y: TILE_OFFSET,
  z: -26,
  roam: true,
});

loadCharacter({
  url: assetUrl('guide-custom.glb?v=8'),
  exhibit: guideExhibit,
  rig: RIGS.guide,
  x: -5.5,
  z: 0.8,
  roam: false,
  onLoad: addInfoDesk,
});

// Info desk in front of the gallery guide (centered at x = -5.5).
function addInfoDesk() {
  box(2.2, 0.72, 0.9, -5.5, 0.36, 1.5, materials.monumentDark);
  box(2.4, 0.08, 1.05, -5.5, 0.76, 1.5, materials.wood);
  addLabel('INFO DESK', -5.5, 0.8, 2.11, 0, 0.8);
}

function registerCharacter(root, exhibit) {
  const position = new THREE.Vector3();
  root.getWorldPosition(position);
  const character = {
    root,
    exhibit,
    position,
    baseY: root.position.y,
    talkOffset: Math.random() * 10,
    rig: null,
    motionState: 'idle',
    roam: false,
    roamCenter: position.clone(),
    roamTarget: new THREE.Vector3(),
    hasRoamTarget: false,
    roamWait: 1 + Math.random() * 2,
    roamSpeed: 0.6,
    speed: 0,
    anim: {
      walk: 0,
      stridePhase: 0,
      blinkTimer: 1 + Math.random() * 3,
      blinkStart: -1,
      gestureTimer: 0,
      gestureTarget: { left: 0, right: 0, open: 0 },
      gesture: { left: 0, right: 0, open: 0 },
      head: { yaw: 0, pitch: 0, roll: 0 },
      mouth: 0,
    },
  };
  root.userData.character = character;
  characters.push(character);
  return character;
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

function roomAt(position) {
  if (position.z < -4) return ['The Great Hall', 'Walk up to a guest and press E to talk.'];
  if (position.z < 21) return ['Museum Grounds', 'Explore the gardens, or head up the steps into the hall.'];
  return ['Museum Street', 'The museum gates are just ahead.'];
}

// ============================================================================
// Game layer: missions, interaction, conversations (text + voice), photos.
// ============================================================================
const ui = new GameUI(document.querySelector('#ui'));
const extras = createWorldExtras({ scene, surfaceHeightAt });
let log = null; // MissionLog, created when the visit starts
let gameStarted = false;
let introProgress = 0; // camera glide from the title flyover to the gate
const introFrom = new THREE.Vector3();
let activeConversation = null; // { id, character }
let voiceStatus = 'idle';
let footstepDistance = 0;
let currentInteractable = null;
const bannerQueue = [];
let bannerBusy = false;

const sarvamConfig = {
  apiKey: import.meta.env.VITE_SARVAM_API_KEY,
  orgId: import.meta.env.VITE_SARVAM_ORG_ID,
  workspaceId: import.meta.env.VITE_SARVAM_WORKSPACE_ID,
  appId: import.meta.env.VITE_SARVAM_APP_ID,
};
const voiceAvailable = Boolean(sarvamConfig.apiKey && sarvamConfig.orgId && sarvamConfig.workspaceId);

function characterById(id) {
  return characters.find((character) => character.exhibit.id === id) || null;
}

function queueBanner(kicker, title) {
  bannerQueue.push([kicker, title]);
  if (bannerBusy) return;
  const next = () => {
    const item = bannerQueue.shift();
    if (!item) { bannerBusy = false; return; }
    bannerBusy = true;
    ui.showBanner(...item);
    setTimeout(next, 3800);
  };
  next();
}

function bindMissionEvents() {
  log.on((type, detail) => {
    if (type === 'objective') {
      const done = detail.progress >= detail.target;
      if (done) {
        sfx.objective();
        ui.toast(`Objective complete: ${detail.objective.text} <span class="toast-stars">+1 ★</span>`, 'info', '✔');
      } else {
        ui.toast(`${detail.objective.text}: ${detail.progress}/${detail.target}`, 'info', '✦');
      }
    } else if (type === 'stars' && !detail.silent) {
      ui.toast(`+${detail.amount} ★ ${detail.reason ? `· ${detail.reason}` : ''}`, 'star', '★');
    } else if (type === 'rank') {
      sfx.success();
      ui.toast(`New rank: <strong>${detail.rank.title}</strong>`, 'rank', '♛');
    } else if (type === 'mission-complete') {
      sfx.success();
      queueBanner('Mission complete', detail.mission.title);
      if (detail.mission.id === 'welcome') {
        extras.showFragments(log.state.fragments);
        sfx.whoosh();
      }
    } else if (type === 'mission-start') {
      queueBanner('New mission', detail.mission.title);
    }
    ui.renderTracker(log);
  });
}

function startGame({ mode, name }) {
  initAudio();
  sfx.success();
  const saved = mode === 'continue' ? loadSave() : null;
  log = saved ? new MissionLog(saved) : MissionLog.newGame(name);
  if (!saved) log.save();
  bindMissionEvents();
  if (log.isMissionComplete('welcome')) extras.showFragments(log.state.fragments);
  if (log.state.timelineRestored) extras.restoreTimeline(true);
  introFrom.copy(camera.position);
  introProgress = 0.0001;
  ui.setHudVisible(true);
  ui.renderTracker(log);
  if (saved) {
    queueBanner('Welcome back', log.name);
  } else {
    queueBanner('Echoes of History', `Welcome, ${log.name}`);
    queueBanner('New mission', 'A Warm Welcome');
    setTimeout(() => ui.toast('Follow the golden beam to the info desk', 'info', '✦'), 1500);
  }
}

// ------------------------------------------------------------ interaction
function interactables() {
  const list = [];
  for (const character of characters) {
    list.push({ kind: 'character', id: character.exhibit.id, label: `Talk to ${character.exhibit.name}`, position: character.position, radius: character.exhibit.interactRadius || 3.4 });
  }
  for (const plaque of extras.plaques) {
    list.push({ kind: 'plaque', plaque, label: `Read about ${plaque.title.split(' (')[0]}`, position: plaque.group.position, radius: 2.2 });
  }
  list.push({ kind: 'timeline', label: 'Examine the Timeline Wall', position: extras.timelinePosition, radius: 4.5 });
  return list;
}

function nearestInteractable() {
  let best = null;
  let bestDistance = Infinity;
  for (const item of interactables()) {
    const distance = Math.hypot(camera.position.x - item.position.x, camera.position.z - item.position.z);
    if (distance < item.radius && distance < bestDistance) {
      best = item;
      bestDistance = distance;
    }
  }
  return best;
}

function interact(item) {
  if (!item || !log) return;
  keys.clear();
  if (item.kind === 'character') openConversation(item.id);
  else if (item.kind === 'plaque') { sfx.open(); ui.showPlaque(item.plaque); }
  else if (item.kind === 'timeline') {
    if (log.state.timelineRestored) {
      ui.toast('The Timeline of History is whole again.', 'info', '✦');
      return;
    }
    ui.openTimeline(log.state.fragments, onTimelineSolved);
  }
}

function onTimelineSolved() {
  log.restoreTimeline();
  extras.restoreTimeline();
  sfx.fanfare();
  const ahead = new THREE.Vector3();
  camera.getWorldDirection(ahead);
  extras.burst(camera.position.clone().addScaledVector(ahead, 4).add(new THREE.Vector3(0, 2.5, 0)), 2);
  queueBanner('History restored', 'The Timeline Wall shines again');
  setTimeout(() => extras.burst(extras.timelinePosition.clone().add(new THREE.Vector3(0, 5, 0)), 4), 1400);
  setTimeout(() => ui.showEnding(log, { onPhoto: takePhoto }), 3600);
}

// ----------------------------------------------------------- conversation
function dialogueNode(id, nodeId) {
  const source = DIALOGUE[id][nodeId];
  let text = source.text;
  if (id === 'guide' && nodeId === 'start' && log.state.timelineRestored) {
    text = 'You did it, {name}! The Timeline Wall is shining again — thank you. You are now officially a Curator of Time. Feel free to keep exploring.';
  } else if (nodeId === 'start' && FRAGMENT_REMARKS[id] && FRAGMENTS.some((fragment) => fragment.owner === id && log.hasFragment(fragment.id))) {
    text = `${text} ${FRAGMENT_REMARKS[id]}`;
  }
  return {
    text: text.replaceAll('{name}', log.name),
    options: source.options.map((option) => ({
      label: option.label,
      onSelect: () => {
        if (option.next) ui.setDialogueNode(dialogueNode(id, option.next));
        else if (option.action === 'quiz') startQuiz(id);
        else closeConversation();
      },
    })),
  };
}

function voiceState() {
  return {
    available: voiceAvailable,
    active: Boolean(sarvamAgent || sarvamStarting),
    status: voiceStatus,
    onStart: () => startSarvamConversation(),
    onStop: () => {
      stopConversation();
      voiceStatus = 'idle';
      setCharacterState(talkingFighter, 'listening');
      setSpeaking(talkingFighter, false);
      ui.setVoice(voiceState());
    },
  };
}

function openConversation(id) {
  const character = characterById(id);
  if (!character) return;
  activeConversation = { id, character };
  talkingFighter = character.exhibit;
  character.motionState = 'listening';
  sfx.open();
  ui.closeDialogueRequest = closeConversation;
  ui.openDialogue(id, dialogueNode(id, 'start'), voiceState());
  log.meet(id);
}

function closeConversation() {
  if (!activeConversation) return;
  stopConversation();
  voiceStatus = 'idle';
  setCharacterState(talkingFighter, 'idle');
  setSpeaking(talkingFighter, false);
  ui.closeDialogue();
  sfx.close();
  activeConversation = null;
  talkingFighter = null;
}

function startQuiz(id) {
  const character = activeConversation?.character;
  closeConversation();
  if (character) character.motionState = 'listening';
  ui.startQuiz(id, (score) => {
    if (character) character.motionState = 'idle';
    return log.recordQuiz(id, score);
  });
}

function stopConversation() {
  sarvamAgent?.stop().catch(() => {});
  sarvamAgent = null;
  sarvamOutputLevel = 0;
  sarvamTargetLevel = 0;
}

async function startSarvamConversation() {
  if (sarvamAgent || sarvamStarting || !talkingFighter) return;
  const appId = talkingFighter.sarvamAppId || sarvamConfig.appId;
  if (!voiceAvailable || !appId) return;
  const exhibit = talkingFighter;
  sarvamStarting = true;
  voiceStatus = 'connecting';
  ui.setVoice(voiceState());
  const variables = { ...(exhibit.agentVariables || {}) };
  for (const key of ['user_name', 'caller_name']) if (key in variables) variables[key] = log?.name || 'Museum Visitor';
  try {
    sarvamAgent = new ConversationAgent({
      apiKey: sarvamConfig.apiKey,
      platform: 'browser',
      config: {
        org_id: sarvamConfig.orgId,
        workspace_id: sarvamConfig.workspaceId,
        app_id: appId,
        user_identifier_type: 'custom',
        user_identifier: exhibit.userIdentifier || `museum-visitor-${crypto.randomUUID()}`,
        interaction_type: InteractionType.CALL,
        input_sample_rate: 16000,
        output_sample_rate: 16000,
        agent_variables: variables,
      },
      audioInterface: new BrowserAudioInterface(16000, {
        outputLevelCallback: ({ rms }) => {
          // Use decoded agent audio rather than a timer for mouth movement.
          sarvamTargetLevel = Math.min(1, rms * 8);
        },
      }),
      audioCallback: async () => {
        // Audio chunks are the authoritative signal that the agent is speaking.
        setCharacterState(exhibit, 'speaking');
        setSpeaking(exhibit, true);
        if (voiceStatus !== 'speaking') { voiceStatus = 'speaking'; ui.setVoice(voiceState()); }
      },
      stateCallback: (state) => {
        const normalizedState = String(state).toLowerCase();
        setCharacterState(exhibit, normalizedState);
        setSpeaking(exhibit, normalizedState === 'speaking');
        voiceStatus = normalizedState === 'speaking' ? 'speaking' : 'listening';
        ui.setVoice(voiceState());
      },
      endCallback: async () => {
        sarvamAgent = null;
        sarvamOutputLevel = 0;
        sarvamTargetLevel = 0;
        voiceStatus = 'idle';
        setCharacterState(exhibit, activeConversation ? 'listening' : 'idle');
        setSpeaking(exhibit, false);
        ui.setVoice(voiceState());
      },
    });
    await sarvamAgent.start();
    const connected = await sarvamAgent.waitForConnect(10);
    if (!connected) throw new Error('Sarvam connection timed out');
    voiceStatus = 'listening';
  } catch (error) {
    console.error('Sarvam connection error:', error);
    stopConversation();
    voiceStatus = 'idle';
    ui.toast('Voice chat is unavailable right now — you can still talk by text.', 'info', '🎙');
  } finally {
    sarvamStarting = false;
    ui.setVoice(voiceState());
  }
}

// ------------------------------------------------------------------ photo
function takePhoto() {
  if (!gameStarted || ui.isBlocking()) return;
  renderer.render(scene, camera);
  const shot = renderer.domElement.toDataURL('image/jpeg', 0.92);
  ui.photoFlash();
  sfx.shutter();
  const image = new Image();
  image.onload = () => {
    const width = 1600;
    const photoHeight = Math.round((image.height / image.width) * (width - 80));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = photoHeight + 200;
    const context = canvas.getContext('2d');
    context.fillStyle = '#f4ede0';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 40, 40, width - 80, photoHeight);
    context.strokeStyle = '#c9a45c';
    context.lineWidth = 3;
    context.strokeRect(40, 40, width - 80, photoHeight);
    context.fillStyle = '#2a2116';
    context.textAlign = 'center';
    context.font = '600 48px "Playfair Display", Georgia, serif';
    context.fillText(`${GAME_TITLE} — ${GAME_SUBTITLE}`, width / 2, photoHeight + 112);
    context.font = '400 28px Inter, sans-serif';
    context.fillStyle = '#6b5a40';
    const date = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
    context.fillText(`${log.name} · ${log.rank.title} · ${date}`, width / 2, photoHeight + 160);
    const link = document.createElement('a');
    link.download = `grand-museum-${Date.now()}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.9);
    link.click();
  };
  image.src = shot;
  log.state.photos += 1;
  log.save();
  ui.toast('Souvenir photo saved to your downloads', 'info', '📷');
}

// ------------------------------------------------------------------ input
window.addEventListener('keydown', (event) => {
  if (!gameStarted || introProgress < 1 || ui.isBlocking()) return;
  const key = event.key.toLowerCase();
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) keys.add(key);
  if (key === ' ' && !isJumping) {
    jumpVelocity = 5.4;
    isJumping = true;
    event.preventDefault();
  }
  if (key === 'e') interact(currentInteractable);
  if (key === 'j' || key === 'tab') {
    event.preventDefault();
    keys.clear();
    ui.toggleJournal(log);
  }
  if (key === 'p') takePhoto();
  if (key === 'm') ui.toast(toggleMute() ? 'Sound off' : 'Sound on', 'info', '♪');
});
window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());

// -------------------------------------------------------------- per frame
const compassTarget = new THREE.Vector3();
function objectiveTarget() {
  const current = log?.currentObjective();
  if (!current) return null;
  const { target } = current.objective;
  if (target === 'fragment') {
    const nearest = extras.nearestFragment(camera.position);
    return nearest ? compassTarget.copy(nearest.root.position) : null;
  }
  if (target === 'timeline') return compassTarget.copy(extras.timelinePosition);
  const character = characterById(target);
  return character ? compassTarget.copy(character.position) : null;
}

function updateGame(time, delta) {
  if (!gameStarted) return;
  const blocking = ui.isBlocking();
  // Interaction prompt
  currentInteractable = blocking ? null : nearestInteractable();
  ui.setPrompt(currentInteractable?.label || null);
  // Fragment pickup
  if (!blocking) {
    const found = extras.fragmentAt(camera.position, 1.8);
    if (found) {
      keys.clear();
      extras.collect(found);
      sfx.collect();
      log.collectFragment(found.fragment.id);
      ui.showFragmentCard(found.fragment, log.state.fragments.length, FRAGMENTS.length);
    }
  }
  // Objective beam and compass
  const target = objectiveTarget();
  extras.setBeacon(target);
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  const heading = Math.atan2(direction.x, -direction.z);
  if (target) {
    const bearing = Math.atan2(target.x - camera.position.x, -(target.z - camera.position.z));
    ui.updateCompass(heading, bearing, Math.hypot(target.x - camera.position.x, target.z - camera.position.z));
  } else {
    ui.updateCompass(heading, null, 0);
  }
}

const forward = new THREE.Vector3();
const sideways = new THREE.Vector3();
const visitorPosition = new THREE.Vector3();
const { damp } = THREE.MathUtils;
const lookTarget = new THREE.Vector3();
const headWorld = new THREE.Vector3();

function angleDifference(target, current) {
  const difference = target - current;
  return Math.atan2(Math.sin(difference), Math.cos(difference));
}

function turnToward(root, desiredRotation, delta, rate) {
  root.rotation.y += angleDifference(desiredRotation, root.rotation.y) * Math.min(delta * rate, 1);
}

// Speech gestures: how far each arm lifts forward and how open the arms are.
const TALK_GESTURES = [
  { left: 0, right: 0, open: 0.05 },
  { left: 0, right: 0.55, open: 0.12 },
  { left: 0.5, right: 0, open: 0.12 },
  { left: 0.35, right: 0.35, open: 0.3 },
  { left: 0, right: 0.8, open: 0.2 },
  { left: 0.25, right: 0.15, open: 0.4 },
];

function updateCharacters(time, delta) {
  visitorPosition.copy(camera.position);
  const smoothing = sarvamTargetLevel > sarvamOutputLevel ? 1 - Math.exp(-delta * 11) : 1 - Math.exp(-delta * 7);
  sarvamOutputLevel = THREE.MathUtils.lerp(sarvamOutputLevel, sarvamTargetLevel, smoothing);
  for (const character of characters) {
    const { root, exhibit } = character;
    root.getWorldPosition(character.position);
    const distance = Math.hypot(character.position.x - visitorPosition.x, character.position.z - visitorPosition.z);
    const isInProximity = distance <= (exhibit.proximityRadius || 4.4);
    const inConversation = activeConversation?.character === character || (talkingFighter === exhibit && (sarvamAgent || sarvamStarting));
    const isRoaming = character.roam && !isInProximity && !inConversation;
    const faceOffset = exhibit.faceOffset || 0;

    // Wander: pause, pick a nearby spot, turn toward it, then ease into walking.
    let targetSpeed = 0;
    if (isRoaming) {
      if (character.roamWait > 0) {
        character.roamWait -= delta;
      } else if (!character.hasRoamTarget) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 1.5 + Math.random() * 2.3;
        character.roamTarget.set(
          character.roamCenter.x + Math.cos(angle) * radius,
          root.position.y,
          character.roamCenter.z + Math.sin(angle) * radius,
        );
        character.hasRoamTarget = true;
      } else {
        const offsetX = character.roamTarget.x - root.position.x;
        const offsetZ = character.roamTarget.z - root.position.z;
        const targetDistance = Math.hypot(offsetX, offsetZ);
        if (targetDistance < 0.15) {
          character.hasRoamTarget = false;
          character.roamWait = 1.5 + Math.random() * 3.5;
        } else {
          const heading = Math.atan2(offsetX, offsetZ) + faceOffset;
          turnToward(root, heading, delta, 3);
          const alignment = Math.max(0, Math.cos(angleDifference(heading, root.rotation.y)));
          targetSpeed = character.roamSpeed * alignment ** 2 * Math.min(1, targetDistance / 0.5);
        }
      }
    }
    character.speed = damp(character.speed, targetSpeed, 4, delta);
    if (character.hasRoamTarget && character.speed > 0.001) {
      const offsetX = character.roamTarget.x - root.position.x;
      const offsetZ = character.roamTarget.z - root.position.z;
      const targetDistance = Math.hypot(offsetX, offsetZ) || 1;
      const step = Math.min(character.speed * delta, targetDistance);
      root.position.x += (offsetX / targetDistance) * step;
      root.position.z += (offsetZ / targetDistance) * step;
    }
    root.position.y = THREE.MathUtils.lerp(root.position.y, character.baseY + surfaceHeightAt(root.position.x, root.position.z), Math.min(delta * 5, 1));

    // When the visitor is close and the character is standing, turn the body
    // slowly toward them; the head (below) turns faster and leads the body.
    if (character.speed < 0.15 && distance < (exhibit.isGuide ? 12 : 6)) {
      const towardVisitor = Math.atan2(visitorPosition.x - character.position.x, visitorPosition.z - character.position.z) + faceOffset;
      turnToward(root, towardVisitor, delta, 1.6);
    }

    if (character.rig) animateCharacter(character, time, delta, distance);
  }
}

function animateCharacter(character, time, delta, distance) {
  const { rig, anim } = character;
  const f = rig.facing;
  const t = time + character.talkOffset;
  const isSpeaking = character.motionState === 'speaking';
  const isListening = character.motionState === 'listening';

  // --- Walk cycle -----------------------------------------------------------
  anim.walk = damp(anim.walk, THREE.MathUtils.clamp(character.speed / character.roamSpeed, 0, 1), 6, delta);
  anim.stridePhase += character.speed * delta * 7;
  const stride = Math.sin(anim.stridePhase) * anim.walk;
  const bounce = (Math.abs(Math.cos(anim.stridePhase)) - 0.6) * anim.walk;
  const idle = 1 - anim.walk;

  // Rotating a joint by -f * angle swings its limb forward (toward the face).
  rig.leftLeg.rotation.x = -f * stride * 0.5;
  rig.rightLeg.rotation.x = f * stride * 0.5;
  rig.container.position.y = rig.containerRestY + bounce * 0.07;

  // --- Upper body: breathing, weight shift, counter-twist -------------------
  const breath = Math.sin(t * 1.6);
  if (rig.torso) {
    rig.torso.scale.set(
      rig.torsoRestScale.x * (1 + breath * 0.012),
      rig.torsoRestScale.y * (1 + breath * 0.006),
      rig.torsoRestScale.z * (1 + breath * 0.02),
    );
  }
  rig.upperBody.position.y = rig.upperBody.userData.restPosition.y + breath * 0.008;
  rig.upperBody.rotation.z = Math.sin(t * 0.43) * 0.022 * idle + stride * 0.025;
  rig.upperBody.rotation.y = -stride * 0.07;
  rig.upperBody.rotation.x = -f * (0.05 * anim.walk + (isSpeaking ? Math.sin(t * 1.3) * 0.015 : 0));

  // --- Arms: swing opposite to the legs, gesture while talking -------------
  anim.gestureTimer -= delta;
  if (anim.gestureTimer <= 0) {
    const choice = isSpeaking ? TALK_GESTURES[Math.floor(Math.random() * TALK_GESTURES.length)] : { left: 0, right: 0, open: 0 };
    anim.gestureTarget = {
      left: rig.gestureArms.includes('left') ? choice.left : 0,
      right: rig.gestureArms.includes('right') ? choice.right : 0,
      open: choice.open,
    };
    anim.gestureTimer = isSpeaking ? 0.9 + Math.random() * 1.6 : 0.3;
  }
  for (const side of ['left', 'right', 'open']) {
    anim.gesture[side] = damp(anim.gesture[side], anim.gestureTarget[side], 3.2, delta);
  }
  const beat = isSpeaking ? Math.sin(t * 5.5) * 0.06 * (0.4 + sarvamOutputLevel) : 0;
  const sway = Math.sin(t * 0.9) * 0.02 * idle;
  const leftForward = -stride * 0.4 + anim.gesture.left * (1 + beat) + sway;
  const rightForward = stride * 0.4 * rig.rightArmSwing + anim.gesture.right * (1 + beat) - sway;
  rig.leftArm.rotation.x = -f * leftForward;
  rig.rightArm.rotation.x = -f * rightForward;
  rig.leftArm.rotation.z = -(rig.armRest + anim.gesture.open * 0.5 + 0.02 * anim.walk);
  rig.rightArm.rotation.z = rig.armRest + anim.gesture.open * 0.5 + 0.02 * anim.walk;

  // --- Head: look at the visitor, nod while talking, tilt while listening ---
  let yaw = 0;
  let pitch = 0;
  if (distance < 9) {
    rig.head.getWorldPosition(headWorld);
    lookTarget.copy(visitorPosition);
    character.root.worldToLocal(lookTarget);
    character.root.worldToLocal(headWorld);
    const dx = lookTarget.x - headWorld.x;
    const dz = lookTarget.z - headWorld.z;
    yaw = THREE.MathUtils.clamp(Math.atan2(f * dx, f * dz) - rig.upperBody.rotation.y, -0.8, 0.8);
    pitch = THREE.MathUtils.clamp(Math.atan2(lookTarget.y - headWorld.y, Math.hypot(dx, dz)), -0.3, 0.3);
  }
  const nod = isSpeaking ? sarvamOutputLevel * 0.07 + Math.sin(t * 2.6) * 0.03 : isListening ? Math.max(0, Math.sin(t * 1.1)) * 0.05 : 0;
  anim.head.yaw = damp(anim.head.yaw, yaw + Math.sin(t * 0.37) * 0.04 * idle, 5, delta);
  anim.head.pitch = damp(anim.head.pitch, pitch - nod, 5, delta);
  anim.head.roll = damp(anim.head.roll, isListening ? 0.07 : Math.sin(t * 0.5) * 0.015, 3, delta);
  rig.head.rotation.y = anim.head.yaw;
  rig.head.rotation.x = -f * anim.head.pitch;
  rig.head.rotation.z = anim.head.roll;

  // --- Blinking -------------------------------------------------------------
  anim.blinkTimer -= delta;
  if (anim.blinkTimer <= 0) {
    anim.blinkStart = time;
    anim.blinkTimer = 2 + Math.random() * 4 + (Math.random() < 0.2 ? -1.7 : 0); // occasional double blink
  }
  const blinkProgress = (time - anim.blinkStart) / 0.15;
  const blink = blinkProgress >= 0 && blinkProgress < 1 ? Math.sin(blinkProgress * Math.PI) : 0;
  for (const { eye, restScaleY } of rig.eyes) eye.scale.y = restScaleY * (1 - blink * 0.9);

  // --- Mouth follows the agent's audio level --------------------------------
  // If no audio level is reported, fall back to a syllable-like rhythm.
  const syllables = 0.3 + 0.3 * Math.sin(t * 9.5) * Math.sin(t * 3.3);
  const mouthTarget = isSpeaking ? Math.min(1, Math.max(sarvamOutputLevel * 1.4, sarvamOutputLevel < 0.02 ? syllables : 0)) : 0;
  anim.mouth = damp(anim.mouth, mouthTarget, 22, delta);
  if (rig.mouth) animateMouth(rig.mouth, anim.mouth, 0.5 + 0.5 * Math.sin(t * 7.1));
}

function updateGalleryDoors(delta) {
  const distanceToEntrance = Math.hypot(camera.position.x, camera.position.z + 3.5);
  const isOpen = distanceToEntrance < 8.5;
  for (const { door, closedX, openX } of galleryDoors) {
    door.position.x = THREE.MathUtils.lerp(door.position.x, isOpen ? openX : closedX, Math.min(delta * 5, 1));
  }
}

const START_POSITION = new THREE.Vector3(0, 2.2, 26);
const START_TARGET = new THREE.Vector3(0, 2.2, 25.99);
const introLook = new THREE.Vector3();

function updateTitleCamera(elapsed) {
  const angle = elapsed * 0.05 + 0.6;
  camera.position.set(Math.sin(angle) * 36, 12.5 + Math.sin(elapsed * 0.13) * 1.5, -14 + Math.cos(angle) * 40);
  camera.lookAt(0, 4, -18);
}

function updateIntroGlide(delta) {
  introProgress = Math.min(1, introProgress + delta / 2.6);
  const eased = introProgress < 0.5 ? 4 * introProgress ** 3 : 1 - (-2 * introProgress + 2) ** 3 / 2;
  camera.position.lerpVectors(introFrom, START_POSITION, eased);
  introLook.set(0, 4, -18).lerp(new THREE.Vector3(0, 2.2, 14), eased);
  camera.lookAt(introLook);
  if (introProgress >= 1) {
    controls.target.copy(START_TARGET);
    controls.update();
  }
}

function updatePlayer(delta) {
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
  if (!movement.lengthSq()) return;
  movement.normalize().multiplyScalar(delta * 4.2);
  const next = camera.position.clone().add(movement);
  next.x = THREE.MathUtils.clamp(next.x, -70, 70);
  next.z = THREE.MathUtils.clamp(next.z, -70, 70);

  // Push the visitor out of walls, pillars and hedges...
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
  // ...and out of the characters, so you bump into people instead of walking through them.
  for (const character of characters) {
    const dx = next.x - character.position.x;
    const dz = next.z - character.position.z;
    const distance = Math.hypot(dx, dz);
    const personal = 0.95;
    if (distance < personal) {
      const safe = distance || 0.001;
      next.x += (dx / safe) * (personal - distance);
      next.z += (dz / safe) * (personal - distance);
    }
  }

  next.y = isJumping ? camera.position.y : 1.65 + surfaceHeightAt(next.x, next.z);
  const change = next.sub(camera.position);
  camera.position.add(change);
  controls.target.add(change);
  if (!isJumping) {
    footstepDistance += Math.hypot(change.x, change.z);
    if (footstepDistance > 1.65) {
      footstepDistance = 0;
      sfx.step(camera.position.z < -3 ? 'stone' : 'grass');
    }
  }
}

function updateLocationCard() {
  let name;
  let detail;
  if (activeConversation) {
    locationLabel.textContent = 'You are talking to';
    name = activeConversation.character.exhibit.name;
    detail = activeConversation.character.exhibit.era;
  } else {
    locationLabel.textContent = 'You are exploring';
    [name, detail] = roomAt(camera.position);
  }
  if (roomName.textContent !== name) roomName.textContent = name;
  if (roomDetail.textContent !== detail) roomDetail.textContent = detail;
}

function animate() {
  requestAnimationFrame(animate);
  timer.update();
  const delta = Math.min(timer.getDelta(), 0.05);
  const elapsed = timer.getElapsed();
  const playing = gameStarted && introProgress >= 1;
  if (!gameStarted) {
    updateTitleCamera(elapsed);
    if (introProgress > 0) gameStarted = true;
  } else if (introProgress < 1) {
    updateIntroGlide(delta);
  } else {
    const blocking = ui.isBlocking();
    controls.enabled = !blocking;
    if (blocking) keys.clear();
    updatePlayer(delta);
  }
  if (gameStarted) updateLocationCard();
  updateCharacters(elapsed, delta);
  updateGame(elapsed, delta);
  extras.update(elapsed, delta, camera.position);
  updateGalleryDoors(delta);
  if (playing) controls.update();
  renderer.render(scene, camera);
}

ui.showTitle({
  hasSave: Boolean(loadSave()),
  savedName: loadSave()?.name,
  onStart: (choice) => startGame(choice),
});
animate();

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

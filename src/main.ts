/**
 * Indoor Scene Demo
 *
 * Demonstrates the builder hierarchy pattern:
 * - RoomBuilder creates walls/floor
 * - FurnitureBuilder delegates to ChairBuilder, TableBuilder
 * - PlantBuilder creates decorative plants
 * - PersonBuilder assembles humanoid from parts
 */

import * as THREE from 'three';
import {
  buildConnectedChair,
  buildTree,
  buildTorsoWithSeams,
  buildArmWithSeams,
  buildLegWithSeams,
  buildHeadWithSeams,
  buildBox,
  buildCylinder,
  MeshModeler
} from './cad/MeshModeler';
import { MeshConverter } from './renderer/MeshConverter';
import { Vec3 } from './core/Vec3';
import { runMeshValidityTests } from './tests/meshValidityTests';

console.log('🏠 Procedurable - Indoor Scene Demo');
console.log('══════════════════════════════════════════════════════════════');

// Quick sanity checks (fail-fast signals)
runMeshValidityTests();

// ============================================
// SCENE SETUP
// ============================================
const container = document.getElementById('app');
if (!container) throw new Error('Container not found');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a2a3a);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(4, 3, 4);
camera.lookAt(0, 1, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

// Lighting
const ambient = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
keyLight.position.set(3, 5, 2);
keyLight.castShadow = true;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3);
fillLight.position.set(-3, 2, -2);
scene.add(fillLight);

// ============================================
// MATERIALS
// ============================================
const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x4a4a5a, roughness: 0.9, flatShading: true });
const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x6a6a7a, roughness: 0.8, flatShading: true });
const woodMaterial = new THREE.MeshStandardMaterial({ color: 0x8B7355, roughness: 0.7, flatShading: true });
const tableMaterial = new THREE.MeshStandardMaterial({ color: 0x654321, roughness: 0.6, flatShading: true });
const plantMaterial = new THREE.MeshStandardMaterial({ color: 0x2d5a27, roughness: 0.8, flatShading: true });
const potMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9, flatShading: true });
const skinMaterial = new THREE.MeshStandardMaterial({ color: 0xD4A574, roughness: 0.7, flatShading: true });
const shirtMaterial = new THREE.MeshStandardMaterial({ color: 0x4466AA, roughness: 0.8, flatShading: true });
const pantsMaterial = new THREE.MeshStandardMaterial({ color: 0x333344, roughness: 0.8, flatShading: true });

// ============================================
// ROOM BUILDER
// ============================================
console.log('\n📦 Building Room...');

function buildRoom(width: number, depth: number, height: number): THREE.Group {
  const room = new THREE.Group();
  room.name = 'room';

  // Floor
  const floor = buildBox(width, 0.1, depth);
  const floorMesh = MeshConverter.toThreeMesh(floor, floorMaterial);
  floorMesh.position.y = -0.05;
  floorMesh.receiveShadow = true;
  room.add(floorMesh);

  // Back wall
  const backWall = buildBox(width, height, 0.1);
  const backWallMesh = MeshConverter.toThreeMesh(backWall, wallMaterial);
  backWallMesh.position.set(0, height / 2, -depth / 2);
  room.add(backWallMesh);

  // Left wall
  const leftWall = buildBox(0.1, height, depth);
  const leftWallMesh = MeshConverter.toThreeMesh(leftWall, wallMaterial);
  leftWallMesh.position.set(-width / 2, height / 2, 0);
  room.add(leftWallMesh);

  // Right wall (partial for visibility)
  const rightWall = buildBox(0.1, height, depth * 0.4);
  const rightWallMesh = MeshConverter.toThreeMesh(rightWall, wallMaterial);
  rightWallMesh.position.set(width / 2, height / 2, -depth * 0.3);
  room.add(rightWallMesh);

  console.log(`   Room: ${width}m × ${depth}m × ${height}m`);
  return room;
}

const room = buildRoom(6, 5, 3);
scene.add(room);

// ============================================
// TABLE BUILDER
// ============================================
console.log('\n📦 Building Table...');

function buildTable(width: number, depth: number, height: number, legRadius: number): THREE.Group {
  const table = new THREE.Group();
  table.name = 'table';

  // Table top
  const top = buildBox(width, 0.04, depth);
  const topMesh = MeshConverter.toThreeMesh(top, tableMaterial);
  topMesh.position.y = height;
  topMesh.castShadow = true;
  table.add(topMesh);

  // Legs
  const legHeight = height - 0.02;
  const legInset = 0.05;
  const legPositions = [
    [-width/2 + legInset, -depth/2 + legInset],
    [width/2 - legInset, -depth/2 + legInset],
    [-width/2 + legInset, depth/2 - legInset],
    [width/2 - legInset, depth/2 - legInset]
  ];

  for (const [x, z] of legPositions) {
    const leg = buildCylinder(legRadius, legHeight, 8);
    const legMesh = MeshConverter.toThreeMesh(leg, tableMaterial);
    legMesh.position.set(x, legHeight / 2, z);
    legMesh.castShadow = true;
    table.add(legMesh);
  }

  console.log(`   Table: ${width}m × ${depth}m, height ${height}m`);
  return table;
}

const table = buildTable(1.2, 0.8, 0.75, 0.03);
table.position.set(0, 0, 0);
scene.add(table);

// ============================================
// CHAIRS AROUND TABLE
// ============================================
console.log('\n📦 Building Chairs...');

const chairPositions = [
  { x: 0, z: 0.6, rot: 0 },           // Front
  { x: 0, z: -0.6, rot: Math.PI },    // Back
  { x: -0.8, z: 0, rot: Math.PI / 2 }, // Left
  { x: 0.8, z: 0, rot: -Math.PI / 2 }  // Right
];

chairPositions.forEach((pos, i) => {
  const chairMesh = buildConnectedChair(0.42, 0.38, 0.025, 0.44, 0.018, 0.025, 0.38, 0.02);
  const chair = MeshConverter.toThreeMesh(chairMesh, woodMaterial);
  chair.position.set(pos.x, 0, pos.z);
  chair.rotation.y = pos.rot;
  chair.castShadow = true;
  scene.add(chair);
  console.log(`   Chair ${i + 1} at (${pos.x}, ${pos.z})`);
});

// ============================================
// PLANT BUILDER
// ============================================
console.log('\n📦 Building Plant...');

function buildPottedPlant(potRadius: number, potHeight: number, plantHeight: number, seed: number): THREE.Group {
  const plant = new THREE.Group();
  plant.name = 'potted_plant';

  // Pot (tapered cylinder would be better, using simple box for now)
  const m = new MeshModeler();
  const potBottom = m.createCircleLoop(Vec3.zero(), potRadius * 0.8, 12);
  m.capLoop(potBottom, true);
  const potTop = m.extrudeLoop(potBottom, new Vec3(0, 1, 0), potHeight);
  m.scaleLoop(potTop, potRadius / (potRadius * 0.8));
  m.capLoop(potTop, false);
  const potMesh = MeshConverter.toThreeMesh(m.build(), potMaterial);
  potMesh.castShadow = true;
  plant.add(potMesh);

  // Plant (small tree)
  const treeMesh = buildTree(potRadius * 0.3, plantHeight, 1, seed);
  const tree = MeshConverter.toThreeMesh(treeMesh, plantMaterial);
  tree.position.y = potHeight;
  tree.castShadow = true;
  plant.add(tree);

  console.log(`   Plant: pot ${potRadius}m radius, plant ${plantHeight}m tall`);
  return plant;
}

const plant1 = buildPottedPlant(0.15, 0.25, 0.5, 42);
plant1.position.set(-2.3, 0, -1.8);
scene.add(plant1);

const plant2 = buildPottedPlant(0.12, 0.2, 0.4, 123);
plant2.position.set(2.4, 0, 1.5);
scene.add(plant2);

// ============================================
// PERSON BUILDER
// ============================================
console.log('\n📦 Building Person...');

function buildPerson(height: number, position: Vec3): THREE.Group {
  const person = new THREE.Group();
  person.name = 'person';

  // Scale factor based on height (1.7m reference)
  const scale = height / 1.7;

  // Torso
  const torso = buildTorsoWithSeams();
  const torsoMesh = MeshConverter.toThreeMesh(torso.build(), shirtMaterial);
  torsoMesh.scale.setScalar(scale);
  torsoMesh.position.y = 0.9 * scale;
  person.add(torsoMesh);

  // Head
  const head = buildHeadWithSeams();
  const headMesh = MeshConverter.toThreeMesh(head.build(), skinMaterial);
  headMesh.scale.setScalar(scale);
  headMesh.position.y = 1.4 * scale;
  person.add(headMesh);

  // Left Arm
  const leftArm = buildArmWithSeams(0.6 * scale, true);
  const leftArmMesh = MeshConverter.toThreeMesh(leftArm.build(), skinMaterial);
  leftArmMesh.position.set(-0.25 * scale, 1.3 * scale, 0);
  person.add(leftArmMesh);

  // Right Arm
  const rightArm = buildArmWithSeams(0.6 * scale, false);
  const rightArmMesh = MeshConverter.toThreeMesh(rightArm.build(), skinMaterial);
  rightArmMesh.position.set(0.25 * scale, 1.3 * scale, 0);
  person.add(rightArmMesh);

  // Left Leg
  const leftLeg = buildLegWithSeams(0.9 * scale, true);
  const leftLegMesh = MeshConverter.toThreeMesh(leftLeg.build(), pantsMaterial);
  leftLegMesh.position.set(-0.1 * scale, 0.9 * scale, 0);
  person.add(leftLegMesh);

  // Right Leg
  const rightLeg = buildLegWithSeams(0.9 * scale, false);
  const rightLegMesh = MeshConverter.toThreeMesh(rightLeg.build(), pantsMaterial);
  rightLegMesh.position.set(0.1 * scale, 0.9 * scale, 0);
  person.add(rightLegMesh);

  person.position.set(position.x, position.y, position.z);

  // Log bone info
  const bones = leftArm.getAllBones();
  console.log(`   Person: height ${height}m, ${bones.size} bones per arm`);
  console.log(`   Bones: ${Array.from(bones.keys()).join(', ')}`);

  return person;
}

// Person 1: Standing near wall
const person1 = buildPerson(1.75, new Vec3(-1.8, 0, 0.5));
person1.rotation.y = Math.PI / 4;
scene.add(person1);

// Person 2: Standing by table
const person2 = buildPerson(1.65, new Vec3(1.5, 0, -0.3));
person2.rotation.y = -Math.PI / 3;
scene.add(person2);

// ============================================
// DECORATIVE OBJECTS
// ============================================
console.log('\n📦 Adding Decorative Objects...');

// Vase on table
const vase = new MeshModeler();
const vaseBottom = vase.createCircleLoop(new Vec3(0, 0.75, 0), 0.05, 8);
vase.capLoop(vaseBottom, true);
const vaseMid = vase.extrudeLoop(vaseBottom, new Vec3(0, 1, 0), 0.1);
vase.scaleLoop(vaseMid, 1.3);
const vaseTop = vase.extrudeLoop(vaseMid, new Vec3(0, 1, 0), 0.08);
vase.scaleLoop(vaseTop, 0.6);
vase.capLoop(vaseTop, false);
const vaseMesh = MeshConverter.toThreeMesh(vase.build(), potMaterial);
vaseMesh.position.set(0.3, 0, 0);
scene.add(vaseMesh);

// Small plant in vase
const smallPlant = buildTree(0.02, 0.15, 0, 999);
const smallPlantMesh = MeshConverter.toThreeMesh(smallPlant, plantMaterial);
smallPlantMesh.position.set(0.3, 0.93, 0);
scene.add(smallPlantMesh);

console.log('   Vase with plant on table');

// ============================================
// UI OVERLAY
// ============================================
const infoOverlay = document.getElementById('info-overlay');
if (infoOverlay) {
  infoOverlay.innerHTML = `
    <h2>🏠 Indoor Scene</h2>
    <div style="font-size: 10px; line-height: 1.6; font-family: monospace;">
      <strong>Scene Contents:</strong><br>
      • Room (6m × 5m × 3m)<br>
      • Table with 4 chairs<br>
      • 2 Potted plants<br>
      • 2 People (rigged)<br>
      • Decorative vase<br>
      <br>
      <strong>Builder Pattern:</strong><br>
      • RoomBuilder → walls, floor<br>
      • TableBuilder → top + legs<br>
      • ChairBuilder → connected mesh<br>
      • PlantBuilder → pot + tree<br>
      • PersonBuilder → body parts<br>
      <br>
      <strong>Features Used:</strong><br>
      • MeshModeler operations<br>
      • Seams for assembly<br>
      • Bones for rigging<br>
      • Path extrusion (plants)
    </div>
    <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 10px; color: #666;">
      Drag to rotate, scroll to zoom
    </div>
  `;
}

// ============================================
// CAMERA CONTROLS
// ============================================
let rotY = 0.8;
let rotX = 0.4;
let dist = 6;
let dragging = false;
let lastX = 0, lastY = 0;

renderer.domElement.addEventListener('mousedown', e => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
window.addEventListener('mouseup', () => dragging = false);
window.addEventListener('mousemove', e => {
  if (dragging) {
    rotY -= (e.clientX - lastX) * 0.01;
    rotX -= (e.clientY - lastY) * 0.01;
    rotX = Math.max(0.1, Math.min(1.4, rotX));
    lastX = e.clientX;
    lastY = e.clientY;
  }
});
renderer.domElement.addEventListener('wheel', e => {
  e.preventDefault();
  dist += e.deltaY * 0.005;
  dist = Math.max(2, Math.min(12, dist));
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  requestAnimationFrame(animate);
  camera.position.set(
    dist * Math.cos(rotX) * Math.sin(rotY),
    dist * Math.sin(rotX) + 1,
    dist * Math.cos(rotX) * Math.cos(rotY)
  );
  camera.lookAt(0, 1, 0);
  renderer.render(scene, camera);
}
animate();

console.log('\n══════════════════════════════════════════════════════════════');
console.log('✅ Indoor Scene Complete!');
console.log('   Builders used: Room, Table, Chair, Plant, Person');
console.log('   People have seams and bones for future animation');
console.log('══════════════════════════════════════════════════════════════');

/**
 * Dashboard Main Entry Point
 *
 * Connects to authoring server via WebSocket
 * Displays 3x3 grid of builder runs with different seeds
 * Real-time updates when builders change
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Types
interface BuilderInfo {
  name: string;
  description: string;
  measurements: string[];
  decisions: string[];
}

interface RunResult {
  seed: number;
  vertices: number;
  faces: number;
  bounds: { width: string; height: string; depth: string };
  decisions: Record<string, { value: any; source: string }>;
  measurements: Record<string, { value: number; source: string }>;
  issues: number;
}

interface CellState {
  seed: number;
  result: RunResult | null;
  loading: boolean;
  renderer: THREE.WebGLRenderer | null;
  scene: THREE.Scene | null;
  camera: THREE.PerspectiveCamera | null;
  controls: OrbitControls | null;
  mesh: THREE.Group | null;
}

// State - single seed view
const state = {
  connected: false,
  ws: null as WebSocket | null,
  activeBuilder: null as string | null,
  builders: [] as BuilderInfo[],
  currentSeed: 1,
  cell: null as CellState | null,
  animationId: null as number | null,
};

// DOM Elements
const elements = {
  statusDot: document.getElementById('status-dot') as HTMLElement,
  statusText: document.getElementById('status-text') as HTMLElement,
  builderSelect: document.getElementById('builder-select') as HTMLSelectElement,
  currentSeed: document.getElementById('current-seed') as HTMLInputElement,
  runBtn: document.getElementById('run-btn') as HTMLButtonElement,
  prevBtn: document.getElementById('prev-btn') as HTMLButtonElement,
  nextBtn: document.getElementById('next-btn') as HTMLButtonElement,
  randomBtn: document.getElementById('random-btn') as HTMLButtonElement,
  seedDisplay: document.getElementById('seed-display') as HTMLElement,
  infoPanel: document.getElementById('info-panel') as HTMLElement,
  gridTitle: document.getElementById('grid-title') as HTMLElement,
  mainCell: document.getElementById('main-cell') as HTMLElement,
  mainCanvas: document.getElementById('main-canvas') as HTMLCanvasElement,
  mainOverlay: document.getElementById('main-overlay') as HTMLElement,
  logPanel: document.getElementById('log-panel') as HTMLElement,
  detailPanel: document.getElementById('detail-panel') as HTMLElement,
};

// Logging
function log(message: string, level: 'info' | 'success' | 'error' = 'info') {
  const entry = document.createElement('div');
  entry.className = `log-entry ${level}`;
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  elements.logPanel.appendChild(entry);
  elements.logPanel.scrollTop = elements.logPanel.scrollHeight;
}

// WebSocket Connection
function connectWebSocket() {
  const wsUrl = 'ws://127.0.0.1:4200/ws';
  log(`Connecting to ${wsUrl}...`);

  state.ws = new WebSocket(wsUrl);

  state.ws.onopen = () => {
    state.connected = true;
    elements.statusDot.classList.add('connected');
    elements.statusText.textContent = 'Connected';
    log('WebSocket connected', 'success');
    loadBuilders();
  };

  state.ws.onclose = () => {
    state.connected = false;
    elements.statusDot.classList.remove('connected');
    elements.statusText.textContent = 'Disconnected';
    log('WebSocket disconnected', 'error');

    // Reconnect after delay
    setTimeout(connectWebSocket, 3000);
  };

  state.ws.onerror = (err) => {
    log(`WebSocket error: ${err}`, 'error');
  };

  state.ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      handleMessage(msg);
    } catch (err) {
      log(`Failed to parse message: ${err}`, 'error');
    }
  };
}

function handleMessage(msg: any) {
  switch (msg.type) {
    case 'connected':
      log(`Server state: activeBuilder=${msg.state?.activeBuilder || 'none'}`);
      break;

    case 'builder_opened':
      log(`Builder opened: ${msg.builder}`, 'success');
      logToConsole(`builder.open ${msg.builder}`, 'ok');
      break;

    case 'builder_run':
      log(`Builder run: seed=${msg.seed}, v=${msg.summary?.vertices}, f=${msg.summary?.faces}`);
      logToConsole(`builder.run seed=${msg.seed}`, 'ok', `→ ${msg.summary?.vertices}v, ${msg.summary?.faces}f`);
      // Note: We don't auto-refresh here to avoid infinite loops
      // The dashboard updates when the user clicks buttons
      break;

    case 'commands_executed':
      // Log all commands that were executed
      if (msg.commands && Array.isArray(msg.commands)) {
        for (const cmd of msg.commands) {
          logToConsole(cmd.command, cmd.status, cmd.data ? JSON.stringify(cmd.data).slice(0, 80) : cmd.error);
        }
      }
      break;

    case 'execute_result':
      // Handle execution results
      break;

    default:
      log(`Unknown message type: ${msg.type}`);
  }
}

// Command console logging
function logToConsole(command: string, status: 'ok' | 'error' = 'ok', result?: string) {
  const consoleOutput = document.getElementById('console-output');
  if (!consoleOutput) return;

  // Remove the "waiting" hint if present
  const hint = consoleOutput.querySelector('.hint');
  if (hint) hint.remove();

  const entry = document.createElement('div');
  entry.className = `console-entry ${status === 'error' ? 'error' : ''}`;

  const time = new Date().toLocaleTimeString('en-US', { hour12: false });

  entry.innerHTML = `
    <span class="cmd-time">${time}</span>
    <span class="cmd-text">${escapeHtml(command)}</span>
    ${result ? `<span class="cmd-result">${escapeHtml(result)}</span>` : ''}
  `;

  consoleOutput.appendChild(entry);
  consoleOutput.scrollTop = consoleOutput.scrollHeight;

  // Keep only last 50 entries
  while (consoleOutput.children.length > 50) {
    consoleOutput.removeChild(consoleOutput.firstChild!);
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// API calls via HTTP (more reliable for request/response)
async function executeCommands(commands: string[]): Promise<any> {
  const response = await fetch('http://127.0.0.1:4200/api/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commands }),
  });
  return response.json();
}

// Load available builders
async function loadBuilders() {
  try {
    const result = await executeCommands(['builder.list']);
    if (result.results?.[0]?.status === 'ok') {
      state.builders = result.results[0].data.builders;
      populateBuilderSelect();
      log(`Loaded ${state.builders.length} builders`);
    }
  } catch (err) {
    log(`Failed to load builders: ${err}`, 'error');
  }
}

function populateBuilderSelect() {
  elements.builderSelect.innerHTML = '<option value="">Select a builder...</option>';
  for (const builder of state.builders) {
    const option = document.createElement('option');
    option.value = builder.name;
    option.textContent = builder.name;
    elements.builderSelect.appendChild(option);
  }
}

// Single cell setup
function setupMainCell() {
  const canvas = elements.mainCanvas;

  state.cell = {
    seed: state.currentSeed,
    result: null,
    loading: false,
    renderer: null,
    scene: null,
    camera: null,
    controls: null,
    mesh: null,
  };

  // Create renderer
  state.cell.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  state.cell.renderer.setPixelRatio(window.devicePixelRatio);
  state.cell.renderer.setClearColor(0x161b22);

  // Create scene
  state.cell.scene = new THREE.Scene();

  // Create camera
  state.cell.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  state.cell.camera.position.set(1.5, 1.2, 1.5);
  state.cell.camera.lookAt(0, 0.4, 0);

  // Create orbit controls
  state.cell.controls = new OrbitControls(state.cell.camera, canvas);
  state.cell.controls.target.set(0, 0.4, 0);
  state.cell.controls.enableDamping = true;
  state.cell.controls.dampingFactor = 0.05;

  // Add lights
  const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
  state.cell.scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(5, 10, 7);
  state.cell.scene.add(directionalLight);

  const fillLight = new THREE.DirectionalLight(0x4488ff, 0.3);
  fillLight.position.set(-5, 2, -5);
  state.cell.scene.add(fillLight);

  // Handle resize
  resizeMainCell();
}

function resizeMainCell() {
  if (!state.cell?.renderer || !state.cell.camera) return;

  const container = elements.mainCell;
  const rect = container.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;

  state.cell.renderer.setSize(width, height);
  state.cell.camera.aspect = width / height;
  state.cell.camera.updateProjectionMatrix();
}

function updateDetailPanel() {
  const cell = state.cell;

  if (!cell?.result) {
    elements.detailPanel.innerHTML = `
      <h2>Inspection</h2>
      <div class="empty-state">No data for seed ${state.currentSeed}</div>
    `;
    return;
  }

  const result = cell.result;
  let decisionsHtml = '';
  for (const [key, d] of Object.entries(result.decisions)) {
    decisionsHtml += `
      <div class="decision-item">
        <span class="decision-key">${key}</span>
        <span>
          <span class="decision-value">${d.value}</span>
          <span class="decision-source">${d.source}</span>
        </span>
      </div>
    `;
  }

  let measurementsHtml = '';
  for (const [key, m] of Object.entries(result.measurements)) {
    const displayVal = typeof m.value === 'number' ? m.value.toFixed(3) : m.value;
    measurementsHtml += `
      <div class="measurement-item">
        <span class="measurement-key">${key}</span>
        <span class="measurement-value">${displayVal}</span>
      </div>
    `;
  }

  elements.detailPanel.innerHTML = `
    <h2>Seed ${result.seed}</h2>

    <div class="detail-section">
      <h3>Geometry</h3>
      <div class="measurement-item">
        <span class="measurement-key">Vertices</span>
        <span class="measurement-value">${result.vertices}</span>
      </div>
      <div class="measurement-item">
        <span class="measurement-key">Faces</span>
        <span class="measurement-value">${result.faces}</span>
      </div>
      <div class="measurement-item">
        <span class="measurement-key">Size</span>
        <span class="measurement-value">${result.bounds.width} × ${result.bounds.height} × ${result.bounds.depth}</span>
      </div>
      <div class="measurement-item">
        <span class="measurement-key">Issues</span>
        <span class="measurement-value">${result.issues}</span>
      </div>
    </div>

    <div class="detail-section">
      <h3>Decisions (${Object.keys(result.decisions).length})</h3>
      ${decisionsHtml || '<div class="empty-state">No decisions</div>'}
    </div>

    <div class="detail-section">
      <h3>Measurements (${Object.keys(result.measurements).length})</h3>
      ${measurementsHtml || '<div class="empty-state">No measurements</div>'}
    </div>
  `;
}

// Run builder for current seed
async function runCurrentSeed() {
  if (!state.activeBuilder || !state.cell) {
    log('No builder selected', 'error');
    return;
  }

  setNavButtonsState(false);
  elements.runBtn.disabled = true;
  elements.runBtn.textContent = 'Running...';

  const seed = state.currentSeed;
  state.cell.seed = seed;
  state.cell.loading = true;
  updateMainOverlay();

  log(`Running ${state.activeBuilder} with seed ${seed}`);

  try {
    // Open builder first
    await executeCommands([`builder.open ${state.activeBuilder}`]);

    const result = await executeCommands([
      `builder.run seed=${seed}`,
      'builder.measurements',
      'builder.decisions'
    ]);

    if (result.results?.[0]?.status === 'ok') {
      const runData = result.results[0].data;
      const measurements = result.results[1]?.data?.measurements || {};
      const decisions = result.results[2]?.data?.decisions || runData.decisions;

      state.cell.result = {
        seed,
        vertices: runData.vertices,
        faces: runData.faces,
        bounds: runData.bounds,
        decisions,
        measurements,
        issues: runData.issues,
      };

      // Update mesh in 3D view
      await updateMainMesh();
      log(`Seed ${seed}: ${runData.vertices}v, ${runData.faces}f`, 'success');
    } else {
      log(`Seed ${seed} failed: ${result.results?.[0]?.error}`, 'error');
    }
  } catch (err) {
    log(`Seed ${seed} error: ${err}`, 'error');
  }

  state.cell.loading = false;
  updateMainOverlay();
  updateDetailPanel();

  elements.runBtn.disabled = false;
  elements.runBtn.textContent = 'Run Builder';
  setNavButtonsState(true);
}

function setNavButtonsState(enabled: boolean) {
  elements.prevBtn.disabled = !enabled;
  elements.nextBtn.disabled = !enabled;
  elements.randomBtn.disabled = !enabled;
}

function updateMainOverlay() {
  const cell = state.cell;
  if (!cell) return;

  if (cell.loading) {
    elements.mainCell.classList.add('loading');
    elements.mainOverlay.innerHTML = `
      <span class="cell-seed">Seed: ${cell.seed}</span>
      <span class="cell-stats">Loading...</span>
    `;
  } else if (cell.result) {
    elements.mainCell.classList.remove('loading');
    elements.mainOverlay.innerHTML = `
      <span class="cell-seed">Seed: ${cell.seed}</span>
      <span class="cell-stats">${cell.result.vertices}v ${cell.result.faces}f</span>
    `;
  } else {
    elements.mainCell.classList.remove('loading');
    elements.mainOverlay.innerHTML = `
      <span class="cell-seed">Seed: ${cell.seed}</span>
      <span class="cell-stats">--</span>
    `;
  }

  elements.seedDisplay.textContent = `Seed: ${state.currentSeed}`;
}

// Fetch and render mesh for main cell
async function updateMainMesh() {
  const cell = state.cell;
  if (!cell?.scene || !cell.result) return;

  // Remove old mesh
  if (cell.mesh) {
    cell.scene.remove(cell.mesh);
    cell.mesh = null;
  }

  try {
    // Fetch actual mesh geometry from server
    const meshResult = await executeCommands(['builder.mesh']);

    if (meshResult.results?.[0]?.status === 'ok') {
      const meshData = meshResult.results[0].data;

      // Create Three.js geometry from serialized data
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(meshData.vertices, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(meshData.normals, 3));

      // Add vertex colors if available
      if (meshData.colors && meshData.hasColors) {
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(meshData.colors, 3));
      }

      geometry.computeBoundingSphere();

      // Create material - use vertex colors if available
      const material = new THREE.MeshStandardMaterial({
        color: meshData.hasColors ? 0xffffff : 0x8b5a2b,  // White base if using vertex colors
        vertexColors: meshData.hasColors,  // Enable vertex colors
        roughness: 0.7,
        metalness: 0.1,
        flatShading: true,
        side: THREE.DoubleSide  // Show both sides of faces
      });

      const mesh = new THREE.Mesh(geometry, material);

      const group = new THREE.Group();
      group.add(mesh);

      cell.mesh = group;
      cell.scene.add(group);

      log(`Rendered ${meshData.triangleCount} triangles${meshData.hasColors ? ' (with colors)' : ''}`);
    } else {
      log(`Mesh fetch failed: ${meshResult.results?.[0]?.error}`, 'error');
      createPlaceholderMesh();
    }
  } catch (err) {
    log(`Mesh error: ${err}`, 'error');
    createPlaceholderMesh();
  }
}

// Fallback placeholder mesh if actual mesh fails
function createPlaceholderMesh() {
  const cell = state.cell;
  if (!cell?.scene || !cell.result) return;

  const bounds = cell.result.bounds;
  const width = parseFloat(bounds.width);
  const depth = parseFloat(bounds.depth);

  const group = new THREE.Group();

  // Create a simple chair representation based on decisions
  const decisions = cell.result.decisions;
  const legStyle = decisions.leg_style?.value || 'round';
  const backStyle = decisions.back_style?.value || 'solid';

  // Seat
  const seatGeom = new THREE.BoxGeometry(width, 0.03, depth);
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.7 });
  const seat = new THREE.Mesh(seatGeom, seatMat);
  seat.position.y = 0.45;
  group.add(seat);

  // Legs
  const legHeight = 0.45;
  const legRadius = legStyle === 'square' ? 0.02 : 0.015;
  const legGeom = legStyle === 'square'
    ? new THREE.BoxGeometry(legRadius * 2, legHeight, legRadius * 2)
    : new THREE.CylinderGeometry(legRadius, legRadius * 1.2, legHeight, 8);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x5d4e37, roughness: 0.8 });

  const legPositions = [
    [-width / 2 + 0.03, legHeight / 2, -depth / 2 + 0.03],
    [width / 2 - 0.03, legHeight / 2, -depth / 2 + 0.03],
    [-width / 2 + 0.03, legHeight / 2, depth / 2 - 0.03],
    [width / 2 - 0.03, legHeight / 2, depth / 2 - 0.03],
  ];

  for (const pos of legPositions) {
    const leg = new THREE.Mesh(legGeom, legMat);
    leg.position.set(pos[0], pos[1], pos[2]);
    group.add(leg);
  }

  // Back
  const backHeight = parseFloat(bounds.height) - 0.45;
  if (backStyle === 'solid') {
    const backGeom = new THREE.BoxGeometry(width - 0.04, backHeight, 0.02);
    const back = new THREE.Mesh(backGeom, seatMat);
    back.position.set(0, 0.45 + backHeight / 2, -depth / 2 + 0.02);
    group.add(back);
  } else {
    // Slats
    const slatCount = 3;
    const slatWidth = (width - 0.08) / slatCount - 0.02;
    for (let i = 0; i < slatCount; i++) {
      const slatGeom = new THREE.BoxGeometry(slatWidth, backHeight, 0.015);
      const slat = new THREE.Mesh(slatGeom, seatMat);
      const x = -width / 2 + 0.04 + slatWidth / 2 + i * (slatWidth + 0.02);
      slat.position.set(x, 0.45 + backHeight / 2, -depth / 2 + 0.02);
      group.add(slat);
    }
  }

  cell.mesh = group;
  cell.scene.add(group);
}

// Animation loop
function animate() {
  state.animationId = requestAnimationFrame(animate);

  const cell = state.cell;
  if (cell?.renderer && cell.scene && cell.camera) {
    // Update orbit controls
    cell.controls?.update();
    cell.renderer.render(cell.scene, cell.camera);
  }
}

// Event handlers
function setupEventHandlers() {
  elements.builderSelect.addEventListener('change', async (e) => {
    const name = (e.target as HTMLSelectElement).value;
    if (name) {
      state.activeBuilder = name;
      elements.runBtn.disabled = false;
      setNavButtonsState(true);
      elements.gridTitle.textContent = `${name}`;
      log(`Selected builder: ${name}`);

      // Update info panel
      const builder = state.builders.find(b => b.name === name);
      if (builder) {
        elements.infoPanel.innerHTML = `
          <h3>Measurements</h3>
          ${builder.measurements.map(m => `<div class="info-item"><span class="info-key">${m}</span></div>`).join('')}
          <br>
          <h3>Decisions</h3>
          ${builder.decisions.map(d => `<div class="info-item"><span class="info-key">${d}</span></div>`).join('')}
        `;
      }

      // Auto-run with current seed
      await runCurrentSeed();
    } else {
      state.activeBuilder = null;
      elements.runBtn.disabled = true;
      setNavButtonsState(false);
      elements.gridTitle.textContent = 'No builder selected';
    }
  });

  elements.runBtn.addEventListener('click', runCurrentSeed);

  elements.currentSeed.addEventListener('change', () => {
    state.currentSeed = parseInt(elements.currentSeed.value) || 1;
    elements.seedDisplay.textContent = `Seed: ${state.currentSeed}`;
    if (state.activeBuilder) {
      runCurrentSeed();
    }
  });

  // Navigation buttons
  elements.prevBtn.addEventListener('click', () => {
    if (state.currentSeed > 1) {
      state.currentSeed--;
      elements.currentSeed.value = String(state.currentSeed);
      runCurrentSeed();
    }
  });

  elements.nextBtn.addEventListener('click', () => {
    state.currentSeed++;
    elements.currentSeed.value = String(state.currentSeed);
    runCurrentSeed();
  });

  elements.randomBtn.addEventListener('click', () => {
    state.currentSeed = Math.floor(Math.random() * 100000) + 1;
    elements.currentSeed.value = String(state.currentSeed);
    runCurrentSeed();
  });

  // Handle window resize
  window.addEventListener('resize', resizeMainCell);
}

// Initialize
function init() {
  log('Initializing dashboard...');
  setupMainCell();
  setupEventHandlers();
  connectWebSocket();
  animate();

  // Initial resize
  setTimeout(resizeMainCell, 100);
}

init();


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
  instanceCount?: number;
  hasInstances?: boolean;
  quality?: {
    target_tier: number;
    achieved_tier: number;
    gates_passed: number;
    gates_failed: number;
    suggestion_count: number;
  };
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
  showUVPreview: false,  // C4-002: Toggle for UV checkerboard preview
  showWeightPreview: false,  // E2-002: Toggle for weight heat map preview
  selectedJoint: null as string | null,  // E2-002: Currently selected joint for weight display
  showMorphPreview: false,  // E3-002: Toggle for morph target preview
  morphTargetWeights: {} as Record<string, number>,  // E3-002: Current morph target weights
  availableMorphTargets: [] as Array<{ name: string; offsetCount: number; defaultWeight: number }>,  // E3-002
  showTexturePreview: false,  // G6-003: Toggle for baked texture preview
  textureCache: new Map<string, THREE.Texture>(),  // G6-003: Loaded textures by path
  availableTextures: null as { albedo?: string; normal?: string; roughness?: string; ao?: string } | null,  // G6-003
  perMaterialTextures: null as Map<string, { albedo?: string; normal?: string; roughness?: string; ao?: string }> | null,  // Per-slot textures
  perSlotUVBounds: null as Record<string, { uMin: number; uMax: number; vMin: number; vMax: number }> | null,  // UV normalisation bounds per slot
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

// C4-002: Create checkerboard texture for UV preview
let checkerboardTexture: THREE.Texture | null = null;

function getCheckerboardTexture(): THREE.Texture {
  if (checkerboardTexture) return checkerboardTexture;

  // Create a 64x64 checkerboard pattern
  const size = 64;
  const data = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // 8x8 checker grid
      const isWhite = ((Math.floor(x / 8) + Math.floor(y / 8)) % 2) === 0;
      const value = isWhite ? 255 : 100;
      data[i] = value;     // R
      data[i + 1] = value; // G
      data[i + 2] = value; // B
      data[i + 3] = 255;   // A
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);  // Repeat the pattern
  texture.needsUpdate = true;

  checkerboardTexture = texture;
  return texture;
}

// E2-002: Weight heat map color - blue (0) to red (1), magenta for unweighted
function getWeightColor(weight: number, isUnweighted: boolean = false): THREE.Color {
  if (isUnweighted) {
    return new THREE.Color(1, 0, 1);  // Magenta for unweighted vertices
  }
  // Blue (0) -> Cyan -> Green -> Yellow -> Red (1)
  const r = Math.min(1, weight * 2);
  const g = weight < 0.5 ? weight * 2 : 2 - weight * 2;
  const b = Math.max(0, 1 - weight * 2);
  return new THREE.Color(r, g, b);
}

// E2-002: Select first available joint for weight visualization
async function selectFirstJoint() {
  try {
    const result = await executeCommands(['builder.skeleton']);
    if (result.results?.[0]?.success && result.results[0].data?.joints) {
      const joints = result.results[0].data.joints;
      if (joints.length > 0) {
        state.selectedJoint = joints[0].name;
        log(`Selected joint: ${state.selectedJoint}`, 'info');
      }
    }
  } catch (err) {
    log(`Failed to get skeleton: ${err}`, 'error');
  }
}

// E2-002: Select joint for weight visualization
async function selectJointForWeights(jointName: string) {
  state.selectedJoint = jointName;
  state.showWeightPreview = true;
  state.showUVPreview = false;
  log(`Weight preview: ${jointName}`, 'info');
  await runCurrentSeed();
}

// E2-002: Get weight heat map data for current mesh
async function getWeightHeatMap(): Promise<number[] | null> {
  if (!state.selectedJoint) return null;

  try {
    const result = await executeCommands([`builder.show_weights ${state.selectedJoint}`]);
    if (result.results?.[0]?.success) {
      return result.results[0].data.heatMap;
    }
  } catch (err) {
    log(`Failed to get weight data: ${err}`, 'error');
  }
  return null;
}

// E3-002: Load available morph targets from current builder
async function loadMorphTargets(): Promise<void> {
  try {
    const result = await executeCommands(['builder.morph_targets']);
    if (result.results?.[0]?.success && result.results[0].data?.hasTargets) {
      state.availableMorphTargets = result.results[0].data.targets;
      // Initialize weights to defaults
      state.morphTargetWeights = {};
      for (const target of state.availableMorphTargets) {
        state.morphTargetWeights[target.name] = target.defaultWeight;
      }
      log(`Loaded ${state.availableMorphTargets.length} morph target(s)`, 'info');
    } else {
      state.availableMorphTargets = [];
      state.morphTargetWeights = {};
    }
  } catch (err) {
    log(`Failed to load morph targets: ${err}`, 'error');
    state.availableMorphTargets = [];
    state.morphTargetWeights = {};
  }
}

// G6-003: Load baked textures for current builder
async function loadBakedTextures(): Promise<void> {
  if (!state.activeBuilder) {
    state.availableTextures = null; state.perMaterialTextures = null;
    return;
  }

  try {
    // Extract base builder name (last part after /) since that's how textures are saved
    const parts = state.activeBuilder.split('/');
    const baseName = parts[parts.length - 1];

    // Clear texture cache
    state.textureCache.clear();

    // Always re-bake textures for current mesh to ensure they match
    log(`Baking textures for ${baseName}...`, 'info');

    // Unwrap UVs, bake textures, AND generate UV debug texture for comparison
    const bakeResult = await executeCommands([
      'builder.unwrap',
      'builder.bake_textures',            // G3-004: auto-resolution based on scene complexity
      'builder.uv_debug'                   // G3-004: auto-resolution based on scene complexity
    ]);

    if (bakeResult.results?.[1]?.status !== 'ok') {
      const error = bakeResult.results?.[1]?.error || bakeResult.results?.[0]?.error || 'Unknown error';
      log(`Failed to bake textures: ${error}`, 'error');
      state.availableTextures = null; state.perMaterialTextures = null;
      return;
    }

    // Log UV debug stats if available
    if (bakeResult.results?.[2]?.status === 'ok' && bakeResult.results[2].data) {
      const uvStats = bakeResult.results[2].data;
      log(`UV Debug: ${uvStats.triangleCount} triangles, ${uvStats.degenerateCount} degenerate, ${uvStats.totalArea} coverage`, 'info');
    }

    log(`Textures baked successfully`, 'info');

    // Query for textures
    const result = await executeCommands([`texture.list ${baseName}`]);

    if (result.results?.[0]?.status === 'ok' && result.results[0].data?.textures?.length > 0) {
      const textures = result.results[0].data.textures as Array<{ filename: string; builder: string; channel: string }>;
      const cacheBuster = `?t=${Date.now()}`;

      // Separate per-material textures (builder name contains slot suffix)
      // from single-material textures (builder name exactly matches baseName).
      const singleMat: typeof textures = [];
      const perMat = new Map<string, typeof textures>();

      for (const tex of textures) {
        if (tex.channel === 'uv_debug') continue; // skip debug textures
        if (tex.builder === baseName) {
          singleMat.push(tex);
        } else if (tex.builder.startsWith(baseName + '_')) {
          // Extract slot name: "ChessBoard_dark_material" → "dark_material"
          const slotName = tex.builder.substring(baseName.length + 1);
          if (!perMat.has(slotName)) perMat.set(slotName, []);
          perMat.get(slotName)!.push(tex);
        }
      }

      if (perMat.size > 0) {
        // Multi-material: build per-slot texture maps
        state.perMaterialTextures = new Map();
        for (const [slotName, slotTextures] of perMat) {
          const slotMap: { albedo?: string; normal?: string; roughness?: string; ao?: string } = {};
          for (const tex of slotTextures) {
            const path = `/output/textures/${tex.filename}${cacheBuster}`;
            if (tex.channel === 'albedo') slotMap.albedo = path;
            else if (tex.channel === 'normal') slotMap.normal = path;
            else if (tex.channel === 'roughness') slotMap.roughness = path;
            else if (tex.channel === 'ao') slotMap.ao = path;
          }
          state.perMaterialTextures.set(slotName, slotMap);
        }

        // Load UV bounds sidecar so we can normalise per-slot UVs to match baked space
        try {
          const sidecarName = `${baseName.replace(/\//g, '_')}_uv_bounds.json`;
          const resp = await fetch(`/output/textures/${sidecarName}${cacheBuster}`);
          if (resp.ok) {
            state.perSlotUVBounds = await resp.json();
            log(`Loaded UV bounds for ${Object.keys(state.perSlotUVBounds!).length} slots`, 'info');
          } else {
            state.perSlotUVBounds = null;
          }
        } catch {
          state.perSlotUVBounds = null;
        }

        // Also set availableTextures to signal that texture preview is available
        // (use the first slot as a fallback for any code that checks availableTextures)
        const firstSlot = state.perMaterialTextures.values().next().value;
        state.availableTextures = firstSlot || {};
        log(`Loaded per-material textures for ${perMat.size} slots: ${[...perMat.keys()].join(', ')}`, 'info');
      } else if (singleMat.length > 0) {
        // Single-material: classic path
        state.availableTextures = {};
        state.perMaterialTextures = null;
        for (const tex of singleMat) {
          const path = `/output/textures/${tex.filename}${cacheBuster}`;
          if (tex.channel === 'albedo') state.availableTextures.albedo = path;
          else if (tex.channel === 'normal') state.availableTextures.normal = path;
          else if (tex.channel === 'roughness') state.availableTextures.roughness = path;
          else if (tex.channel === 'ao') state.availableTextures.ao = path;
        }
        log(`Loaded single-material textures: ${Object.keys(state.availableTextures).join(', ')}`, 'info');
      } else {
        state.availableTextures = null; state.perMaterialTextures = null;
        state.perMaterialTextures = null;
        log(`No textures found after baking`, 'error');
      }

      // UV debug texture path
      const uvDebugPath = `/output/textures/${baseName}_uv_debug.png${cacheBuster}`;
      if (state.availableTextures) {
        (state.availableTextures as any).uvDebug = uvDebugPath;
      }
    } else {
      state.availableTextures = null; state.perMaterialTextures = null;
      state.perMaterialTextures = null;
      log(`No textures found after baking`, 'error');
    }
  } catch (err) {
    log(`Failed to load textures: ${err}`, 'error');
    state.availableTextures = null; state.perMaterialTextures = null;
  }
}

// G6-003: Load a texture from URL with caching
async function loadTexture(url: string, colorSpace: typeof THREE.SRGBColorSpace | typeof THREE.LinearSRGBColorSpace = THREE.SRGBColorSpace): Promise<THREE.Texture | null> {
  // Cache key includes colorSpace so sRGB and Linear variants are stored separately
  const cacheKey = `${url}|${colorSpace}`;
  if (state.textureCache.has(cacheKey)) {
    return state.textureCache.get(cacheKey)!;
  }

  try {
    const loader = new THREE.TextureLoader();
    const texture = await new Promise<THREE.Texture>((resolve, reject) => {
      loader.load(url, resolve, undefined, reject);
    });

    texture.colorSpace = colorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;

    // Cache the loaded texture
    state.textureCache.set(cacheKey, texture);
    return texture;
  } catch (err) {
    log(`Failed to load texture ${url}: ${err}`, 'error');
    return null;
  }
}

// E3-002: Update morph target weight and re-render
async function updateMorphTargetWeight(targetName: string, weight: number): Promise<void> {
  state.morphTargetWeights[targetName] = weight;
  log(`Morph target '${targetName}' weight = ${weight.toFixed(2)}`, 'info');
  // Re-render with new weights
  await runCurrentSeed();
}

// E3-002: Create morph target slider UI
function createMorphTargetUI(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'morph-targets-panel';
  container.innerHTML = `<div class="section-title">Morph Targets (press 'm' to toggle)</div>`;

  if (state.availableMorphTargets.length === 0) {
    container.innerHTML += `<div class="no-targets">No morph targets defined</div>`;
    return container;
  }

  for (const target of state.availableMorphTargets) {
    const weight = state.morphTargetWeights[target.name] ?? target.defaultWeight;
    const row = document.createElement('div');
    row.className = 'morph-slider-row';
    row.innerHTML = `
      <label class="morph-label" title="${target.name} (${target.offsetCount} offsets)">
        ${target.name}
      </label>
      <input type="range" class="morph-slider"
             min="0" max="1" step="0.01"
             value="${weight}"
             data-target="${target.name}">
      <span class="morph-value">${weight.toFixed(2)}</span>
    `;

    const slider = row.querySelector('.morph-slider') as HTMLInputElement;
    const valueSpan = row.querySelector('.morph-value') as HTMLSpanElement;

    slider.addEventListener('input', () => {
      const newWeight = parseFloat(slider.value);
      valueSpan.textContent = newWeight.toFixed(2);
    });

    slider.addEventListener('change', async () => {
      const newWeight = parseFloat(slider.value);
      await updateMorphTargetWeight(target.name, newWeight);
    });

    container.appendChild(row);
  }

  return container;
}

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

  // Extra rim light from behind-right to reveal form on rounded/lathe shapes
  const rimLight = new THREE.DirectionalLight(0xfff0e0, 0.5);
  rimLight.position.set(3, 4, -8);
  state.cell.scene.add(rimLight);

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
    const isOverridden = d.source === 'override';
    const decisionClass = isOverridden ? 'decision-item overridden' : 'decision-item';

    // Create appropriate control based on decision type
    let control = '';
    if (typeof d.value === 'boolean') {
      // Boolean decision - toggle switch
      control = `
        <label class="decision-toggle">
          <input type="checkbox" ${d.value ? 'checked' : ''} onchange="window.toggleDecision('${key}', this.checked)">
          <span class="toggle-slider"></span>
        </label>
      `;
    } else if ((d as any).options && Array.isArray((d as any).options)) {
      // Choice decision - dropdown
      const options = (d as any).options;
      control = `
        <select class="decision-select" onchange="window.overrideDecision('${key}', this.value)">
          ${options.map((opt: string) => `<option value="${opt}" ${d.value === opt ? 'selected' : ''}>${opt}</option>`).join('')}
        </select>
      `;
    } else if (typeof d.value === 'number') {
      // Number decision - input field
      control = `
        <input type="number" class="decision-input" value="${d.value}" step="0.1"
               onchange="window.overrideDecision('${key}', parseFloat(this.value))">
      `;
    } else {
      // Default: just show value
      control = `<span class="decision-value">${d.value}</span>`;
    }

    decisionsHtml += `
      <div class="${decisionClass}">
        <span class="decision-key">${key}</span>
        <span class="decision-controls">
          ${control}
          ${isOverridden ? `<button class="reset-btn" onclick="window.resetDecision('${key}')" title="Reset to default">↺</button>` : ''}
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
    <div class="detail-section">
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
      ${result.hasInstances ? `
      <div class="measurement-item">
        <span class="measurement-key">Instances</span>
        <span class="measurement-value">${result.instanceCount}</span>
      </div>
      ` : ''}
    </div>

    ${state.showTexturePreview && state.availableTextures ? `
    <div class="detail-section">
      <h3>Textures (Press T to toggle)</h3>
      <div class="texture-links">
        ${state.availableTextures.albedo ? `<a href="${state.availableTextures.albedo}" target="_blank" class="texture-link">Albedo</a>` : ''}
        ${state.availableTextures.normal ? `<a href="${state.availableTextures.normal}" target="_blank" class="texture-link">Normal</a>` : ''}
        ${state.availableTextures.roughness ? `<a href="${state.availableTextures.roughness}" target="_blank" class="texture-link">Roughness</a>` : ''}
        ${state.availableTextures.ao ? `<a href="${state.availableTextures.ao}" target="_blank" class="texture-link">AO</a>` : ''}
        ${(state.availableTextures as any).uvDebug ? `<a href="${(state.availableTextures as any).uvDebug}" target="_blank" class="texture-link uv-debug">UV Debug</a>` : ''}
      </div>
      <div class="texture-hint">Click to view texture. Compare UV Debug with Albedo to verify UV mapping.</div>
    </div>
    ` : ''}

    <div class="detail-section">
      <h3>
        Decisions (${Object.keys(result.decisions).length})
        <button class="reset-all-btn" onclick="window.resetAllDecisions()" title="Reset all decisions to defaults">Reset All</button>
      </h3>
      ${decisionsHtml || '<div class="empty-state">No decisions</div>'}
    </div>

    <div class="detail-section">
      <h3>Measurements (${Object.keys(result.measurements).length})</h3>
      ${measurementsHtml || '<div class="empty-state">No measurements</div>'}
    </div>
  `;

  // E3-002: Add morph target sliders if available
  if (state.availableMorphTargets.length > 0) {
    const morphUI = createMorphTargetUI();
    elements.detailPanel.appendChild(morphUI);
  }
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
      'builder.decisions',
      'builder.instances'
    ]);

    if (result.results?.[0]?.status === 'ok') {
      const runData = result.results[0].data;
      const measurements = result.results[1]?.data?.measurements || {};
      const decisions = result.results[2]?.data?.decisions || runData.decisions;
      const instanceData = result.results[3]?.data || {};

      state.cell.result = {
        seed,
        vertices: runData.vertices,
        faces: runData.faces,
        bounds: runData.bounds,
        decisions,
        measurements,
        issues: runData.issues,
        instanceCount: instanceData.count || 0,
        hasInstances: instanceData.count > 0,
        quality: runData.quality
      };

      // E3-002: Load morph targets for this builder
      await loadMorphTargets();

      // Update mesh in 3D view
      await updateMainMesh();
      const instanceMsg = state.cell.result.hasInstances ? ` + ${state.cell.result.instanceCount} instances` : '';
      log(`Seed ${seed}: ${runData.vertices}v, ${runData.faces}f${instanceMsg}`, 'success');
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

  // A2-003: Generate quality badge
  const getQualityBadge = (result: RunResult | null) => {
    if (!result?.quality) return '';
    const q = result.quality;
    const tierMatch = q.achieved_tier >= q.target_tier;
    const badgeClass = tierMatch ? 'quality-badge quality-pass' : 'quality-badge quality-fail';
    const icon = tierMatch ? '✓' : '⚠';
    return `<span class="${badgeClass}">T${q.achieved_tier}${icon}</span>`;
  };

  if (cell.loading) {
    elements.mainCell.classList.add('loading');
    elements.mainOverlay.innerHTML = `
      <span class="cell-seed">Seed: ${cell.seed}</span>
      <span class="cell-stats">Loading...</span>
    `;
  } else if (cell.result) {
    elements.mainCell.classList.remove('loading');
    const qualityBadge = getQualityBadge(cell.result);
    elements.mainOverlay.innerHTML = `
      <span class="cell-seed">Seed: ${cell.seed} ${qualityBadge}</span>
      <span class="cell-stats">${cell.result.vertices}v ${cell.result.faces}f</span>
    `;
    // A2-003: Update grid title with quality badge
    if (state.activeBuilder && cell.result.quality) {
      const q = cell.result.quality;
      const tierMatch = q.achieved_tier >= q.target_tier;
      const badgeStyle = tierMatch ? 'color: #4caf50;' : 'color: #ff9800;';
      elements.gridTitle.innerHTML = `${state.activeBuilder} <span style="${badgeStyle} font-size: 0.8em;">T${q.achieved_tier}</span>`;
    }
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

  // Show loading state
  cell.loading = true;
  updateMainOverlay();

  // Remove old mesh and properly dispose resources
  if (cell.mesh) {
    cell.scene.remove(cell.mesh);
    // Dispose all children's geometry and materials
    cell.mesh.traverse((obj: any) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m: any) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
    cell.mesh = null;
  }

  try {
    // Note: If texture preview is on, loadBakedTextures() has already run builder.unwrap
    // and the ctx.lastRun.mesh already has UVs. Don't unwrap again as it would create
    // different UV coordinates than the baked textures!

    // Fetch both mesh and instances from server
    const results = await executeCommands(['builder.mesh', 'builder.instances']);

    const meshResult = results.results?.[0];
    const instancesResult = results.results?.[1];

    const group = new THREE.Group();

    // Render merged geometry
    if (meshResult?.status === 'ok') {
      const meshData = meshResult.data;

      // Debug logging for mesh data
      log(`Mesh data: ${meshData.vertexCount} vertices, ${meshData.triangleCount} triangles, hasColors=${meshData.hasColors}, hasUVs=${meshData.hasUVs || false}`);

      // Only create mesh if there's actual geometry
      if (meshData.vertices && meshData.vertices.length > 0) {
        // Create Three.js geometry from serialized data
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(meshData.vertices, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(meshData.normals, 3));

        // Add vertex colors if available
        if (meshData.colors && meshData.hasColors) {
          geometry.setAttribute('color', new THREE.Float32BufferAttribute(meshData.colors, 3));
        }

        // Add UVs if available
        if (meshData.uvs && meshData.uvs.length > 0) {
          geometry.setAttribute('uv', new THREE.Float32BufferAttribute(meshData.uvs, 2));
        }

        geometry.computeBoundingSphere();

        // Create material - use checkerboard if UV preview mode, weight colors if weight mode, else vertex colors or default
        const hasUVs = meshData.uvs && meshData.uvs.length > 0;
        let material: THREE.MeshStandardMaterial;
        let useWeightColors = false;

        // E2-002: Weight preview mode - apply weight heat map colors
        if (state.showWeightPreview && state.selectedJoint) {
          const heatMap = await getWeightHeatMap();
          if (heatMap && heatMap.length > 0) {
            // Replace vertex colors with weight heat map colors
            const vertexCount = meshData.vertices.length / 3;
            const weightColors = new Float32Array(vertexCount * 3);

            for (let i = 0; i < vertexCount; i++) {
              const weight = heatMap[i] ?? 0;
              const isUnweighted = weight === 0 && !heatMap[i];
              const color = getWeightColor(weight, isUnweighted);
              weightColors[i * 3] = color.r;
              weightColors[i * 3 + 1] = color.g;
              weightColors[i * 3 + 2] = color.b;
            }

            geometry.setAttribute('color', new THREE.Float32BufferAttribute(weightColors, 3));
            useWeightColors = true;
            log(`Weight preview: ${state.selectedJoint} (blue=0, red=1)`);
          }
        }

        if (state.showUVPreview && hasUVs && !useWeightColors) {
          // UV preview mode: show checkerboard texture
          // Use smooth shading so UV seams are visible without faceted artifacts
          material = new THREE.MeshStandardMaterial({
            map: getCheckerboardTexture(),
            roughness: 0.5,
            metalness: 0.0,
            flatShading: false,
            side: THREE.DoubleSide
          });
          log(`Using UV checkerboard preview`);
        } else if (useWeightColors) {
          // Weight preview mode: use weight colors with smooth shading
          material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            vertexColors: true,
            roughness: 0.5,
            metalness: 0.0,
            flatShading: false,
            side: THREE.DoubleSide
          });
        } else if (state.showTexturePreview && hasUVs && state.availableTextures) {
          // G6-003: Texture preview mode - use baked PBR textures
          // Helper to build a THREE material from a texture channel map
          const buildPBRMaterial = async (texMap: { albedo?: string; normal?: string; roughness?: string; ao?: string }): Promise<THREE.MeshStandardMaterial> => {
            const props: THREE.MeshStandardMaterialParameters = {
              // These are overridden to 1.0 when maps are present so the map
              // value is used directly rather than being multiplied by the scalar.
              roughness: 0.7, metalness: 0.0,
              flatShading: false, side: THREE.DoubleSide
            };
            if (texMap.albedo) {
              // Albedo is a colour texture — sRGB
              const t = await loadTexture(texMap.albedo, THREE.SRGBColorSpace);
              if (t) props.map = t;
            }
            // Normal map is always flat (128,128,255) — not applied since it contributes
            // nothing but forces Three.js to compute tangents which can corrupt shading.
            // if (texMap.normal) { ... }
            if (texMap.roughness) {
              const t = await loadTexture(texMap.roughness, THREE.LinearSRGBColorSpace);
              if (t) { props.roughnessMap = t; props.roughness = 1.0; }
            }
            if (texMap.ao) {
              const t = await loadTexture(texMap.ao, THREE.LinearSRGBColorSpace);
              if (t) { props.aoMap = t; props.aoMapIntensity = 1.0; }
            }
            return new THREE.MeshStandardMaterial(props);
          };

          if (state.perMaterialTextures && meshData.materialIndices && meshData.materialSlots) {
            // Multi-material: create indexed geometry with groups per material slot
            const matSlots = meshData.materialSlots as Array<{ name: string }>;
            const matIndices = meshData.materialIndices as number[];
            const triCount = matIndices.length;
            const nrm = meshData.normals;
            // Sample normals at evenly-spaced points, all within bounds, aligned to stride of 3
            const nrmLen = nrm?.length ?? 0;
            const nrmSamples = nrm ? [0, 1, 2, 3].map(q => {
              const ii = Math.floor((q * (nrmLen - 3)) / 3 / 3) * 3; // quarter points, stride-aligned
              return `(${nrm[ii]?.toFixed(2)},${nrm[ii+1]?.toFixed(2)},${nrm[ii+2]?.toFixed(2)})`;
            }).join(' ') : 'MISSING';
            log(`[DBG] multi-mat: triCount=${triCount}, normals len=${nrmLen}, samples: ${nrmSamples}`, 'info');

            // Sort triangles by material index so each slot forms a contiguous group
            const triOrder = Array.from({ length: triCount }, (_, i) => i);
            triOrder.sort((a, b) => matIndices[a] - matIndices[b]);

            // Pre-compute per-slot UV bounds for normalisation.
            // The baker normalised each slot's sub-mesh UVs to [0,1] before baking,
            // so we must apply the same transform here so the atlas UVs map correctly
            // into each slot's baked texture.
            // Use the sidecar JSON when available; fall back to computing from the data.
            const slotUVBounds = new Map<number, { uMin: number; uMax: number; vMin: number; vMax: number }>();
            if (state.perSlotUVBounds) {
              // Use pre-computed bounds from the baker (most accurate)
              for (let si = 0; si < matSlots.length; si++) {
                const name = matSlots[si]?.name;
                if (name && state.perSlotUVBounds[name]) {
                  slotUVBounds.set(si, state.perSlotUVBounds[name]);
                }
              }
            }
            // Fallback: compute bounds from the mesh UV data per slot
            if (slotUVBounds.size === 0 && meshData.uvs) {
              for (let ti = 0; ti < triCount; ti++) {
                const slotIdx = matIndices[ti];
                let b = slotUVBounds.get(slotIdx);
                if (!b) { b = { uMin: Infinity, uMax: -Infinity, vMin: Infinity, vMax: -Infinity }; slotUVBounds.set(slotIdx, b); }
                for (let v = 0; v < 3; v++) {
                  const vi = (ti * 3 + v) * 2;
                  const u = meshData.uvs[vi], uv = meshData.uvs[vi + 1];
                  if (u < b.uMin) b.uMin = u; if (u > b.uMax) b.uMax = u;
                  if (uv < b.vMin) b.vMin = uv; if (uv > b.vMax) b.vMax = uv;
                }
              }
            }

            // Log actual UV range per slot vs sidecar bounds for diagnosis
            if (meshData.uvs) {
              const actualBounds = new Map<number, { uMin: number; uMax: number; vMin: number; vMax: number }>();
              for (let ti = 0; ti < triCount; ti++) {
                const slotIdx = matIndices[ti];
                let b = actualBounds.get(slotIdx);
                if (!b) { b = { uMin: Infinity, uMax: -Infinity, vMin: Infinity, vMax: -Infinity }; actualBounds.set(slotIdx, b); }
                for (let v = 0; v < 3; v++) {
                  const vi = (ti * 3 + v) * 2;
                  const u = meshData.uvs[vi], uv = meshData.uvs[vi + 1];
                  if (u < b.uMin) b.uMin = u; if (u > b.uMax) b.uMax = u;
                  if (uv < b.vMin) b.vMin = uv; if (uv > b.vMax) b.vMax = uv;
                }
              }
              for (const [si, ab] of actualBounds) {
                const sb = slotUVBounds.get(si);
                const name = matSlots[si]?.name ?? `slot${si}`;
                log(`[DBG UV] ${name}: actual=[${ab.uMin.toFixed(3)},${ab.uMax.toFixed(3)}]×[${ab.vMin.toFixed(3)},${ab.vMax.toFixed(3)}] sidecar=${sb ? `[${sb.uMin.toFixed(3)},${sb.uMax.toFixed(3)}]×[${sb.vMin.toFixed(3)},${sb.vMax.toFixed(3)}]` : 'none'}`, 'info');
              }
            }

            // Rebuild vertex arrays in sorted order, normalising UVs per slot
            const sortedPos = new Float32Array(triCount * 9);
            const sortedNrm = new Float32Array(triCount * 9);
            const sortedUvs = new Float32Array(triCount * 6);
            for (let out = 0; out < triCount; out++) {
              const src = triOrder[out];
              const slotIdx = matIndices[src];
              const bounds = slotUVBounds.get(slotIdx);
              const uRange = bounds ? bounds.uMax - bounds.uMin : 1;
              const vRange = bounds ? bounds.vMax - bounds.vMin : 1;
              const uMin = bounds?.uMin ?? 0;
              const vMin = bounds?.vMin ?? 0;
              for (let v = 0; v < 3; v++) {
                const si = src * 3 + v, oi = out * 3 + v;
                sortedPos[oi * 3]     = meshData.vertices[si * 3];
                sortedPos[oi * 3 + 1] = meshData.vertices[si * 3 + 1];
                sortedPos[oi * 3 + 2] = meshData.vertices[si * 3 + 2];
                sortedNrm[oi * 3]     = meshData.normals[si * 3];
                sortedNrm[oi * 3 + 1] = meshData.normals[si * 3 + 1];
                sortedNrm[oi * 3 + 2] = meshData.normals[si * 3 + 2];
                // Normalise atlas UV → slot-local [0,1] to match baked texture space
                const rawU = meshData.uvs[si * 2];
                const rawV = meshData.uvs[si * 2 + 1];
                sortedUvs[oi * 2]     = uRange > 1e-6 ? (rawU - uMin) / uRange : rawU;
                sortedUvs[oi * 2 + 1] = vRange > 1e-6 ? (rawV - vMin) / vRange : rawV;
              }
            }

            // Replace geometry attributes with sorted + normalised data
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(sortedPos, 3));
            geometry.setAttribute('uv', new THREE.Float32BufferAttribute(sortedUvs, 2));
            // Use the builder's smooth-group-aware normals. These are already correct —
            // the previous "broken lighting" was caused by the `sortedNrm.some()` validity
            // check incorrectly triggering computeVertexNormals() due to the out-of-bounds
            // sample bug. The builder normals are smooth-group-aware and should look better
            // than flat normals from computeVertexNormals() on non-indexed geometry.
            geometry.setAttribute('normal', new THREE.Float32BufferAttribute(sortedNrm, 3));

            // Build groups and materials array
            const materials: THREE.MeshStandardMaterial[] = [];
            const slotToMatIdx = new Map<number, number>();
            let groupStart = 0;

            for (let out = 0; out < triCount; ) {
              const slotIdx = matIndices[triOrder[out]];
              const start = out;
              while (out < triCount && matIndices[triOrder[out]] === slotIdx) out++;
              const count = (out - start) * 3; // vertex count

              if (!slotToMatIdx.has(slotIdx)) {
                const slotName = matSlots[slotIdx]?.name;
                const texMap = slotName ? state.perMaterialTextures.get(slotName) : undefined;
                if (texMap) {
                  slotToMatIdx.set(slotIdx, materials.length);
                  materials.push(await buildPBRMaterial(texMap));
                } else {
                  // Fallback: default material for slots without textures
                  slotToMatIdx.set(slotIdx, materials.length);
                  materials.push(new THREE.MeshStandardMaterial({
                    roughness: 0.7, metalness: 0.0,
                    flatShading: false, side: THREE.DoubleSide
                  }));
                }
              }

              geometry.addGroup(groupStart, count, slotToMatIdx.get(slotIdx)!);
              groupStart += count;
            }

            geometry.computeBoundingSphere();
            const multiMesh = new THREE.Mesh(geometry, materials);
            group.add(multiMesh);
            log(`Using ${materials.length} per-material PBR textures`);
            // Skip the single-material mesh creation below
            material = null as any;
          } else {
            // Single-material fallback
            material = await buildPBRMaterial(state.availableTextures);
            log(`Using baked PBR textures`);
          }
        } else {
          // Normal mode: use vertex colors if available
          // Use smooth shading when the mesh has pre-computed smoothGroup-aware normals;
          // this gives correct smooth surfaces on lathe/sweep geometry while preserving
          // hard edges between different smooth groups (e.g. box faces, cap vs body).
          material = new THREE.MeshStandardMaterial({
            color: meshData.hasColors ? 0xffffff : 0x8b5a2b,
            vertexColors: meshData.hasColors,
            roughness: 0.7,
            metalness: 0.1,
            flatShading: false,
            side: THREE.DoubleSide
          });
        }

        // For multi-material texture preview, the mesh was already added above
        if (material) {
          const mesh = new THREE.Mesh(geometry, material);
          group.add(mesh);
        }

        log(`Rendered ${meshData.triangleCount} triangles${meshData.hasColors ? ' (with colors)' : ''}`);
      }
    }

    // Render instances
    if (instancesResult?.status === 'ok' && instancesResult.data?.instances?.length > 0) {
      const instances = instancesResult.data.instances;
      log(`Rendering ${instances.length} instances...`);

      let instancesRendered = 0;
      for (const instance of instances) {
        try {
          // Fetch the mesh for this instance's builder
          const instanceMeshResult = await executeCommands([
            `builder.open ${instance.builderName}`,
            `builder.run seed=${instance.seed}`,
            'builder.mesh'
          ]);

          if (instanceMeshResult.results?.[2]?.status === 'ok') {
            const instanceMeshData = instanceMeshResult.results[2].data;

            // Create geometry for this instance
            const instanceGeometry = new THREE.BufferGeometry();
            instanceGeometry.setAttribute('position', new THREE.Float32BufferAttribute(instanceMeshData.vertices, 3));
            instanceGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(instanceMeshData.normals, 3));

            if (instanceMeshData.colors && instanceMeshData.hasColors) {
              instanceGeometry.setAttribute('color', new THREE.Float32BufferAttribute(instanceMeshData.colors, 3));
            }

            instanceGeometry.computeBoundingSphere();

            // Create material with slight color variation for instances
            // Use smooth shading to match main mesh — smoothGroup-aware normals
            // are computed server-side so instance geometry gets correct shading
            const instanceMaterial = new THREE.MeshStandardMaterial({
              color: instanceMeshData.hasColors ? 0xffffff : 0x6b8e23,  // Olive green for instances
              vertexColors: instanceMeshData.hasColors,
              roughness: 0.7,
              metalness: 0.1,
              flatShading: false,
              side: THREE.DoubleSide
            });

            const instanceMesh = new THREE.Mesh(instanceGeometry, instanceMaterial);

            // Apply transform from instance data
            const transform = instance.transform;
            instanceMesh.position.set(transform.position.x, transform.position.y, transform.position.z);
            instanceMesh.rotation.set(transform.rotation.x, transform.rotation.y, transform.rotation.z);

            // Handle scale (may be undefined if scale=1)
            const scale = transform.scale ?? 1;
            instanceMesh.scale.setScalar(scale);

            group.add(instanceMesh);
            instancesRendered++;
          }
        } catch (err) {
          console.warn(`Failed to render instance ${instance.id}:`, err);
        }
      }

      log(`Rendered ${instancesRendered}/${instances.length} instances`);
    }

    if (group.children.length > 0) {
      cell.mesh = group;
      cell.scene.add(group);
    } else {
      log('No geometry to render, using placeholder', 'error');
      createPlaceholderMesh();
    }

  } catch (err) {
    log(`Mesh error: ${err}`, 'error');
    createPlaceholderMesh();
  } finally {
    // Clear loading state
    if (state.cell) {
      state.cell.loading = false;
      updateMainOverlay();
    }
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

      // Clear texture state when switching builders
      state.availableTextures = null; state.perMaterialTextures = null;
      state.showTexturePreview = false;

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
      // Also clear textures when no builder selected
      state.availableTextures = null; state.perMaterialTextures = null;
      state.showTexturePreview = false;
    }
  });

  elements.runBtn.addEventListener('click', runCurrentSeed);

  elements.currentSeed.addEventListener('change', async () => {
    state.currentSeed = parseInt(elements.currentSeed.value) || 1;
    elements.seedDisplay.textContent = `Seed: ${state.currentSeed}`;
    if (state.activeBuilder) {
      // Reset measurement overrides when changing seeds
      await executeCommands(['measurement.reset-all']);
      await runCurrentSeed();
    }
  });

  // Navigation buttons
  elements.prevBtn.addEventListener('click', async () => {
    if (state.currentSeed > 1) {
      state.currentSeed--;
      elements.currentSeed.value = String(state.currentSeed);
      await executeCommands(['measurement.reset-all']);
      await runCurrentSeed();
      // Re-bake textures if in texture preview mode
      if (state.showTexturePreview) {
        await loadBakedTextures();
        await updateMainMesh();
      }
    }
  });

  elements.nextBtn.addEventListener('click', async () => {
    state.currentSeed++;
    elements.currentSeed.value = String(state.currentSeed);
    await executeCommands(['measurement.reset-all']);
    await runCurrentSeed();
    // Re-bake textures if in texture preview mode
    if (state.showTexturePreview) {
      await loadBakedTextures();
      await updateMainMesh();
    }
  });

  elements.randomBtn.addEventListener('click', async () => {
    state.currentSeed = Math.floor(Math.random() * 100000) + 1;
    elements.currentSeed.value = String(state.currentSeed);
    await executeCommands(['measurement.reset-all']);
    await runCurrentSeed();
    // Re-bake textures if in texture preview mode
    if (state.showTexturePreview) {
      await loadBakedTextures();
      await updateMainMesh();
    }
  });

  // Handle window resize
  window.addEventListener('resize', resizeMainCell);

  // C4-002: Keyboard shortcut 'u' to toggle UV preview mode
  window.addEventListener('keydown', async (e) => {
    if (e.key === 'u' || e.key === 'U') {
      state.showUVPreview = !state.showUVPreview;
      state.showWeightPreview = false;  // Mutually exclusive with weight preview
      state.showTexturePreview = false;  // Mutually exclusive with texture preview
      log(`UV Preview: ${state.showUVPreview ? 'ON' : 'OFF'}`, 'info');
      // Re-render current view
      await runCurrentSeed();
    }
    // E2-002: Keyboard shortcut 'w' to toggle weight visualization mode
    else if (e.key === 'w' || e.key === 'W') {
      state.showWeightPreview = !state.showWeightPreview;
      state.showUVPreview = false;  // Mutually exclusive with UV preview
      state.showTexturePreview = false;  // Mutually exclusive with texture preview
      if (state.showWeightPreview) {
        log(`Weight Preview: ON (click joint name in panel to select)`, 'info');
        // Try to select first joint if none selected
        if (!state.selectedJoint) {
          await selectFirstJoint();
        }
      } else {
        log(`Weight Preview: OFF`, 'info');
        state.selectedJoint = null;
      }
      // Re-render current view
      await runCurrentSeed();
    }
    // E3-002: Keyboard shortcut 'm' to toggle morph target preview mode
    else if (e.key === 'm' || e.key === 'M') {
      state.showMorphPreview = !state.showMorphPreview;
      if (state.showMorphPreview) {
        log(`Morph Preview: ON (use sliders in panel to blend)`, 'info');
        // Load morph targets if not already loaded
        await loadMorphTargets();
      } else {
        log(`Morph Preview: OFF`, 'info');
        // Reset weights to defaults
        for (const target of state.availableMorphTargets) {
          state.morphTargetWeights[target.name] = target.defaultWeight;
        }
      }
      // Re-render current view with morph targets applied
      await runCurrentSeed();
      // Update detail panel to show/hide morph UI
      updateDetailPanel();
    }
    // G6-003: Keyboard shortcut 't' to toggle texture preview mode
    else if (e.key === 't' || e.key === 'T') {
      state.showTexturePreview = !state.showTexturePreview;
      state.showUVPreview = false;  // Mutually exclusive
      state.showWeightPreview = false;  // Mutually exclusive
      if (state.showTexturePreview) {
        log(`Texture Preview: ON (baking textures...)`, 'info');
        // Bake textures for current mesh (don't re-run builder!)
        await loadBakedTextures();
        // Just update the mesh display with textures (don't rebuild)
        await updateMainMesh();
      } else {
        log(`Texture Preview: OFF`, 'info');
        state.availableTextures = null; state.perMaterialTextures = null;
        // Re-render without textures
        await updateMainMesh();
      }
    }
  });
}

// Decision override functions (exposed globally for HTML onclick handlers)
async function overrideDecision(key: string, value: any) {
  if (!state.activeBuilder) return;

  try {
    log(`Overriding decision ${key} = ${value}`);
    const overrideResult = await executeCommands([`decision.override ${key} ${value}`]);
    log(`Override result: ${JSON.stringify(overrideResult.results?.[0]?.data)}`);

    await runCurrentSeed();  // Re-run with override
  } catch (err) {
    log(`Failed to override decision: ${err}`, 'error');
  }
}

async function toggleDecision(key: string, value: boolean) {
  // Send boolean as string "true" or "false" (not 1/0)
  await overrideDecision(key, value ? 'true' : 'false');
}

async function resetDecision(key: string) {
  if (!state.activeBuilder) return;

  try {
    log(`Resetting decision ${key}`);
    await executeCommands([`decision.reset ${key}`]);
    await runCurrentSeed();  // Re-run without override
  } catch (err) {
    log(`Failed to reset decision: ${err}`, 'error');
  }
}

async function resetAllDecisions() {
  if (!state.activeBuilder) return;

  try {
    log('Resetting all decisions');
    await executeCommands(['decision.reset-all']);
    await runCurrentSeed();  // Re-run without overrides
  } catch (err) {
    log(`Failed to reset all decisions: ${err}`, 'error');
  }
}

// Expose to window for HTML onclick handlers
(window as any).overrideDecision = overrideDecision;
(window as any).toggleDecision = toggleDecision;
(window as any).resetDecision = resetDecision;
(window as any).resetAllDecisions = resetAllDecisions;
(window as any).selectJointForWeights = selectJointForWeights;  // E2-002

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


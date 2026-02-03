/**
 * Texture Baker (G6-001)
 *
 * Bakes procedural materials to PBR texture images.
 * Takes mesh with UVs, material stack, and resolution to produce
 * albedo, normal, roughness, metallic, and AO texture maps.
 */

import { Mesh } from '../geometry/Mesh';
import { Vertex } from '../geometry/Vertex';
import { Face } from '../geometry/Face';
import { createMaterialStack, MaterialStackDefinition } from './MaterialStack';
import { analyzeMesh, remapAnalysis } from './MeshAnalysis';
import type { MeshAnalysis } from './MeshAnalysis';
import { EvaluationContext, Color } from './TextureGenerator';
import { Vec3 } from '../math/Vec3';

// Import generators to ensure they're registered
import './generators/WoodGrainGenerator';
import './generators/StoneGenerator';
import './generators/MetalBrushedGenerator';
import './generators/NoiseColorGenerator';
import './generators/WearGenerator';

/**
 * Texture channels that can be baked
 */
export type TextureChannel = 'albedo' | 'normal' | 'roughness' | 'metallic' | 'ao' | 'height';

/**
 * Bake options
 */
export interface BakeOptions {
  /** Texture resolution (width and height) */
  resolution?: number;
  /** Which channels to bake */
  channels?: TextureChannel[];
  /** Output format */
  format?: 'png' | 'jpeg';
  /** Random seed for determinism */
  seed?: number;
  /** Margin for UV island bleeding (pixels) */
  margin?: number;
  /** Super-sampling factor for anti-aliasing */
  superSample?: number;
  /** Pre-computed mesh analysis — avoids redundant analyzeMesh() calls.
   *  When provided, this analysis is used directly instead of re-analyzing.
   *  For sub-meshes, pass a remapped analysis via remapAnalysis(). */
  cachedAnalysis?: MeshAnalysis;
}

/**
 * Result of texture baking
 */
export interface BakeResult {
  /** Resolution used */
  resolution: number;
  /** Baked texture buffers (RGBA for albedo/normal, grayscale for others) */
  textures: Map<TextureChannel, Uint8Array>;
  /** Time taken to bake (ms) */
  bakeTimeMs: number;
  /** Statistics */
  stats: {
    pixelsBaked: number;
    pixelsEmpty: number;
    coverage: number;
  };
}

/**
 * UV-to-pixel mapping for a face
 */
interface UVTriangle {
  /** Vertex indices */
  indices: [number, number, number];
  /** UV coordinates */
  uvs: [[number, number], [number, number], [number, number]];
  /** World positions for analysis */
  positions: [Vec3, Vec3, Vec3];
  /** Face index */
  faceIndex: number;
  /** Material slot index for per-face materials */
  materialSlotIndex: number;
}

/**
 * Extract UV triangles from mesh
 */
function extractUVTriangles(mesh: Mesh): UVTriangle[] {
  const triangles: UVTriangle[] = [];

  for (let fi = 0; fi < mesh.faces.length; fi++) {
    const face = mesh.faces[fi];
    if (face.indices.length < 3) continue;

    // Triangulate face
    for (let i = 1; i < face.indices.length - 1; i++) {
      const i0 = face.indices[0];
      const i1 = face.indices[i];
      const i2 = face.indices[i + 1];

      const v0 = mesh.vertices[i0];
      const v1 = mesh.vertices[i1];
      const v2 = mesh.vertices[i2];

      const uv0 = v0.attributes.uv ?? [0, 0];
      const uv1 = v1.attributes.uv ?? [0, 0];
      const uv2 = v2.attributes.uv ?? [0, 0];

      triangles.push({
        indices: [i0, i1, i2],
        uvs: [uv0 as [number, number], uv1 as [number, number], uv2 as [number, number]],
        positions: [v0.position, v1.position, v2.position],
        faceIndex: fi,
        materialSlotIndex: face.materialSlotIndex ?? 0
      });
    }
  }

  return triangles;
}

/**
 * Calculate barycentric coordinates for a point in a triangle
 */
function barycentric(
  px: number, py: number,
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number
): [number, number, number] | null {
  // Use the standard barycentric coordinate formula that handles any winding
  const denom = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);

  // Check for degenerate triangle (all points collinear)
  if (Math.abs(denom) < 1e-10) return null;

  const a = ((y1 - y2) * (px - x2) + (x2 - x1) * (py - y2)) / denom;
  const b = ((y2 - y0) * (px - x2) + (x0 - x2) * (py - y2)) / denom;
  const c = 1 - a - b;

  // Check if point is inside triangle (with small tolerance for edge cases)
  if (a >= -0.001 && b >= -0.001 && c >= -0.001) {
    return [a, b, c];
  }
  return null;
}

/**
 * Interpolate Vec3 using barycentric coordinates
 */
function interpolateVec3(v0: Vec3, v1: Vec3, v2: Vec3, bary: [number, number, number]): Vec3 {
  return new Vec3(
    v0.x * bary[0] + v1.x * bary[1] + v2.x * bary[2],
    v0.y * bary[0] + v1.y * bary[1] + v2.y * bary[2],
    v0.z * bary[0] + v1.z * bary[1] + v2.z * bary[2]
  );
}

/**
 * Interpolate scalar using barycentric coordinates
 */
function interpolateScalar(v0: number, v1: number, v2: number, bary: [number, number, number]): number {
  return v0 * bary[0] + v1 * bary[1] + v2 * bary[2];
}

// NOTE: Tangent-space normal computation code was removed.
// It caused visual artifacts and was reverted to flat normals.
// The code is preserved in git history if needed for future implementation.

/**
 * Dilate texture to fill margins around UV islands
 * This prevents black bleeding at texture seams
 * Uses nearest-neighbor (not averaging) to prevent color blending between islands
 */
function dilateTexture(buffer: Uint8Array, resolution: number, channels: number, iterations: number = 4): void {
  const totalPixels = resolution * resolution;

  // Create a mask of which pixels are filled (alpha > 0 for RGBA)
  const filled = new Uint8Array(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    if (channels === 4) {
      filled[i] = buffer[i * 4 + 3] > 0 ? 1 : 0;
    } else {
      filled[i] = 1;
    }
  }

  // For RGBA textures only (albedo, normal), do dilation
  if (channels !== 4) return;

  for (let iter = 0; iter < iterations; iter++) {
    const newFilled = new Uint8Array(filled);

    for (let y = 0; y < resolution; y++) {
      for (let x = 0; x < resolution; x++) {
        const idx = y * resolution + x;
        if (filled[idx]) continue; // Already filled

        // Find first filled neighbor (nearest-neighbor, not averaging)
        const neighbors = [
          [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]
        ];

        for (const [nx, ny] of neighbors) {
          if (nx < 0 || nx >= resolution || ny < 0 || ny >= resolution) continue;
          const nIdx = ny * resolution + nx;
          if (filled[nIdx]) {
            // Copy color from this neighbor (nearest-neighbor)
            buffer[idx * 4] = buffer[nIdx * 4];
            buffer[idx * 4 + 1] = buffer[nIdx * 4 + 1];
            buffer[idx * 4 + 2] = buffer[nIdx * 4 + 2];
            buffer[idx * 4 + 3] = buffer[nIdx * 4 + 3];
            newFilled[idx] = 1;
            break; // Use first neighbor found
          }
        }
      }
    }

    filled.set(newFilled);
  }
}

/**
 * Dilate grayscale texture with a baked mask
 * Uses nearest-neighbor (not averaging) to prevent blending between islands
 */
function dilateGrayscaleTexture(
  buffer: Uint8Array,
  bakedMask: Uint8Array,
  resolution: number,
  defaultValue: number,
  iterations: number = 4
): void {
  const filled = new Uint8Array(bakedMask);

  for (let iter = 0; iter < iterations; iter++) {
    const newFilled = new Uint8Array(filled);

    for (let y = 0; y < resolution; y++) {
      for (let x = 0; x < resolution; x++) {
        const idx = y * resolution + x;
        if (filled[idx]) continue;

        const neighbors = [
          [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]
        ];

        let found = false;
        for (const [nx, ny] of neighbors) {
          if (nx < 0 || nx >= resolution || ny < 0 || ny >= resolution) continue;
          const nIdx = ny * resolution + nx;
          if (filled[nIdx]) {
            // Copy from first filled neighbor (nearest-neighbor)
            buffer[idx] = buffer[nIdx];
            newFilled[idx] = 1;
            found = true;
            break;
          }
        }

        if (!found) {
          buffer[idx] = defaultValue;
        }
      }
    }

    filled.set(newFilled);
  }
}

/**
 * Convert color to RGBA bytes
 */
function colorToRGBA(color: Color, alpha: number = 255): [number, number, number, number] {
  return [
    Math.round(Math.max(0, Math.min(255, color.r * 255))),
    Math.round(Math.max(0, Math.min(255, color.g * 255))),
    Math.round(Math.max(0, Math.min(255, color.b * 255))),
    alpha
  ];
}


/**
 * Convert scalar to grayscale byte
 */
function scalarToByte(value: number): number {
  return Math.round(Math.max(0, Math.min(255, value * 255)));
}

/**
 * Bake textures from a mesh and material stack
 */
export function bakeTextures(
  mesh: Mesh,
  materialDef: MaterialStackDefinition,
  options: BakeOptions = {}
): BakeResult {
  const startTime = Date.now();

  const {
    resolution = 1024,
    channels = ['albedo', 'normal', 'roughness', 'metallic', 'ao'],
    seed = 42
  } = options;

  // Create material stack
  const materialStack = createMaterialStack(materialDef);

  // Use cached analysis if provided, otherwise compute fresh
  let analysis: MeshAnalysis;
  if (options.cachedAnalysis) {
    analysis = options.cachedAnalysis;
  } else {
    // Fast-path: skip expensive AO for large meshes (>5000 vertices)
    // AO computation is O(V × aoRays × F) which is prohibitive for complex meshes
    const shouldSkipAO = mesh.vertices.length > 5000;
    analysis = analyzeMesh(mesh, {
      aoRays: shouldSkipAO ? 0 : 16,
      aoSeed: seed,
      computeAO: !shouldSkipAO,
      computeCurvature: !shouldSkipAO,
      writeNormalsToMesh: true  // Store normals on vertices for GLTFExporter
    });
  }

  // Extract UV triangles
  const triangles = extractUVTriangles(mesh);

  // Create output buffers
  const textures = new Map<TextureChannel, Uint8Array>();
  const pixelCount = resolution * resolution;

  // Mask to track which pixels were actually baked (for dilation)
  const bakedMask = new Uint8Array(pixelCount);

  if (channels.includes('albedo')) {
    textures.set('albedo', new Uint8Array(pixelCount * 4));
  }
  if (channels.includes('normal')) {
    textures.set('normal', new Uint8Array(pixelCount * 4));
    // Initialize to flat normal (128, 128, 255)
    const normalBuf = textures.get('normal')!;
    for (let i = 0; i < pixelCount; i++) {
      normalBuf[i * 4] = 128;
      normalBuf[i * 4 + 1] = 128;
      normalBuf[i * 4 + 2] = 255;
      normalBuf[i * 4 + 3] = 255;
    }
  }
  if (channels.includes('roughness')) {
    textures.set('roughness', new Uint8Array(pixelCount));
  }
  if (channels.includes('metallic')) {
    textures.set('metallic', new Uint8Array(pixelCount));
  }
  if (channels.includes('ao')) {
    textures.set('ao', new Uint8Array(pixelCount));
    // Initialize to white (no occlusion)
    textures.get('ao')!.fill(255);
  }
  if (channels.includes('height')) {
    textures.set('height', new Uint8Array(pixelCount));
    textures.get('height')!.fill(128); // Mid-gray = zero height
  }

  // Bake by iterating triangles and rasterizing each one
  // This ensures every triangle gets baked, even small ones
  let pixelsBaked = 0;

  for (const tri of triangles) {
    // Get triangle UV bounds
    const uv0 = tri.uvs[0], uv1 = tri.uvs[1], uv2 = tri.uvs[2];

    // Convert to pixel coordinates
    const px0 = uv0[0] * resolution, py0 = uv0[1] * resolution;
    const px1 = uv1[0] * resolution, py1 = uv1[1] * resolution;
    const px2 = uv2[0] * resolution, py2 = uv2[1] * resolution;

    // Bounding box in pixel space
    const minPx = Math.max(0, Math.floor(Math.min(px0, px1, px2)));
    const maxPx = Math.min(resolution - 1, Math.ceil(Math.max(px0, px1, px2)));
    const minPy = Math.max(0, Math.floor(Math.min(py0, py1, py2)));
    const maxPy = Math.min(resolution - 1, Math.ceil(Math.max(py0, py1, py2)));

    // Get analysis data for triangle vertices
    const a0 = analysis.vertices[tri.indices[0]];
    const a1 = analysis.vertices[tri.indices[1]];
    const a2 = analysis.vertices[tri.indices[2]];

    // Rasterize this triangle
    for (let py = minPy; py <= maxPy; py++) {
      for (let px = minPx; px <= maxPx; px++) {
        // Pixel center in UV space
        const u = (px + 0.5) / resolution;
        const v = (py + 0.5) / resolution;

        // Check if pixel is inside triangle using barycentric coordinates
        const bary = barycentric(
          u, v,
          uv0[0], uv0[1],
          uv1[0], uv1[1],
          uv2[0], uv2[1]
        );

        if (!bary) continue;

        const pixelIndex = py * resolution + px;

        // Skip if already baked (another triangle might have covered this pixel)
        if (bakedMask[pixelIndex]) continue;

        pixelsBaked++;
        bakedMask[pixelIndex] = 1;

        // Interpolate world position
        const worldPos = interpolateVec3(
          tri.positions[0],
          tri.positions[1],
          tri.positions[2],
          bary
        );

        const curvature = interpolateScalar(
          a0?.curvature ?? 0,
          a1?.curvature ?? 0,
          a2?.curvature ?? 0,
          bary
        );

        const ao = interpolateScalar(
          a0?.ambientOcclusion ?? 1,
          a1?.ambientOcclusion ?? 1,
          a2?.ambientOcclusion ?? 1,
          bary
        );

        // Create evaluation context
        const ctx: EvaluationContext = {
          u, v,
          worldPos,
          curvature,
          ao
        };

        // Evaluate material stack
        const result = materialStack.evaluate(ctx, seed);

        if (textures.has('albedo')) {
          const buf = textures.get('albedo')!;
          const rgba = colorToRGBA(result.albedo);
          buf[pixelIndex * 4] = rgba[0];
          buf[pixelIndex * 4 + 1] = rgba[1];
          buf[pixelIndex * 4 + 2] = rgba[2];
          buf[pixelIndex * 4 + 3] = rgba[3];
        }

        if (textures.has('normal')) {
          const buf = textures.get('normal')!;
          // Use flat normal (tangent-space neutral) - this works reliably
          // Smooth normal interpolation caused visual artifacts
          buf[pixelIndex * 4] = 128;
          buf[pixelIndex * 4 + 1] = 128;
          buf[pixelIndex * 4 + 2] = 255;
          buf[pixelIndex * 4 + 3] = 255;
        }

        if (textures.has('roughness')) {
          textures.get('roughness')![pixelIndex] = scalarToByte(result.roughness);
        }

        if (textures.has('metallic')) {
          textures.get('metallic')![pixelIndex] = scalarToByte(result.metallic);
        }

        if (textures.has('ao')) {
          textures.get('ao')![pixelIndex] = scalarToByte(ao);
        }

        if (textures.has('height')) {
          // Height: -1 to 1 mapped to 0-255
          textures.get('height')![pixelIndex] = scalarToByte((result.height + 1) * 0.5);
        }
      }
    }
  }

  // Calculate empty pixels for stats
  const pixelsEmpty = pixelCount - pixelsBaked;

  // Dilate textures to fill margins
  // Use minimal iterations - just enough to prevent black seams (2-4 pixels)
  // Too many iterations causes blurring between adjacent UV islands
  const dilationIterations = Math.min(4, Math.max(2, Math.ceil(resolution * 0.01)));

  for (const channel of channels) {
    const buffer = textures.get(channel);
    if (!buffer) continue;

    const isGrayscale = channel === 'roughness' || channel === 'metallic' || channel === 'ao' || channel === 'height';

    if (isGrayscale) {
      // For grayscale textures, use the bakedMask
      const defaultVal = channel === 'ao' ? 255 : channel === 'height' ? 128 : 0;
      dilateGrayscaleTexture(buffer, bakedMask, resolution, defaultVal, dilationIterations);
    } else {
      // For RGBA textures, dilate normally
      dilateTexture(buffer, resolution, 4, dilationIterations);
    }
  }

  const bakeTimeMs = Date.now() - startTime;

  return {
    resolution,
    textures,
    bakeTimeMs,
    stats: {
      pixelsBaked,
      pixelsEmpty,
      coverage: pixelsBaked / pixelCount
    }
  };
}

/**
 * Bake textures from a mesh with multiple materials.
 * Each face can have a different material slot, and this function
 * will use the appropriate material definition for each face.
 *
 * @param mesh - Mesh with UVs and per-face materialSlotIndex
 * @param materialDefs - Map from slot index to material definition
 * @param options - Bake options
 */
export function bakeTexturesMultiMaterial(
  mesh: Mesh,
  materialDefs: Map<number, MaterialStackDefinition>,
  options: BakeOptions = {}
): BakeResult {
  const startTime = Date.now();

  const {
    resolution = 1024,
    channels = ['albedo', 'normal', 'roughness', 'metallic', 'ao'],
    seed = 42
  } = options;

  // Create material stacks for each slot
  const materialStacks = new Map<number, ReturnType<typeof createMaterialStack>>();
  for (const [slotIndex, def] of materialDefs) {
    materialStacks.set(slotIndex, createMaterialStack(def));
  }

  // Fallback: if slot 0 doesn't exist, create a default wood material
  if (!materialStacks.has(0) && materialStacks.size > 0) {
    // Use first available material as fallback
    const firstMaterial = materialStacks.values().next().value;
    if (firstMaterial) {
      materialStacks.set(-1, firstMaterial); // -1 = fallback
    }
  }

  // Fast-path: skip expensive AO for large meshes (>5000 vertices)
  const shouldSkipAO = mesh.vertices.length > 5000;
  const analysis = analyzeMesh(mesh, {
    aoRays: shouldSkipAO ? 0 : 16,
    aoSeed: seed,
    computeAO: !shouldSkipAO,
    computeCurvature: !shouldSkipAO
  });

  // Extract UV triangles (now includes materialSlotIndex)
  const triangles = extractUVTriangles(mesh);

  // Create output buffers
  const textures = new Map<TextureChannel, Uint8Array>();
  const pixelCount = resolution * resolution;
  const bakedMask = new Uint8Array(pixelCount);

  if (channels.includes('albedo')) {
    textures.set('albedo', new Uint8Array(pixelCount * 4));
  }
  if (channels.includes('normal')) {
    textures.set('normal', new Uint8Array(pixelCount * 4));
    const normalBuf = textures.get('normal')!;
    for (let i = 0; i < pixelCount; i++) {
      normalBuf[i * 4] = 128;
      normalBuf[i * 4 + 1] = 128;
      normalBuf[i * 4 + 2] = 255;
      normalBuf[i * 4 + 3] = 255;
    }
  }
  if (channels.includes('roughness')) {
    textures.set('roughness', new Uint8Array(pixelCount));
  }
  if (channels.includes('metallic')) {
    textures.set('metallic', new Uint8Array(pixelCount));
  }
  if (channels.includes('ao')) {
    textures.set('ao', new Uint8Array(pixelCount));
    textures.get('ao')!.fill(255);
  }
  if (channels.includes('height')) {
    textures.set('height', new Uint8Array(pixelCount));
    textures.get('height')!.fill(128);
  }

  let pixelsBaked = 0;

  for (const tri of triangles) {
    // Get the material stack for this triangle's slot
    const materialStack = materialStacks.get(tri.materialSlotIndex)
      ?? materialStacks.get(-1)
      ?? materialStacks.values().next().value;

    if (!materialStack) continue; // No material available

    const uv0 = tri.uvs[0], uv1 = tri.uvs[1], uv2 = tri.uvs[2];
    const px0 = uv0[0] * resolution, py0 = uv0[1] * resolution;
    const px1 = uv1[0] * resolution, py1 = uv1[1] * resolution;
    const px2 = uv2[0] * resolution, py2 = uv2[1] * resolution;

    const minPx = Math.max(0, Math.floor(Math.min(px0, px1, px2)));
    const maxPx = Math.min(resolution - 1, Math.ceil(Math.max(px0, px1, px2)));
    const minPy = Math.max(0, Math.floor(Math.min(py0, py1, py2)));
    const maxPy = Math.min(resolution - 1, Math.ceil(Math.max(py0, py1, py2)));

    const a0 = analysis.vertices[tri.indices[0]];
    const a1 = analysis.vertices[tri.indices[1]];
    const a2 = analysis.vertices[tri.indices[2]];

    for (let py = minPy; py <= maxPy; py++) {
      for (let px = minPx; px <= maxPx; px++) {
        const u = (px + 0.5) / resolution;
        const v = (py + 0.5) / resolution;

        const bary = barycentric(
          u, v,
          uv0[0], uv0[1],
          uv1[0], uv1[1],
          uv2[0], uv2[1]
        );

        if (!bary) continue;

        const pixelIndex = py * resolution + px;
        if (bakedMask[pixelIndex]) continue;

        pixelsBaked++;
        bakedMask[pixelIndex] = 1;

        const worldPos = interpolateVec3(
          tri.positions[0], tri.positions[1], tri.positions[2], bary
        );

        const curvature = interpolateScalar(
          a0?.curvature ?? 0, a1?.curvature ?? 0, a2?.curvature ?? 0, bary
        );

        const ao = interpolateScalar(
          a0?.ambientOcclusion ?? 1, a1?.ambientOcclusion ?? 1, a2?.ambientOcclusion ?? 1, bary
        );

        const ctx: EvaluationContext = { u, v, worldPos, curvature, ao };
        const result = materialStack.evaluate(ctx, seed);

        if (textures.has('albedo')) {
          const buf = textures.get('albedo')!;
          const rgba = colorToRGBA(result.albedo);
          buf[pixelIndex * 4] = rgba[0];
          buf[pixelIndex * 4 + 1] = rgba[1];
          buf[pixelIndex * 4 + 2] = rgba[2];
          buf[pixelIndex * 4 + 3] = rgba[3];
        }

        if (textures.has('normal')) {
          const buf = textures.get('normal')!;
          // Use flat normal (tangent-space neutral) - this works reliably
          buf[pixelIndex * 4] = 128;
          buf[pixelIndex * 4 + 1] = 128;
          buf[pixelIndex * 4 + 2] = 255;
          buf[pixelIndex * 4 + 3] = 255;
        }

        if (textures.has('roughness')) {
          textures.get('roughness')![pixelIndex] = scalarToByte(result.roughness);
        }

        if (textures.has('metallic')) {
          textures.get('metallic')![pixelIndex] = scalarToByte(result.metallic);
        }

        if (textures.has('ao')) {
          textures.get('ao')![pixelIndex] = scalarToByte(ao);
        }

        if (textures.has('height')) {
          textures.get('height')![pixelIndex] = scalarToByte((result.height + 1) * 0.5);
        }
      }
    }
  }

  const pixelsEmpty = pixelCount - pixelsBaked;
  const dilationIterations = Math.min(4, Math.max(2, Math.ceil(resolution * 0.01)));

  for (const channel of channels) {
    const buffer = textures.get(channel);
    if (!buffer) continue;

    const isGrayscale = channel === 'roughness' || channel === 'metallic' || channel === 'ao' || channel === 'height';

    if (isGrayscale) {
      const defaultVal = channel === 'ao' ? 255 : channel === 'height' ? 128 : 0;
      dilateGrayscaleTexture(buffer, bakedMask, resolution, defaultVal, dilationIterations);
    } else {
      dilateTexture(buffer, resolution, 4, dilationIterations);
    }
  }

  const bakeTimeMs = Date.now() - startTime;

  return {
    resolution,
    textures,
    bakeTimeMs,
    stats: {
      pixelsBaked,
      pixelsEmpty,
      coverage: pixelsBaked / pixelCount
    }
  };
}

/**
 * Generate a UV debug texture that visualizes the UV triangles
 * Each triangle gets a unique color, edges are drawn in white
 * This helps debug UV mapping issues by comparing with baked textures
 */
export function generateUVDebugTexture(mesh: Mesh, resolution: number = 512): {
  buffer: Uint8Array;
  triangleCount: number;
  stats: {
    totalArea: number;
    degenerateCount: number;
    minArea: number;
    maxArea: number;
  };
} {
  const triangles = extractUVTriangles(mesh);
  const buffer = new Uint8Array(resolution * resolution * 4);

  // Fill with dark gray background
  for (let i = 0; i < resolution * resolution; i++) {
    buffer[i * 4] = 32;
    buffer[i * 4 + 1] = 32;
    buffer[i * 4 + 2] = 32;
    buffer[i * 4 + 3] = 255;
  }

  // Statistics
  let totalArea = 0;
  let degenerateCount = 0;
  let minArea = Infinity;
  let maxArea = 0;

  // Generate distinct colors for each triangle using golden ratio
  const goldenRatio = 0.618033988749895;

  // Draw filled triangles
  for (let ti = 0; ti < triangles.length; ti++) {
    const tri = triangles[ti];

    // Calculate UV triangle area
    const uv0 = tri.uvs[0], uv1 = tri.uvs[1], uv2 = tri.uvs[2];
    const area = Math.abs(
      (uv1[0] - uv0[0]) * (uv2[1] - uv0[1]) -
      (uv2[0] - uv0[0]) * (uv1[1] - uv0[1])
    ) * 0.5;

    totalArea += area;
    if (area < 0.0001) {
      degenerateCount++;
    }
    minArea = Math.min(minArea, area);
    maxArea = Math.max(maxArea, area);

    // Generate color using golden ratio for good distribution
    const hue = (ti * goldenRatio) % 1;
    const [r, g, b] = hsvToRgb(hue, 0.7, 0.9);

    // Rasterize triangle using scanline
    rasterizeTriangle(buffer, resolution, tri.uvs, r, g, b);
  }

  // Draw triangle edges in white for visibility
  for (const tri of triangles) {
    drawLine(buffer, resolution, tri.uvs[0], tri.uvs[1], 255, 255, 255);
    drawLine(buffer, resolution, tri.uvs[1], tri.uvs[2], 255, 255, 255);
    drawLine(buffer, resolution, tri.uvs[2], tri.uvs[0], 255, 255, 255);
  }

  // Draw UV coordinate markers at corners
  drawMarker(buffer, resolution, 0, 0, 255, 0, 0); // Red at (0,0)
  drawMarker(buffer, resolution, 1, 0, 0, 255, 0); // Green at (1,0)
  drawMarker(buffer, resolution, 0, 1, 0, 0, 255); // Blue at (0,1)
  drawMarker(buffer, resolution, 1, 1, 255, 255, 0); // Yellow at (1,1)

  return {
    buffer,
    triangleCount: triangles.length,
    stats: {
      totalArea,
      degenerateCount,
      minArea: minArea === Infinity ? 0 : minArea,
      maxArea
    }
  };
}

/**
 * Convert HSV to RGB (h in [0,1], s in [0,1], v in [0,1])
 */
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  let r: number, g: number, b: number;
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    default: r = v; g = p; b = q; break;
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/**
 * Rasterize a UV triangle into the buffer
 */
function rasterizeTriangle(
  buffer: Uint8Array,
  resolution: number,
  uvs: [[number, number], [number, number], [number, number]],
  r: number, g: number, b: number
): void {
  // Convert UV to pixel coordinates
  const px0 = Math.round(uvs[0][0] * (resolution - 1));
  const py0 = Math.round(uvs[0][1] * (resolution - 1));
  const px1 = Math.round(uvs[1][0] * (resolution - 1));
  const py1 = Math.round(uvs[1][1] * (resolution - 1));
  const px2 = Math.round(uvs[2][0] * (resolution - 1));
  const py2 = Math.round(uvs[2][1] * (resolution - 1));

  // Bounding box
  const minX = Math.max(0, Math.min(px0, px1, px2));
  const maxX = Math.min(resolution - 1, Math.max(px0, px1, px2));
  const minY = Math.max(0, Math.min(py0, py1, py2));
  const maxY = Math.min(resolution - 1, Math.max(py0, py1, py2));

  // Scanline rasterization
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (pointInTriangle(x, y, px0, py0, px1, py1, px2, py2)) {
        const idx = (y * resolution + x) * 4;
        buffer[idx] = r;
        buffer[idx + 1] = g;
        buffer[idx + 2] = b;
        buffer[idx + 3] = 255;
      }
    }
  }
}

/**
 * Check if point is inside triangle using barycentric coordinates
 */
function pointInTriangle(
  px: number, py: number,
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number
): boolean {
  const denom = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
  if (Math.abs(denom) < 0.0001) return false;

  const a = ((y1 - y2) * (px - x2) + (x2 - x1) * (py - y2)) / denom;
  const b = ((y2 - y0) * (px - x2) + (x0 - x2) * (py - y2)) / denom;
  const c = 1 - a - b;

  return a >= -0.001 && b >= -0.001 && c >= -0.001;
}

/**
 * Draw a line using Bresenham's algorithm
 */
function drawLine(
  buffer: Uint8Array,
  resolution: number,
  uv0: [number, number],
  uv1: [number, number],
  r: number, g: number, b: number
): void {
  let x0 = Math.round(uv0[0] * (resolution - 1));
  let y0 = Math.round(uv0[1] * (resolution - 1));
  const x1 = Math.round(uv1[0] * (resolution - 1));
  const y1 = Math.round(uv1[1] * (resolution - 1));

  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    if (x0 >= 0 && x0 < resolution && y0 >= 0 && y0 < resolution) {
      const idx = (y0 * resolution + x0) * 4;
      buffer[idx] = r;
      buffer[idx + 1] = g;
      buffer[idx + 2] = b;
      buffer[idx + 3] = 255;
    }

    if (x0 === x1 && y0 === y1) break;

    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
}

/**
 * Draw a marker (small cross) at UV coordinate
 */
function drawMarker(
  buffer: Uint8Array,
  resolution: number,
  u: number, v: number,
  r: number, g: number, b: number
): void {
  const px = Math.round(u * (resolution - 1));
  const py = Math.round(v * (resolution - 1));
  const size = 5;

  for (let i = -size; i <= size; i++) {
    // Horizontal
    const hx = px + i;
    if (hx >= 0 && hx < resolution && py >= 0 && py < resolution) {
      const idx = (py * resolution + hx) * 4;
      buffer[idx] = r;
      buffer[idx + 1] = g;
      buffer[idx + 2] = b;
      buffer[idx + 3] = 255;
    }
    // Vertical
    const vy = py + i;
    if (px >= 0 && px < resolution && vy >= 0 && vy < resolution) {
      const idx = (vy * resolution + px) * 4;
      buffer[idx] = r;
      buffer[idx + 1] = g;
      buffer[idx + 2] = b;
      buffer[idx + 3] = 255;
    }
  }
}

/**
 * Result of per-material texture baking
 */
export interface PerMaterialBakeResult {
  /** Results per material slot index */
  materials: Map<number, {
    /** Material slot name */
    name: string;
    /** Number of triangles using this material */
    triangleCount: number;
    /** Bake result (textures, stats) */
    bakeResult: BakeResult;
    /** Whether this is a solid color (1x1 texture optimization) */
    isSolidColor: boolean;
    /**
     * UV bounds of this slot's triangles in the shared atlas (pre-normalization).
     * The baker normalised these to [0,1] before baking, so the dashboard must
     * apply the same transform when sampling the baked texture:
     *   u_baked = (u_atlas - uMin) / (uMax - uMin)
     *   v_baked = (v_atlas - vMin) / (vMax - vMin)
     * Undefined for solid-color slots (UV doesn't matter for 1×1 textures).
     */
    uvBounds?: { uMin: number; uMax: number; vMin: number; vMax: number };
  }>;
  /** Total bake time (ms) */
  totalBakeTimeMs: number;
  /** Statistics */
  stats: {
    materialCount: number;
    totalTriangles: number;
    solidColorMaterials: number;
    texturedMaterials: number;
  };
}

/**
 * Bake textures separately for each material slot.
 *
 * This solves the UV atlas problem for multi-material meshes like ChessBoard:
 * - Each material gets its own UV space [0,1] × [0,1]
 * - Solid color materials get 1×1 textures (huge optimization)
 * - Textured materials get full resolution
 *
 * @param mesh - Mesh with per-face materialSlotIndex
 * @param materialDefs - Map from slot index to material definition
 * @param options - Bake options
 */
export function bakeTexturesPerMaterial(
  mesh: Mesh,
  materialDefs: Map<number, MaterialStackDefinition>,
  options: BakeOptions = {}
): PerMaterialBakeResult {
  const startTime = Date.now();

  const {
    resolution = 512,
    channels = ['albedo', 'normal', 'roughness', 'metallic', 'ao'],
    seed = 42
  } = options;

  // Extract UV triangles and group by material slot
  const allTriangles = extractUVTriangles(mesh);
  const trianglesByMaterial = new Map<number, typeof allTriangles>();

  for (const tri of allTriangles) {
    const slot = tri.materialSlotIndex;
    if (!trianglesByMaterial.has(slot)) {
      trianglesByMaterial.set(slot, []);
    }
    trianglesByMaterial.get(slot)!.push(tri);
  }

  // Result map
  const materials = new Map<number, {
    name: string;
    triangleCount: number;
    bakeResult: BakeResult;
    isSolidColor: boolean;
    uvBounds?: { uMin: number; uMax: number; vMin: number; vMax: number };
  }>();

  let solidColorCount = 0;
  let texturedCount = 0;

  // Analyze the FULL mesh once — all sub-meshes share this analysis.
  // AO computed on the full mesh is more correct because it sees all geometry
  // for occlusion, not just the subset belonging to one material.
  const hasTexturedMaterials = [...trianglesByMaterial].some(([slotIndex]) => {
    const materialDef = materialDefs.get(slotIndex) ?? { layers: [] };
    return !isSolidColorMaterial(materialDef);
  });

  let fullAnalysis: MeshAnalysis | undefined;
  if (hasTexturedMaterials) {
    const shouldSkipAO = mesh.vertices.length > 5000;
    fullAnalysis = analyzeMesh(mesh, {
      aoRays: shouldSkipAO ? 0 : 16,
      aoSeed: seed,
      computeAO: !shouldSkipAO,
      computeCurvature: !shouldSkipAO,
      // Do NOT write normals back here — the mesh has already had smooth-group-aware
      // normals computed by mesh.calculateNormals() before baking. analyzeMesh computes
      // normals on the triangulated flat mesh (every vertex appears in exactly one face)
      // which produces per-face flat normals and overwrites the correct smooth normals.
      writeNormalsToMesh: false
    });
  }

  // Process each material slot separately
  for (const [slotIndex, triangles] of trianglesByMaterial) {
    const materialDef = materialDefs.get(slotIndex) ?? { layers: [] };
    const materialName = mesh.materialSlots[slotIndex]?.name ?? `material_${slotIndex}`;

    // Check if this is a solid color material (no texture generators)
    const isSolidColor = isSolidColorMaterial(materialDef);

    if (isSolidColor) {
      solidColorCount++;
      // For solid colors, bake a tiny 1x1 texture
      const bakeResult = bakeSolidColorMaterial(materialDef, channels, seed);
      materials.set(slotIndex, {
        name: materialName,
        triangleCount: triangles.length,
        bakeResult,
        isSolidColor: true
      });
    } else {
      texturedCount++;
      // For textured materials, create a sub-mesh and remap the cached analysis
      const { mesh: subMesh, vertexMap } = createSubMeshFromTriangles(mesh, triangles);

      // Normalise sub-mesh UVs to [0,1] for baking.
      // The sub-mesh is a throwaway copy so the original atlas UVs are untouched.
      // We store the pre-normalisation bounds so the dashboard can apply the
      // inverse transform when sampling the resulting texture.
      const uvBounds = normalizeSubMeshUVs(subMesh);

      // Remap the full-mesh analysis to the sub-mesh vertex indices
      const subAnalysis = fullAnalysis
        ? remapAnalysis(fullAnalysis, vertexMap, subMesh.vertices.length)
        : undefined;

      const bakeResult = bakeTextures(subMesh, materialDef, {
        resolution,
        channels,
        seed,
        cachedAnalysis: subAnalysis
      });
      materials.set(slotIndex, {
        name: materialName,
        triangleCount: triangles.length,
        bakeResult,
        isSolidColor: false,
        uvBounds
      });
    }
  }

  const totalBakeTimeMs = Date.now() - startTime;

  return {
    materials,
    totalBakeTimeMs,
    stats: {
      materialCount: materials.size,
      totalTriangles: allTriangles.length,
      solidColorMaterials: solidColorCount,
      texturedMaterials: texturedCount
    }
  };
}

/**
 * Check if a material definition is a solid color (no procedural textures)
 */
function isSolidColorMaterial(def: MaterialStackDefinition): boolean {
  if (!def.layers || def.layers.length === 0) {
    return true; // Empty = solid color
  }

  // Check if all layers are solid_color generator
  for (const layer of def.layers) {
    if (layer.generator !== 'solid_color') {
      return false; // Has a procedural generator
    }
  }
  return true;
}

/**
 * Bake a 1x1 solid color texture
 */
function bakeSolidColorMaterial(
  def: MaterialStackDefinition,
  channels: TextureChannel[],
  seed: number
): BakeResult {
  const materialStack = createMaterialStack(def);
  const ctx: EvaluationContext = {
    u: 0.5,
    v: 0.5,
    worldPos: new Vec3(0, 0, 0),
    curvature: 0,
    ao: 1
  };

  const result = materialStack.evaluate(ctx, seed);
  const textures = new Map<TextureChannel, Uint8Array>();

  if (channels.includes('albedo')) {
    const buf = new Uint8Array(4);
    buf[0] = Math.round(result.albedo.r * 255);
    buf[1] = Math.round(result.albedo.g * 255);
    buf[2] = Math.round(result.albedo.b * 255);
    buf[3] = 255;
    textures.set('albedo', buf);
  }

  if (channels.includes('normal')) {
    // Flat normal for solid color
    const buf = new Uint8Array(4);
    buf[0] = 128; // X = 0
    buf[1] = 128; // Y = 0
    buf[2] = 255; // Z = 1
    buf[3] = 255;
    textures.set('normal', buf);
  }

  if (channels.includes('roughness')) {
    const buf = new Uint8Array(1);
    buf[0] = Math.round(result.roughness * 255);
    textures.set('roughness', buf);
  }

  if (channels.includes('metallic')) {
    const buf = new Uint8Array(1);
    buf[0] = Math.round(result.metallic * 255);
    textures.set('metallic', buf);
  }

  if (channels.includes('ao')) {
    const buf = new Uint8Array(1);
    buf[0] = 255; // No occlusion for solid color
    textures.set('ao', buf);
  }

  if (channels.includes('height')) {
    const buf = new Uint8Array(1);
    buf[0] = 128; // Neutral height
    textures.set('height', buf);
  }

  return {
    resolution: 1,
    textures,
    bakeTimeMs: 0,
    stats: {
      pixelsBaked: 1,
      pixelsEmpty: 0,
      coverage: 1
    }
  };
}

/**
 * Remap UV coordinates on a sub-mesh so they fill [0,1]×[0,1].
 * Used only for baking — the sub-mesh is a throwaway copy so the original
 * atlas UVs on the scene mesh are not affected.
 * Returns the UV bounds (pre-normalization) so the dashboard can apply the
 * same transform when sampling the resulting texture.
 */
function normalizeSubMeshUVs(mesh: Mesh): { uMin: number; uMax: number; vMin: number; vMax: number } {
  let uMin = Infinity, uMax = -Infinity;
  let vMin = Infinity, vMax = -Infinity;

  for (const v of mesh.vertices) {
    const uv = v.attributes.uv;
    if (!uv) continue;
    if (uv[0] < uMin) uMin = uv[0];
    if (uv[0] > uMax) uMax = uv[0];
    if (uv[1] < vMin) vMin = uv[1];
    if (uv[1] > vMax) vMax = uv[1];
  }

  const uRange = uMax - uMin;
  const vRange = vMax - vMin;

  if (uRange > 1e-6 && vRange > 1e-6) {
    for (const v of mesh.vertices) {
      const uv = v.attributes.uv;
      if (!uv) continue;
      v.attributes.uv = [
        (uv[0] - uMin) / uRange,
        (uv[1] - vMin) / vRange,
      ] as [number, number];
    }
  }

  return { uMin, uMax, vMin, vMax };
}

/**
 * Create a sub-mesh containing only the specified triangles.
 * Remaps vertices and preserves UVs and smoothGroup.
 * Returns both the sub-mesh and the vertex mapping (original → sub-mesh index)
 * so that cached analysis can be remapped.
 */
function createSubMeshFromTriangles(originalMesh: Mesh, triangles: UVTriangle[]): { mesh: Mesh; vertexMap: Map<number, number> } {
  const subMesh = new Mesh();
  const vertexMap = new Map<number, number>();

  for (const tri of triangles) {
    const newIndices: number[] = [];

    for (let i = 0; i < 3; i++) {
      const oldIdx = tri.indices[i];

      if (!vertexMap.has(oldIdx)) {
        const oldVertex = originalMesh.vertices[oldIdx];
        const newVertex = new Vertex(
          oldVertex.position.clone(),
          {
            uv: oldVertex.attributes.uv ? [...oldVertex.attributes.uv] as [number, number] : undefined,
            normal: oldVertex.attributes.normal?.clone(),
            color: oldVertex.attributes.color ? [...oldVertex.attributes.color] as [number, number, number] : undefined,
            smoothGroup: oldVertex.attributes.smoothGroup
          }
        );

        vertexMap.set(oldIdx, subMesh.vertices.length);
        subMesh.addVertex(newVertex);
      }

      newIndices.push(vertexMap.get(oldIdx)!);
    }

    subMesh.addFace(new Face(newIndices, undefined, tri.materialSlotIndex));
  }

  // Copy material slots
  for (const slot of originalMesh.materialSlots) {
    subMesh.addMaterialSlot({ ...slot });
  }

  return { mesh: subMesh, vertexMap };
}

/**
 * TextureBaker class for stateful baking with options
 */
export class TextureBaker {
  private options: BakeOptions;

  constructor(options: BakeOptions = {}) {
    this.options = options;
  }

  /**
   * Bake textures for a mesh
   */
  bake(mesh: Mesh, materialDef: MaterialStackDefinition): BakeResult {
    return bakeTextures(mesh, materialDef, this.options);
  }

  /**
   * Bake textures separately for each material
   */
  bakePerMaterial(
    mesh: Mesh,
    materialDefs: Map<number, MaterialStackDefinition>
  ): PerMaterialBakeResult {
    return bakeTexturesPerMaterial(mesh, materialDefs, this.options);
  }

  /**
   * Set resolution
   */
  setResolution(resolution: number): void {
    this.options.resolution = resolution;
  }

  /**
   * Set channels to bake
   */
  setChannels(channels: TextureChannel[]): void {
    this.options.channels = channels;
  }

  /**
   * Set seed
   */
  setSeed(seed: number): void {
    this.options.seed = seed;
  }
}

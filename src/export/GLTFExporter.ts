/**
 * GLTFExporter - Pure glTF 2.0 / GLB exporter
 *
 * Converts Mesh (with material slots, UVs, normals) to standard glTF format.
 * No external dependencies — builds the binary format directly.
 *
 * C6-001: Basic mesh export
 * C6-002: Scene export with hierarchy and instancing
 */

import { Mesh } from '../platform/geometry/Mesh';
import { Vec3 } from '../platform/math/Vec3';
import type { MaterialSlot } from '../platform/materials/MaterialLibrary';
import type { PSDScene, PSDMeshPrim, PSDInstancePrim, PSDXformPrim, PSDTransform } from '../generation/builder/PSD';

// =============================================================================
// Public API
// =============================================================================

export interface GLTFExportResult {
  /** GLB binary data */
  glb: Uint8Array;
  /** Summary statistics */
  stats: {
    vertexCount: number;
    triangleCount: number;
    materialCount: number;
    byteSize: number;
    hasUVs: boolean;
  };
}

export interface GLTFSceneExportResult {
  /** GLB binary data */
  glb: Uint8Array;
  /** Summary statistics */
  stats: {
    nodeCount: number;
    meshCount: number;
    instanceCount: number;
    materialCount: number;
    vertexCount: number;
    triangleCount: number;
    byteSize: number;
  };
}

/**
 * Export a Mesh to GLB (binary glTF 2.0).
 */
export function exportGLB(mesh: Mesh, name: string = 'mesh'): GLTFExportResult {
  const triangulated = mesh.triangulate();

  // Group faces by material
  const materialGroups = groupFacesByMaterial(triangulated);
  const materials = triangulated.materialSlots;

  // Check if any vertex has UVs
  const hasUVs = triangulated.vertices.some(v => v.attributes.uv !== undefined);

  // Build per-primitive geometry buffers
  const primitiveData = materialGroups.map(group =>
    buildPrimitiveBuffer(triangulated, group.faceIndices, hasUVs)
  );

  // Calculate buffer layout
  const bufferParts: Uint8Array[] = [];
  const accessors: any[] = [];
  const bufferViews: any[] = [];
  let byteOffset = 0;

  const primitiveSpecs: any[] = [];

  for (let pi = 0; pi < primitiveData.length; pi++) {
    const prim = primitiveData[pi];
    // --- Vertex buffer (interleaved: pos + normal + uv) ---
    const stride = hasUVs ? 32 : 24; // 12 + 12 + (8 if UVs)
    const vertexBuf = prim.vertexBuffer;
    const vertexBufViewIdx = bufferViews.length;
    bufferViews.push({
      buffer: 0,
      byteOffset,
      byteLength: vertexBuf.byteLength,
      byteStride: stride,
      target: 34962 // ARRAY_BUFFER
    });
    bufferParts.push(new Uint8Array(vertexBuf));
    byteOffset += vertexBuf.byteLength;

    // Position accessor
    const posAccessorIdx = accessors.length;
    accessors.push({
      bufferView: vertexBufViewIdx,
      byteOffset: 0,
      componentType: 5126, // FLOAT
      count: prim.vertexCount,
      type: 'VEC3',
      min: [prim.posMin.x, prim.posMin.y, prim.posMin.z],
      max: [prim.posMax.x, prim.posMax.y, prim.posMax.z]
    });

    // Normal accessor
    const normalAccessorIdx = accessors.length;
    accessors.push({
      bufferView: vertexBufViewIdx,
      byteOffset: 12,
      componentType: 5126,
      count: prim.vertexCount,
      type: 'VEC3'
    });

    // UV accessor (optional)
    let uvAccessorIdx: number | undefined;
    if (hasUVs) {
      uvAccessorIdx = accessors.length;
      accessors.push({
        bufferView: vertexBufViewIdx,
        byteOffset: 24,
        componentType: 5126,
        count: prim.vertexCount,
        type: 'VEC2'
      });
    }

    // --- Index buffer ---
    const indexBuf = prim.indexBuffer;
    // Align to 4 bytes
    const indexPadding = (4 - (byteOffset % 4)) % 4;
    if (indexPadding > 0) {
      bufferParts.push(new Uint8Array(indexPadding));
      byteOffset += indexPadding;
    }
    const indexBufViewIdx = bufferViews.length;
    const useShort = prim.vertexCount <= 65535;
    bufferViews.push({
      buffer: 0,
      byteOffset,
      byteLength: indexBuf.byteLength,
      target: 34963 // ELEMENT_ARRAY_BUFFER
    });
    bufferParts.push(new Uint8Array(indexBuf));
    byteOffset += indexBuf.byteLength;

    const indexAccessorIdx = accessors.length;
    accessors.push({
      bufferView: indexBufViewIdx,
      byteOffset: 0,
      componentType: useShort ? 5123 : 5125, // UNSIGNED_SHORT or UNSIGNED_INT
      count: prim.indexCount,
      type: 'SCALAR'
    });

    // Build primitive spec
    const attributes: any = {
      POSITION: posAccessorIdx,
      NORMAL: normalAccessorIdx
    };
    if (uvAccessorIdx !== undefined) {
      attributes.TEXCOORD_0 = uvAccessorIdx;
    }

    primitiveSpecs.push({
      attributes,
      indices: indexAccessorIdx,
      material: pi < materials.length ? pi : undefined
    });
  }

  // Pad total buffer to 4-byte alignment
  const totalPadding = (4 - (byteOffset % 4)) % 4;
  if (totalPadding > 0) {
    bufferParts.push(new Uint8Array(totalPadding));
    byteOffset += totalPadding;
  }

  // Merge all buffer parts into one
  const binBuffer = concatBuffers(bufferParts);

  // Build glTF JSON
  const gltf: any = {
    asset: {
      version: '2.0',
      generator: 'Procedurable C6-001'
    },
    scene: 0,
    scenes: [{ name, nodes: [0] }],
    nodes: [{ name, mesh: 0 }],
    meshes: [{ name, primitives: primitiveSpecs }],
    accessors,
    bufferViews,
    buffers: [{ byteLength: binBuffer.byteLength }],
    materials: buildGLTFMaterials(materials, materialGroups)
  };

  // Pack as GLB
  const glb = packGLB(gltf, binBuffer);

  const totalVertices = primitiveData.reduce((s, p) => s + p.vertexCount, 0);
  const totalTriangles = primitiveData.reduce((s, p) => s + p.indexCount / 3, 0);

  return {
    glb,
    stats: {
      vertexCount: totalVertices,
      triangleCount: totalTriangles,
      materialCount: Math.max(materials.length, 1),
      byteSize: glb.byteLength,
      hasUVs
    }
  };
}

/**
 * Export a PSDScene to GLB (binary glTF 2.0) with hierarchy and instancing.
 *
 * C6-002: Composed scene exports with parent-child transform hierarchy.
 * Instances share mesh data (not duplicated).
 */
export function exportSceneGLB(scene: PSDScene): GLTFSceneExportResult {
  // Collect all meshes (excluding prototypes which are only used by instances)
  const meshPrims: Array<{ path: string; prim: PSDMeshPrim }> = [];
  const instancePrims: Array<{ path: string; prim: PSDInstancePrim }> = [];
  const xformPrims: Array<{ path: string; prim: PSDXformPrim }> = [];

  // Map prototype paths to mesh indices (for instancing)
  const prototypeMeshIndices: Map<string, number> = new Map();

  for (const [path, prim] of Object.entries(scene.prims)) {
    if (prim.type === 'Mesh') {
      meshPrims.push({ path, prim: prim as PSDMeshPrim });
    } else if (prim.type === 'Instance') {
      instancePrims.push({ path, prim: prim as PSDInstancePrim });
    } else if (prim.type === 'Xform') {
      xformPrims.push({ path, prim: prim as PSDXformPrim });
    }
  }

  // Separate prototype meshes from regular meshes
  const prototypeMeshes = meshPrims.filter(m => m.path.includes('/__prototypes__/'));
  const regularMeshes = meshPrims.filter(m => !m.path.includes('/__prototypes__/'));

  // Build materials from scene
  const gltfMaterials = scene.materials.map((mat, i) => ({
    name: mat.name || `material_${i}`,
    pbrMetallicRoughness: {
      baseColorFactor: [mat.color[0], mat.color[1], mat.color[2], 1.0],
      roughnessFactor: mat.roughness,
      metallicFactor: mat.metalness
    }
  }));

  // Build buffer data
  const bufferParts: Uint8Array[] = [];
  const accessors: any[] = [];
  const bufferViews: any[] = [];
  const meshes: any[] = [];
  const nodes: any[] = [];
  let byteOffset = 0;

  let totalVertices = 0;
  let totalTriangles = 0;

  // Helper to add a mesh geometry to glTF
  const addMeshGeometry = (geom: PSDMeshPrim['geometry'], materialSlots: number[]): number => {
    const hasUVs = geom.uvs !== undefined && geom.uvs.length > 0;
    const vertexCount = geom.vertices.length / 3;
    const indexCount = geom.indices.length;

    // Build interleaved vertex buffer
    const stride = hasUVs ? 32 : 24;
    const vertexBuffer = new ArrayBuffer(vertexCount * stride);
    const vertexView = new DataView(vertexBuffer);

    let posMin = new Vec3(Infinity, Infinity, Infinity);
    let posMax = new Vec3(-Infinity, -Infinity, -Infinity);

    for (let i = 0; i < vertexCount; i++) {
      const px = geom.vertices[i * 3];
      const py = geom.vertices[i * 3 + 1];
      const pz = geom.vertices[i * 3 + 2];
      const nx = geom.normals[i * 3];
      const ny = geom.normals[i * 3 + 1];
      const nz = geom.normals[i * 3 + 2];

      posMin = new Vec3(Math.min(posMin.x, px), Math.min(posMin.y, py), Math.min(posMin.z, pz));
      posMax = new Vec3(Math.max(posMax.x, px), Math.max(posMax.y, py), Math.max(posMax.z, pz));

      const off = i * stride;
      vertexView.setFloat32(off, px, true);
      vertexView.setFloat32(off + 4, py, true);
      vertexView.setFloat32(off + 8, pz, true);
      vertexView.setFloat32(off + 12, nx, true);
      vertexView.setFloat32(off + 16, ny, true);
      vertexView.setFloat32(off + 20, nz, true);

      if (hasUVs) {
        const u = geom.uvs![i * 2];
        const v = geom.uvs![i * 2 + 1];
        vertexView.setFloat32(off + 24, u, true);
        vertexView.setFloat32(off + 28, v, true);
      }
    }

    // Index buffer
    const useShort = vertexCount <= 65535;
    const indexBuffer = useShort
      ? new Uint16Array(geom.indices).buffer
      : new Uint32Array(geom.indices).buffer;

    // Add vertex buffer view
    const vertexBufViewIdx = bufferViews.length;
    bufferViews.push({
      buffer: 0,
      byteOffset,
      byteLength: vertexBuffer.byteLength,
      byteStride: stride,
      target: 34962
    });
    bufferParts.push(new Uint8Array(vertexBuffer));
    byteOffset += vertexBuffer.byteLength;

    // Position accessor
    const posAccessorIdx = accessors.length;
    accessors.push({
      bufferView: vertexBufViewIdx,
      byteOffset: 0,
      componentType: 5126,
      count: vertexCount,
      type: 'VEC3',
      min: [posMin.x, posMin.y, posMin.z],
      max: [posMax.x, posMax.y, posMax.z]
    });

    // Normal accessor
    const normalAccessorIdx = accessors.length;
    accessors.push({
      bufferView: vertexBufViewIdx,
      byteOffset: 12,
      componentType: 5126,
      count: vertexCount,
      type: 'VEC3'
    });

    // UV accessor
    let uvAccessorIdx: number | undefined;
    if (hasUVs) {
      uvAccessorIdx = accessors.length;
      accessors.push({
        bufferView: vertexBufViewIdx,
        byteOffset: 24,
        componentType: 5126,
        count: vertexCount,
        type: 'VEC2'
      });
    }

    // Align to 4 bytes for index buffer
    const indexPadding = (4 - (byteOffset % 4)) % 4;
    if (indexPadding > 0) {
      bufferParts.push(new Uint8Array(indexPadding));
      byteOffset += indexPadding;
    }

    // Index buffer view
    const indexBufViewIdx = bufferViews.length;
    bufferViews.push({
      buffer: 0,
      byteOffset,
      byteLength: indexBuffer.byteLength,
      target: 34963
    });
    bufferParts.push(new Uint8Array(indexBuffer));
    byteOffset += indexBuffer.byteLength;

    // Index accessor
    const indexAccessorIdx = accessors.length;
    accessors.push({
      bufferView: indexBufViewIdx,
      byteOffset: 0,
      componentType: useShort ? 5123 : 5125,
      count: indexCount,
      type: 'SCALAR'
    });

    // Build primitive
    const attributes: any = {
      POSITION: posAccessorIdx,
      NORMAL: normalAccessorIdx
    };
    if (uvAccessorIdx !== undefined) {
      attributes.TEXCOORD_0 = uvAccessorIdx;
    }

    // Use first material slot for the primitive (simplified - one primitive per mesh)
    const materialIdx = materialSlots.length > 0 ? materialSlots[0] : undefined;

    const meshIdx = meshes.length;
    meshes.push({
      primitives: [{
        attributes,
        indices: indexAccessorIdx,
        material: materialIdx
      }]
    });

    totalVertices += vertexCount;
    totalTriangles += indexCount / 3;

    return meshIdx;
  };

  // Process prototype meshes first (they are shared by instances)
  for (const { path, prim } of prototypeMeshes) {
    const meshIdx = addMeshGeometry(prim.geometry, prim.materialSlots);
    prototypeMeshIndices.set(path, meshIdx);
  }

  // Build node hierarchy
  const pathToNodeIdx: Map<string, number> = new Map();

  // Helper to convert PSDTransform to glTF transform
  const transformToGLTF = (t: PSDTransform): any => {
    const node: any = {};
    if (t.position[0] !== 0 || t.position[1] !== 0 || t.position[2] !== 0) {
      node.translation = t.position;
    }
    if (t.rotation[0] !== 0 || t.rotation[1] !== 0 || t.rotation[2] !== 0) {
      node.rotation = eulerToQuaternion(t.rotation);
    }
    if (t.scale[0] !== 1 || t.scale[1] !== 1 || t.scale[2] !== 1) {
      node.scale = t.scale;
    }
    return node;
  };

  // Create nodes for regular meshes
  for (const { path, prim } of regularMeshes) {
    const meshIdx = addMeshGeometry(prim.geometry, prim.materialSlots);
    const node: any = {
      name: path.split('/').pop() || 'mesh',
      mesh: meshIdx,
      ...transformToGLTF(prim.transform)
    };
    pathToNodeIdx.set(path, nodes.length);
    nodes.push(node);
  }

  // Create nodes for instances (reference shared prototype meshes)
  for (const { path, prim } of instancePrims) {
    const meshIdx = prototypeMeshIndices.get(prim.prototype);
    if (meshIdx !== undefined) {
      const node: any = {
        name: path.split('/').pop() || 'instance',
        mesh: meshIdx,
        ...transformToGLTF(prim.transform)
      };
      pathToNodeIdx.set(path, nodes.length);
      nodes.push(node);
    }
  }

  // Create nodes for xforms (groups)
  for (const { path, prim } of xformPrims) {
    // Skip prototype container nodes
    if (path.includes('/__prototypes__')) continue;

    const node: any = {
      name: path.split('/').pop() || 'group',
      ...transformToGLTF(prim.transform)
    };
    pathToNodeIdx.set(path, nodes.length);
    nodes.push(node);
  }

  // Build parent-child relationships
  for (const [path, nodeIdx] of pathToNodeIdx) {
    const prim = scene.prims[path];
    if (prim && prim.children && prim.children.length > 0) {
      const childIndices: number[] = [];
      for (const childPath of prim.children) {
        const childIdx = pathToNodeIdx.get(childPath);
        if (childIdx !== undefined) {
          childIndices.push(childIdx);
        }
      }
      if (childIndices.length > 0) {
        nodes[nodeIdx].children = childIndices;
      }
    }
  }

  // Find root nodes (nodes without parents in our export)
  const rootNodeIndices: number[] = [];
  for (const [path, nodeIdx] of pathToNodeIdx) {
    const prim = scene.prims[path];
    if (!prim?.parent || !pathToNodeIdx.has(prim.parent)) {
      rootNodeIndices.push(nodeIdx);
    }
  }

  // If no nodes created, create a minimal empty scene
  if (nodes.length === 0) {
    nodes.push({ name: scene.name });
    rootNodeIndices.push(0);
  }

  // Pad buffer to 4-byte alignment
  const totalPadding = (4 - (byteOffset % 4)) % 4;
  if (totalPadding > 0) {
    bufferParts.push(new Uint8Array(totalPadding));
    byteOffset += totalPadding;
  }

  // Merge buffer parts
  const binBuffer = concatBuffers(bufferParts);

  // Build glTF JSON
  const gltf: any = {
    asset: {
      version: '2.0',
      generator: 'Procedurable C6-002'
    },
    scene: 0,
    scenes: [{ name: scene.name, nodes: rootNodeIndices }],
    nodes,
    accessors,
    bufferViews,
    buffers: [{ byteLength: binBuffer.byteLength }]
  };

  if (meshes.length > 0) {
    gltf.meshes = meshes;
  }

  if (gltfMaterials.length > 0) {
    gltf.materials = gltfMaterials;
  }

  // Pack as GLB
  const glb = packGLB(gltf, binBuffer);

  return {
    glb,
    stats: {
      nodeCount: nodes.length,
      meshCount: meshes.length,
      instanceCount: instancePrims.length,
      materialCount: gltfMaterials.length,
      vertexCount: totalVertices,
      triangleCount: totalTriangles,
      byteSize: glb.byteLength
    }
  };
}

/**
 * Convert Euler angles (XYZ order, radians) to quaternion [x, y, z, w]
 */
function eulerToQuaternion(euler: [number, number, number]): [number, number, number, number] {
  const [rx, ry, rz] = euler;
  const c1 = Math.cos(rx / 2), s1 = Math.sin(rx / 2);
  const c2 = Math.cos(ry / 2), s2 = Math.sin(ry / 2);
  const c3 = Math.cos(rz / 2), s3 = Math.sin(rz / 2);

  // XYZ order
  const x = s1 * c2 * c3 + c1 * s2 * s3;
  const y = c1 * s2 * c3 - s1 * c2 * s3;
  const z = c1 * c2 * s3 + s1 * s2 * c3;
  const w = c1 * c2 * c3 - s1 * s2 * s3;

  return [x, y, z, w];
}

// =============================================================================
// Internal: Material grouping
// =============================================================================

interface MaterialGroup {
  materialSlotIndex: number | undefined;
  faceIndices: number[];
}

function groupFacesByMaterial(mesh: Mesh): MaterialGroup[] {
  const groups = new Map<number | undefined, number[]>();

  for (let i = 0; i < mesh.faces.length; i++) {
    const key = mesh.faces[i].materialSlotIndex;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(i);
  }

  // If there's only one group with undefined material, that's fine — single primitive
  const result: MaterialGroup[] = [];
  for (const [materialSlotIndex, faceIndices] of groups) {
    result.push({ materialSlotIndex, faceIndices });
  }

  return result;
}

// =============================================================================
// Internal: Geometry buffer building
// =============================================================================

interface PrimitiveBufferData {
  vertexBuffer: ArrayBuffer;
  indexBuffer: ArrayBuffer;
  vertexCount: number;
  indexCount: number;
  posMin: Vec3;
  posMax: Vec3;
}

function buildPrimitiveBuffer(
  mesh: Mesh,
  faceIndices: number[],
  hasUVs: boolean
): PrimitiveBufferData {
  // Collect unique vertices for this primitive and build index buffer
  const vertexMap = new Map<number, number>(); // original vertex index → new index
  const orderedVertices: number[] = []; // new index → original index

  const indices: number[] = [];

  for (const fi of faceIndices) {
    const face = mesh.faces[fi];
    // Each face should be a triangle (mesh is triangulated)
    for (const vi of face.indices) {
      if (!vertexMap.has(vi)) {
        vertexMap.set(vi, orderedVertices.length);
        orderedVertices.push(vi);
      }
      indices.push(vertexMap.get(vi)!);
    }
  }

  const vertexCount = orderedVertices.length;
  const floatsPerVertex = hasUVs ? 8 : 6; // pos(3) + normal(3) + uv(2)
  const vertexBuffer = new ArrayBuffer(vertexCount * floatsPerVertex * 4);
  const vertexView = new Float32Array(vertexBuffer);

  // Compute face normals for flat shading fallback
  // Actually, for proper flat shading we need per-face vertices, not shared.
  // But the mesh is already triangulated with potentially shared vertices.
  // Let's compute per-vertex normals via mesh if not already present.
  // For glTF, we need normals. Compute face normals for each triangle.

  // Since we're sharing vertices across faces, we need smooth normals.
  // Compute them by averaging face normals per vertex.
  const vertexNormals = new Map<number, Vec3>();
  for (const fi of faceIndices) {
    const face = mesh.faces[fi];
    if (face.indices.length < 3) continue;
    const v0 = mesh.vertices[face.indices[0]].position;
    const v1 = mesh.vertices[face.indices[1]].position;
    const v2 = mesh.vertices[face.indices[2]].position;
    const normal = v1.sub(v0).cross(v2.sub(v0)).normalize();
    for (const vi of face.indices) {
      const existing = vertexNormals.get(vi) || Vec3.zero();
      vertexNormals.set(vi, existing.add(normal));
    }
  }

  let posMin = new Vec3(Infinity, Infinity, Infinity);
  let posMax = new Vec3(-Infinity, -Infinity, -Infinity);

  for (let ni = 0; ni < orderedVertices.length; ni++) {
    const oi = orderedVertices[ni];
    const v = mesh.vertices[oi];
    const pos = v.position;
    const normal = (vertexNormals.get(oi) || new Vec3(0, 1, 0)).normalize();
    const uv = v.attributes.uv || [0, 0];

    const offset = ni * floatsPerVertex;
    vertexView[offset] = pos.x;
    vertexView[offset + 1] = pos.y;
    vertexView[offset + 2] = pos.z;
    vertexView[offset + 3] = normal.x;
    vertexView[offset + 4] = normal.y;
    vertexView[offset + 5] = normal.z;
    if (hasUVs) {
      vertexView[offset + 6] = uv[0];
      vertexView[offset + 7] = uv[1];
    }

    posMin = new Vec3(Math.min(posMin.x, pos.x), Math.min(posMin.y, pos.y), Math.min(posMin.z, pos.z));
    posMax = new Vec3(Math.max(posMax.x, pos.x), Math.max(posMax.y, pos.y), Math.max(posMax.z, pos.z));
  }

  // Build index buffer
  const useShort = vertexCount <= 65535;
  const indexBuffer = useShort
    ? new Uint16Array(indices).buffer
    : new Uint32Array(indices).buffer;

  return {
    vertexBuffer,
    indexBuffer,
    vertexCount,
    indexCount: indices.length,
    posMin,
    posMax
  };
}

// =============================================================================
// Internal: Materials
// =============================================================================

function buildGLTFMaterials(slots: MaterialSlot[], _groups: MaterialGroup[]): any[] {
  if (slots.length === 0) {
    // Default material for meshes without material slots
    return [{
      name: 'default',
      pbrMetallicRoughness: {
        baseColorFactor: [0.545, 0.353, 0.169, 1.0], // wood brown
        roughnessFactor: 0.7,
        metallicFactor: 0.1
      }
    }];
  }

  return slots.map(slot => ({
    name: slot.name,
    pbrMetallicRoughness: {
      baseColorFactor: [slot.color.r, slot.color.g, slot.color.b, 1.0],
      roughnessFactor: slot.roughness,
      metallicFactor: slot.metalness
    }
  }));
}

// =============================================================================
// Internal: GLB packing
// =============================================================================

/**
 * Pack glTF JSON + binary buffer into GLB format.
 *
 * GLB structure:
 *   12-byte header: magic(4) + version(4) + length(4)
 *   JSON chunk: chunkLength(4) + chunkType(4) + data (padded to 4 bytes with spaces)
 *   BIN chunk:  chunkLength(4) + chunkType(4) + data (padded to 4 bytes with zeros)
 */
export function packGLB(gltfJson: any, binBuffer: Uint8Array): Uint8Array {
  const jsonStr = JSON.stringify(gltfJson);
  const jsonEncoder = new TextEncoder();
  const jsonBytes = jsonEncoder.encode(jsonStr);

  // Pad JSON to 4-byte alignment with spaces (0x20)
  const jsonPadding = (4 - (jsonBytes.length % 4)) % 4;
  const jsonChunkLength = jsonBytes.length + jsonPadding;

  // Pad BIN to 4-byte alignment with zeros
  const binPadding = (4 - (binBuffer.byteLength % 4)) % 4;
  const binChunkLength = binBuffer.byteLength + binPadding;

  // Total file size
  const totalLength = 12 + 8 + jsonChunkLength + 8 + binChunkLength;

  const result = new ArrayBuffer(totalLength);
  const view = new DataView(result);
  const bytes = new Uint8Array(result);

  let offset = 0;

  // GLB Header
  view.setUint32(offset, 0x46546C67, true); offset += 4; // magic: "glTF"
  view.setUint32(offset, 2, true);          offset += 4; // version: 2
  view.setUint32(offset, totalLength, true); offset += 4; // total length

  // JSON chunk header
  view.setUint32(offset, jsonChunkLength, true); offset += 4;
  view.setUint32(offset, 0x4E4F534A, true);     offset += 4; // "JSON"
  bytes.set(jsonBytes, offset);
  offset += jsonBytes.length;
  // Pad with spaces
  for (let i = 0; i < jsonPadding; i++) {
    bytes[offset++] = 0x20;
  }

  // BIN chunk header
  view.setUint32(offset, binChunkLength, true); offset += 4;
  view.setUint32(offset, 0x004E4942, true);     offset += 4; // "BIN\0"
  bytes.set(binBuffer, offset);
  offset += binBuffer.byteLength;
  // Pad with zeros (already zero-initialized)

  return new Uint8Array(result);
}

// =============================================================================
// Utilities
// =============================================================================

function concatBuffers(parts: Uint8Array[]): Uint8Array {
  const totalLength = parts.reduce((sum, p) => sum + p.byteLength, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

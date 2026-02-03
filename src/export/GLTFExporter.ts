/**
 * GLTFExporter - Pure glTF 2.0 / GLB exporter
 *
 * Converts Mesh (with material slots, UVs, normals) to standard glTF format.
 * No external dependencies — builds the binary format directly.
 *
 * C6-001: Basic mesh export
 * C6-002: Scene export with hierarchy and instancing
 * E4-001: Skeleton and skin export for rigged models
 */

import { Mesh } from '../platform/geometry/Mesh';
import { Vec3 } from '../platform/math/Vec3';
import type { MaterialSlot } from '../platform/materials/MaterialLibrary';
import type { PSDScene, PSDMeshPrim, PSDInstancePrim, PSDXformPrim, PSDTransform } from '../generation/builder/PSD';
import type { TracedOutput, TracedSkeleton, TracedJoint } from '../generation/builder/TracedBuilder';

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
 * Result of exporting a rigged model (E4-001)
 */
export interface GLTFRiggedExportResult {
  /** GLB binary data */
  glb: Uint8Array;
  /** Summary statistics */
  stats: {
    vertexCount: number;
    triangleCount: number;
    materialCount: number;
    jointCount: number;
    skinnedVertexCount: number;
    byteSize: number;
    hasUVs: boolean;
  };
}

/**
 * Result of exporting a model with morph targets (E4-002)
 */
export interface GLTFMorphExportResult {
  /** GLB binary data */
  glb: Uint8Array;
  /** Summary statistics */
  stats: {
    vertexCount: number;
    triangleCount: number;
    materialCount: number;
    morphTargetCount: number;
    byteSize: number;
    hasUVs: boolean;
  };
}

/**
 * Baked texture set for glTF export (G6-002)
 */
export interface BakedTextureSet {
  /** Albedo/base color texture (RGBA, 4 bytes per pixel) */
  albedo?: Uint8Array;
  /** Normal map (RGBA, 4 bytes per pixel) */
  normal?: Uint8Array;
  /** Roughness texture (grayscale, 1 byte per pixel) */
  roughness?: Uint8Array;
  /** Metallic texture (grayscale, 1 byte per pixel) */
  metallic?: Uint8Array;
  /** Ambient occlusion texture (grayscale, 1 byte per pixel) */
  ao?: Uint8Array;
  /** Texture resolution (width and height) */
  resolution: number;
}

/**
 * Result of exporting a model with baked textures (G6-002)
 */
export interface GLTFTexturedExportResult {
  /** GLB binary data */
  glb: Uint8Array;
  /** Summary statistics */
  stats: {
    vertexCount: number;
    triangleCount: number;
    materialCount: number;
    textureCount: number;
    textureResolution: number;
    byteSize: number;
    hasUVs: boolean;
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
 * Export a rigged model (TracedOutput with skeleton and weights) to GLB.
 *
 * E4-001: Skeleton and skin export for rigged models.
 *
 * Includes:
 * - Joint nodes in scene hierarchy
 * - Skin with inverse bind matrices
 * - Vertex weights as JOINTS_0 and WEIGHTS_0 attributes
 * - Joint constraints as glTF extras
 *
 * @param output TracedOutput with skeleton and vertexWeights
 * @param name Optional name for the model
 */
export function exportRiggedGLB(output: TracedOutput, name: string = 'rigged_mesh'): GLTFRiggedExportResult {
  if (!output.skeleton) {
    throw new Error('Cannot export rigged model: no skeleton defined');
  }

  if (!output.vertexWeights) {
    throw new Error('Cannot export rigged model: no vertex weights defined');
  }

  const mesh = output.mesh.triangulate();
  const skeleton = output.skeleton;
  const weights = output.vertexWeights;
  const materials = mesh.materialSlots;

  // Check if any vertex has UVs
  const hasUVs = mesh.vertices.some(v => v.attributes.uv !== undefined);

  // Buffer management
  const bufferParts: Uint8Array[] = [];
  const accessors: any[] = [];
  const bufferViews: any[] = [];
  let byteOffset = 0;

  // --- Build joint nodes ---
  const nodes: any[] = [];
  const jointNodeIndices: number[] = []; // Maps joint index to node index

  // Create a root node for the mesh
  const meshNodeIndex = 0;
  nodes.push({ name });

  // Create nodes for each joint
  for (let ji = 0; ji < skeleton.joints.length; ji++) {
    const joint = skeleton.joints[ji];
    const nodeIndex = nodes.length;
    jointNodeIndices.push(nodeIndex);

    const node: any = {
      name: joint.name,
      translation: [joint.position.x, joint.position.y, joint.position.z]
    };

    // Add rotation if non-zero
    if (joint.orientation.x !== 0 || joint.orientation.y !== 0 || joint.orientation.z !== 0) {
      node.rotation = eulerToQuaternion([joint.orientation.x, joint.orientation.y, joint.orientation.z]);
    }

    // Add constraints as extras (not standard glTF, but preserved for tools)
    if (joint.constraints) {
      node.extras = {
        jointConstraints: {
          type: joint.constraints.type,
          axis: joint.constraints.axis,
          limits: joint.constraints.limits
        }
      };
    }

    nodes.push(node);
  }

  // Build joint hierarchy (children arrays)
  for (let ji = 0; ji < skeleton.joints.length; ji++) {
    const joint = skeleton.joints[ji];
    if (joint.parent !== null) {
      const parentJoint = skeleton.jointMap.get(joint.parent);
      if (parentJoint) {
        const parentIndex = skeleton.joints.indexOf(parentJoint);
        if (parentIndex !== -1) {
          const parentNodeIndex = jointNodeIndices[parentIndex];
          if (!nodes[parentNodeIndex].children) {
            nodes[parentNodeIndex].children = [];
          }
          nodes[parentNodeIndex].children.push(jointNodeIndices[ji]);
        }
      }
    }
  }

  // Root joints are children of the mesh node
  const rootJointNodeIndices: number[] = [];
  for (const rootName of skeleton.roots) {
    const joint = skeleton.jointMap.get(rootName);
    if (joint) {
      const jointIndex = skeleton.joints.indexOf(joint);
      if (jointIndex !== -1) {
        rootJointNodeIndices.push(jointNodeIndices[jointIndex]);
      }
    }
  }
  if (rootJointNodeIndices.length > 0) {
    nodes[meshNodeIndex].children = rootJointNodeIndices;
  }

  // --- Compute inverse bind matrices ---
  // Each joint's IBM is the inverse of its world-space transform
  const inverseBindMatrices = computeInverseBindMatrices(skeleton);

  // Add IBM accessor
  const ibmBuffer = new Float32Array(skeleton.joints.length * 16);
  for (let ji = 0; ji < skeleton.joints.length; ji++) {
    ibmBuffer.set(inverseBindMatrices[ji], ji * 16);
  }
  const ibmBufferBytes = new Uint8Array(ibmBuffer.buffer);

  const ibmBufferViewIdx = bufferViews.length;
  bufferViews.push({
    buffer: 0,
    byteOffset,
    byteLength: ibmBufferBytes.byteLength
  });
  bufferParts.push(ibmBufferBytes);
  byteOffset += ibmBufferBytes.byteLength;

  const ibmAccessorIdx = accessors.length;
  accessors.push({
    bufferView: ibmBufferViewIdx,
    byteOffset: 0,
    componentType: 5126, // FLOAT
    count: skeleton.joints.length,
    type: 'MAT4'
  });

  // --- Build mesh geometry with skinning attributes ---
  const vertexCount = mesh.vertices.length;

  // Interleaved vertex buffer: position(3) + normal(3) + uv(2) + joints(4) + weights(4)
  // Note: JOINTS_0 uses UNSIGNED_BYTE or UNSIGNED_SHORT
  // We'll use UNSIGNED_BYTE (max 255 joints) with separate buffer views for clarity

  // Build vertex positions, normals, UVs
  const stride = hasUVs ? 32 : 24; // pos(3*4) + normal(3*4) + uv(2*4) = 32 or 24
  const vertexBuffer = new ArrayBuffer(vertexCount * stride);
  const vertexView = new DataView(vertexBuffer);

  // Compute normals
  const vertexNormals = computeVertexNormals(mesh);

  let posMin = new Vec3(Infinity, Infinity, Infinity);
  let posMax = new Vec3(-Infinity, -Infinity, -Infinity);

  for (let vi = 0; vi < vertexCount; vi++) {
    const v = mesh.vertices[vi];
    const pos = v.position;
    const normal = vertexNormals[vi];
    const uv = v.attributes.uv || [0, 0];

    posMin = new Vec3(Math.min(posMin.x, pos.x), Math.min(posMin.y, pos.y), Math.min(posMin.z, pos.z));
    posMax = new Vec3(Math.max(posMax.x, pos.x), Math.max(posMax.y, pos.y), Math.max(posMax.z, pos.z));

    const off = vi * stride;
    vertexView.setFloat32(off, pos.x, true);
    vertexView.setFloat32(off + 4, pos.y, true);
    vertexView.setFloat32(off + 8, pos.z, true);
    vertexView.setFloat32(off + 12, normal.x, true);
    vertexView.setFloat32(off + 16, normal.y, true);
    vertexView.setFloat32(off + 20, normal.z, true);

    if (hasUVs) {
      vertexView.setFloat32(off + 24, uv[0], true);
      vertexView.setFloat32(off + 28, uv[1], true);
    }
  }

  // Add vertex buffer view
  // Align to 4 bytes
  const vertexPadding = (4 - (byteOffset % 4)) % 4;
  if (vertexPadding > 0) {
    bufferParts.push(new Uint8Array(vertexPadding));
    byteOffset += vertexPadding;
  }

  const vertexBufViewIdx = bufferViews.length;
  bufferViews.push({
    buffer: 0,
    byteOffset,
    byteLength: vertexBuffer.byteLength,
    byteStride: stride,
    target: 34962 // ARRAY_BUFFER
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

  // UV accessor (optional)
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

  // --- Build JOINTS_0 and WEIGHTS_0 buffers ---
  const maxInfluences = 4; // glTF standard
  const jointsBuffer = new Uint8Array(vertexCount * 4); // 4 bytes per vertex
  const weightsBuffer = new Float32Array(vertexCount * 4); // 4 floats per vertex

  let skinnedVertexCount = 0;

  for (let vi = 0; vi < vertexCount; vi++) {
    const vw = weights.weights.get(vi) || [];

    // Sort by weight descending and take top 4
    const sorted = [...vw].sort((a, b) => b.weight - a.weight).slice(0, maxInfluences);

    // Normalize weights
    const totalWeight = sorted.reduce((sum, w) => sum + w.weight, 0);

    if (sorted.length > 0) {
      skinnedVertexCount++;
    }

    for (let i = 0; i < maxInfluences; i++) {
      if (i < sorted.length && totalWeight > 0) {
        jointsBuffer[vi * 4 + i] = sorted[i].jointIndex;
        weightsBuffer[vi * 4 + i] = sorted[i].weight / totalWeight;
      } else {
        jointsBuffer[vi * 4 + i] = 0;
        weightsBuffer[vi * 4 + i] = 0;
      }
    }
  }

  // Align to 4 bytes
  const jointsPadding = (4 - (byteOffset % 4)) % 4;
  if (jointsPadding > 0) {
    bufferParts.push(new Uint8Array(jointsPadding));
    byteOffset += jointsPadding;
  }

  // JOINTS_0 buffer view
  const jointsBufViewIdx = bufferViews.length;
  bufferViews.push({
    buffer: 0,
    byteOffset,
    byteLength: jointsBuffer.byteLength,
    target: 34962
  });
  bufferParts.push(jointsBuffer);
  byteOffset += jointsBuffer.byteLength;

  // JOINTS_0 accessor
  const jointsAccessorIdx = accessors.length;
  accessors.push({
    bufferView: jointsBufViewIdx,
    byteOffset: 0,
    componentType: 5121, // UNSIGNED_BYTE
    count: vertexCount,
    type: 'VEC4'
  });

  // Align to 4 bytes for weights
  const weightsPadding = (4 - (byteOffset % 4)) % 4;
  if (weightsPadding > 0) {
    bufferParts.push(new Uint8Array(weightsPadding));
    byteOffset += weightsPadding;
  }

  // WEIGHTS_0 buffer view
  const weightsBufViewIdx = bufferViews.length;
  const weightsBytes = new Uint8Array(weightsBuffer.buffer);
  bufferViews.push({
    buffer: 0,
    byteOffset,
    byteLength: weightsBytes.byteLength,
    target: 34962
  });
  bufferParts.push(weightsBytes);
  byteOffset += weightsBytes.byteLength;

  // WEIGHTS_0 accessor
  const weightsAccessorIdx = accessors.length;
  accessors.push({
    bufferView: weightsBufViewIdx,
    byteOffset: 0,
    componentType: 5126, // FLOAT
    count: vertexCount,
    type: 'VEC4'
  });

  // --- Build index buffer ---
  const indices: number[] = [];
  for (const face of mesh.faces) {
    indices.push(...face.indices);
  }

  const useShort = vertexCount <= 65535;
  const indexBuffer = useShort
    ? new Uint16Array(indices).buffer
    : new Uint32Array(indices).buffer;

  // Align to 4 bytes
  const indexPadding = (4 - (byteOffset % 4)) % 4;
  if (indexPadding > 0) {
    bufferParts.push(new Uint8Array(indexPadding));
    byteOffset += indexPadding;
  }

  const indexBufViewIdx = bufferViews.length;
  bufferViews.push({
    buffer: 0,
    byteOffset,
    byteLength: indexBuffer.byteLength,
    target: 34963 // ELEMENT_ARRAY_BUFFER
  });
  bufferParts.push(new Uint8Array(indexBuffer));
  byteOffset += indexBuffer.byteLength;

  const indexAccessorIdx = accessors.length;
  accessors.push({
    bufferView: indexBufViewIdx,
    byteOffset: 0,
    componentType: useShort ? 5123 : 5125,
    count: indices.length,
    type: 'SCALAR'
  });

  // --- Build mesh primitive ---
  const attributes: any = {
    POSITION: posAccessorIdx,
    NORMAL: normalAccessorIdx,
    JOINTS_0: jointsAccessorIdx,
    WEIGHTS_0: weightsAccessorIdx
  };
  if (uvAccessorIdx !== undefined) {
    attributes.TEXCOORD_0 = uvAccessorIdx;
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
      generator: 'Procedurable E4-001'
    },
    scene: 0,
    scenes: [{ name, nodes: [meshNodeIndex] }],
    nodes,
    meshes: [{
      name,
      primitives: [{
        attributes,
        indices: indexAccessorIdx,
        material: materials.length > 0 ? 0 : undefined
      }]
    }],
    skins: [{
      name: `${name}_skin`,
      joints: jointNodeIndices,
      inverseBindMatrices: ibmAccessorIdx,
      skeleton: jointNodeIndices.length > 0 ? jointNodeIndices[0] : undefined
    }],
    accessors,
    bufferViews,
    buffers: [{ byteLength: binBuffer.byteLength }]
  };

  // Add skin reference to mesh node
  nodes[meshNodeIndex].mesh = 0;
  nodes[meshNodeIndex].skin = 0;

  // Add materials if present
  if (materials.length > 0) {
    gltf.materials = buildGLTFMaterials(materials, []);
  }

  // Pack as GLB
  const glb = packGLB(gltf, binBuffer);

  return {
    glb,
    stats: {
      vertexCount,
      triangleCount: indices.length / 3,
      materialCount: Math.max(materials.length, 1),
      jointCount: skeleton.joints.length,
      skinnedVertexCount,
      byteSize: glb.byteLength,
      hasUVs
    }
  };
}

/**
 * Export a model with morph targets to GLB.
 *
 * E4-002: Morph target export for blend shapes.
 *
 * Includes:
 * - Morph targets as glTF mesh primitive `targets` array
 * - Each target contains POSITION delta accessors
 * - Default weights in mesh.weights array
 * - Target names in mesh.extras.targetNames (glTF convention)
 *
 * @param output TracedOutput with morphTargets
 * @param name Optional name for the model
 */
export function exportMorphGLB(output: TracedOutput, name: string = 'morph_mesh'): GLTFMorphExportResult {
  if (!output.morphTargets || output.morphTargets.targets.length === 0) {
    throw new Error('Cannot export morph model: no morph targets defined');
  }

  const mesh = output.mesh.triangulate();
  const morphTargets = output.morphTargets;
  const materials = mesh.materialSlots;

  // Check if any vertex has UVs
  const hasUVs = mesh.vertices.some(v => v.attributes.uv !== undefined);

  // Buffer management
  const bufferParts: Uint8Array[] = [];
  const accessors: any[] = [];
  const bufferViews: any[] = [];
  let byteOffset = 0;

  const vertexCount = mesh.vertices.length;

  // --- Build base mesh geometry ---
  const stride = hasUVs ? 32 : 24;
  const vertexBuffer = new ArrayBuffer(vertexCount * stride);
  const vertexView = new DataView(vertexBuffer);

  // Compute normals
  const vertexNormals = computeVertexNormals(mesh);

  let posMin = new Vec3(Infinity, Infinity, Infinity);
  let posMax = new Vec3(-Infinity, -Infinity, -Infinity);

  for (let vi = 0; vi < vertexCount; vi++) {
    const v = mesh.vertices[vi];
    const pos = v.position;
    const normal = vertexNormals[vi];
    const uv = v.attributes.uv || [0, 0];

    posMin = new Vec3(Math.min(posMin.x, pos.x), Math.min(posMin.y, pos.y), Math.min(posMin.z, pos.z));
    posMax = new Vec3(Math.max(posMax.x, pos.x), Math.max(posMax.y, pos.y), Math.max(posMax.z, pos.z));

    const off = vi * stride;
    vertexView.setFloat32(off, pos.x, true);
    vertexView.setFloat32(off + 4, pos.y, true);
    vertexView.setFloat32(off + 8, pos.z, true);
    vertexView.setFloat32(off + 12, normal.x, true);
    vertexView.setFloat32(off + 16, normal.y, true);
    vertexView.setFloat32(off + 20, normal.z, true);

    if (hasUVs) {
      vertexView.setFloat32(off + 24, uv[0], true);
      vertexView.setFloat32(off + 28, uv[1], true);
    }
  }

  // Add vertex buffer view
  const vertexBufViewIdx = bufferViews.length;
  bufferViews.push({
    buffer: 0,
    byteOffset,
    byteLength: vertexBuffer.byteLength,
    byteStride: stride,
    target: 34962 // ARRAY_BUFFER
  });
  bufferParts.push(new Uint8Array(vertexBuffer));
  byteOffset += vertexBuffer.byteLength;

  // Position accessor
  const posAccessorIdx = accessors.length;
  accessors.push({
    bufferView: vertexBufViewIdx,
    byteOffset: 0,
    componentType: 5126, // FLOAT
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

  // UV accessor (optional)
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

  // --- Build morph target accessors ---
  const morphTargetAccessors: number[] = [];
  const targetNames: string[] = [];
  const defaultWeights: number[] = [];

  for (const target of morphTargets.targets) {
    targetNames.push(target.name);
    defaultWeights.push(target.defaultWeight);

    // Build position delta buffer (dense - all vertices)
    const deltaBuffer = new Float32Array(vertexCount * 3);

    // Initialize to zero
    deltaBuffer.fill(0);

    // Fill in the sparse offsets
    let deltaMin = new Vec3(0, 0, 0);
    let deltaMax = new Vec3(0, 0, 0);

    for (const offset of target.offsets) {
      const vi = offset.vertexIndex;
      if (vi >= 0 && vi < vertexCount) {
        const dx = offset.offset.x;
        const dy = offset.offset.y;
        const dz = offset.offset.z;

        deltaBuffer[vi * 3] = dx;
        deltaBuffer[vi * 3 + 1] = dy;
        deltaBuffer[vi * 3 + 2] = dz;

        deltaMin = new Vec3(Math.min(deltaMin.x, dx), Math.min(deltaMin.y, dy), Math.min(deltaMin.z, dz));
        deltaMax = new Vec3(Math.max(deltaMax.x, dx), Math.max(deltaMax.y, dy), Math.max(deltaMax.z, dz));
      }
    }

    // Align to 4 bytes
    const deltaPadding = (4 - (byteOffset % 4)) % 4;
    if (deltaPadding > 0) {
      bufferParts.push(new Uint8Array(deltaPadding));
      byteOffset += deltaPadding;
    }

    // Add buffer view for this morph target
    const deltaBytes = new Uint8Array(deltaBuffer.buffer);
    const deltaBufViewIdx = bufferViews.length;
    bufferViews.push({
      buffer: 0,
      byteOffset,
      byteLength: deltaBytes.byteLength,
      target: 34962
    });
    bufferParts.push(deltaBytes);
    byteOffset += deltaBytes.byteLength;

    // Add accessor for this morph target
    const deltaAccessorIdx = accessors.length;
    accessors.push({
      bufferView: deltaBufViewIdx,
      byteOffset: 0,
      componentType: 5126,
      count: vertexCount,
      type: 'VEC3',
      min: [deltaMin.x, deltaMin.y, deltaMin.z],
      max: [deltaMax.x, deltaMax.y, deltaMax.z]
    });

    morphTargetAccessors.push(deltaAccessorIdx);
  }

  // --- Build index buffer ---
  const indices: number[] = [];
  for (const face of mesh.faces) {
    indices.push(...face.indices);
  }

  const useShort = vertexCount <= 65535;
  const indexBuffer = useShort
    ? new Uint16Array(indices).buffer
    : new Uint32Array(indices).buffer;

  // Align to 4 bytes
  const indexPadding = (4 - (byteOffset % 4)) % 4;
  if (indexPadding > 0) {
    bufferParts.push(new Uint8Array(indexPadding));
    byteOffset += indexPadding;
  }

  const indexBufViewIdx = bufferViews.length;
  bufferViews.push({
    buffer: 0,
    byteOffset,
    byteLength: indexBuffer.byteLength,
    target: 34963
  });
  bufferParts.push(new Uint8Array(indexBuffer));
  byteOffset += indexBuffer.byteLength;

  const indexAccessorIdx = accessors.length;
  accessors.push({
    bufferView: indexBufViewIdx,
    byteOffset: 0,
    componentType: useShort ? 5123 : 5125,
    count: indices.length,
    type: 'SCALAR'
  });

  // --- Build mesh primitive with morph targets ---
  const attributes: any = {
    POSITION: posAccessorIdx,
    NORMAL: normalAccessorIdx
  };
  if (uvAccessorIdx !== undefined) {
    attributes.TEXCOORD_0 = uvAccessorIdx;
  }

  // Build targets array (each target has a POSITION accessor)
  const targets = morphTargetAccessors.map(accessorIdx => ({
    POSITION: accessorIdx
  }));

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
      generator: 'Procedurable E4-002'
    },
    scene: 0,
    scenes: [{ name, nodes: [0] }],
    nodes: [{ name, mesh: 0 }],
    meshes: [{
      name,
      primitives: [{
        attributes,
        indices: indexAccessorIdx,
        material: materials.length > 0 ? 0 : undefined,
        targets
      }],
      weights: defaultWeights,
      extras: {
        targetNames
      }
    }],
    accessors,
    bufferViews,
    buffers: [{ byteLength: binBuffer.byteLength }]
  };

  // Add materials if present
  if (materials.length > 0) {
    gltf.materials = buildGLTFMaterials(materials, []);
  }

  // Pack as GLB
  const glb = packGLB(gltf, binBuffer);

  return {
    glb,
    stats: {
      vertexCount,
      triangleCount: indices.length / 3,
      materialCount: Math.max(materials.length, 1),
      morphTargetCount: morphTargets.targets.length,
      byteSize: glb.byteLength,
      hasUVs
    }
  };
}

/**
 * Export a Mesh with baked textures to GLB (binary glTF 2.0).
 *
 * G6-002: glTF export with embedded baked textures.
 *
 * Includes:
 * - baseColorTexture for albedo
 * - metallicRoughnessTexture (combined: G=roughness, B=metallic)
 * - normalTexture for normal maps
 * - occlusionTexture for ambient occlusion
 *
 * Textures are embedded as PNG images in the GLB binary chunk.
 *
 * @param mesh The mesh to export
 * @param textures Baked texture set from TextureBaker
 * @param name Optional name for the model
 * @param embedTextures If true, embed textures in GLB. If false, reference external files (not implemented yet).
 */
export function exportTexturedGLB(
  mesh: Mesh,
  textures: BakedTextureSet,
  name: string = 'textured_mesh',
  embedTextures: boolean = true
): GLTFTexturedExportResult {
  if (!embedTextures) {
    throw new Error('External texture references not yet implemented. Use embedTextures=true.');
  }

  const triangulated = mesh.triangulate();

  // Group faces by material
  const materialGroups = groupFacesByMaterial(triangulated);
  const materials = triangulated.materialSlots;

  // Check if any vertex has UVs
  const hasUVs = triangulated.vertices.some(v => v.attributes.uv !== undefined);

  if (!hasUVs) {
    throw new Error('Cannot export textured model: mesh has no UVs. Run UV unwrapping first.');
  }

  // Build per-primitive geometry buffers
  const primitiveData = materialGroups.map(group =>
    buildPrimitiveBuffer(triangulated, group.faceIndices, hasUVs)
  );

  // Buffer management
  const bufferParts: Uint8Array[] = [];
  const accessors: any[] = [];
  const bufferViews: any[] = [];
  const images: any[] = [];
  const samplers: any[] = [];
  const gltfTextures: any[] = [];
  let byteOffset = 0;

  // --- Build geometry buffers ---
  const primitiveSpecs: any[] = [];

  for (let pi = 0; pi < primitiveData.length; pi++) {
    const prim = primitiveData[pi];
    // --- Vertex buffer (interleaved: pos + normal + uv) ---
    const stride = 32; // pos(12) + normal(12) + uv(8)
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

    // UV accessor
    const uvAccessorIdx = accessors.length;
    accessors.push({
      bufferView: vertexBufViewIdx,
      byteOffset: 24,
      componentType: 5126,
      count: prim.vertexCount,
      type: 'VEC2'
    });

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
      componentType: useShort ? 5123 : 5125,
      count: prim.indexCount,
      type: 'SCALAR'
    });

    // Build primitive spec (material assigned after textures are processed)
    primitiveSpecs.push({
      attributes: {
        POSITION: posAccessorIdx,
        NORMAL: normalAccessorIdx,
        TEXCOORD_0: uvAccessorIdx
      },
      indices: indexAccessorIdx,
      material: 0 // Will be updated below
    });
  }

  // --- Add texture sampler ---
  const samplerId = samplers.length;
  samplers.push({
    magFilter: 9729, // LINEAR
    minFilter: 9987, // LINEAR_MIPMAP_LINEAR
    wrapS: 10497,    // REPEAT
    wrapT: 10497     // REPEAT
  });

  // --- Encode and embed textures ---
  let textureCount = 0;

  // Helper to add a texture image
  const addTextureImage = (imageData: Uint8Array, textureName: string, mimeType: string = 'image/png'): number => {
    // Align to 4 bytes
    const padding = (4 - (byteOffset % 4)) % 4;
    if (padding > 0) {
      bufferParts.push(new Uint8Array(padding));
      byteOffset += padding;
    }

    // Add buffer view for image data
    const imageBufferViewIdx = bufferViews.length;
    bufferViews.push({
      buffer: 0,
      byteOffset,
      byteLength: imageData.byteLength
      // No target for image buffer views
    });
    bufferParts.push(imageData);
    byteOffset += imageData.byteLength;

    // Add image reference
    const imageIdx = images.length;
    images.push({
      name: textureName,
      mimeType,
      bufferView: imageBufferViewIdx
    });

    // Add texture reference
    const textureIdx = gltfTextures.length;
    gltfTextures.push({
      sampler: samplerId,
      source: imageIdx
    });

    textureCount++;
    return textureIdx;
  };

  // Track texture indices for material
  let baseColorTextureIdx: number | undefined;
  let metallicRoughnessTextureIdx: number | undefined;
  let normalTextureIdx: number | undefined;
  let occlusionTextureIdx: number | undefined;

  // Add albedo (base color) texture
  if (textures.albedo) {
    const pngData = encodeRGBAToPNG(textures.albedo, textures.resolution, textures.resolution);
    baseColorTextureIdx = addTextureImage(pngData, `${name}_baseColor`);
  }

  // Build combined metallicRoughness texture (glTF convention: G=roughness, B=metallic)
  if (textures.roughness || textures.metallic) {
    const resolution = textures.resolution;
    const pixelCount = resolution * resolution;
    const combinedRGBA = new Uint8Array(pixelCount * 4);

    for (let i = 0; i < pixelCount; i++) {
      const roughness = textures.roughness ? textures.roughness[i] : 127; // Default 0.5
      const metallic = textures.metallic ? textures.metallic[i] : 0;     // Default 0.0

      combinedRGBA[i * 4] = 255;       // R: unused (but must be present)
      combinedRGBA[i * 4 + 1] = roughness; // G: roughness
      combinedRGBA[i * 4 + 2] = metallic;  // B: metallic
      combinedRGBA[i * 4 + 3] = 255;       // A: unused
    }

    const pngData = encodeRGBAToPNG(combinedRGBA, resolution, resolution);
    metallicRoughnessTextureIdx = addTextureImage(pngData, `${name}_metallicRoughness`);
  }

  // Add normal texture
  if (textures.normal) {
    const pngData = encodeRGBAToPNG(textures.normal, textures.resolution, textures.resolution);
    normalTextureIdx = addTextureImage(pngData, `${name}_normal`);
  }

  // Add ambient occlusion texture
  if (textures.ao) {
    // AO is grayscale; encode as RGB with same value in all channels
    const resolution = textures.resolution;
    const pixelCount = resolution * resolution;
    const aoRGBA = new Uint8Array(pixelCount * 4);

    for (let i = 0; i < pixelCount; i++) {
      const ao = textures.ao[i];
      aoRGBA[i * 4] = ao;
      aoRGBA[i * 4 + 1] = ao;
      aoRGBA[i * 4 + 2] = ao;
      aoRGBA[i * 4 + 3] = 255;
    }

    const pngData = encodeRGBAToPNG(aoRGBA, resolution, resolution);
    occlusionTextureIdx = addTextureImage(pngData, `${name}_occlusion`);
  }

  // --- Build textured material ---
  const pbrMaterial: any = {
    name: `${name}_material`,
    pbrMetallicRoughness: {}
  };

  if (baseColorTextureIdx !== undefined) {
    pbrMaterial.pbrMetallicRoughness.baseColorTexture = {
      index: baseColorTextureIdx,
      texCoord: 0
    };
  } else {
    // Fallback base color
    const baseColor = materials.length > 0
      ? [materials[0].color.r, materials[0].color.g, materials[0].color.b, 1.0]
      : [0.545, 0.353, 0.169, 1.0]; // Default wood brown
    pbrMaterial.pbrMetallicRoughness.baseColorFactor = baseColor;
  }

  if (metallicRoughnessTextureIdx !== undefined) {
    pbrMaterial.pbrMetallicRoughness.metallicRoughnessTexture = {
      index: metallicRoughnessTextureIdx,
      texCoord: 0
    };
  } else {
    // Fallback metallic/roughness values
    pbrMaterial.pbrMetallicRoughness.roughnessFactor = materials.length > 0 ? materials[0].roughness : 0.7;
    pbrMaterial.pbrMetallicRoughness.metallicFactor = materials.length > 0 ? materials[0].metalness : 0.1;
  }

  if (normalTextureIdx !== undefined) {
    pbrMaterial.normalTexture = {
      index: normalTextureIdx,
      texCoord: 0,
      scale: 1.0
    };
  }

  if (occlusionTextureIdx !== undefined) {
    pbrMaterial.occlusionTexture = {
      index: occlusionTextureIdx,
      texCoord: 0,
      strength: 1.0
    };
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
      generator: 'Procedurable G6-002'
    },
    scene: 0,
    scenes: [{ name, nodes: [0] }],
    nodes: [{ name, mesh: 0 }],
    meshes: [{ name, primitives: primitiveSpecs }],
    accessors,
    bufferViews,
    buffers: [{ byteLength: binBuffer.byteLength }],
    materials: [pbrMaterial],
    samplers,
    textures: gltfTextures,
    images
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
      materialCount: 1,
      textureCount,
      textureResolution: textures.resolution,
      byteSize: glb.byteLength,
      hasUVs: true
    }
  };
}

/**
 * Export mesh with per-material textures (G6-004).
 *
 * Each material slot gets its own set of textures.
 * This is more efficient for multi-material meshes like ChessBoard
 * because solid color materials get 1x1 textures instead of sharing
 * a crowded UV atlas.
 *
 * @param mesh The mesh to export
 * @param perMaterialTextures Map from material slot index to texture set
 * @param name Name for the mesh
 */
export function exportMultiMaterialTexturedGLB(
  mesh: Mesh,
  perMaterialTextures: Map<number, BakedTextureSet>,
  name: string = 'textured_mesh'
): GLTFTexturedExportResult {
  const triangulated = mesh.triangulate();

  // Group faces by material
  const materialGroups = groupFacesByMaterial(triangulated);
  const materials = triangulated.materialSlots;

  // Check if any vertex has UVs
  const hasUVs = triangulated.vertices.some(v => v.attributes.uv !== undefined);

  if (!hasUVs) {
    throw new Error('Cannot export textured model: mesh has no UVs. Run UV unwrapping first.');
  }

  // Build per-primitive geometry buffers
  const primitiveData = materialGroups.map(group =>
    buildPrimitiveBuffer(triangulated, group.faceIndices, hasUVs)
  );

  // Buffer management
  const bufferParts: Uint8Array[] = [];
  const accessors: any[] = [];
  const bufferViews: any[] = [];
  const images: any[] = [];
  const samplers: any[] = [];
  const gltfTextures: any[] = [];
  const gltfMaterials: any[] = [];
  let byteOffset = 0;
  let totalTextureCount = 0;

  // --- Add shared texture sampler ---
  const samplerId = samplers.length;
  samplers.push({
    magFilter: 9729, // LINEAR
    minFilter: 9987, // LINEAR_MIPMAP_LINEAR
    wrapS: 10497,    // REPEAT
    wrapT: 10497     // REPEAT
  });

  // Helper to add a texture image
  const addTextureImage = (imageData: Uint8Array, textureName: string, mimeType: string = 'image/png'): number => {
    const padding = (4 - (byteOffset % 4)) % 4;
    if (padding > 0) {
      bufferParts.push(new Uint8Array(padding));
      byteOffset += padding;
    }

    const imageBufferViewIdx = bufferViews.length;
    bufferViews.push({
      buffer: 0,
      byteOffset,
      byteLength: imageData.byteLength
    });
    bufferParts.push(imageData);
    byteOffset += imageData.byteLength;

    const imageIdx = images.length;
    images.push({
      name: textureName,
      mimeType,
      bufferView: imageBufferViewIdx
    });

    const textureIdx = gltfTextures.length;
    gltfTextures.push({
      sampler: samplerId,
      source: imageIdx
    });

    totalTextureCount++;
    return textureIdx;
  };

  // --- Build materials with their textures ---
  for (let mi = 0; mi < Math.max(materialGroups.length, 1); mi++) {
    const materialSlot = materials[mi] || { name: `material_${mi}`, color: { r: 0.5, g: 0.5, b: 0.5 }, roughness: 0.5, metalness: 0 };
    const textures = perMaterialTextures.get(mi);

    const pbrMaterial: any = {
      name: materialSlot.name || `material_${mi}`,
      pbrMetallicRoughness: {}
    };

    if (textures) {
      const resolution = textures.resolution;
      const matName = materialSlot.name || `mat${mi}`;

      // Add albedo texture
      if (textures.albedo) {
        const pngData = encodeRGBAToPNG(textures.albedo, resolution, resolution);
        const textureIdx = addTextureImage(pngData, `${matName}_baseColor`);
        pbrMaterial.pbrMetallicRoughness.baseColorTexture = { index: textureIdx, texCoord: 0 };
      } else {
        pbrMaterial.pbrMetallicRoughness.baseColorFactor = [materialSlot.color.r, materialSlot.color.g, materialSlot.color.b, 1.0];
      }

      // Add metallicRoughness texture
      if (textures.roughness || textures.metallic) {
        const pixelCount = resolution * resolution;
        const combinedRGBA = new Uint8Array(pixelCount * 4);

        for (let i = 0; i < pixelCount; i++) {
          const roughness = textures.roughness ? textures.roughness[i] : 127;
          const metallic = textures.metallic ? textures.metallic[i] : 0;
          combinedRGBA[i * 4] = 255;
          combinedRGBA[i * 4 + 1] = roughness;
          combinedRGBA[i * 4 + 2] = metallic;
          combinedRGBA[i * 4 + 3] = 255;
        }

        const pngData = encodeRGBAToPNG(combinedRGBA, resolution, resolution);
        const textureIdx = addTextureImage(pngData, `${matName}_metallicRoughness`);
        pbrMaterial.pbrMetallicRoughness.metallicRoughnessTexture = { index: textureIdx, texCoord: 0 };
      } else {
        pbrMaterial.pbrMetallicRoughness.roughnessFactor = materialSlot.roughness ?? 0.5;
        pbrMaterial.pbrMetallicRoughness.metallicFactor = materialSlot.metalness ?? 0.0;
      }

      // Add normal texture
      if (textures.normal) {
        const pngData = encodeRGBAToPNG(textures.normal, resolution, resolution);
        const textureIdx = addTextureImage(pngData, `${matName}_normal`);
        pbrMaterial.normalTexture = { index: textureIdx, texCoord: 0, scale: 1.0 };
      }

      // Add AO texture
      if (textures.ao) {
        const pixelCount = resolution * resolution;
        const aoRGBA = new Uint8Array(pixelCount * 4);
        for (let i = 0; i < pixelCount; i++) {
          const ao = textures.ao[i];
          aoRGBA[i * 4] = ao;
          aoRGBA[i * 4 + 1] = ao;
          aoRGBA[i * 4 + 2] = ao;
          aoRGBA[i * 4 + 3] = 255;
        }
        const pngData = encodeRGBAToPNG(aoRGBA, resolution, resolution);
        const textureIdx = addTextureImage(pngData, `${matName}_occlusion`);
        pbrMaterial.occlusionTexture = { index: textureIdx, texCoord: 0, strength: 1.0 };
      }
    } else {
      // No textures for this material - use solid color
      pbrMaterial.pbrMetallicRoughness.baseColorFactor = [materialSlot.color.r, materialSlot.color.g, materialSlot.color.b, 1.0];
      pbrMaterial.pbrMetallicRoughness.roughnessFactor = materialSlot.roughness ?? 0.5;
      pbrMaterial.pbrMetallicRoughness.metallicFactor = materialSlot.metalness ?? 0.0;
    }

    gltfMaterials.push(pbrMaterial);
  }

  // --- Build geometry buffers ---
  const primitiveSpecs: any[] = [];

  for (let pi = 0; pi < primitiveData.length; pi++) {
    const prim = primitiveData[pi];
    const stride = 32;
    const vertexBuf = prim.vertexBuffer;
    const vertexBufViewIdx = bufferViews.length;
    bufferViews.push({
      buffer: 0,
      byteOffset,
      byteLength: vertexBuf.byteLength,
      byteStride: stride,
      target: 34962
    });
    bufferParts.push(new Uint8Array(vertexBuf));
    byteOffset += vertexBuf.byteLength;

    const posAccessorIdx = accessors.length;
    accessors.push({
      bufferView: vertexBufViewIdx,
      byteOffset: 0,
      componentType: 5126,
      count: prim.vertexCount,
      type: 'VEC3',
      min: [prim.posMin.x, prim.posMin.y, prim.posMin.z],
      max: [prim.posMax.x, prim.posMax.y, prim.posMax.z]
    });

    const normalAccessorIdx = accessors.length;
    accessors.push({
      bufferView: vertexBufViewIdx,
      byteOffset: 12,
      componentType: 5126,
      count: prim.vertexCount,
      type: 'VEC3'
    });

    const uvAccessorIdx = accessors.length;
    accessors.push({
      bufferView: vertexBufViewIdx,
      byteOffset: 24,
      componentType: 5126,
      count: prim.vertexCount,
      type: 'VEC2'
    });

    const indexBuf = prim.indexBuffer;
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
      target: 34963
    });
    bufferParts.push(new Uint8Array(indexBuf));
    byteOffset += indexBuf.byteLength;

    const indexAccessorIdx = accessors.length;
    accessors.push({
      bufferView: indexBufViewIdx,
      byteOffset: 0,
      componentType: useShort ? 5123 : 5125,
      count: prim.indexCount,
      type: 'SCALAR'
    });

    // Assign material index to primitive
    const materialIdx = Math.min(pi, gltfMaterials.length - 1);
    primitiveSpecs.push({
      attributes: {
        POSITION: posAccessorIdx,
        NORMAL: normalAccessorIdx,
        TEXCOORD_0: uvAccessorIdx
      },
      indices: indexAccessorIdx,
      material: materialIdx
    });
  }

  // Pad total buffer
  const totalPadding = (4 - (byteOffset % 4)) % 4;
  if (totalPadding > 0) {
    bufferParts.push(new Uint8Array(totalPadding));
    byteOffset += totalPadding;
  }

  const binBuffer = concatBuffers(bufferParts);

  const gltf: any = {
    asset: {
      version: '2.0',
      generator: 'Procedurable G6-004'
    },
    scene: 0,
    scenes: [{ name, nodes: [0] }],
    nodes: [{ name, mesh: 0 }],
    meshes: [{ name, primitives: primitiveSpecs }],
    accessors,
    bufferViews,
    buffers: [{ byteLength: binBuffer.byteLength }],
    materials: gltfMaterials,
    samplers: samplers.length > 0 ? samplers : undefined,
    textures: gltfTextures.length > 0 ? gltfTextures : undefined,
    images: images.length > 0 ? images : undefined
  };

  const glb = packGLB(gltf, binBuffer);

  const totalVertices = primitiveData.reduce((s, p) => s + p.vertexCount, 0);
  const totalTriangles = primitiveData.reduce((s, p) => s + p.indexCount / 3, 0);
  const maxResolution = Math.max(...Array.from(perMaterialTextures.values()).map(t => t.resolution), 1);

  return {
    glb,
    stats: {
      vertexCount: totalVertices,
      triangleCount: totalTriangles,
      materialCount: gltfMaterials.length,
      textureCount: totalTextureCount,
      textureResolution: maxResolution,
      byteSize: glb.byteLength,
      hasUVs: true
    }
  };
}

/**
 * Encode RGBA pixel data to PNG format.
 *
 * This is a minimal PNG encoder that produces valid PNG files.
 * No compression (DEFLATE with no compression) for simplicity.
 */
function encodeRGBAToPNG(rgba: Uint8Array, width: number, height: number): Uint8Array {
  // PNG signature
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

  // Build IHDR chunk
  const ihdr = new ArrayBuffer(13);
  const ihdrView = new DataView(ihdr);
  ihdrView.setUint32(0, width, false);    // Big-endian width
  ihdrView.setUint32(4, height, false);   // Big-endian height
  ihdrView.setUint8(8, 8);                // Bit depth: 8
  ihdrView.setUint8(9, 6);                // Color type: 6 = RGBA
  ihdrView.setUint8(10, 0);               // Compression: 0
  ihdrView.setUint8(11, 0);               // Filter: 0
  ihdrView.setUint8(12, 0);               // Interlace: 0
  const ihdrChunk = buildPNGChunk('IHDR', new Uint8Array(ihdr));

  // Build IDAT chunk (image data)
  // For each row: 1 filter byte (0 = None) + row pixels (RGBA)
  const rowSize = 1 + width * 4;
  const rawData = new Uint8Array(height * rowSize);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter type: None

    for (let x = 0; x < width; x++) {
      // Flip Y for PNG (top to bottom)
      const srcY = height - 1 - y;
      const srcIdx = (srcY * width + x) * 4;
      const dstIdx = rowOffset + 1 + x * 4;

      rawData[dstIdx] = rgba[srcIdx];       // R
      rawData[dstIdx + 1] = rgba[srcIdx + 1]; // G
      rawData[dstIdx + 2] = rgba[srcIdx + 2]; // B
      rawData[dstIdx + 3] = rgba[srcIdx + 3]; // A
    }
  }

  // Wrap in zlib stream (no compression)
  const zlibData = wrapDeflateNoCompression(rawData);
  const idatChunk = buildPNGChunk('IDAT', zlibData);

  // Build IEND chunk
  const iendChunk = buildPNGChunk('IEND', new Uint8Array(0));

  // Concatenate all parts
  const totalLength = signature.length + ihdrChunk.length + idatChunk.length + iendChunk.length;
  const png = new Uint8Array(totalLength);
  let offset = 0;

  png.set(signature, offset);
  offset += signature.length;

  png.set(ihdrChunk, offset);
  offset += ihdrChunk.length;

  png.set(idatChunk, offset);
  offset += idatChunk.length;

  png.set(iendChunk, offset);

  return png;
}

/**
 * Build a PNG chunk: length(4) + type(4) + data + crc(4)
 */
function buildPNGChunk(type: string, data: Uint8Array): Uint8Array {
  const chunkLength = data.length;
  const chunk = new Uint8Array(4 + 4 + chunkLength + 4);
  const view = new DataView(chunk.buffer);

  // Length (big-endian)
  view.setUint32(0, chunkLength, false);

  // Type
  chunk[4] = type.charCodeAt(0);
  chunk[5] = type.charCodeAt(1);
  chunk[6] = type.charCodeAt(2);
  chunk[7] = type.charCodeAt(3);

  // Data
  chunk.set(data, 8);

  // CRC-32 over type + data
  const crc = crc32(chunk.subarray(4, 8 + chunkLength));
  view.setUint32(8 + chunkLength, crc, false);

  return chunk;
}

/**
 * Wrap raw data in a zlib stream with no compression (DEFLATE stored blocks).
 */
function wrapDeflateNoCompression(data: Uint8Array): Uint8Array {
  // Zlib header: CMF=0x78 (deflate, 32K window), FLG=0x01 (no preset dict, check bits)
  const header = new Uint8Array([0x78, 0x01]);

  // Split into stored blocks (max 65535 bytes each)
  const maxBlockSize = 65535;
  const numBlocks = Math.ceil(data.length / maxBlockSize);
  const blocks: Uint8Array[] = [];

  for (let i = 0; i < numBlocks; i++) {
    const isLast = i === numBlocks - 1;
    const blockStart = i * maxBlockSize;
    const blockEnd = Math.min(blockStart + maxBlockSize, data.length);
    const blockData = data.subarray(blockStart, blockEnd);
    const blockLen = blockData.length;

    // Block header: 5 bytes
    // BFINAL (1 bit) + BTYPE (2 bits = 00 for stored) + padding to byte boundary
    // LEN (2 bytes LE) + NLEN (2 bytes LE, one's complement of LEN)
    const blockHeader = new Uint8Array(5);
    blockHeader[0] = isLast ? 0x01 : 0x00; // BFINAL=1 for last block, BTYPE=00 (stored)
    blockHeader[1] = blockLen & 0xFF;
    blockHeader[2] = (blockLen >> 8) & 0xFF;
    blockHeader[3] = (~blockLen) & 0xFF;
    blockHeader[4] = ((~blockLen) >> 8) & 0xFF;

    blocks.push(blockHeader);
    blocks.push(blockData);
  }

  // Adler-32 checksum of uncompressed data
  const adler = adler32(data);
  const adlerBytes = new Uint8Array(4);
  adlerBytes[0] = (adler >> 24) & 0xFF;
  adlerBytes[1] = (adler >> 16) & 0xFF;
  adlerBytes[2] = (adler >> 8) & 0xFF;
  adlerBytes[3] = adler & 0xFF;

  // Concatenate: header + blocks + adler
  const totalLen = 2 + blocks.reduce((s, b) => s + b.length, 0) + 4;
  const result = new Uint8Array(totalLen);
  let offset = 0;

  result.set(header, offset);
  offset += 2;

  for (const block of blocks) {
    result.set(block, offset);
    offset += block.length;
  }

  result.set(adlerBytes, offset);

  return result;
}

/**
 * Adler-32 checksum
 */
function adler32(data: Uint8Array): number {
  const MOD_ADLER = 65521;
  let a = 1;
  let b = 0;

  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]) % MOD_ADLER;
    b = (b + a) % MOD_ADLER;
  }

  return (b << 16) | a;
}

/**
 * CRC-32 checksum (used by PNG)
 */
function crc32(data: Uint8Array): number {
  // Build CRC table on first call
  if (!crc32Table) {
    crc32Table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        if (c & 1) {
          c = 0xEDB88320 ^ (c >>> 1);
        } else {
          c = c >>> 1;
        }
      }
      crc32Table[n] = c;
    }
  }

  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = crc32Table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

let crc32Table: Uint32Array | null = null;

/**
 * Compute inverse bind matrices for each joint.
 *
 * The inverse bind matrix (IBM) transforms a vertex from model space
 * to the joint's local space in the bind pose. It's the inverse of
 * the joint's world transform.
 */
function computeInverseBindMatrices(skeleton: TracedSkeleton): Float32Array[] {
  const matrices: Float32Array[] = [];

  for (const joint of skeleton.joints) {
    // Build the world transform matrix for this joint
    const worldMatrix = buildJointWorldMatrix(joint);

    // Invert it to get the inverse bind matrix
    const ibm = invertMatrix4(worldMatrix);
    matrices.push(ibm);
  }

  return matrices;
}

/**
 * Build a 4x4 transformation matrix for a joint's world pose.
 */
function buildJointWorldMatrix(joint: TracedJoint): Float32Array {
  const matrix = new Float32Array(16);

  // Translation
  const tx = joint.worldPosition.x;
  const ty = joint.worldPosition.y;
  const tz = joint.worldPosition.z;

  // Rotation (euler to rotation matrix)
  const rx = joint.worldOrientation.x;
  const ry = joint.worldOrientation.y;
  const rz = joint.worldOrientation.z;

  const cx = Math.cos(rx), sx = Math.sin(rx);
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const cz = Math.cos(rz), sz = Math.sin(rz);

  // Rotation matrix (XYZ order) combined with translation
  // Column-major order for glTF
  matrix[0] = cy * cz;
  matrix[1] = sx * sy * cz + cx * sz;
  matrix[2] = -cx * sy * cz + sx * sz;
  matrix[3] = 0;

  matrix[4] = -cy * sz;
  matrix[5] = -sx * sy * sz + cx * cz;
  matrix[6] = cx * sy * sz + sx * cz;
  matrix[7] = 0;

  matrix[8] = sy;
  matrix[9] = -sx * cy;
  matrix[10] = cx * cy;
  matrix[11] = 0;

  matrix[12] = tx;
  matrix[13] = ty;
  matrix[14] = tz;
  matrix[15] = 1;

  return matrix;
}

/**
 * Invert a 4x4 matrix.
 */
function invertMatrix4(m: Float32Array): Float32Array {
  const result = new Float32Array(16);

  const m00 = m[0], m01 = m[1], m02 = m[2], m03 = m[3];
  const m10 = m[4], m11 = m[5], m12 = m[6], m13 = m[7];
  const m20 = m[8], m21 = m[9], m22 = m[10], m23 = m[11];
  const m30 = m[12], m31 = m[13], m32 = m[14], m33 = m[15];

  const b00 = m00 * m11 - m01 * m10;
  const b01 = m00 * m12 - m02 * m10;
  const b02 = m00 * m13 - m03 * m10;
  const b03 = m01 * m12 - m02 * m11;
  const b04 = m01 * m13 - m03 * m11;
  const b05 = m02 * m13 - m03 * m12;
  const b06 = m20 * m31 - m21 * m30;
  const b07 = m20 * m32 - m22 * m30;
  const b08 = m20 * m33 - m23 * m30;
  const b09 = m21 * m32 - m22 * m31;
  const b10 = m21 * m33 - m23 * m31;
  const b11 = m22 * m33 - m23 * m32;

  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

  if (!det) {
    // Return identity if singular
    result[0] = 1; result[5] = 1; result[10] = 1; result[15] = 1;
    return result;
  }

  det = 1.0 / det;

  result[0] = (m11 * b11 - m12 * b10 + m13 * b09) * det;
  result[1] = (m02 * b10 - m01 * b11 - m03 * b09) * det;
  result[2] = (m31 * b05 - m32 * b04 + m33 * b03) * det;
  result[3] = (m22 * b04 - m21 * b05 - m23 * b03) * det;
  result[4] = (m12 * b08 - m10 * b11 - m13 * b07) * det;
  result[5] = (m00 * b11 - m02 * b08 + m03 * b07) * det;
  result[6] = (m32 * b02 - m30 * b05 - m33 * b01) * det;
  result[7] = (m20 * b05 - m22 * b02 + m23 * b01) * det;
  result[8] = (m10 * b10 - m11 * b08 + m13 * b06) * det;
  result[9] = (m01 * b08 - m00 * b10 - m03 * b06) * det;
  result[10] = (m30 * b04 - m31 * b02 + m33 * b00) * det;
  result[11] = (m21 * b02 - m20 * b04 - m23 * b00) * det;
  result[12] = (m11 * b07 - m10 * b09 - m12 * b06) * det;
  result[13] = (m00 * b09 - m01 * b07 + m02 * b06) * det;
  result[14] = (m31 * b01 - m30 * b03 - m32 * b00) * det;
  result[15] = (m20 * b03 - m21 * b01 + m22 * b00) * det;

  return result;
}

/**
 * Compute vertex normals by averaging face normals.
 */
function computeVertexNormals(mesh: Mesh): Vec3[] {
  const normals: Vec3[] = mesh.vertices.map(() => new Vec3(0, 0, 0));

  for (const face of mesh.faces) {
    if (face.indices.length < 3) continue;
    const v0 = mesh.vertices[face.indices[0]].position;
    const v1 = mesh.vertices[face.indices[1]].position;
    const v2 = mesh.vertices[face.indices[2]].position;
    const faceNormal = v1.sub(v0).cross(v2.sub(v0)).normalize();

    for (const vi of face.indices) {
      normals[vi] = normals[vi].add(faceNormal);
    }
  }

  // Normalize
  for (let i = 0; i < normals.length; i++) {
    const len = normals[i].length();
    if (len > 0) {
      normals[i] = normals[i].mul(1 / len);
    } else {
      normals[i] = new Vec3(0, 1, 0);
    }
  }

  return normals;
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

  // Use pre-computed vertex normals if available (from MeshAnalysis or calculateNormals),
  // otherwise fall back to computing smooth normals by averaging face normals per vertex.
  // This ensures normals are consistent with what the texture baker used.
  const hasPrecomputedNormals = orderedVertices.some(oi => mesh.vertices[oi].attributes.normal !== undefined);

  const vertexNormals = new Map<number, Vec3>();
  if (hasPrecomputedNormals) {
    // Use existing normals from vertex attributes
    for (const oi of orderedVertices) {
      const v = mesh.vertices[oi];
      if (v.attributes.normal) {
        vertexNormals.set(oi, v.attributes.normal);
      }
    }
  }

  if (!hasPrecomputedNormals) {
    // Fall back: compute normals with smoothGroup awareness
    // First pass: accumulate face normals
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

    // Second pass: share normals across smoothGroup siblings at same position
    const hasSmoothGroups = orderedVertices.some(oi => mesh.vertices[oi].attributes.smoothGroup !== undefined);
    if (hasSmoothGroups) {
      const groupMap = new Map<string, number[]>();
      for (const oi of orderedVertices) {
        const v = mesh.vertices[oi];
        const sg = v.attributes.smoothGroup;
        if (sg !== undefined) {
          const p = v.position;
          const key = `${sg}-${p.x.toFixed(6)}-${p.y.toFixed(6)}-${p.z.toFixed(6)}`;
          if (!groupMap.has(key)) groupMap.set(key, []);
          groupMap.get(key)!.push(oi);
        }
      }
      for (const indices of groupMap.values()) {
        if (indices.length <= 1) continue;
        let shared = Vec3.zero();
        for (const idx of indices) {
          shared = shared.add(vertexNormals.get(idx) || Vec3.zero());
        }
        for (const idx of indices) {
          vertexNormals.set(idx, shared);
        }
      }
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

// =============================================================================
// Exported PNG Encoding Helper
// =============================================================================

/**
 * Encode texture data to PNG format.
 *
 * @param data - Raw texture data (RGBA for channels=4, grayscale for channels=1)
 * @param width - Texture width
 * @param height - Texture height
 * @param channels - Number of channels (1=grayscale, 4=RGBA)
 * @returns PNG file as Uint8Array
 */
export function encodeTextureToPNG(data: Uint8Array, width: number, height: number, channels: 1 | 4 = 4): Uint8Array {
  // Convert grayscale to RGBA if needed
  let rgba: Uint8Array;
  if (channels === 1) {
    rgba = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      const gray = data[i];
      rgba[i * 4] = gray;
      rgba[i * 4 + 1] = gray;
      rgba[i * 4 + 2] = gray;
      rgba[i * 4 + 3] = 255;
    }
  } else {
    rgba = data;
  }

  return encodeRGBAToPNG(rgba, width, height);
}


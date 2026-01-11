/**
 * Mesh Modeler - Blender-like mesh construction
 *
 * Instead of combining disconnected primitives, this builds meshes
 * the way artists do in Blender:
 * - Start with a base shape
 * - Extrude edges/faces to grow the mesh
 * - All geometry is connected
 * - Proper for UV mapping and texturing
 *
 * Key operations:
 * - extrudeFace() - push a face outward, creating new side faces
 * - extrudeEdgeLoop() - extrude a ring of edges
 * - bridgeLoops() - connect two edge loops with faces
 * - insetFace() - create smaller face inside existing face
 * - extrudeAlongPath() - extrude loop along a curved path
 * - defineSeam() - mark edge loops as connection points
 */

import { Mesh } from '../geometry/Mesh';
import { Vertex } from '../geometry/Vertex';
import { Face } from '../geometry/Face';
import { Vec3 } from '../core/Vec3';

/**
 * Seam definition for connecting meshes
 */
export interface Seam {
  name: string;
  loopIndices: number[];
  normal: Vec3;
  center: Vec3;
  radius: number;
}

/**
 * Bone for rigging
 */
export interface Bone {
  name: string;
  head: Vec3;
  tail: Vec3;
  parent?: string;
  children: string[];
}

/**
 * MeshModeler - builds connected meshes through operations
 */
export class MeshModeler {
  mesh: Mesh;

  // Track named edge loops for later operations
  private namedLoops: Map<string, number[]> = new Map();

  // Seams for mesh assembly
  private seams: Map<string, Seam> = new Map();

  // Bones for rigging
  private bones: Map<string, Bone> = new Map();

  // Skin weights: vertex index -> [{bone, weight}]
  private skinWeights: Map<number, Array<{bone: string; weight: number}>> = new Map();

  constructor() {
    this.mesh = new Mesh();
  }

  /**
   * Start with a polygon face at origin
   * Returns the face index and edge loop indices
   */
  createFace(vertices: Vec3[]): { faceIndex: number; loopIndices: number[] } {
    const loopIndices: number[] = [];

    for (const pos of vertices) {
      loopIndices.push(this.mesh.vertices.length);
      this.mesh.addVertex(new Vertex(pos));
    }

    const faceIndex = this.mesh.faces.length;
    this.mesh.addFace(new Face(loopIndices));

    return { faceIndex, loopIndices };
  }

  /**
   * Create a rectangular face at the given Y height
   * Returns indices of the 4 corner vertices
   */
  createRectFace(width: number, depth: number, y: number = 0): number[] {
    const hw = width / 2;
    const hd = depth / 2;

    // Counter-clockwise when viewed from above
    const vertices = [
      new Vec3(-hw, y, -hd),  // 0: back-left
      new Vec3(-hw, y, hd),   // 1: front-left
      new Vec3(hw, y, hd),    // 2: front-right
      new Vec3(hw, y, -hd)    // 3: back-right
    ];

    return this.createFace(vertices).loopIndices;
  }

  /**
   * Extrude a face along a direction
   * Creates new side faces connecting old and new positions
   * Returns the new face's vertex indices
   */
  extrudeFace(faceIndex: number, direction: Vec3, distance: number): number[] {
    const face = this.mesh.faces[faceIndex];
    const offset = direction.normalize().mul(distance);

    // Create new vertices by offsetting existing ones
    const newIndices: number[] = [];
    for (const oldIndex of face.indices) {
      const oldPos = this.mesh.vertices[oldIndex].position;
      const newPos = oldPos.add(offset);
      newIndices.push(this.mesh.vertices.length);
      this.mesh.addVertex(new Vertex(newPos));
    }

    // Create side faces connecting old to new
    const n = face.indices.length;
    for (let i = 0; i < n; i++) {
      const nextI = (i + 1) % n;
      // Quad: old[i], old[i+1], new[i+1], new[i]
      // Counter-clockwise when viewed from outside
      this.mesh.addFace(new Face([
        face.indices[i],
        face.indices[nextI],
        newIndices[nextI],
        newIndices[i]
      ]));
    }

    // Update the original face to use new vertices (it becomes the "top")
    // Actually, we want to keep the original as bottom and create new top
    // So we create a new face for the top
    this.mesh.addFace(new Face([...newIndices].reverse())); // Reversed for outward normal

    return newIndices;
  }

  /**
   * Extrude an edge loop (ring of vertices) along a direction
   * This is like extruding a cylinder's top edge to make it taller
   */
  extrudeLoop(loopIndices: number[], direction: Vec3, distance: number): number[] {
    const offset = direction.normalize().mul(distance);
    const newIndices: number[] = [];

    // Create new vertices
    for (const oldIndex of loopIndices) {
      const oldPos = this.mesh.vertices[oldIndex].position;
      const newPos = oldPos.add(offset);
      newIndices.push(this.mesh.vertices.length);
      this.mesh.addVertex(new Vertex(newPos));
    }

    // Create connecting faces
    const n = loopIndices.length;
    for (let i = 0; i < n; i++) {
      const nextI = (i + 1) % n;
      this.mesh.addFace(new Face([
        loopIndices[i],
        loopIndices[nextI],
        newIndices[nextI],
        newIndices[i]
      ]));
    }

    return newIndices;
  }

  /**
   * Bridge two edge loops with faces
   * Loops must have same vertex count
   */
  bridgeLoops(loop1: number[], loop2: number[]): void {
    if (loop1.length !== loop2.length) {
      throw new Error('Loops must have same vertex count for bridging');
    }

    const n = loop1.length;
    for (let i = 0; i < n; i++) {
      const nextI = (i + 1) % n;
      this.mesh.addFace(new Face([
        loop1[i],
        loop1[nextI],
        loop2[nextI],
        loop2[i]
      ]));
    }
  }

  /**
   * Cap an edge loop with a face (fill the hole)
   */
  capLoop(loopIndices: number[], reverse: boolean = false): number {
    const indices = reverse ? [...loopIndices].reverse() : loopIndices;
    const faceIndex = this.mesh.faces.length;
    this.mesh.addFace(new Face(indices));
    return faceIndex;
  }

  /**
   * Scale a loop of vertices (for tapering)
   */
  scaleLoop(loopIndices: number[], scale: number, center?: Vec3): void {
    // Find center if not provided
    if (!center) {
      center = Vec3.zero();
      for (const i of loopIndices) {
        center = center.add(this.mesh.vertices[i].position);
      }
      center = center.div(loopIndices.length);
    }

    // Scale each vertex relative to center
    for (const i of loopIndices) {
      const v = this.mesh.vertices[i];
      const offset = v.position.sub(center);
      v.position = center.add(offset.mul(scale));
    }
  }

  /**
   * Translate a loop of vertices
   */
  translateLoop(loopIndices: number[], offset: Vec3): void {
    for (const i of loopIndices) {
      this.mesh.vertices[i].position = this.mesh.vertices[i].position.add(offset);
    }
  }

  /**
   * Create a circular edge loop
   */
  createCircleLoop(center: Vec3, radius: number, segments: number, normal: Vec3 = new Vec3(0, 1, 0)): number[] {
    const indices: number[] = [];

    // Calculate tangent vectors
    const up = Math.abs(normal.y) < 0.999 ? new Vec3(0, 1, 0) : new Vec3(1, 0, 0);
    const tangent1 = normal.cross(up).normalize();
    const tangent2 = normal.cross(tangent1).normalize();

    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const pos = center.add(tangent1.mul(x)).add(tangent2.mul(z));

      indices.push(this.mesh.vertices.length);
      this.mesh.addVertex(new Vertex(pos));
    }

    return indices;
  }

  /**
   * Name a loop for later reference
   */
  nameLoop(name: string, indices: number[]): void {
    this.namedLoops.set(name, indices);
  }

  /**
   * Get a named loop
   */
  getLoop(name: string): number[] | undefined {
    return this.namedLoops.get(name);
  }

  // ============================================
  // INSET OPERATIONS
  // ============================================

  /**
   * Inset a face - create a smaller face inside, connected by new faces
   * Useful for decorative frames, panel details
   * Returns the new inner loop indices
   */
  insetFace(faceIndex: number, amount: number): number[] {
    const face = this.mesh.faces[faceIndex];
    const n = face.indices.length;

    // Calculate face center
    let center = Vec3.zero();
    for (const i of face.indices) {
      center = center.add(this.mesh.vertices[i].position);
    }
    center = center.div(n);

    // Create inset vertices
    const innerIndices: number[] = [];
    for (const i of face.indices) {
      const pos = this.mesh.vertices[i].position;
      const toCenter = center.sub(pos).normalize();
      const newPos = pos.add(toCenter.mul(amount));
      innerIndices.push(this.mesh.vertices.length);
      this.mesh.addVertex(new Vertex(newPos));
    }

    // Create connecting quads between outer and inner
    for (let i = 0; i < n; i++) {
      const nextI = (i + 1) % n;
      this.mesh.addFace(new Face([
        face.indices[i],
        face.indices[nextI],
        innerIndices[nextI],
        innerIndices[i]
      ]));
    }

    // Update original face to be the inner face
    // (or create new inner face and delete original)
    this.mesh.addFace(new Face(innerIndices));

    return innerIndices;
  }

  /**
   * Cut a hole in a face by insetting and NOT capping
   * Returns the inner loop (the hole edge)
   */
  cutHoleInFace(faceIndex: number, insetAmount: number): number[] {
    const innerLoop = this.insetFace(faceIndex, insetAmount);
    // The inner face was added by insetFace, remove it to leave a hole
    this.mesh.faces.pop();
    return innerLoop;
  }

  // ============================================
  // PATH EXTRUSION (for branches, curved shapes)
  // ============================================

  /**
   * Extrude a loop along a path of points
   * Optionally scale at each point for tapering
   * Returns the final loop indices
   */
  extrudeAlongPath(
    loopIndices: number[],
    path: Vec3[],
    scales?: number[]
  ): number[] {
    if (path.length < 2) {
      throw new Error('Path must have at least 2 points');
    }

    let currentLoop = loopIndices;

    for (let i = 1; i < path.length; i++) {
      const from = path[i - 1];
      const to = path[i];
      const direction = to.sub(from);
      const distance = direction.length();

      // Extrude to next point
      const newLoop = this.extrudeLoop(currentLoop, direction.normalize(), distance);

      // Apply scale if provided
      if (scales && scales[i] !== undefined) {
        const scaleRatio = scales[i] / (scales[i - 1] || 1);
        this.scaleLoop(newLoop, scaleRatio, to);
      }

      currentLoop = newLoop;
    }

    return currentLoop;
  }

  // ============================================
  // SEAM SYSTEM (for mesh assembly)
  // ============================================

  /**
   * Define a seam at an edge loop
   * Seams are used to connect separate meshes (like body parts)
   */
  defineSeam(name: string, loopIndices: number[]): Seam {
    // Calculate seam properties
    let center = Vec3.zero();
    for (const i of loopIndices) {
      center = center.add(this.mesh.vertices[i].position);
    }
    center = center.div(loopIndices.length);

    // Calculate average radius
    let totalDist = 0;
    for (const i of loopIndices) {
      totalDist += this.mesh.vertices[i].position.sub(center).length();
    }
    const radius = totalDist / loopIndices.length;

    // Calculate normal (average of edge cross products)
    let normal = Vec3.zero();
    const n = loopIndices.length;
    for (let i = 0; i < n; i++) {
      const curr = this.mesh.vertices[loopIndices[i]].position;
      const next = this.mesh.vertices[loopIndices[(i + 1) % n]].position;
      const toCenter = center.sub(curr);
      const edge = next.sub(curr);
      normal = normal.add(edge.cross(toCenter));
    }
    normal = normal.normalize();

    const seam: Seam = {
      name,
      loopIndices: [...loopIndices],
      normal,
      center,
      radius
    };

    this.seams.set(name, seam);
    return seam;
  }

  /**
   * Get a seam by name
   */
  getSeam(name: string): Seam | undefined {
    return this.seams.get(name);
  }

  /**
   * Get all seams
   */
  getAllSeams(): Map<string, Seam> {
    return new Map(this.seams);
  }

  // ============================================
  // RIGGING SYSTEM
  // ============================================

  /**
   * Add a bone to the rig
   */
  addBone(name: string, head: Vec3, tail: Vec3, parentName?: string): Bone {
    const bone: Bone = {
      name,
      head: head.clone(),
      tail: tail.clone(),
      parent: parentName,
      children: []
    };

    // Update parent's children list
    if (parentName) {
      const parent = this.bones.get(parentName);
      if (parent) {
        parent.children.push(name);
      }
    }

    this.bones.set(name, bone);
    return bone;
  }

  /**
   * Assign skin weights to vertices
   */
  assignWeight(vertexIndex: number, boneName: string, weight: number): void {
    if (!this.skinWeights.has(vertexIndex)) {
      this.skinWeights.set(vertexIndex, []);
    }
    this.skinWeights.get(vertexIndex)!.push({ bone: boneName, weight });
  }

  /**
   * Assign weights to a loop of vertices
   */
  assignLoopWeights(loopIndices: number[], boneName: string, weight: number): void {
    for (const i of loopIndices) {
      this.assignWeight(i, boneName, weight);
    }
  }

  /**
   * Auto-assign weights based on distance to bone
   */
  autoWeightToBone(boneName: string, maxDistance: number, falloff: 'linear' | 'smooth' = 'smooth'): void {
    const bone = this.bones.get(boneName);
    if (!bone) return;

    for (let i = 0; i < this.mesh.vertices.length; i++) {
      const pos = this.mesh.vertices[i].position;

      // Distance to bone line segment
      const boneDir = bone.tail.sub(bone.head);
      const boneLen = boneDir.length();
      const toVertex = pos.sub(bone.head);

      // Project onto bone
      let t = toVertex.dot(boneDir) / (boneLen * boneLen);
      t = Math.max(0, Math.min(1, t));

      const closestPoint = bone.head.add(boneDir.mul(t));
      const dist = pos.sub(closestPoint).length();

      if (dist < maxDistance) {
        let weight: number;
        if (falloff === 'linear') {
          weight = 1 - (dist / maxDistance);
        } else {
          // Smooth falloff
          const x = dist / maxDistance;
          weight = 1 - (x * x * (3 - 2 * x)); // smoothstep
        }
        this.assignWeight(i, boneName, weight);
      }
    }
  }

  /**
   * Get all bones
   */
  getAllBones(): Map<string, Bone> {
    return new Map(this.bones);
  }

  /**
   * Get skin weights for export
   */
  getSkinWeights(): Map<number, Array<{bone: string; weight: number}>> {
    return new Map(this.skinWeights);
  }

  /**
   * Finalize and return the mesh
   */
  build(): Mesh {
    this.mesh.calculateNormals();
    return this.mesh;
  }
}

// ============================================
// HIGH-LEVEL SHAPE BUILDERS USING MODELER
// ============================================

/**
 * Build a box using extrusion (single connected mesh)
 */
export function buildBox(width: number, height: number, depth: number): Mesh {
  const m = new MeshModeler();

  // Start with bottom face
  const bottom = m.createRectFace(width, depth, 0);
  m.capLoop(bottom, true); // Bottom cap (reversed for downward normal)

  // Extrude up
  const top = m.extrudeLoop(bottom, new Vec3(0, 1, 0), height);
  m.capLoop(top, false); // Top cap

  return m.build();
}

/**
 * Build a cylinder using extrusion
 */
export function buildCylinder(radius: number, height: number, segments: number = 12): Mesh {
  const m = new MeshModeler();

  // Start with bottom circle
  const bottom = m.createCircleLoop(Vec3.zero(), radius, segments);
  m.capLoop(bottom, true);

  // Extrude up
  const top = m.extrudeLoop(bottom, new Vec3(0, 1, 0), height);
  m.capLoop(top, false);

  return m.build();
}

/**
 * Build a tapered cylinder (cone-like)
 */
export function buildTaperedCylinder(
  bottomRadius: number,
  topRadius: number,
  height: number,
  segments: number = 12
): Mesh {
  const m = new MeshModeler();

  // Start with bottom circle
  const bottom = m.createCircleLoop(Vec3.zero(), bottomRadius, segments);
  m.capLoop(bottom, true);

  // Extrude up
  const top = m.extrudeLoop(bottom, new Vec3(0, 1, 0), height);

  // Scale the top loop to create taper
  const scale = topRadius / bottomRadius;
  m.scaleLoop(top, scale);

  m.capLoop(top, false);

  return m.build();
}

/**
 * Build a chair using connected mesh operations
 * This creates a SINGLE mesh with all parts connected
 */
export function buildConnectedChair(
  seatWidth: number,
  seatDepth: number,
  seatThickness: number,
  seatHeight: number,
  legRadius: number,
  legInset: number,
  backHeight: number,
  backThickness: number
): Mesh {
  const m = new MeshModeler();

  // =============================================
  // SEAT - Start with seat bottom, extrude up
  // =============================================
  const seatBottom = m.createRectFace(seatWidth, seatDepth, seatHeight - seatThickness);
  m.capLoop(seatBottom, true); // Bottom face
  const seatTop = m.extrudeLoop(seatBottom, new Vec3(0, 1, 0), seatThickness);
  m.capLoop(seatTop, false); // Top face

  // =============================================
  // LEGS - Extrude down from seat corners
  // =============================================
  const legHeight = seatHeight - seatThickness;
  const legX = seatWidth / 2 - legInset;
  const legZ = seatDepth / 2 - legInset;

  const legPositions = [
    new Vec3(-legX, seatHeight - seatThickness, legZ),   // front-left
    new Vec3(legX, seatHeight - seatThickness, legZ),    // front-right
    new Vec3(-legX, seatHeight - seatThickness, -legZ),  // back-left
    new Vec3(legX, seatHeight - seatThickness, -legZ)    // back-right
  ];

  for (const pos of legPositions) {
    // Create leg top circle at seat level
    const legTop = m.createCircleLoop(pos, legRadius, 8);

    // Extrude down to floor
    const legBottom = m.extrudeLoop(legTop, new Vec3(0, -1, 0), legHeight);
    m.capLoop(legBottom, true); // Bottom cap
  }

  // =============================================
  // BACK - Build from back edge of seat
  // =============================================
  const backWidth = seatWidth - legInset * 2;
  const backZ = -seatDepth / 2 + backThickness / 2;

  // Create back bottom at seat level
  const backBottom = m.createRectFace(backWidth, backThickness, seatHeight);
  // Translate to back position
  m.translateLoop(backBottom, new Vec3(0, 0, backZ));
  m.capLoop(backBottom, true);

  // Extrude up for back height
  const backTop = m.extrudeLoop(backBottom, new Vec3(0, 1, 0), backHeight);
  m.capLoop(backTop, false);

  return m.build();
}

/**
 * Stitch two meshes together at their seams
 * Creates a single connected mesh
 */
export function stitchMeshesAtSeams(
  modelerA: MeshModeler,
  seamNameA: string,
  modelerB: MeshModeler,
  seamNameB: string
): Mesh {
  const seamA = modelerA.getSeam(seamNameA);
  const seamB = modelerB.getSeam(seamNameB);

  if (!seamA || !seamB) {
    throw new Error('Seam not found');
  }

  if (seamA.loopIndices.length !== seamB.loopIndices.length) {
    throw new Error('Seams must have same vertex count');
  }

  // Create new combined mesh
  const result = new MeshModeler();

  // Copy mesh A
  const offsetA = 0;
  for (const v of modelerA.mesh.vertices) {
    result.mesh.addVertex(v.clone());
  }
  for (const f of modelerA.mesh.faces) {
    result.mesh.addFace(new Face(f.indices.map(i => i + offsetA)));
  }

  // Copy mesh B with vertex offset
  const offsetB = result.mesh.vertices.length;

  // Calculate transform to align seam B to seam A
  const posOffset = seamA.center.sub(seamB.center);

  for (const v of modelerB.mesh.vertices) {
    const newPos = v.position.add(posOffset);
    result.mesh.addVertex(new Vertex(newPos));
  }
  for (const f of modelerB.mesh.faces) {
    result.mesh.addFace(new Face(f.indices.map(i => i + offsetB)));
  }

  // Bridge the seams
  const loopA = seamA.loopIndices.map(i => i + offsetA);
  const loopB = seamB.loopIndices.map(i => i + offsetB).reverse();

  result.bridgeLoops(loopA, loopB);

  return result.build();
}

// ============================================
// TREE BUILDER
// ============================================

/**
 * Build a procedural tree with branches
 */
export function buildTree(
  trunkRadius: number,
  trunkHeight: number,
  branchLevels: number,
  seed: number = 42
): Mesh {
  const m = new MeshModeler();

  // Simple seeded random
  let rng = seed;
  const random = () => {
    rng = (rng * 1103515245 + 12345) & 0x7fffffff;
    return rng / 0x7fffffff;
  };

  // Create trunk base
  const trunkSegments = 8;
  const trunkBase = m.createCircleLoop(Vec3.zero(), trunkRadius, trunkSegments);
  m.capLoop(trunkBase, true);

  // Extrude trunk with slight taper
  const trunkPath: Vec3[] = [
    Vec3.zero(),
    new Vec3(0, trunkHeight * 0.5, 0),
    new Vec3(0, trunkHeight, 0)
  ];
  const trunkScales = [1, 0.8, 0.6];

  const trunkTop = m.extrudeAlongPath(trunkBase, trunkPath, trunkScales);

  // Cap trunk top if no branches
  if (branchLevels <= 0) {
    m.capLoop(trunkTop, false);
  }

  // Add branches
  if (branchLevels > 0) {
    const numBranches = 3 + Math.floor(random() * 3);

    for (let i = 0; i < numBranches; i++) {
      const angle = (i / numBranches) * Math.PI * 2 + random() * 0.5;
      const branchLength = trunkHeight * 0.4 * (0.7 + random() * 0.3);
      const branchRadius = trunkRadius * 0.3;

      const dx = Math.cos(angle) * 0.7;
      const dy = 0.5 + random() * 0.3;
      const dz = Math.sin(angle) * 0.7;

      const branchStart = new Vec3(
        dx * trunkRadius * 0.5,
        trunkHeight,
        dz * trunkRadius * 0.5
      );

      const branchBase = m.createCircleLoop(branchStart, branchRadius, 6);
      const branchEnd = branchStart.add(new Vec3(dx, dy, dz).normalize().mul(branchLength));
      const branchTop = m.extrudeLoop(branchBase, branchEnd.sub(branchStart).normalize(), branchLength);
      m.scaleLoop(branchTop, 0.4);
      m.capLoop(branchTop, false);
    }
  }

  return m.build();
}

// ============================================
// HUMANOID BUILDERS
// ============================================

/**
 * Build a torso with seams for limb attachment
 */
export function buildTorsoWithSeams(): MeshModeler {
  const m = new MeshModeler();

  const shoulderWidth = 0.4;
  const hipWidth = 0.35;
  const torsoHeight = 0.5;

  // Hip loop
  const hipLoop = m.createCircleLoop(Vec3.zero(), hipWidth / 2, 8);
  m.defineSeam('pelvis', hipLoop);

  // Extrude up to waist
  const waistLoop = m.extrudeLoop(hipLoop, new Vec3(0, 1, 0), torsoHeight * 0.3);
  m.scaleLoop(waistLoop, 0.85);

  // Extrude to chest
  const chestLoop = m.extrudeLoop(waistLoop, new Vec3(0, 1, 0), torsoHeight * 0.4);
  m.scaleLoop(chestLoop, shoulderWidth / hipWidth * 1.1);

  // Extrude to shoulders
  const shoulderLoop = m.extrudeLoop(chestLoop, new Vec3(0, 1, 0), torsoHeight * 0.3);
  m.defineSeam('neck', shoulderLoop);

  // Add spine bones
  m.addBone('spine_lower', Vec3.zero(), new Vec3(0, torsoHeight * 0.3, 0));
  m.addBone('spine_upper', new Vec3(0, torsoHeight * 0.3, 0), new Vec3(0, torsoHeight, 0), 'spine_lower');

  // Auto-weight
  m.autoWeightToBone('spine_lower', 0.25);
  m.autoWeightToBone('spine_upper', 0.25);

  return m;
}

/**
 * Build an arm with seams
 */
export function buildArmWithSeams(length: number, isLeft: boolean): MeshModeler {
  const m = new MeshModeler();

  const upperArmLen = length * 0.45;
  const forearmLen = length * 0.40;
  const handLen = length * 0.15;
  const shoulderRadius = 0.05;
  const wristRadius = 0.03;
  const dir = isLeft ? -1 : 1;

  // Shoulder
  const shoulderLoop = m.createCircleLoop(Vec3.zero(), shoulderRadius, 8, new Vec3(dir, 0, 0));
  m.defineSeam('shoulder', shoulderLoop);

  // Upper arm
  const elbowLoop = m.extrudeLoop(shoulderLoop, new Vec3(dir, 0, 0), upperArmLen);
  m.scaleLoop(elbowLoop, 0.8);
  m.addBone('upper_arm', Vec3.zero(), new Vec3(dir * upperArmLen, 0, 0));

  // Forearm
  const wristLoop = m.extrudeLoop(elbowLoop, new Vec3(dir, 0, 0), forearmLen);
  m.scaleLoop(wristLoop, wristRadius / (shoulderRadius * 0.8));
  m.addBone('forearm', new Vec3(dir * upperArmLen, 0, 0), new Vec3(dir * (upperArmLen + forearmLen), 0, 0), 'upper_arm');
  m.defineSeam('wrist', wristLoop);

  // Hand
  const handEnd = m.extrudeLoop(wristLoop, new Vec3(dir, 0, 0), handLen);
  m.scaleLoop(handEnd, 0.5);
  m.capLoop(handEnd, false);
  m.addBone('hand', new Vec3(dir * (upperArmLen + forearmLen), 0, 0), new Vec3(dir * length, 0, 0), 'forearm');

  return m;
}

/**
 * Build a leg with seams
 */
export function buildLegWithSeams(length: number, isLeft: boolean): MeshModeler {
  const m = new MeshModeler();

  const thighLen = length * 0.45;
  const shinLen = length * 0.45;
  const footLen = length * 0.10;
  const hipRadius = 0.08;
  const ankleRadius = 0.04;
  const dir = isLeft ? -1 : 1;

  // Hip attachment
  const hipLoop = m.createCircleLoop(new Vec3(dir * 0.1, 0, 0), hipRadius, 8, new Vec3(0, -1, 0));
  m.defineSeam('hip', hipLoop);

  // Thigh
  const kneeLoop = m.extrudeLoop(hipLoop, new Vec3(0, -1, 0), thighLen);
  m.scaleLoop(kneeLoop, 0.75);
  m.addBone('thigh', new Vec3(dir * 0.1, 0, 0), new Vec3(dir * 0.1, -thighLen, 0));

  // Shin
  const ankleLoop = m.extrudeLoop(kneeLoop, new Vec3(0, -1, 0), shinLen);
  m.scaleLoop(ankleLoop, ankleRadius / (hipRadius * 0.75));
  m.addBone('shin', new Vec3(dir * 0.1, -thighLen, 0), new Vec3(dir * 0.1, -(thighLen + shinLen), 0), 'thigh');
  m.defineSeam('ankle', ankleLoop);

  // Foot
  const toeLoop = m.extrudeLoop(ankleLoop, new Vec3(0, 0, 1), footLen);
  m.capLoop(toeLoop, false);
  m.addBone('foot', new Vec3(dir * 0.1, -(thighLen + shinLen), 0), new Vec3(dir * 0.1, -(thighLen + shinLen), footLen), 'shin');

  return m;
}

/**
 * Build a simple head
 */
export function buildHeadWithSeams(): MeshModeler {
  const m = new MeshModeler();

  const neckRadius = 0.06;
  const headRadius = 0.12;
  const headHeight = 0.25;

  // Neck connection
  const neckLoop = m.createCircleLoop(Vec3.zero(), neckRadius, 8, new Vec3(0, 1, 0));
  m.defineSeam('neck', neckLoop);

  // Neck
  const neckTop = m.extrudeLoop(neckLoop, new Vec3(0, 1, 0), 0.08);
  m.scaleLoop(neckTop, 0.9);
  m.addBone('neck', Vec3.zero(), new Vec3(0, 0.08, 0));

  // Head base
  const headBase = m.extrudeLoop(neckTop, new Vec3(0, 1, 0), headHeight * 0.3);
  m.scaleLoop(headBase, headRadius / (neckRadius * 0.9));

  // Head middle
  const headMid = m.extrudeLoop(headBase, new Vec3(0, 1, 0), headHeight * 0.4);

  // Head top
  const headTop = m.extrudeLoop(headMid, new Vec3(0, 1, 0), headHeight * 0.3);
  m.scaleLoop(headTop, 0.5);
  m.capLoop(headTop, false);

  m.addBone('head', new Vec3(0, 0.08, 0), new Vec3(0, 0.08 + headHeight, 0), 'neck');

  return m;
}

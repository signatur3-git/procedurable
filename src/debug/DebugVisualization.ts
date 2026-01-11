/**
 * Debug utilities for visualizing transforms and positions
 */

import * as THREE from 'three';
import { Mesh } from '../geometry/Mesh';
import { SceneNode } from '../core/SceneNode';

/**
 * Add axis helpers to visualize part orientations
 */
export function addAxisHelpers(
  threeScene: THREE.Scene,
  node: SceneNode,
  size: number = 0.1
): void {
  const allNodes = node.getAllNodes();

  for (const n of allNodes) {
    if (n.mesh) {
      const axisHelper = new THREE.AxesHelper(size);

      // Get world position from the node's transform
      const worldTransform = n.getWorldTransform();
      axisHelper.position.set(
        worldTransform.position.x,
        worldTransform.position.y,
        worldTransform.position.z
      );

      // Apply rotation
      axisHelper.rotation.set(
        worldTransform.rotation.x,
        worldTransform.rotation.y,
        worldTransform.rotation.z
      );

      threeScene.add(axisHelper);
    }
  }
}

/**
 * Log detailed mesh bounds info
 */
export function logMeshBounds(mesh: Mesh, name: string): void {
  if (mesh.vertices.length === 0) {
    console.log(`${name}: No vertices`);
    return;
  }

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (const v of mesh.vertices) {
    minX = Math.min(minX, v.position.x);
    minY = Math.min(minY, v.position.y);
    minZ = Math.min(minZ, v.position.z);
    maxX = Math.max(maxX, v.position.x);
    maxY = Math.max(maxY, v.position.y);
    maxZ = Math.max(maxZ, v.position.z);
  }

  console.log(`${name}:`);
  console.log(`  Vertices: ${mesh.vertices.length}`);
  console.log(`  Bounds X: [${minX.toFixed(3)}, ${maxX.toFixed(3)}] (size: ${(maxX - minX).toFixed(3)})`);
  console.log(`  Bounds Y: [${minY.toFixed(3)}, ${maxY.toFixed(3)}] (size: ${(maxY - minY).toFixed(3)})`);
  console.log(`  Bounds Z: [${minZ.toFixed(3)}, ${maxZ.toFixed(3)}] (size: ${(maxZ - minZ).toFixed(3)})`);
  console.log(`  Center: (${((minX + maxX) / 2).toFixed(3)}, ${((minY + maxY) / 2).toFixed(3)}, ${((minZ + maxZ) / 2).toFixed(3)})`);
}

/**
 * Log SceneNode hierarchy with detailed transform info
 */
export function logNodeHierarchy(node: SceneNode, indent: number = 0): void {
  const prefix = '  '.repeat(indent);
  const pos = node.transform.position;
  const rot = node.transform.rotation;

  const rotDeg = {
    x: (rot.x * 180 / Math.PI).toFixed(1),
    y: (rot.y * 180 / Math.PI).toFixed(1),
    z: (rot.z * 180 / Math.PI).toFixed(1)
  };

  console.log(`${prefix}📦 ${node.name}`);
  console.log(`${prefix}   pos: (${pos.x.toFixed(3)}, ${pos.y.toFixed(3)}, ${pos.z.toFixed(3)})`);
  console.log(`${prefix}   rot: (${rotDeg.x}°, ${rotDeg.y}°, ${rotDeg.z}°)`);

  if (node.mesh) {
    const vCount = node.mesh.vertices.length;
    const fCount = node.mesh.faces.length;
    console.log(`${prefix}   mesh: ${vCount} verts, ${fCount} faces`);

    // Show local mesh bounds (before transform)
    if (vCount > 0) {
      let minY = Infinity, maxY = -Infinity;
      for (const v of node.mesh.vertices) {
        minY = Math.min(minY, v.position.y);
        maxY = Math.max(maxY, v.position.y);
      }
      console.log(`${prefix}   local height: ${(maxY - minY).toFixed(3)} (Y: ${minY.toFixed(3)} to ${maxY.toFixed(3)})`);
    }
  }

  for (const child of node.children) {
    logNodeHierarchy(child, indent + 1);
  }
}

/**
 * Create a simple box wireframe at a position (for debugging)
 */
export function createDebugBox(
  scene: THREE.Scene,
  x: number, y: number, z: number,
  size: number = 0.05,
  color: number = 0xff0000
): void {
  const geometry = new THREE.BoxGeometry(size, size, size);
  const edges = new THREE.EdgesGeometry(geometry);
  const material = new THREE.LineBasicMaterial({ color });
  const wireframe = new THREE.LineSegments(edges, material);
  wireframe.position.set(x, y, z);
  scene.add(wireframe);
}

/**
 * Visualize expected leg positions vs actual
 */
export function debugLegPositions(
  scene: THREE.Scene,
  seatWidth: number,
  seatDepth: number,
  legInset: number,
  legHeight: number
): void {
  const hw = seatWidth / 2 - legInset;
  const hd = seatDepth / 2 - legInset;

  const expectedPositions = [
    { x: -hw, z: -hd, label: 'BL' },
    { x: hw, z: -hd, label: 'BR' },
    { x: -hw, z: hd, label: 'FL' },
    { x: hw, z: hd, label: 'FR' }
  ];

  console.log('Expected leg positions (top of leg):');
  for (const pos of expectedPositions) {
    console.log(`  ${pos.label}: (${pos.x.toFixed(3)}, ${legHeight.toFixed(3)}, ${pos.z.toFixed(3)})`);

    // Green box at expected top-of-leg position
    createDebugBox(scene, pos.x, legHeight, pos.z, 0.03, 0x00ff00);

    // Red box at expected bottom-of-leg position
    createDebugBox(scene, pos.x, 0, pos.z, 0.03, 0xff0000);
  }
}


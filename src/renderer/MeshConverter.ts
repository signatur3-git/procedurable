﻿import * as THREE from 'three';
import { Mesh } from '../geometry/Mesh';

export class MeshConverter {
  /**
   * Convert to Three.js geometry using non-indexed (flat shaded) approach
   * This gives correct hard edges for CAD-like geometry
   */
  static toThreeGeometry(mesh: Mesh): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    const triangulated = mesh.triangulate();

    // For flat shading, we need non-indexed geometry
    // Each face gets its own vertices with face normals
    const positions: number[] = [];
    const normals: number[] = [];

    for (const face of triangulated.faces) {
      // Get face vertices
      const v0 = triangulated.vertices[face.indices[0]].position;
      const v1 = triangulated.vertices[face.indices[1]].position;
      const v2 = triangulated.vertices[face.indices[2]].position;

      // Calculate face normal
      const edge1 = v1.sub(v0);
      const edge2 = v2.sub(v0);
      const faceNormal = edge1.cross(edge2).normalize();

      // Add each vertex with the face normal
      positions.push(v0.x, v0.y, v0.z);
      positions.push(v1.x, v1.y, v1.z);
      positions.push(v2.x, v2.y, v2.z);

      normals.push(faceNormal.x, faceNormal.y, faceNormal.z);
      normals.push(faceNormal.x, faceNormal.y, faceNormal.z);
      normals.push(faceNormal.x, faceNormal.y, faceNormal.z);
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
    geometry.computeBoundingSphere();

    return geometry;
  }

  static toThreeMesh(mesh: Mesh, material?: THREE.Material): THREE.Mesh {
    const geometry = this.toThreeGeometry(mesh);
    const defaultMaterial = new THREE.MeshStandardMaterial({
      color: 0x808080,
      roughness: 0.7,
      metalness: 0.1,
      flatShading: true
    });
    return new THREE.Mesh(geometry, material || defaultMaterial);
  }
}

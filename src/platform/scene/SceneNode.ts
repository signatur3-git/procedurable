/**
 * SceneNode - Hierarchical scene graph node
 *
 * Each node has a local transform and can contain geometry (mesh)
 * and children. The world transform is computed by traversing
 * up the parent chain.
 */

import { Mesh } from '../geometry/Mesh';
import { Vertex } from '../geometry/Vertex';
import { Vec3 } from '../math/Vec3';
import { Transform } from '../math/Transform';
import { Mat4 } from '../math/Mat4';

export class SceneNode {
  public name: string;
  public transform: Transform;
  public mesh: Mesh | null;
  public children: SceneNode[];
  public parent: SceneNode | null;

  constructor(name: string = 'node') {
    this.name = name;
    this.transform = Transform.identity();
    this.mesh = null;
    this.children = [];
    this.parent = null;
  }

  /**
   * Add a child node
   */
  addChild(child: SceneNode): SceneNode {
    child.parent = this;
    this.children.push(child);
    return this;
  }

  /**
   * Remove a child node
   */
  removeChild(child: SceneNode): boolean {
    const index = this.children.indexOf(child);
    if (index >= 0) {
      this.children.splice(index, 1);
      child.parent = null;
      return true;
    }
    return false;
  }

  /**
   * Get the world transformation matrix
   */
  getWorldMatrix(): Mat4 {
    if (this.parent) {
      return this.parent.getWorldMatrix().multiply(this.transform.getMatrix());
    }
    return this.transform.getMatrix();
  }

  /**
   * Get the world transform
   */
  getWorldTransform(): Transform {
    if (!this.parent) {
      return this.transform.clone();
    }
    return this.parent.getWorldTransform().combine(this.transform);
  }

  /**
   * Set local position
   */
  setPosition(x: number, y: number, z: number): SceneNode {
    this.transform.setPosition(x, y, z);
    return this;
  }

  /**
   * Set local rotation (Euler angles in radians)
   */
  setRotation(x: number, y: number, z: number): SceneNode {
    this.transform.setRotation(x, y, z);
    return this;
  }

  /**
   * Set local scale
   */
  setScale(x: number, y: number, z: number): SceneNode {
    this.transform.scale = new Vec3(x, y, z);
    return this;
  }

  /**
   * Set mesh geometry
   */
  setMesh(mesh: Mesh): SceneNode {
    this.mesh = mesh;
    return this;
  }

  /**
   * Flatten this node and all children into a single mesh in world coordinates
   */
  toMesh(): Mesh {
    const result = new Mesh();
    this.flattenInto(result, this.getWorldMatrix());
    result.calculateNormals();
    return result;
  }

  /**
   * Internal: flatten node into mesh using provided world matrix
   */
  private flattenInto(target: Mesh, worldMatrix: Mat4): void {
    // Transform and add this node's mesh
    if (this.mesh) {
      const transformedMesh = this.mesh.clone();
      transformedMesh.vertices.forEach((v: Vertex) => {
        v.position = worldMatrix.transformPoint(v.position);
        // Also transform normals if they exist
        if (v.attributes.normal) {
          v.attributes.normal = worldMatrix.transformDirection(v.attributes.normal).normalize();
        }
      });
      target.merge(transformedMesh);
    }

    // Recursively process children
    for (const child of this.children) {
      const childWorldMatrix = worldMatrix.multiply(child.transform.getMatrix());
      child.flattenInto(target, childWorldMatrix);
    }
  }

  /**
   * Find a child by name (recursive)
   */
  findByName(name: string): SceneNode | null {
    if (this.name === name) return this;
    for (const child of this.children) {
      const found = child.findByName(name);
      if (found) return found;
    }
    return null;
  }

  /**
   * Get all nodes in the hierarchy (including this one)
   */
  getAllNodes(): SceneNode[] {
    const nodes: SceneNode[] = [this];
    for (const child of this.children) {
      nodes.push(...child.getAllNodes());
    }
    return nodes;
  }

  /**
   * Debug: print the hierarchy
   */
  printHierarchy(indent: number = 0): void {
    const prefix = '  '.repeat(indent);
    const meshInfo = this.mesh ? ` [${this.mesh.vertices.length} verts]` : '';
    console.log(`${prefix}${this.name}${meshInfo}`);
    console.log(`${prefix}  ${this.transform.toString()}`);
    for (const child of this.children) {
      child.printHierarchy(indent + 1);
    }
  }

  /**
   * Create a simple node with a mesh
   */
  static fromMesh(name: string, mesh: Mesh): SceneNode {
    const node = new SceneNode(name);
    node.mesh = mesh;
    return node;
  }

  /**
   * Create a node at a position
   */
  static at(name: string, x: number, y: number, z: number): SceneNode {
    const node = new SceneNode(name);
    node.setPosition(x, y, z);
    return node;
  }
}


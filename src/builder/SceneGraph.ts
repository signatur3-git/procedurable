/**
 * SceneGraph - Semantic scene representation with queryable nodes
 *
 * Enables:
 * - Functional understanding ("find all seating surfaces")
 * - Cross-component queries ("where are other chairs?")
 * - Spatial queries ("what's near me?")
 * - Layout algorithms ("place on all horizontal surfaces")
 *
 * P2-M2d-005
 */

import { AABB } from '../core/AABB';
import { Vec3 } from '../core/Vec3';

/**
 * Transform in 3D space
 */
export interface Transform {
  position: Vec3;
  rotation: { x: number; y: number; z: number };  // Euler angles in radians
  scale: number;
}

/**
 * Scene node - represents a semantic part of the scene
 */
export interface SceneNode {
  /** Unique identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Semantic tags for queries */
  tags: string[];

  /** Bounding box in local space */
  bounds: AABB;

  /** Transform relative to parent */
  transform: Transform;

  /** Parent node ID (null for root) */
  parent: string | null;

  /** Child node IDs */
  children: string[];

  /** Builder that created this node */
  builderName?: string;

  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Scene graph - hierarchical semantic representation
 */
export class SceneGraph {
  private nodes: Map<string, SceneNode> = new Map();
  private tagIndex: Map<string, Set<string>> = new Map();  // tag -> node IDs
  private rootNodes: Set<string> = new Set();

  /**
   * Add a node to the graph
   */
  addNode(node: SceneNode): void {
    this.nodes.set(node.id, node);

    // Update tag index
    for (const tag of node.tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(node.id);
    }

    // Track root nodes
    if (node.parent === null) {
      this.rootNodes.add(node.id);
    }

    // Update parent's children list
    if (node.parent !== null) {
      const parent = this.nodes.get(node.parent);
      if (parent && !parent.children.includes(node.id)) {
        parent.children.push(node.id);
      }
    }
  }

  /**
   * Get a node by ID
   */
  getNode(id: string): SceneNode | undefined {
    return this.nodes.get(id);
  }

  /**
   * Get all nodes with a specific tag
   */
  getNodesByTag(tag: string): SceneNode[] {
    const ids = this.tagIndex.get(tag);
    if (!ids) return [];
    return Array.from(ids).map(id => this.nodes.get(id)!).filter(n => n !== undefined);
  }

  /**
   * Get nodes by multiple tags (AND operation)
   */
  getNodesByTags(tags: string[]): SceneNode[] {
    if (tags.length === 0) return [];

    // Start with first tag
    let resultIds = this.tagIndex.get(tags[0]);
    if (!resultIds) return [];

    // Intersect with other tags
    for (let i = 1; i < tags.length; i++) {
      const tagIds = this.tagIndex.get(tags[i]);
      if (!tagIds) return [];
      resultIds = new Set([...resultIds].filter(id => tagIds.has(id)));
    }

    return Array.from(resultIds).map(id => this.nodes.get(id)!).filter(n => n !== undefined);
  }

  /**
   * Find nodes by name (substring match)
   */
  findNodesByName(namePattern: string): SceneNode[] {
    const pattern = namePattern.toLowerCase();
    return Array.from(this.nodes.values()).filter(node =>
      node.name.toLowerCase().includes(pattern)
    );
  }

  /**
   * Get all root nodes
   */
  getRootNodes(): SceneNode[] {
    return Array.from(this.rootNodes).map(id => this.nodes.get(id)!).filter(n => n !== undefined);
  }

  /**
   * Get children of a node
   */
  getChildren(nodeId: string): SceneNode[] {
    const node = this.nodes.get(nodeId);
    if (!node) return [];
    return node.children.map(id => this.nodes.get(id)!).filter(n => n !== undefined);
  }

  /**
   * Get parent of a node
   */
  getParent(nodeId: string): SceneNode | null {
    const node = this.nodes.get(nodeId);
    if (!node || !node.parent) return null;
    return this.nodes.get(node.parent) || null;
  }

  /**
   * Get world transform (accumulated from root)
   */
  getWorldTransform(nodeId: string): Transform {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return { position: new Vec3(0, 0, 0), rotation: { x: 0, y: 0, z: 0 }, scale: 1 };
    }

    // If no parent, return local transform
    if (!node.parent) {
      return { ...node.transform };
    }

    // Accumulate transforms up the hierarchy
    const parentTransform = this.getWorldTransform(node.parent);

    // Apply parent transform to local position
    const worldPos = node.transform.position
      .mul(parentTransform.scale)
      .add(parentTransform.position);

    // Accumulate rotations
    const worldRot = {
      x: parentTransform.rotation.x + node.transform.rotation.x,
      y: parentTransform.rotation.y + node.transform.rotation.y,
      z: parentTransform.rotation.z + node.transform.rotation.z
    };

    // Accumulate scale
    const worldScale = parentTransform.scale * node.transform.scale;

    return {
      position: worldPos,
      rotation: worldRot,
      scale: worldScale
    };
  }

  /**
   * Get world-space bounding box
   */
  getWorldBounds(nodeId: string): AABB {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return new AABB(new Vec3(0, 0, 0), new Vec3(0, 0, 0));
    }

    const worldTransform = this.getWorldTransform(nodeId);

    // Transform bounds by scaling and translating
    const scaledMin = node.bounds.min.mul(worldTransform.scale);
    const scaledMax = node.bounds.max.mul(worldTransform.scale);

    return new AABB(
      scaledMin.add(worldTransform.position),
      scaledMax.add(worldTransform.position)
    );
  }

  /**
   * Find nodes within distance of a point
   */
  findNodesNearby(center: Vec3, radius: number): SceneNode[] {
    const results: SceneNode[] = [];

    for (const node of this.nodes.values()) {
      const worldBounds = this.getWorldBounds(node.id);

      // Calculate closest point on AABB to center
      const closestPoint = new Vec3(
        Math.max(worldBounds.min.x, Math.min(center.x, worldBounds.max.x)),
        Math.max(worldBounds.min.y, Math.min(center.y, worldBounds.max.y)),
        Math.max(worldBounds.min.z, Math.min(center.z, worldBounds.max.z))
      );

      const distance = closestPoint.sub(center).length();

      if (distance <= radius) {
        results.push(node);
      }
    }

    return results;
  }

  /**
   * Find nodes facing a direction (within angle tolerance)
   */
  findNodesFacing(direction: Vec3, angleTolerance: number): SceneNode[] {
    const results: SceneNode[] = [];
    const normalizedDir = direction.normalize();

    for (const node of this.nodes.values()) {
      const worldTransform = this.getWorldTransform(node.id);

      // Compute node's forward vector from Y rotation
      const yaw = worldTransform.rotation.y;
      const nodeForward = new Vec3(Math.sin(yaw), 0, Math.cos(yaw));

      // Check angle
      const dot = nodeForward.dot(normalizedDir);
      const angle = Math.acos(Math.max(-1, Math.min(1, dot)));

      if (angle <= angleTolerance) {
        results.push(node);
      }
    }

    return results;
  }

  /**
   * Get all tags in the scene
   */
  getAllTags(): string[] {
    return Array.from(this.tagIndex.keys());
  }

  /**
   * Get node count
   */
  size(): number {
    return this.nodes.size;
  }

  /**
   * Export as JSON
   */
  toJSON(): any {
    return {
      nodes: Array.from(this.nodes.values()),
      tags: this.getAllTags()
    };
  }

  /**
   * Clear the graph
   */
  clear(): void {
    this.nodes.clear();
    this.tagIndex.clear();
    this.rootNodes.clear();
  }
}

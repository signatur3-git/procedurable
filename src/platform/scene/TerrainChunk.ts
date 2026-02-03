/**
 * TerrainChunk - Chunk-aligned terrain generation (G1-002)
 *
 * Manages terrain generation in chunks for seamless tiling.
 * Adjacent chunks share boundary vertices for continuous terrain.
 */

import { Mesh } from '../geometry/Mesh';
import { MeshOperations, TerrainModification } from '../geometry/MeshOperations';

/**
 * Interface representing a single terrain chunk
 */
export interface TerrainChunk {
  /** Chunk X coordinate (in chunk units, not world units) */
  chunkX: number;
  /** Chunk Z coordinate (in chunk units, not world units) */
  chunkZ: number;
  /** Size of chunk in world units (chunks are square) */
  size: number;
  /** Number of segments per chunk edge */
  segments: number;
  /** The generated terrain mesh */
  mesh: Mesh;
  /** World-space bounds */
  bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
}

/**
 * Options for terrain chunk generation
 */
export interface TerrainChunkOptions {
  /** Size of each chunk in world units (default: 64) */
  chunkSize?: number;
  /** Number of segments per chunk edge (default: 16) */
  segments?: number;
  /** Height function taking world-space coordinates */
  heightFunction: (x: number, z: number) => number;
  /** Optional terrain modifications (building pads, etc.) */
  modifications?: TerrainModification[];
}

/**
 * Generate a single terrain chunk.
 *
 * The chunk uses world-space coordinates for the height function, ensuring
 * boundary vertices at chunk edges are evaluated identically by adjacent chunks.
 *
 * @param chunkX Chunk X coordinate (integer)
 * @param chunkZ Chunk Z coordinate (integer)
 * @param options Terrain generation options
 * @returns The generated terrain chunk
 */
export function generateTerrainChunk(
  chunkX: number,
  chunkZ: number,
  options: TerrainChunkOptions
): TerrainChunk {
  const {
    chunkSize = 64,
    segments = 16,
    heightFunction,
    modifications = []
  } = options;

  // Calculate world-space bounds
  // Chunk (0,0) spans from x=0 to x=chunkSize, z=0 to z=chunkSize
  // Chunk (1,0) spans from x=chunkSize to x=2*chunkSize, etc.
  const worldMinX = chunkX * chunkSize;
  const worldMaxX = (chunkX + 1) * chunkSize;
  const worldMinZ = chunkZ * chunkSize;
  const worldMaxZ = (chunkZ + 1) * chunkSize;

  // Center of chunk in world space
  const centerX = worldMinX + chunkSize / 2;
  const centerZ = worldMinZ + chunkSize / 2;

  // Generate the mesh using createHeightFieldMesh
  // The height function receives WORLD-SPACE coordinates, not chunk-local
  // This ensures boundary vertices are evaluated consistently across chunks
  const mesh = MeshOperations.createHeightFieldMesh({
    width: chunkSize,
    depth: chunkSize,
    segmentsX: segments,
    segmentsZ: segments,
    heightFunction,  // Already expects world-space coordinates
    modifications,
    center: { x: centerX, z: centerZ }
  });

  return {
    chunkX,
    chunkZ,
    size: chunkSize,
    segments,
    mesh,
    bounds: {
      minX: worldMinX,
      maxX: worldMaxX,
      minZ: worldMinZ,
      maxZ: worldMaxZ
    }
  };
}

/**
 * Generate multiple terrain chunks for a region.
 *
 * @param minChunkX Minimum chunk X coordinate (inclusive)
 * @param minChunkZ Minimum chunk Z coordinate (inclusive)
 * @param maxChunkX Maximum chunk X coordinate (inclusive)
 * @param maxChunkZ Maximum chunk Z coordinate (inclusive)
 * @param options Terrain generation options
 * @returns Array of generated terrain chunks
 */
export function generateTerrainRegion(
  minChunkX: number,
  minChunkZ: number,
  maxChunkX: number,
  maxChunkZ: number,
  options: TerrainChunkOptions
): TerrainChunk[] {
  const chunks: TerrainChunk[] = [];

  for (let cz = minChunkZ; cz <= maxChunkZ; cz++) {
    for (let cx = minChunkX; cx <= maxChunkX; cx++) {
      chunks.push(generateTerrainChunk(cx, cz, options));
    }
  }

  return chunks;
}

/**
 * Verify that two adjacent chunks share boundary vertices exactly.
 * Used for testing and validation.
 *
 * @param chunk1 First chunk
 * @param chunk2 Second chunk (must be horizontally or vertically adjacent)
 * @param tolerance Position comparison tolerance (default: 1e-10)
 * @returns True if boundary vertices match exactly
 */
export function verifyChunkBoundary(
  chunk1: TerrainChunk,
  chunk2: TerrainChunk,
  tolerance: number = 1e-10
): { matches: boolean; mismatchCount: number; details: string } {
  // Determine adjacency direction
  const dx = chunk2.chunkX - chunk1.chunkX;
  const dz = chunk2.chunkZ - chunk1.chunkZ;

  // Must be exactly adjacent (not diagonal)
  if (Math.abs(dx) + Math.abs(dz) !== 1) {
    return {
      matches: false,
      mismatchCount: -1,
      details: `Chunks are not adjacent: (${chunk1.chunkX},${chunk1.chunkZ}) and (${chunk2.chunkX},${chunk2.chunkZ})`
    };
  }

  // Ensure both chunks have same settings
  if (chunk1.size !== chunk2.size || chunk1.segments !== chunk2.segments) {
    return {
      matches: false,
      mismatchCount: -1,
      details: 'Chunks have different size or segment settings'
    };
  }

  const segments = chunk1.segments;
  const vertsPerEdge = segments + 1;

  // Collect boundary vertices from each chunk
  const boundary1: { x: number; y: number; z: number }[] = [];
  const boundary2: { x: number; y: number; z: number }[] = [];

  if (dx === 1) {
    // chunk2 is to the right of chunk1
    // chunk1's right edge (x = maxX) should match chunk2's left edge (x = minX)
    const boundary1X = chunk1.bounds.maxX;
    const boundary2X = chunk2.bounds.minX;

    for (const v of chunk1.mesh.vertices) {
      if (Math.abs(v.position.x - boundary1X) < tolerance) {
        boundary1.push({ x: v.position.x, y: v.position.y, z: v.position.z });
      }
    }
    for (const v of chunk2.mesh.vertices) {
      if (Math.abs(v.position.x - boundary2X) < tolerance) {
        boundary2.push({ x: v.position.x, y: v.position.y, z: v.position.z });
      }
    }
  } else if (dx === -1) {
    // chunk2 is to the left of chunk1
    const boundary1X = chunk1.bounds.minX;
    const boundary2X = chunk2.bounds.maxX;

    for (const v of chunk1.mesh.vertices) {
      if (Math.abs(v.position.x - boundary1X) < tolerance) {
        boundary1.push({ x: v.position.x, y: v.position.y, z: v.position.z });
      }
    }
    for (const v of chunk2.mesh.vertices) {
      if (Math.abs(v.position.x - boundary2X) < tolerance) {
        boundary2.push({ x: v.position.x, y: v.position.y, z: v.position.z });
      }
    }
  } else if (dz === 1) {
    // chunk2 is in front of chunk1 (positive Z)
    const boundary1Z = chunk1.bounds.maxZ;
    const boundary2Z = chunk2.bounds.minZ;

    for (const v of chunk1.mesh.vertices) {
      if (Math.abs(v.position.z - boundary1Z) < tolerance) {
        boundary1.push({ x: v.position.x, y: v.position.y, z: v.position.z });
      }
    }
    for (const v of chunk2.mesh.vertices) {
      if (Math.abs(v.position.z - boundary2Z) < tolerance) {
        boundary2.push({ x: v.position.x, y: v.position.y, z: v.position.z });
      }
    }
  } else {
    // chunk2 is behind chunk1 (negative Z)
    const boundary1Z = chunk1.bounds.minZ;
    const boundary2Z = chunk2.bounds.maxZ;

    for (const v of chunk1.mesh.vertices) {
      if (Math.abs(v.position.z - boundary1Z) < tolerance) {
        boundary1.push({ x: v.position.x, y: v.position.y, z: v.position.z });
      }
    }
    for (const v of chunk2.mesh.vertices) {
      if (Math.abs(v.position.z - boundary2Z) < tolerance) {
        boundary2.push({ x: v.position.x, y: v.position.y, z: v.position.z });
      }
    }
  }

  // Should have same number of boundary vertices
  if (boundary1.length !== vertsPerEdge || boundary2.length !== vertsPerEdge) {
    return {
      matches: false,
      mismatchCount: Math.abs(boundary1.length - boundary2.length),
      details: `Unexpected boundary vertex counts: ${boundary1.length} vs ${boundary2.length} (expected ${vertsPerEdge})`
    };
  }

  // Sort by the varying coordinate (Z for X-adjacent, X for Z-adjacent)
  const sortKey = (dx !== 0)
    ? (v: { z: number }) => v.z
    : (v: { x: number }) => v.x;

  boundary1.sort((a, b) => sortKey(a) - sortKey(b));
  boundary2.sort((a, b) => sortKey(a) - sortKey(b));

  // Compare heights (Y values) - X and Z should match by construction
  let mismatchCount = 0;
  const mismatches: string[] = [];

  for (let i = 0; i < boundary1.length; i++) {
    const v1 = boundary1[i];
    const v2 = boundary2[i];

    // Heights should match exactly (both evaluated same world-space coordinate)
    if (Math.abs(v1.y - v2.y) > tolerance) {
      mismatchCount++;
      if (mismatches.length < 5) {
        mismatches.push(`Vertex ${i}: y1=${v1.y.toFixed(4)} vs y2=${v2.y.toFixed(4)}`);
      }
    }
  }

  return {
    matches: mismatchCount === 0,
    mismatchCount,
    details: mismatchCount === 0
      ? 'All boundary vertices match'
      : `${mismatchCount} mismatches: ${mismatches.join('; ')}${mismatchCount > 5 ? '...' : ''}`
  };
}

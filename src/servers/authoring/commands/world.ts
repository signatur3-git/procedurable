/**
 * World Commands
 *
 * Commands for querying deterministic world generation:
 *   world.sampleHeight x=<x> z=<z> seed=<seed>
 *   world.instances bounds=<...> seed=<seed>
 *   world.generate_chunk chunkX=<x> chunkZ=<z> seed=<seed> [size=<size>] [segments=<n>]
 *   world.generate_region minX=<x> minZ=<z> maxX=<x> maxZ=<z> seed=<seed>
 *   world.generate_view position=<x,y,z> direction=<x,y,z> range=<N> seed=<seed>
 */

import { CommandNamespace, CommandHandler, CommandResult } from '../command-registry';
import { ParsedCommand, getArg, getNumberOption } from '../command-parser';
import { field } from '../../../platform/spatial/ScalarField';
import { poissonDiskScatter } from '../../../platform/spatial/PoissonDisk';
import { createInstanceGroupFromScatter } from '../../../platform/spatial/Instance';
import {
  generateTerrainChunk,
  generateTerrainRegion,
  verifyChunkBoundary
} from '../../../platform/scene/TerrainChunk';
import {
  generateView,
  ViewConfig,
  LODConfig,
  DEFAULT_LOD_DISTANCES
} from '../../../platform/scene/ViewDependentGenerator';
import { Vec3 } from '../../../platform/math/Vec3';

/**
 * Simple coordinate hash function for deterministic seeding
 */
function hashCoords(x: number, z: number, seed: number): number {
  let hash = seed;
  hash = ((hash << 5) - hash) + Math.floor(x);
  hash = ((hash << 5) - hash) + Math.floor(z);
  return Math.abs(hash) >>> 0;
}

const handlers: CommandHandler[] = [
  {
    action: 'sampleHeight',
    description: 'Sample terrain height at coordinates',
    usage: 'world.sampleHeight x=<x> z=<z> seed=<seed>',
    execute: async (cmd: ParsedCommand): Promise<CommandResult> => {
      const x = getNumberOption(cmd, 'x');
      const z = getNumberOption(cmd, 'z');
      const seed = getNumberOption(cmd, 'seed') ?? 12345;

      if (x === undefined || z === undefined) {
        return {
          success: false,
          error: 'Missing coordinates. Usage: world.sampleHeight x=<x> z=<z> seed=<seed>'
        };
      }

      // Create deterministic terrain field
      const terrain = field.remap(
        field.fbm(seed, 0.02, 1.0, 4, 0.5),
        -1, 1,
        0, 50  // 0-50m elevation
      );

      const height = terrain.sample(x, 0, z);

      return {
        success: true,
        data: {
          x,
          z,
          height: Math.round(height * 100) / 100,  // Round to 2 decimals
          seed
        }
      };
    }
  },

  {
    action: 'instances',
    description: 'Generate instances in a region',
    usage: 'world.instances bounds={minX:0,maxX:50,minZ:0,maxZ:50} seed=<seed>',
    execute: async (cmd: ParsedCommand): Promise<CommandResult> => {
      const boundsStr = getArg(cmd, 0, 'bounds');
      const seed = getNumberOption(cmd, 'seed') ?? 12345;

      if (!boundsStr) {
        return {
          success: false,
          error: 'Missing bounds. Usage: world.instances bounds={minX:0,maxX:50,minZ:0,maxZ:50} seed=<seed>'
        };
      }

      // Parse bounds (simple JSON-like format)
      let bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
      try {
        // Handle both {minX:0,maxX:50,minZ:0,maxZ:50} and JSON format
        const normalized = boundsStr.replace(/([a-zA-Z]+):/g, '"$1":');
        bounds = JSON.parse(normalized);

        if (!bounds.minX && bounds.minX !== 0 || !bounds.maxX || !bounds.minZ && bounds.minZ !== 0 || !bounds.maxZ) {
          throw new Error('Missing bounds properties');
        }
      } catch {
        return {
          success: false,
          error: 'Invalid bounds format. Expected: bounds={minX:0,maxX:50,minZ:0,maxZ:50}'
        };
      }

      // Create deterministic forest density field
      const forestDensity = field.clamp(
        field.noise2d(seed, 0.05, 1.0),
        0, 1
      );

      // Scatter trees using coordinate-based seed
      const scatterSeed = hashCoords(bounds.minX, bounds.minZ, seed);
      const treePoints = poissonDiskScatter(bounds, {
        minDistance: 5.0,
        densityField: forestDensity,
        densityThreshold: 0.4,
        seed: scatterSeed
      });

      // Create instances
      const group = createInstanceGroupFromScatter(
        treePoints.points,
        'Tree',
        scatterSeed,
        {
          randomRotation: true,
          scaleVariation: 0.3
        }
      );

      return {
        success: true,
        data: {
          bounds,
          seed,
          scatterSeed,
          instances: group.instances.map(inst => ({
            id: inst.id,
            builderName: inst.builderName,
            position: inst.transform.position,
            rotation: inst.transform.rotation,
            scale: inst.transform.scale,
            seed: inst.seed
          })),
          count: group.count
        }
      };
    }
  },

  {
    action: 'generate_chunk',
    description: 'Generate a single terrain chunk',
    usage: 'world.generate_chunk chunkX=<x> chunkZ=<z> seed=<seed> [size=<size>] [segments=<n>]',
    execute: async (cmd: ParsedCommand): Promise<CommandResult> => {
      const chunkX = getNumberOption(cmd, 'chunkX');
      const chunkZ = getNumberOption(cmd, 'chunkZ');
      const seed = getNumberOption(cmd, 'seed') ?? 12345;
      const size = getNumberOption(cmd, 'size') ?? 64;
      const segments = getNumberOption(cmd, 'segments') ?? 16;

      if (chunkX === undefined || chunkZ === undefined) {
        return {
          success: false,
          error: 'Missing chunk coordinates. Usage: world.generate_chunk chunkX=<x> chunkZ=<z> seed=<seed>'
        };
      }

      // Create deterministic terrain height function using world-space coordinates
      const terrain = field.remap(
        field.fbm(seed, 0.02, 1.0, 4, 0.5),
        -1, 1,
        0, 50  // 0-50m elevation
      );

      const heightFunction = (x: number, z: number): number => {
        return terrain.sample(x, 0, z);
      };

      const chunk = generateTerrainChunk(chunkX, chunkZ, {
        chunkSize: size,
        segments,
        heightFunction
      });

      return {
        success: true,
        data: {
          chunkX: chunk.chunkX,
          chunkZ: chunk.chunkZ,
          size: chunk.size,
          segments: chunk.segments,
          bounds: chunk.bounds,
          vertexCount: chunk.mesh.vertices.length,
          faceCount: chunk.mesh.faces.length,
          seed
        }
      };
    }
  },

  {
    action: 'generate_region',
    description: 'Generate multiple terrain chunks for a region',
    usage: 'world.generate_region minX=<x> minZ=<z> maxX=<x> maxZ=<z> seed=<seed> [size=<size>] [segments=<n>]',
    execute: async (cmd: ParsedCommand): Promise<CommandResult> => {
      const minX = getNumberOption(cmd, 'minX');
      const minZ = getNumberOption(cmd, 'minZ');
      const maxX = getNumberOption(cmd, 'maxX');
      const maxZ = getNumberOption(cmd, 'maxZ');
      const seed = getNumberOption(cmd, 'seed') ?? 12345;
      const size = getNumberOption(cmd, 'size') ?? 64;
      const segments = getNumberOption(cmd, 'segments') ?? 16;

      if (minX === undefined || minZ === undefined || maxX === undefined || maxZ === undefined) {
        return {
          success: false,
          error: 'Missing region bounds. Usage: world.generate_region minX=<x> minZ=<z> maxX=<x> maxZ=<z> seed=<seed>'
        };
      }

      // Validate range
      if (maxX < minX || maxZ < minZ) {
        return {
          success: false,
          error: 'Invalid region: maxX must be >= minX and maxZ must be >= minZ'
        };
      }

      // Limit region size to prevent memory issues
      const chunksX = maxX - minX + 1;
      const chunksZ = maxZ - minZ + 1;
      const totalChunks = chunksX * chunksZ;

      if (totalChunks > 100) {
        return {
          success: false,
          error: `Region too large: ${totalChunks} chunks (max 100). Reduce region size.`
        };
      }

      // Create deterministic terrain height function
      const terrain = field.remap(
        field.fbm(seed, 0.02, 1.0, 4, 0.5),
        -1, 1,
        0, 50
      );

      const heightFunction = (x: number, z: number): number => {
        return terrain.sample(x, 0, z);
      };

      const chunks = generateTerrainRegion(minX, minZ, maxX, maxZ, {
        chunkSize: size,
        segments,
        heightFunction
      });

      // Verify boundaries between adjacent chunks
      const boundaryResults: { chunks: string; matches: boolean; details: string }[] = [];

      for (let i = 0; i < chunks.length; i++) {
        for (let j = i + 1; j < chunks.length; j++) {
          const c1 = chunks[i];
          const c2 = chunks[j];

          // Check if chunks are adjacent
          const dx = Math.abs(c2.chunkX - c1.chunkX);
          const dz = Math.abs(c2.chunkZ - c1.chunkZ);

          if (dx + dz === 1) {
            // Adjacent chunks - verify boundary
            const result = verifyChunkBoundary(c1, c2);
            boundaryResults.push({
              chunks: `(${c1.chunkX},${c1.chunkZ})-(${c2.chunkX},${c2.chunkZ})`,
              matches: result.matches,
              details: result.details
            });
          }
        }
      }

      return {
        success: true,
        data: {
          region: { minX, minZ, maxX, maxZ },
          seed,
          chunkSize: size,
          segments,
          totalChunks,
          chunks: chunks.map(c => ({
            chunkX: c.chunkX,
            chunkZ: c.chunkZ,
            bounds: c.bounds,
            vertexCount: c.mesh.vertices.length,
            faceCount: c.mesh.faces.length
          })),
          boundaryVerification: {
            total: boundaryResults.length,
            allMatch: boundaryResults.every(r => r.matches),
            results: boundaryResults
          }
        }
      };
    }
  },

  // G2-002: View-dependent generation
  {
    action: 'generate_view',
    description: 'Generate terrain and objects visible from a camera position with distance-based LOD (G2-002)',
    usage: 'world.generate_view position=<x,y,z> direction=<x,y,z> range=<N> seed=<seed> [size=<chunk_size>] [fov=<degrees>]',
    execute: async (cmd: ParsedCommand): Promise<CommandResult> => {
      // Parse position
      const posStr = getArg(cmd, 0, 'position');
      if (!posStr) {
        return {
          success: false,
          error: 'Missing position. Usage: world.generate_view position=<x,y,z> direction=<x,y,z> range=<N> seed=<seed>'
        };
      }

      const posCoords = posStr.split(',').map(Number);
      if (posCoords.length !== 3 || posCoords.some(isNaN)) {
        return {
          success: false,
          error: 'Invalid position format. Use: position=x,y,z (e.g., position=0,10,0)'
        };
      }

      // Parse direction
      const dirStr = getArg(cmd, 0, 'direction');
      if (!dirStr) {
        return {
          success: false,
          error: 'Missing direction. Usage: world.generate_view position=<x,y,z> direction=<x,y,z> range=<N> seed=<seed>'
        };
      }

      const dirCoords = dirStr.split(',').map(Number);
      if (dirCoords.length !== 3 || dirCoords.some(isNaN)) {
        return {
          success: false,
          error: 'Invalid direction format. Use: direction=x,y,z (e.g., direction=0,0,1)'
        };
      }

      // Normalize direction
      const dirVec = new Vec3(dirCoords[0], dirCoords[1], dirCoords[2]);
      if (dirVec.length() < 0.0001) {
        return {
          success: false,
          error: 'Direction cannot be zero vector'
        };
      }
      const normalizedDir = dirVec.normalize();

      // Parse range
      const range = getNumberOption(cmd, 'range');
      if (range === undefined || range <= 0) {
        return {
          success: false,
          error: 'Missing or invalid range. Range must be a positive number.'
        };
      }

      const seed = getNumberOption(cmd, 'seed') ?? 12345;
      const chunkSize = getNumberOption(cmd, 'size') ?? 64;
      const fovDegrees = getNumberOption(cmd, 'fov') ?? 90;
      const fovRadians = (fovDegrees * Math.PI) / 180;

      // Create view config
      const view: ViewConfig = {
        position: new Vec3(posCoords[0], posCoords[1], posCoords[2]),
        direction: normalizedDir,
        range,
        fovHorizontal: fovRadians,
        fovVertical: fovRadians * 0.75  // Typical aspect ratio
      };

      // Create LOD config
      const lodConfig: LODConfig = {
        lodDistances: DEFAULT_LOD_DISTANCES,
        maxLOD: 4
      };

      // Create deterministic terrain height function
      const terrain = field.remap(
        field.fbm(seed, 0.02, 1.0, 4, 0.5),
        -1, 1,
        0, 50
      );

      const heightFunction = (x: number, z: number): number => {
        return terrain.sample(x, 0, z);
      };

      // Generate scatter points for objects in the view range
      const scatterBounds = {
        minX: view.position.x - range,
        maxX: view.position.x + range,
        minZ: view.position.z - range,
        maxZ: view.position.z + range
      };

      const scatterSeed = hashCoords(
        Math.floor(view.position.x),
        Math.floor(view.position.z),
        seed
      );

      const scatterPoints = poissonDiskScatter(scatterBounds, {
        minDistance: 10.0,
        densityField: field.constant(0.5),
        densityThreshold: 0.3,
        seed: scatterSeed
      });

      // Create objects from scatter points
      const objects = scatterPoints.points.map((pt, idx) => ({
        id: `tree_${idx}`,
        position: new Vec3(pt.x, heightFunction(pt.x, pt.z), pt.z)
      }));

      // Generate view-dependent scene
      const result = generateView(
        view,
        objects,
        {
          chunkSize,
          heightFunction
        },
        lodConfig
      );

      // Format output
      return {
        success: true,
        data: {
          view: {
            position: { x: view.position.x, y: view.position.y, z: view.position.z },
            direction: { x: normalizedDir.x, y: normalizedDir.y, z: normalizedDir.z },
            range,
            fovDegrees
          },
          seed,
          chunkSize,
          terrain: {
            totalChunks: result.stats.totalChunks,
            visibleChunks: result.stats.visibleChunks,
            skippedChunks: result.stats.skippedChunks,
            chunks: result.terrainChunks.map(c => ({
              chunkX: c.chunkX,
              chunkZ: c.chunkZ,
              distance: Math.round(c.distance * 100) / 100,
              lodTier: c.lodTier,
              segments: c.segments,
              vertexCount: c.mesh.vertices.length
            })),
            lodDistribution: result.stats.lodDistribution
          },
          objects: {
            total: result.objects.length,
            visible: result.objects.filter(o => o.isVisible).length,
            skipped: result.objects.filter(o => !o.isVisible).length,
            byLOD: {
              lod0: result.objects.filter(o => o.isVisible && o.lodTier === 0).length,
              lod1: result.objects.filter(o => o.isVisible && o.lodTier === 1).length,
              lod2: result.objects.filter(o => o.isVisible && o.lodTier === 2).length,
              lod3: result.objects.filter(o => o.isVisible && o.lodTier === 3).length,
              lod4: result.objects.filter(o => o.isVisible && o.lodTier === 4).length
            },
            nearestObjects: result.objects
              .filter(o => o.isVisible)
              .sort((a, b) => a.distance - b.distance)
              .slice(0, 10)
              .map(o => ({
                id: o.id,
                distance: Math.round(o.distance * 100) / 100,
                lodTier: o.lodTier,
                position: { x: o.position.x, y: o.position.y, z: o.position.z }
              }))
          }
        }
      };
    }
  }
];

export const worldNamespace: CommandNamespace = {
  name: 'world',
  description: 'Commands for deterministic world generation queries',
  handlers: handlers
};


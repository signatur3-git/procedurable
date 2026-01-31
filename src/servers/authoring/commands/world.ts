/**
 * World Commands
 *
 * Commands for querying deterministic world generation:
 *   world.sampleHeight x=<x> z=<z> seed=<seed>
 *   world.instances bounds=<...> seed=<seed>
 */

import { CommandNamespace, CommandHandler, CommandResult } from '../command-registry';
import { ParsedCommand, getArg, getNumberOption } from '../command-parser';
import { field } from '../../../platform/spatial/ScalarField';
import { poissonDiskScatter } from '../../../platform/spatial/PoissonDisk';
import { createInstanceGroupFromScatter } from '../../../platform/spatial/Instance';

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
  }
];

export const worldNamespace: CommandNamespace = {
  name: 'world',
  description: 'Commands for deterministic world generation queries',
  handlers: handlers
};


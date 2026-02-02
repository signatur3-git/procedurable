/**
 * PSD Scene Query Commands (B2-003)
 *
 * Commands for querying and inspecting PSD (Procedurable Scene Description) scenes.
 * These commands work with the serialized PSD format from builder.export_psd.
 */

import { CommandNamespace, CommandHandler, CommandResult, CommandContext } from '../command-registry';
import { ParsedCommand, getArg, getNumberOption } from '../command-parser';
import {
  PSDScene,
  serializeToPSD,
  queryByTag,
  getPrimBounds,
  listPrimsHierarchy,
  getOverview,
  inspectPrim,
  getMaterialAssignments,
  calculateDistance,
  findPrimsWithin,
  collectAggregatedTags
} from '../../../generation/builder/PSD';

/**
 * Helper to get or create the PSD scene from the last run.
 * Caches the result for performance.
 */
async function getOrCreatePSDScene(ctx: CommandContext): Promise<PSDScene | null> {
  if (!ctx.lastRun) {
    return null;
  }

  // Return cached scene if available
  if (ctx.lastPSDScene) {
    return ctx.lastPSDScene;
  }

  // Serialize the last run to PSD format
  const scene = serializeToPSD(ctx.lastRun);
  ctx.lastPSDScene = scene;
  return scene;
}

const handlers: CommandHandler[] = [
  {
    action: 'query_by_tag',
    description: 'Find prims by tag (recursive — searches descendants)',
    usage: 'psd.query_by_tag <tag>',
    execute: async (cmd: ParsedCommand, ctx: CommandContext): Promise<CommandResult> => {
      const tag = getArg(cmd, 0);
      if (!tag) {
        return { success: false, error: 'Usage: psd.query_by_tag <tag>' };
      }

      const scene = await getOrCreatePSDScene(ctx);
      if (!scene) {
        return { success: false, error: 'No builder has been run yet. Use builder.run first.' };
      }

      const paths = queryByTag(scene, tag);

      return {
        success: true,
        data: {
          tag,
          count: paths.length,
          prims: paths.map(path => {
            const prim = scene.prims[path];
            return {
              path,
              type: prim.type,
              tags: prim.tags,
              aggregatedTags: collectAggregatedTags(scene, path)
            };
          })
        }
      };
    }
  },

  {
    action: 'get_bounds',
    description: 'Get AABB bounds for a prim',
    usage: 'psd.get_bounds <prim_path>',
    execute: async (cmd: ParsedCommand, ctx: CommandContext): Promise<CommandResult> => {
      const primPath = getArg(cmd, 0);
      if (!primPath) {
        return { success: false, error: 'Usage: psd.get_bounds <prim_path>' };
      }

      const scene = await getOrCreatePSDScene(ctx);
      if (!scene) {
        return { success: false, error: 'No builder has been run yet. Use builder.run first.' };
      }

      const bounds = getPrimBounds(scene, primPath);
      if (!bounds) {
        return { success: false, error: `Prim not found: ${primPath}` };
      }

      const size = {
        x: bounds.max[0] - bounds.min[0],
        y: bounds.max[1] - bounds.min[1],
        z: bounds.max[2] - bounds.min[2]
      };

      const center = {
        x: (bounds.min[0] + bounds.max[0]) / 2,
        y: (bounds.min[1] + bounds.max[1]) / 2,
        z: (bounds.min[2] + bounds.max[2]) / 2
      };

      return {
        success: true,
        data: {
          path: primPath,
          bounds: {
            min: { x: bounds.min[0], y: bounds.min[1], z: bounds.min[2] },
            max: { x: bounds.max[0], y: bounds.max[1], z: bounds.max[2] }
          },
          size,
          center
        }
      };
    }
  },

  {
    action: 'list_prims',
    description: 'List all prims with hierarchy information',
    usage: 'psd.list_prims',
    execute: async (_cmd: ParsedCommand, ctx: CommandContext): Promise<CommandResult> => {
      const scene = await getOrCreatePSDScene(ctx);
      if (!scene) {
        return { success: false, error: 'No builder has been run yet. Use builder.run first.' };
      }

      const hierarchy = listPrimsHierarchy(scene);

      return {
        success: true,
        data: {
          primCount: Object.keys(scene.prims).length,
          prims: hierarchy.map(h => ({
            ...h,
            indent: '  '.repeat(h.depth) + '└─ '
          }))
        }
      };
    }
  },

  {
    action: 'get_materials',
    description: 'Get all materials and their assignments',
    usage: 'psd.get_materials',
    execute: async (_cmd: ParsedCommand, ctx: CommandContext): Promise<CommandResult> => {
      const scene = await getOrCreatePSDScene(ctx);
      if (!scene) {
        return { success: false, error: 'No builder has been run yet. Use builder.run first.' };
      }

      const assignments = getMaterialAssignments(scene);

      return {
        success: true,
        data: {
          materialCount: scene.materials.length,
          materials: assignments.map((a, idx) => ({
            index: idx,
            name: a.material.name,
            color: {
              r: a.material.color[0].toFixed(3),
              g: a.material.color[1].toFixed(3),
              b: a.material.color[2].toFixed(3)
            },
            roughness: a.material.roughness,
            metalness: a.material.metalness,
            usedBy: a.usedBy,
            triangleCount: a.triangleCount
          }))
        }
      };
    }
  },

  {
    action: 'overview',
    description: 'Get top-level scene overview with aggregated metadata',
    usage: 'psd.overview',
    execute: async (_cmd: ParsedCommand, ctx: CommandContext): Promise<CommandResult> => {
      const scene = await getOrCreatePSDScene(ctx);
      if (!scene) {
        return { success: false, error: 'No builder has been run yet. Use builder.run first.' };
      }

      const overview = getOverview(scene);

      return {
        success: true,
        data: {
          sceneName: scene.name,
          generator: scene.generator,
          totalPrims: Object.keys(scene.prims).length,
          totalMaterials: scene.materials.length,
          roots: overview.map(o => ({
            path: o.path,
            type: o.type,
            childCount: o.childCount,
            descendantCount: o.descendantCount,
            bounds: {
              min: { x: o.combinedBounds.min[0], y: o.combinedBounds.min[1], z: o.combinedBounds.min[2] },
              max: { x: o.combinedBounds.max[0], y: o.combinedBounds.max[1], z: o.combinedBounds.max[2] }
            },
            aggregatedTags: o.aggregatedTags
          }))
        }
      };
    }
  },

  {
    action: 'inspect',
    description: 'Inspect a specific prim (drill-down one level)',
    usage: 'psd.inspect <prim_path>',
    execute: async (cmd: ParsedCommand, ctx: CommandContext): Promise<CommandResult> => {
      const primPath = getArg(cmd, 0);
      if (!primPath) {
        return { success: false, error: 'Usage: psd.inspect <prim_path>' };
      }

      const scene = await getOrCreatePSDScene(ctx);
      if (!scene) {
        return { success: false, error: 'No builder has been run yet. Use builder.run first.' };
      }

      const inspection = inspectPrim(scene, primPath);
      if (!inspection) {
        return { success: false, error: `Prim not found: ${primPath}` };
      }

      // Format for output
      const result: any = {
        path: inspection.path,
        type: inspection.type,
        tags: inspection.tags,
        bounds: {
          min: { x: inspection.bounds.min[0], y: inspection.bounds.min[1], z: inspection.bounds.min[2] },
          max: { x: inspection.bounds.max[0], y: inspection.bounds.max[1], z: inspection.bounds.max[2] }
        },
        transform: {
          position: { x: inspection.transform.position[0], y: inspection.transform.position[1], z: inspection.transform.position[2] },
          rotation: { x: inspection.transform.rotation[0], y: inspection.transform.rotation[1], z: inspection.transform.rotation[2] },
          scale: { x: inspection.transform.scale[0], y: inspection.transform.scale[1], z: inspection.transform.scale[2] }
        },
        childCount: inspection.children.length,
        children: inspection.children
      };

      if (inspection.triangleCount !== undefined) {
        result.triangleCount = inspection.triangleCount;
      }
      if (inspection.prototype !== undefined) {
        result.prototype = inspection.prototype;
      }

      return { success: true, data: result };
    }
  },

  {
    action: 'distance',
    description: 'Calculate distance between two prims',
    usage: 'psd.distance <prim_a> <prim_b>',
    execute: async (cmd: ParsedCommand, ctx: CommandContext): Promise<CommandResult> => {
      const primA = getArg(cmd, 0);
      const primB = getArg(cmd, 1);

      if (!primA || !primB) {
        return { success: false, error: 'Usage: psd.distance <prim_a> <prim_b>' };
      }

      const scene = await getOrCreatePSDScene(ctx);
      if (!scene) {
        return { success: false, error: 'No builder has been run yet. Use builder.run first.' };
      }

      const distance = calculateDistance(scene, primA, primB);
      if (!distance) {
        return { success: false, error: `One or both prims not found: ${primA}, ${primB}` };
      }

      return {
        success: true,
        data: {
          primA: distance.primA,
          primB: distance.primB,
          centerToCenter: parseFloat(distance.centerToCenter.toFixed(4)),
          surfaceToSurface: parseFloat(distance.surfaceToSurface.toFixed(4)),
          note: 'surfaceToSurface is approximate (uses bounding box radii)'
        }
      };
    }
  },

  {
    action: 'prims_within',
    description: 'Find prims within a radius of a given prim',
    usage: 'psd.prims_within <prim_path> radius=<r>',
    execute: async (cmd: ParsedCommand, ctx: CommandContext): Promise<CommandResult> => {
      const primPath = getArg(cmd, 0);
      const radius = getNumberOption(cmd, 'radius');

      if (!primPath) {
        return { success: false, error: 'Usage: psd.prims_within <prim_path> radius=<r>' };
      }
      if (radius === undefined || radius <= 0) {
        return { success: false, error: 'radius must be a positive number' };
      }

      const scene = await getOrCreatePSDScene(ctx);
      if (!scene) {
        return { success: false, error: 'No builder has been run yet. Use builder.run first.' };
      }

      const centerPrim = scene.prims[primPath];
      if (!centerPrim) {
        return { success: false, error: `Prim not found: ${primPath}` };
      }

      const nearby = findPrimsWithin(scene, primPath, radius);

      return {
        success: true,
        data: {
          center: primPath,
          radius,
          count: nearby.length,
          prims: nearby.map(path => {
            const prim = scene.prims[path];
            const dist = calculateDistance(scene, primPath, path);
            return {
              path,
              type: prim.type,
              tags: prim.tags,
              centerToCenter: dist ? parseFloat(dist.centerToCenter.toFixed(4)) : null
            };
          })
        }
      };
    }
  }
];

export const psdNamespace: CommandNamespace = {
  name: 'psd',
  description: 'Query and inspect PSD (Procedurable Scene Description) scenes',
  handlers
};

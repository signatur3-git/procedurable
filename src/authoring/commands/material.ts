/**
 * Material Commands
 *
 * Commands for materials and mesh map baking:
 *   material.bake-maps      - Bake mesh-derived maps (AO, curvature, height)
 *   material.maps           - Get baked maps for current mesh
 *   material.maps-stats     - Get statistics about baked maps
 *   material.colors         - List available named colors
 */

import { CommandNamespace, CommandHandler, CommandContext, CommandResult } from '../command-registry';
import { ParsedCommand } from '../command-parser';
import { bakeMeshMaps, serializeBakedMaps, getMapsStats, BakedMeshMaps } from '../../builder/MeshMapBaker';
import { NAMED_COLORS, listColorsByCategory } from '../../builder/MaterialLibrary';

// Store baked maps for current mesh
let currentBakedMaps: BakedMeshMaps | null = null;

/**
 * Parse a number option with default value
 */
function parseNumberOption(options: Record<string, string>, key: string, defaultValue: number): number {
  const value = options[key];
  if (value === undefined) return defaultValue;
  const num = parseFloat(value);
  return isNaN(num) ? defaultValue : num;
}

const handlers: CommandHandler[] = [
  {
    action: 'bake-maps',
    description: 'Bake mesh-derived maps (AO, curvature, height) from current mesh',
    usage: 'material.bake-maps [ao-samples=16] [ao-distance=0.1] [curvature-radius=0.05]',
    execute: async (cmd: ParsedCommand, ctx: CommandContext): Promise<CommandResult> => {
      if (!ctx.lastRun?.mesh) {
        return {
          success: false,
          error: 'No mesh available. Run a builder first with builder.run'
        };
      }

      const mesh = ctx.lastRun.mesh;

      // Parse options
      const aoSamples = parseNumberOption(cmd.options, 'ao-samples', 16);
      const aoDistance = parseNumberOption(cmd.options, 'ao-distance', 0.1);
      const curvatureRadius = parseNumberOption(cmd.options, 'curvature-radius', 0.05);

      // Validate options
      if (aoSamples < 1 || aoSamples > 128) {
        return { success: false, error: 'ao-samples must be between 1 and 128' };
      }

      const startTime = Date.now();

      // Bake maps
      currentBakedMaps = bakeMeshMaps(mesh, {
        aoSamples,
        aoDistance,
        curvatureRadius
      });

      const duration = Date.now() - startTime;
      const stats = getMapsStats(currentBakedMaps);

      return {
        success: true,
        data: {
          vertexCount: currentBakedMaps.vertexCount,
          bounds: currentBakedMaps.bounds,
          duration: `${duration}ms`,
          stats,
          message: `Baked ${currentBakedMaps.vertexCount} vertices in ${duration}ms`
        }
      };
    }
  },

  {
    action: 'maps',
    description: 'Get baked maps for current mesh',
    usage: 'material.maps [format=summary|full]',
    execute: async (cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      if (!currentBakedMaps) {
        return {
          success: false,
          error: 'No baked maps available. Run material.bake-maps first'
        };
      }

      const format = cmd.options['format'] ?? 'summary';

      if (format === 'full') {
        // Return full arrays (can be large)
        return {
          success: true,
          data: serializeBakedMaps(currentBakedMaps)
        };
      } else {
        // Return summary with samples
        const sampleCount = Math.min(10, currentBakedMaps.vertexCount);
        return {
          success: true,
          data: {
            vertexCount: currentBakedMaps.vertexCount,
            bounds: currentBakedMaps.bounds,
            stats: getMapsStats(currentBakedMaps),
            samples: {
              ao: Array.from(currentBakedMaps.ao.slice(0, sampleCount)),
              curvature: Array.from(currentBakedMaps.curvature.slice(0, sampleCount)),
              height: Array.from(currentBakedMaps.height.slice(0, sampleCount))
            }
          }
        };
      }
    }
  },

  {
    action: 'maps-stats',
    description: 'Get statistics about baked maps',
    usage: 'material.maps-stats',
    execute: async (_cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      if (!currentBakedMaps) {
        return {
          success: false,
          error: 'No baked maps available. Run material.bake-maps first'
        };
      }

      return {
        success: true,
        data: {
          vertexCount: currentBakedMaps.vertexCount,
          bounds: currentBakedMaps.bounds,
          stats: getMapsStats(currentBakedMaps)
        }
      };
    }
  },

  {
    action: 'colors',
    description: 'List available named colors',
    usage: 'material.colors [category=wood|metal|fabric|stone|leather|plastic]',
    execute: async (cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      const category = cmd.options['category'];

      if (category) {
        const prefix = category + '_';
        const colors = listColorsByCategory(prefix);
        const colorMap: Record<string, { r: number; g: number; b: number }> = {};
        for (const name of colors) {
          colorMap[name] = NAMED_COLORS[name];
        }
        return {
          success: true,
          data: {
            category,
            count: colors.length,
            colors: colorMap
          }
        };
      } else {
        // List all categories
        const categories = ['wood', 'metal', 'fabric', 'stone', 'leather', 'plastic'];
        const summary: Record<string, number> = {};
        for (const cat of categories) {
          summary[cat] = listColorsByCategory(cat + '_').length;
        }
        summary['basic'] = Object.keys(NAMED_COLORS).filter(
          n => !categories.some(c => n.startsWith(c + '_'))
        ).length;

        return {
          success: true,
          data: {
            totalColors: Object.keys(NAMED_COLORS).length,
            categories: summary,
            hint: 'Use material.colors category=wood to see specific category'
          }
        };
      }
    }
  }
];

export const materialCommands: CommandNamespace = {
  name: 'material',
  description: 'Material and mesh map baking commands',
  handlers
};

// Export for testing
export function clearBakedMaps(): void {
  currentBakedMaps = null;
}


/**
 * Geometry Commands
 *
 * Commands for geometry operations and queries
 */

import { CommandNamespace, CommandHandler, CommandContext, CommandResult } from '../command-registry';
import { ParsedCommand } from '../command-parser';
import { Shape2D } from '../../../platform/geometry/Shape2D';

const handlers: CommandHandler[] = [
  {
    action: 'shape2d',
    description: 'Create or query 2D shapes',
    usage: 'geometry.shape2d type=<rect|circle|ellipse|polygon> [params...]',
    execute: async (cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      const type = cmd.options['type'];

      if (!type) {
        return {
          success: false,
          error: 'Missing type. Usage: geometry.shape2d type=<rect|circle|ellipse|polygon> [params...]'
        };
      }

      try {
        let shape: Shape2D;

        switch (type) {
          case 'rect': {
            const width = parseFloat(cmd.options['width'] || '1');
            const height = parseFloat(cmd.options['height'] || '1');
            const x = parseFloat(cmd.options['x'] || '0');
            const z = parseFloat(cmd.options['z'] || '0');
            shape = Shape2D.rect(width, height, { x, z });
            break;
          }

          case 'circle': {
            const radius = parseFloat(cmd.options['radius'] || '1');
            const segments = parseInt(cmd.options['segments'] || '32');
            const x = parseFloat(cmd.options['x'] || '0');
            const z = parseFloat(cmd.options['z'] || '0');
            shape = Shape2D.circle(radius, segments, { x, z });
            break;
          }

          case 'ellipse': {
            const radiusX = parseFloat(cmd.options['radiusX'] || '1');
            const radiusZ = parseFloat(cmd.options['radiusZ'] || '1');
            const segments = parseInt(cmd.options['segments'] || '32');
            const x = parseFloat(cmd.options['x'] || '0');
            const z = parseFloat(cmd.options['z'] || '0');
            shape = Shape2D.ellipse(radiusX, radiusZ, segments, { x, z });
            break;
          }

          case 'polygon': {
            return {
              success: false,
              error: 'Polygon type requires explicit points array (not supported via DSL command). Use YAML shape2d construct instead.'
            };
          }

          default:
            return {
              success: false,
              error: `Unknown shape type: ${type}. Supported: rect, circle, ellipse, polygon`
            };
        }

        const bounds = shape.getBounds();
        const area = shape.getArea();

        return {
          success: true,
          data: {
            type: shape.type,
            pointCount: shape.points.length,
            bounds: {
              minX: bounds.minX.toFixed(3),
              maxX: bounds.maxX.toFixed(3),
              minZ: bounds.minZ.toFixed(3),
              maxZ: bounds.maxZ.toFixed(3)
            },
            area: area.toFixed(3),
            isClockwise: shape.isClockwise(),
            points: shape.points.map(p => ({ x: parseFloat(p.x.toFixed(3)), z: parseFloat(p.z.toFixed(3)) }))
          }
        };

      } catch (err: any) {
        return {
          success: false,
          error: `Failed to create shape: ${err.message}`
        };
      }
    }
  }
];

export const geometryNamespace: CommandNamespace = {
  name: 'geometry',
  description: 'Geometry operations and queries',
  handlers
};

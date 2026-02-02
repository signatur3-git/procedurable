/**
 * Geometry Commands
 *
 * Commands for geometry operations and queries
 */

import { CommandNamespace, CommandHandler, CommandContext, CommandResult } from '../command-registry';
import { ParsedCommand } from '../command-parser';
import { Shape2D, Point2D } from '../../../platform/geometry/Shape2D';
import {
  union,
  subtract,
  intersect,
  BooleanResult
} from '../../../platform/geometry/PolygonBoolean';

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

      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          success: false,
          error: `Failed to create shape: ${message}`
        };
      }
    }
  },

  {
    action: 'boolean2d',
    description: '2D boolean operations: union, subtract, intersect',
    usage: 'geometry.boolean2d op=<union|subtract|intersect> subject=<rect|circle:params> clip=<rect|circle:params>',
    execute: async (cmd: ParsedCommand, _ctx: CommandContext): Promise<CommandResult> => {
      const op = cmd.options['op'] || cmd.options['operation'];
      const subjectSpec = cmd.options['subject'] || cmd.options['a'];
      const clipSpec = cmd.options['clip'] || cmd.options['b'];

      if (!op) {
        return {
          success: false,
          error: 'Missing operation. Usage: geometry.boolean2d op=<union|subtract|intersect> subject=... clip=...'
        };
      }

      if (!subjectSpec || !clipSpec) {
        return {
          success: false,
          error: 'Both subject and clip shapes are required. Use subject=rect:2,2 clip=circle:1'
        };
      }

      try {
        // Parse shape specs like "rect:2,2" or "circle:1" or "rect:2,2,0.5,0" (width,height,x,z)
        const parseShapeSpec = (spec: string): Point2D[] => {
          const [type, params] = spec.split(':');
          const values = params ? params.split(',').map(v => parseFloat(v.trim())) : [];

          switch (type.toLowerCase()) {
            case 'rect': {
              const width = values[0] || 1;
              const height = values[1] || width;
              const x = values[2] || 0;
              const z = values[3] || 0;
              return Shape2D.rect(width, height, { x, z }).points;
            }
            case 'circle': {
              const radius = values[0] || 1;
              const segments = values[1] || 32;
              const x = values[2] || 0;
              const z = values[3] || 0;
              return Shape2D.circle(radius, segments, { x, z }).points;
            }
            case 'ellipse': {
              const radiusX = values[0] || 1;
              const radiusZ = values[1] || 1;
              const segments = values[2] || 32;
              const x = values[3] || 0;
              const z = values[4] || 0;
              return Shape2D.ellipse(radiusX, radiusZ, segments, { x, z }).points;
            }
            default:
              throw new Error(`Unknown shape type: ${type}. Supported: rect, circle, ellipse`);
          }
        };

        const subject = parseShapeSpec(subjectSpec);
        const clip = parseShapeSpec(clipSpec);

        let result: BooleanResult;
        switch (op.toLowerCase()) {
          case 'union':
            result = union(subject, clip);
            break;
          case 'subtract':
          case 'difference':
            result = subtract(subject, clip);
            break;
          case 'intersect':
          case 'intersection':
            result = intersect(subject, clip);
            break;
          default:
            return {
              success: false,
              error: `Unknown operation: ${op}. Supported: union, subtract, intersect`
            };
        }

        // Calculate total area
        const totalArea = result.reduce((sum, r) => {
          const outer = Shape2D.polygon(r.outer);
          const holesArea = r.holes.reduce((ha, h) => ha + Shape2D.polygon(h).getArea(), 0);
          return sum + outer.getArea() - holesArea;
        }, 0);

        return {
          success: true,
          data: {
            operation: op,
            resultCount: result.length,
            totalArea: totalArea.toFixed(3),
            polygons: result.map((r, i) => ({
              index: i,
              outerPointCount: r.outer.length,
              holeCount: r.holes.length,
              area: Shape2D.polygon(r.outer).getArea().toFixed(3)
            }))
          }
        };

      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          success: false,
          error: `Boolean operation failed: ${message}`
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

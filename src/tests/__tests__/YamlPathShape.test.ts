import { describe, it, expect } from '@jest/globals';
import { parseAndExecuteBuilder } from '../../builder/YamlBuilderParser';
import type { YamlBuilderDefinition } from '../../builder/YamlBuilderParser';

describe('YamlBuilderParser - Path Shapes', () => {
  it('should parse and extrude a path shape with adaptive tessellation', async () => {
    const builder: YamlBuilderDefinition = {
      version: '1.0',
      name: 'PathBadge',
      description: 'Path-based badge for testing',
      shapes: {
        badge: {
          type: 'path',
          curveTolerance: 0.001,
          curveMaxSegments: 16,
          segments: [
            { type: 'moveTo', point: { x: -1, z: 0 } },
            {
              type: 'cubicCurveTo',
              control1: { x: -1, z: 1 },
              control2: { x: 1, z: 1 },
              end: { x: 1, z: 0 }
            },
            {
              type: 'cubicCurveTo',
              control1: { x: 1, z: -1 },
              control2: { x: -1, z: -1 },
              end: { x: -1, z: 0 }
            },
            { type: 'closePath' }
          ]
        }
      },
      geometry: [
        {
          extrude2d: 'badge',
          shape: 'badge',
          depth: 0.1,
          caps: 'both'
        }
      ]
    };

    const output = await parseAndExecuteBuilder(builder);

    expect(output.mesh.vertices.length).toBeGreaterThan(0);
    expect(output.mesh.faces.length).toBeGreaterThan(0);
  });
});

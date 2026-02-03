/**
 * Tests for Grid and For loop commands
 *
 * These commands enable creating 2D patterns like chessboards.
 */

import { executeBuilder } from '../../generation/builder/YamlBuilderExecutor';
import { YamlBuilderDefinition } from '../../generation/builder/YamlBuilderTypes';

// Test-friendly type alias
type TestYamlDefinition = Partial<YamlBuilderDefinition> & { name: string; version: string };

describe('Grid Command (2D iteration)', () => {
  it('should create geometry in a 2D grid pattern', async () => {
    const yaml: TestYamlDefinition = {
      name: 'TestGrid',
      version: '1.0',
      geometry: [
        {
          grid: { rows: 3, cols: 4 },
          geometry: [
            { vertex: 'v_${row}_${col}', position: { x: 'col * 0.1', y: 0, z: 'row * 0.1' } }
          ]
        }
      ]
    };

    const output = await executeBuilder(yaml);

    // Should create 3 * 4 = 12 vertices
    expect(output.mesh.vertices.length).toBe(12);
  });

  it('should provide row, col, and index variables', async () => {
    const yaml: TestYamlDefinition = {
      name: 'TestGridVars',
      version: '1.0',
      geometry: [
        {
          grid: { rows: 2, cols: 3 },
          geometry: [
            { vertex: 'v_${index}', position: { x: 'col', y: 'index', z: 'row' } }
          ]
        }
      ]
    };

    const output = await executeBuilder(yaml);

    // Should create 2 * 3 = 6 vertices
    expect(output.mesh.vertices.length).toBe(6);

    // Check that index is correctly calculated as row * cols + col
    // Row 0: (0,0,0), (1,1,0), (2,2,0)
    // Row 1: (0,3,1), (1,4,1), (2,5,1)
    const verts = output.mesh.vertices;
    expect(verts[0].position.x).toBe(0);
    expect(verts[0].position.y).toBe(0);
    expect(verts[0].position.z).toBe(0);
    expect(verts[3].position.x).toBe(0);
    expect(verts[3].position.y).toBe(3);
    expect(verts[3].position.z).toBe(1);
  });

  it('should support custom row/col variable names', async () => {
    const yaml: TestYamlDefinition = {
      name: 'TestGridCustomVars',
      version: '1.0',
      geometry: [
        {
          grid: { rows: 2, cols: 2, row_var: 'r', col_var: 'c' },
          geometry: [
            { vertex: 'v_${r}_${c}', position: { x: 'c', y: 0, z: 'r' } }
          ]
        }
      ]
    };

    const output = await executeBuilder(yaml);
    expect(output.mesh.vertices.length).toBe(4);
  });

  it('should support expressions for row/col counts', async () => {
    const yaml: TestYamlDefinition = {
      name: 'TestGridExpr',
      version: '1.0',
      measurements: {
        grid_size: { value: 3 }
      },
      geometry: [
        {
          grid: { rows: 'grid_size', cols: 'grid_size' },
          geometry: [
            { vertex: 'v_${row}_${col}', position: { x: 'col', y: 0, z: 'row' } }
          ]
        }
      ]
    };

    const output = await executeBuilder(yaml);
    expect(output.mesh.vertices.length).toBe(9); // 3x3
  });

  it('should create chessboard-style boxes', async () => {
    const yaml: TestYamlDefinition = {
      name: 'ChessboardSquares',
      version: '1.0',
      measurements: {
        square_size: { value: 0.05 },
        board_start: { value: -0.175 } // -3.5 * square_size for 8x8 centered
      },
      geometry: [
        {
          grid: { rows: 8, cols: 8 },
          geometry: [
            {
              box: {
                name: 'square_${row}_${col}',
                center: {
                  x: 'board_start + col * square_size + square_size/2',
                  y: 0,
                  z: 'board_start + row * square_size + square_size/2'
                },
                size: { x: 'square_size', y: 0.002, z: 'square_size' }
              }
            }
          ]
        }
      ]
    };

    const output = await executeBuilder(yaml);

    // Should create 64 boxes, each with 8 vertices (for UVs) and 6 faces
    // 64 boxes * 24 vertices = 1536 vertices (24 per box due to UV splits)
    expect(output.mesh.vertices.length).toBe(64 * 24);
    expect(output.mesh.faces.length).toBe(64 * 6); // 6 faces per box
  });
});

describe('For Command (repeat alias)', () => {
  it('should work as alias for repeat', async () => {
    const yaml: TestYamlDefinition = {
      name: 'TestFor',
      version: '1.0',
      geometry: [
        {
          for: 5,
          as: 'i',
          geometry: [
            { vertex: 'v_${i}', position: { x: 'i * 0.2', y: 0, z: 0 } }
          ]
        }
      ]
    };

    const output = await executeBuilder(yaml);
    expect(output.mesh.vertices.length).toBe(5);
  });

  it('should support expression for count', async () => {
    const yaml: TestYamlDefinition = {
      name: 'TestForExpr',
      version: '1.0',
      decisions: {
        leg_count: { type: 'count', min: 3, max: 6 }
      },
      geometry: [
        {
          for: 'leg_count',
          as: 'i',
          geometry: [
            { vertex: 'v_${i}', position: { x: 'i', y: 0, z: 0 } }
          ]
        }
      ]
    };

    const output = await executeBuilder(yaml, { seed: 42 });
    // leg_count will be random between 3-6, so check it's in range
    expect(output.mesh.vertices.length).toBeGreaterThanOrEqual(3);
    expect(output.mesh.vertices.length).toBeLessThanOrEqual(6);
  });
});

describe('Nested iteration', () => {
  it('should support nested repeat/for loops', async () => {
    const yaml: TestYamlDefinition = {
      name: 'TestNestedLoop',
      version: '1.0',
      geometry: [
        {
          repeat: 3,
          as: 'outer',
          geometry: [
            {
              for: 2,
              as: 'inner',
              geometry: [
                { vertex: 'v_${outer}_${inner}', position: { x: 'outer', y: 0, z: 'inner' } }
              ]
            }
          ]
        }
      ]
    };

    const output = await executeBuilder(yaml);
    // 3 outer * 2 inner = 6 vertices
    expect(output.mesh.vertices.length).toBe(6);
  });
});

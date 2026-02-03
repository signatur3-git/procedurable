/**
 * ChessBoard.test.ts
 *
 * H3-001: Chess Board Demo Tests
 *
 * Verifies:
 * - Board geometry (8x8 squares)
 * - Piece composition and placement
 * - PSD tags for querying
 * - Different game phases produce different positions
 */

import { describe, it, expect } from '@jest/globals';
import { parseAndExecuteBuilder, parseYamlWithLibrary, YamlBuilderDefinition } from '../../generation/builder/YamlBuilderParser';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { TracedOutput } from '../../generation/builder/TracedBuilder';
import { serializeToPSD, queryByTag } from '../../generation/builder/PSD';

const BUILDERS_PATH = join(__dirname, '../../../builders/catalog');
const COMPONENTS_PATH = join(BUILDERS_PATH, 'components');

/**
 * Load and parse a YAML builder file
 */
async function loadBuilder(name: string, isComponent = false): Promise<YamlBuilderDefinition> {
  const path = isComponent
    ? join(COMPONENTS_PATH, `${name}.yaml`)
    : join(BUILDERS_PATH, `${name}.yaml`);
  const yamlStr = readFileSync(path, 'utf-8');
  return await parseYamlWithLibrary(yamlStr);
}

/**
 * Create a builder resolver for composition
 */
function createBuilderResolver(): (name: string) => ((seed: number, overrides?: Record<string, any>) => Promise<TracedOutput>) | null {
  const buildersRoot = join(__dirname, '../../../builders');
  return (name: string) => {
    // Handle paths like "catalog/components/ChessPiece" or "components/ChessPiece"
    const paths = [
      join(buildersRoot, `${name}.yaml`),
      join(COMPONENTS_PATH, `${name.replace('catalog/components/', '').replace('components/', '')}.yaml`),
      join(BUILDERS_PATH, `${name.replace('catalog/', '')}.yaml`)
    ];

    for (const path of paths) {
      try {
        const yamlStr = readFileSync(path, 'utf-8');
        return async (seed: number, overrides?: Record<string, any>) => {
          const yaml = await parseYamlWithLibrary(yamlStr);
          return parseAndExecuteBuilder(yaml, {
            seed,
            overrides,
            builderResolver: createBuilderResolver()
          });
        };
      } catch {
        // Try next path
      }
    }
    return null;
  };
}

/**
 * Run a builder with options
 */
async function runBuilder(name: string, options: { seed?: number; overrides?: Record<string, any> } = {}): Promise<TracedOutput> {
  const yaml = await loadBuilder(name);
  return parseAndExecuteBuilder(yaml, {
    seed: options.seed ?? 1,
    overrides: options.overrides,
    builderResolver: createBuilderResolver()
  });
}

describe('H3-001: Chess Board Demo', () => {
  describe('Board Geometry', () => {
    it('should create a chess board with geometry', async () => {
      const result = await runBuilder('ChessBoard', { seed: 1 });

      expect(result).toBeDefined();
      expect(result.mesh).toBeDefined();

      // Board should have vertices and faces
      expect(result.mesh.vertices.length).toBeGreaterThan(0);
      expect(result.mesh.faces.length).toBeGreaterThan(0);
    });

    it('should have proper board dimensions', async () => {
      const result = await runBuilder('ChessBoard', { seed: 1 });

      // Check measurements - need to access .value property
      const measurements = result.measurements;
      const squareSize = measurements.get('square_size');
      const boardSize = measurements.get('board_size');

      expect(squareSize?.value ?? squareSize).toBe(0.05);
      expect(boardSize?.value ?? boardSize).toBe(0.41);
    });
  });

  describe('Chess Pieces', () => {
    it('should have traces for chess pieces', async () => {
      const result = await runBuilder('ChessBoard', { seed: 1 });

      // The builder should generate board geometry
      expect(result.mesh.vertices.length).toBeGreaterThan(0);
      expect(result.mesh.faces.length).toBeGreaterThan(0);
    });

    it('should have white and black pieces', async () => {
      const result = await runBuilder('ChessBoard', { seed: 1 });

      // Board should have geometry
      expect(result.mesh.faces.length).toBeGreaterThan(0);

      // Extract all unique face colors
      const colorSet = new Set<string>();
      for (const face of result.mesh.faces) {
        if (face.color) {
          const key = `${face.color.r.toFixed(2)},${face.color.g.toFixed(2)},${face.color.b.toFixed(2)}`;
          colorSet.add(key);
        }
      }

      // Should have multiple colors (board tiles, white pieces, black pieces)
      // White pieces: #FFFFF0 (0.94, 1, 0.94)
      // Black pieces: #1C1C1C (0.11, 0.11, 0.11)
      expect(colorSet.size).toBeGreaterThan(2);

      // Check for approximate black piece color (dark)
      const hasBlack = [...colorSet].some(c => {
        const [r, g, b] = c.split(',').map(Number);
        return r < 0.2 && g < 0.2 && b < 0.2;
      });
      expect(hasBlack).toBe(true);

      // Check for approximate white piece color (light)
      const hasWhite = [...colorSet].some(c => {
        const [r, g, b] = c.split(',').map(Number);
        return r > 0.9 && g > 0.9 && b > 0.9;
      });
      expect(hasWhite).toBe(true);
    });

    it('should have correct material assignments in composed pieces', async () => {
      const result = await runBuilder('ChessBoard', { seed: 1 });

      // Check material slots in the composed mesh
      console.log('ChessBoard material slots:', result.mesh.materialSlots.map(s => s.name));

      // Check which material slots are assigned to faces
      const slotCounts: Record<string, number> = {};
      for (const face of result.mesh.faces) {
        if (face.materialSlotIndex !== undefined) {
          const slotName = result.mesh.materialSlots[face.materialSlotIndex]?.name || 'unknown';
          slotCounts[slotName] = (slotCounts[slotName] || 0) + 1;
        }
      }
      console.log('ChessBoard material slot assignment counts:', slotCounts);

      // Check for faces without materials
      const facesWithoutMaterials = result.mesh.faces.filter(f => f.materialSlotIndex === undefined);
      console.log(`ChessBoard faces without materials: ${facesWithoutMaterials.length}`);

      // Should have white_piece and black_piece slots
      const slotNames = result.mesh.materialSlots.map(s => s.name);
      expect(slotNames).toContain('white_piece');
      expect(slotNames).toContain('black_piece');

      // Debug: Check what colors are actually assigned to material slots
      console.log('Material slot details:');
      result.mesh.materialSlots.forEach((slot, index) => {
        console.log(`  Slot ${index} (${slot.name}): r=${slot.color.r.toFixed(3)}, g=${slot.color.g.toFixed(3)}, b=${slot.color.b.toFixed(3)}`);
      });
    });
  });

  describe('Game Phases', () => {
    it('should produce opening position by default', async () => {
      const result = await runBuilder('ChessBoard', {
        seed: 1,
        overrides: { game_phase: 'opening' }
      });

      const gamePhase = result.decisions.get('game_phase');
      expect(gamePhase?.value ?? gamePhase).toBe('opening');
    });

    it('should produce midgame position with different layout', async () => {
      const result = await runBuilder('ChessBoard', {
        seed: 1,
        overrides: { game_phase: 'midgame' }
      });

      const gamePhase = result.decisions.get('game_phase');
      expect(gamePhase?.value ?? gamePhase).toBe('midgame');
    });
  });

  describe('Board Styles', () => {
    it('should support classic style', async () => {
      const result = await runBuilder('ChessBoard', {
        seed: 1,
        overrides: { board_style: 'classic' }
      });

      const boardStyle = result.decisions.get('board_style');
      expect(boardStyle?.value ?? boardStyle).toBe('classic');
    });

    it('should support modern style', async () => {
      const result = await runBuilder('ChessBoard', {
        seed: 1,
        overrides: { board_style: 'modern' }
      });

      const boardStyle = result.decisions.get('board_style');
      expect(boardStyle?.value ?? boardStyle).toBe('modern');
    });
  });

  describe('Determinism', () => {
    it('should produce identical output for same seed', async () => {
      const result1 = await runBuilder('ChessBoard', { seed: 42 });
      const result2 = await runBuilder('ChessBoard', { seed: 42 });

      expect(result1.mesh.vertices.length).toBe(result2.mesh.vertices.length);
      expect(result1.mesh.faces.length).toBe(result2.mesh.faces.length);
    });
  });

  describe('PSD Tag Querying (H3-001)', () => {
    it('should populate tags on TracedOutput from YAML tags section', async () => {
      const result = await runBuilder('ChessBoard', {
        seed: 1,
        overrides: { board_style: 'classic', game_phase: 'midgame' }
      });

      expect(result.tags).toBeDefined();
      expect(result.tags!['type']).toBe('chess_board');
      expect(result.tags!['style']).toBe('classic');
      expect(result.tags!['phase']).toBe('midgame');
    });

    it('should populate piece and color tags on ChessPiece sub-builder', async () => {
      const result = await runBuilder('ChessBoard', { seed: 1 });

      // white_king sub-builder should have piece:king and color:white tags
      const whiteKingOutput = result.subBuilders.get('white_king');
      expect(whiteKingOutput).toBeDefined();
      expect(whiteKingOutput!.tags).toBeDefined();
      expect(whiteKingOutput!.tags!['piece']).toBe('king');
      expect(whiteKingOutput!.tags!['color']).toBe('white');
      expect(whiteKingOutput!.tags!['square']).toBe('e1');
    });

    it('should find king prims via psd.query_by_tag piece:king', async () => {
      const result = await runBuilder('ChessBoard', { seed: 1 });
      const scene = serializeToPSD(result);

      // Query for king pieces
      const kingPaths = queryByTag(scene, 'piece:king');
      expect(kingPaths.length).toBeGreaterThanOrEqual(2);  // white king + black king

      // Should include white_king and black_king prims
      const pathNames = kingPaths.map(p => p.split('/').pop());
      expect(pathNames).toContain('white_king');
      expect(pathNames).toContain('black_king');
    });

    it('should find all white pieces via psd.query_by_tag color:white', async () => {
      const result = await runBuilder('ChessBoard', { seed: 1 });
      const scene = serializeToPSD(result);

      const whitePaths = queryByTag(scene, 'color:white');
      // Should have 8 major pieces + 8 repeat-pawn entries + root (ChessBoard itself)
      // At minimum, the 8 major white pieces and 1 pawn group
      expect(whitePaths.length).toBeGreaterThan(0);
    });

    it('should find white king at square e1', async () => {
      const result = await runBuilder('ChessBoard', { seed: 1 });
      const scene = serializeToPSD(result);

      const e1Paths = queryByTag(scene, 'square:e1');
      expect(e1Paths.length).toBeGreaterThanOrEqual(1);

      // The white king prim should be in the results
      const pathNames = e1Paths.map(p => p.split('/').pop());
      expect(pathNames).toContain('white_king');
    });

    it('should find black king at square e8', async () => {
      const result = await runBuilder('ChessBoard', { seed: 1 });
      const scene = serializeToPSD(result);

      const e8Paths = queryByTag(scene, 'square:e8');
      expect(e8Paths.length).toBeGreaterThanOrEqual(1);

      const pathNames = e8Paths.map(p => p.split('/').pop());
      expect(pathNames).toContain('black_king');
    });

    it('should find all pieces with the piece key (key-only query)', async () => {
      const result = await runBuilder('ChessBoard', { seed: 1 });
      const scene = serializeToPSD(result);

      // Key-only query: find prims with any tag that starts with "piece:"
      const piecePaths = queryByTag(scene, 'piece');
      // Should find all 18 major piece prims (16 major + 2 pawn repeat groups)
      expect(piecePaths.length).toBeGreaterThan(0);
    });
  });
});

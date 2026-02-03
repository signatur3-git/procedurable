/**
 * Built-in Constraint Libraries Tests (F1-003)
 *
 * Tests for constraint schemas stored in metadata and loadable via constraint.evaluate
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { setMetadataStore, MetadataStore } from '../../storage/MetadataStore';
import { ConstraintEvaluator, ConstraintSchema } from '../../generation/validation/ConstraintEvaluator';
import * as path from 'path';

describe('Built-in Constraint Libraries (F1-003)', () => {
  let store: MetadataStore;

  beforeAll(() => {
    // Use the real metadata folder
    store = new MetadataStore({
      rootDir: path.resolve(__dirname, '../../../metadata')
    });
    setMetadataStore(store);
  });

  describe('constraints/mechanical/gear_mesh', () => {
    let schema: ConstraintSchema;

    beforeAll(async () => {
      const entry = await store.get<ConstraintSchema>('constraints/mechanical/gear_mesh');
      schema = entry.value;
    });

    it('should load from metadata', async () => {
      expect(schema).toBeDefined();
      expect(schema.name).toBe('gear_mesh');
      expect(schema.variables).toHaveProperty('gear1_module');
      expect(schema.variables).toHaveProperty('gear2_module');
      expect(schema.variables).toHaveProperty('center_distance');
    });

    it('should validate schema structure', () => {
      const errors = ConstraintEvaluator.validateSchema(schema);
      expect(errors).toEqual([]);
    });

    it('should pass for matching gears', () => {
      const result = ConstraintEvaluator.evaluate(schema, {
        gear1_module: 0.002,
        gear2_module: 0.002,
        gear1_teeth: 20,
        gear2_teeth: 40,
        center_distance: 0.06  // (20 + 40) * 0.002 / 2 = 0.06
      });
      expect(result.passed).toBe(true);
    });

    it('should fail for mismatched module', () => {
      const result = ConstraintEvaluator.evaluate(schema, {
        gear1_module: 0.002,
        gear2_module: 0.003,  // Different pitch
        gear1_teeth: 20,
        gear2_teeth: 40,
        center_distance: 0.06
      });
      expect(result.passed).toBe(false);
      expect(result.results.some(r => !r.passed && r.rule.description?.includes('matching module'))).toBe(true);
    });

    it('should fail for wrong center distance', () => {
      const result = ConstraintEvaluator.evaluate(schema, {
        gear1_module: 0.002,
        gear2_module: 0.002,
        gear1_teeth: 20,
        gear2_teeth: 40,
        center_distance: 0.08  // Wrong distance (should be 0.06)
      });
      expect(result.passed).toBe(false);
    });
  });

  describe('constraints/spatial/clearance', () => {
    let schema: ConstraintSchema;

    beforeAll(async () => {
      const entry = await store.get<ConstraintSchema>('constraints/spatial/clearance');
      schema = entry.value;
    });

    it('should load from metadata', async () => {
      expect(schema).toBeDefined();
      expect(schema.name).toBe('clearance');
      expect(schema.variables).toHaveProperty('object1_x');
      expect(schema.variables).toHaveProperty('min_clearance');
    });

    it('should validate schema structure', () => {
      const errors = ConstraintEvaluator.validateSchema(schema);
      expect(errors).toEqual([]);
    });

    it('should pass when objects have sufficient clearance', () => {
      const result = ConstraintEvaluator.evaluate(schema, {
        object1_x: 0, object1_y: 0, object1_z: 0,
        object2_x: 1, object2_y: 0, object2_z: 0,
        min_clearance: 0.9  // Distance is 1.0
      });
      expect(result.passed).toBe(true);
    });

    it('should fail when objects are too close', () => {
      const result = ConstraintEvaluator.evaluate(schema, {
        object1_x: 0, object1_y: 0, object1_z: 0,
        object2_x: 0.5, object2_y: 0, object2_z: 0,
        min_clearance: 0.6  // Distance is 0.5, less than required
      });
      expect(result.passed).toBe(false);
    });
  });

  describe('constraints/music/time_signature', () => {
    let schema: ConstraintSchema;

    beforeAll(async () => {
      const entry = await store.get<ConstraintSchema>('constraints/music/time_signature');
      schema = entry.value;
    });

    it('should load from metadata', async () => {
      expect(schema).toBeDefined();
      expect(schema.name).toBe('time_signature');
      expect(schema.variables).toHaveProperty('beats_per_bar');
      expect(schema.variables).toHaveProperty('beat_unit');
    });

    it('should validate schema structure', () => {
      const errors = ConstraintEvaluator.validateSchema(schema);
      expect(errors).toEqual([]);
    });

    it('should pass for valid 4/4 time', () => {
      const result = ConstraintEvaluator.evaluate(schema, {
        beats_per_bar: 4,
        beat_unit: 4,
        bar_duration: 1.0  // 4/4 = 1 whole note
      });
      expect(result.passed).toBe(true);
    });

    it('should pass for valid 3/4 time (waltz)', () => {
      const result = ConstraintEvaluator.evaluate(schema, {
        beats_per_bar: 3,
        beat_unit: 4,
        bar_duration: 0.75  // 3/4 = 0.75 whole notes
      });
      expect(result.passed).toBe(true);
    });

    it('should fail for invalid beat unit', () => {
      const result = ConstraintEvaluator.evaluate(schema, {
        beats_per_bar: 4,
        beat_unit: 5,  // Not a power of 2
        bar_duration: 0.8
      });
      expect(result.passed).toBe(false);
    });
  });

  describe('constraints/chess/valid_position', () => {
    let schema: ConstraintSchema;

    beforeAll(async () => {
      const entry = await store.get<ConstraintSchema>('constraints/chess/valid_position');
      schema = entry.value;
    });

    it('should load from metadata', async () => {
      expect(schema).toBeDefined();
      expect(schema.name).toBe('valid_position');
      expect(schema.variables).toHaveProperty('white_king_count');
      expect(schema.variables).toHaveProperty('black_king_count');
    });

    it('should validate schema structure', () => {
      const errors = ConstraintEvaluator.validateSchema(schema);
      expect(errors).toEqual([]);
    });

    it('should pass for valid starting position counts', () => {
      const result = ConstraintEvaluator.evaluate(schema, {
        board: [], // Not used in count-based rules
        white_king_count: 1,
        black_king_count: 1,
        white_king_rank: 1,
        white_king_file: 5,
        black_king_rank: 8,
        black_king_file: 5,
        white_pawn_count: 8,
        black_pawn_count: 8,
        white_total_pieces: 16,
        black_total_pieces: 16
      });
      expect(result.passed).toBe(true);
    });

    it('should fail when kings are adjacent', () => {
      const result = ConstraintEvaluator.evaluate(schema, {
        board: [],
        white_king_count: 1,
        black_king_count: 1,
        white_king_rank: 4,
        white_king_file: 4,
        black_king_rank: 4,  // Same rank
        black_king_file: 5,  // Adjacent file
        white_pawn_count: 0,
        black_pawn_count: 0,
        white_total_pieces: 1,
        black_total_pieces: 1
      });
      expect(result.passed).toBe(false);
    });

    it('should fail when too many pawns', () => {
      const result = ConstraintEvaluator.evaluate(schema, {
        board: [],
        white_king_count: 1,
        black_king_count: 1,
        white_king_rank: 1,
        white_king_file: 5,
        black_king_rank: 8,
        black_king_file: 5,
        white_pawn_count: 10,  // Too many
        black_pawn_count: 8,
        white_total_pieces: 11,
        black_total_pieces: 9
      });
      expect(result.passed).toBe(false);
    });
  });

  describe('constraints/spatial/no_overlap', () => {
    it('should load from metadata', async () => {
      const entry = await store.get<ConstraintSchema>('constraints/spatial/no_overlap');
      const schema = entry.value;

      expect(schema).toBeDefined();
      expect(schema.name).toBe('no_overlap');
      expect(schema.variables).toHaveProperty('objects');

      const errors = ConstraintEvaluator.validateSchema(schema);
      expect(errors).toEqual([]);
    });
  });
});

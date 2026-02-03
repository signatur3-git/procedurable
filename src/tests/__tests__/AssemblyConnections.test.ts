/**
 * Assembly Connections Tests (F4-002)
 *
 * Tests for non-spatial connections between parts
 */

import { describe, it, expect } from '@jest/globals';
import { TracedBuilder } from '../../generation/builder/TracedBuilder';
import { executeBuilder } from '../../generation/builder/YamlBuilderExecutor';
import { serializeToPSD } from '../../generation/builder/PSD';

describe('Assembly Connections (F4-002)', () => {
  describe('TracedBuilder connections', () => {
    it('should add and retrieve connections', () => {
      const builder = new TracedBuilder('GearAssembly', 42);

      builder.addConnection({
        type: 'gear_mesh',
        from: '/gear_a',
        to: '/gear_b',
        data: { ratio: 3.5, module: 2 },
        description: 'Main drive gear to output gear'
      });

      const connections = builder.getConnections();
      expect(connections).toHaveLength(1);
      expect(connections[0].type).toBe('gear_mesh');
      expect(connections[0].from).toBe('/gear_a');
      expect(connections[0].to).toBe('/gear_b');
      expect(connections[0].data?.ratio).toBe(3.5);
    });

    it('should include connections in build output', () => {
      const builder = new TracedBuilder('JointAssembly', 42);

      builder.addConnection({
        type: 'hinge',
        from: '/arm',
        to: '/forearm',
        data: { axis: 'x', min: -90, max: 90 }
      });

      builder.addConnection({
        type: 'ball_and_socket',
        from: '/torso',
        to: '/arm',
        data: { freedom: 3 }
      });

      const output = builder.build();
      expect(output.connections).toBeDefined();
      expect(output.connections).toHaveLength(2);
      expect(output.connections![0].type).toBe('hinge');
      expect(output.connections![1].type).toBe('ball_and_socket');
    });

    it('should not include connections if none defined', () => {
      const builder = new TracedBuilder('Simple', 42);
      const output = builder.build();
      expect(output.connections).toBeUndefined();
    });
  });

  describe('YAML builder connections', () => {
    it('should process connections from YAML', async () => {
      const yaml = {
        version: '1.0',
        name: 'GearBox',
        connections: [
          {
            type: 'gear_mesh',
            from: 'input_gear',
            to: 'output_gear',
            data: { ratio: 2.5 },
            description: 'Input to output gear mesh'
          },
          {
            type: 'axle',
            from: 'shaft',
            to: 'input_gear'
          }
        ],
        geometry: []
      };

      const result = await executeBuilder(yaml, { seed: 12345 });

      expect(result.connections).toBeDefined();
      expect(result.connections).toHaveLength(2);
      expect(result.connections![0].type).toBe('gear_mesh');
      expect(result.connections![0].data?.ratio).toBe(2.5);
      expect(result.connections![1].type).toBe('axle');
    });
  });

  describe('PSD serialization', () => {
    it('should serialize connections to PSD scene', () => {
      const builder = new TracedBuilder('Assembly', 42);

      builder.addConnection({
        type: 'weld',
        from: '/part_a',
        to: '/part_b',
        description: 'Welded joint'
      });

      builder.addConnection({
        type: 'bolt',
        from: '/bracket',
        to: '/frame',
        data: { size: 'M8', count: 4 }
      });

      const output = builder.build();
      const psd = serializeToPSD(output);

      expect(psd.connections).toBeDefined();
      expect(psd.connections).toHaveLength(2);
      expect(psd.connections![0].type).toBe('weld');
      expect(psd.connections![1].type).toBe('bolt');
      expect(psd.connections![1].data?.size).toBe('M8');
    });

    it('should not include connections in PSD if none defined', () => {
      const builder = new TracedBuilder('Simple', 42);
      const output = builder.build();
      const psd = serializeToPSD(output);

      expect(psd.connections).toBeUndefined();
    });
  });

  describe('integration: mechanical assembly', () => {
    it('should model a gear train with meshing connections', async () => {
      const yaml = {
        version: '1.0',
        name: 'GearTrain',
        measurements: {
          input_teeth: { value: 20 },
          intermediate_teeth: { value: 40 },
          output_teeth: { value: 15 }
        },
        connections: [
          {
            type: 'gear_mesh',
            from: 'input',
            to: 'intermediate',
            data: { ratio: 2.0 },  // 40/20
            description: 'First stage reduction'
          },
          {
            type: 'gear_mesh',
            from: 'intermediate',
            to: 'output',
            data: { ratio: 0.375 },  // 15/40
            description: 'Second stage'
          }
        ],
        geometry: []
      };

      const result = await executeBuilder(yaml, { seed: 42 });
      const psd = serializeToPSD(result);

      // Verify connections are preserved through the pipeline
      expect(psd.connections).toHaveLength(2);

      // Calculate total gear ratio
      const ratios = psd.connections!.map(c => c.data?.ratio || 1);
      const totalRatio = ratios.reduce((a, b) => a * b, 1);
      expect(totalRatio).toBeCloseTo(0.75, 2);  // 2.0 * 0.375 = 0.75
    });
  });
});

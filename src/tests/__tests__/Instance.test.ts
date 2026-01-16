/**
 * Instance Tests
 *
 * Tests for instance representation and helpers
 */

import { describe, it, expect } from '@jest/globals';
import {
  InstanceTransform,
  createInstanceFromPoint,
  createInstanceGroupFromScatter
} from '../../core/Instance';

describe('Instance - Basic Creation', () => {
  it('should create instance from point', () => {
    const point = { x: 10, z: 20 };
    const instance = createInstanceFromPoint(point, 'Tree', {
      yOffset: 0,
      seed: 42
    });

    expect(instance.builderName).toBe('Tree');
    expect(instance.transform.position.x).toBe(10);
    expect(instance.transform.position.y).toBe(0);
    expect(instance.transform.position.z).toBe(20);
    expect(instance.seed).toBe(42);
  });

  it('should generate unique IDs based on position', () => {
    const p1 = { x: 1.5, z: 2.5 };
    const p2 = { x: 3.7, z: 4.2 };

    const i1 = createInstanceFromPoint(p1, 'Tree');
    const i2 = createInstanceFromPoint(p2, 'Tree');

    expect(i1.id).not.toBe(i2.id);
    expect(i1.id).toContain('Tree');
    expect(i1.id).toContain('1.50');
    expect(i1.id).toContain('2.50');
  });

  it('should support rotation', () => {
    const point = { x: 5, z: 10 };
    const instance = createInstanceFromPoint(point, 'Tree', {
      rotation: { x: 0, y: 45, z: 0 }
    });

    expect(instance.transform.rotation).toEqual({ x: 0, y: 45, z: 0 });
  });

  it('should support scale', () => {
    const point = { x: 5, z: 10 };
    const instance = createInstanceFromPoint(point, 'Tree', {
      scale: 1.5
    });

    expect(instance.transform.scale).toBe(1.5);
  });

  it('should support overrides', () => {
    const point = { x: 5, z: 10 };
    const instance = createInstanceFromPoint(point, 'Tree', {
      overrides: { height: 10, leaf_density: 0.8 }
    });

    expect(instance.overrides).toEqual({ height: 10, leaf_density: 0.8 });
  });
});

describe('Instance - Group Creation', () => {
  it('should create instance group from scatter points', () => {
    const points = [
      { x: 1, z: 2 },
      { x: 5, z: 8 },
      { x: 12, z: 15 }
    ];

    const group = createInstanceGroupFromScatter(points, 'Tree', 42);

    expect(group.builderName).toBe('Tree');
    expect(group.seed).toBe(42);
    expect(group.count).toBe(3);
    expect(group.instances.length).toBe(3);
  });

  it('should assign sequential seeds to instances', () => {
    const points = [
      { x: 1, z: 2 },
      { x: 5, z: 8 },
      { x: 12, z: 15 }
    ];

    const group = createInstanceGroupFromScatter(points, 'Tree', 100);

    expect(group.instances[0].seed).toBe(100);
    expect(group.instances[1].seed).toBe(101);
    expect(group.instances[2].seed).toBe(102);
  });

  it('should support shared overrides', () => {
    const points = [
      { x: 1, z: 2 },
      { x: 5, z: 8 }
    ];

    const group = createInstanceGroupFromScatter(points, 'Tree', 42, {
      sharedOverrides: { style: 'oak', season: 'autumn' }
    });

    expect(group.sharedOverrides).toEqual({ style: 'oak', season: 'autumn' });
    expect(group.instances[0].overrides).toEqual({ style: 'oak', season: 'autumn' });
    expect(group.instances[1].overrides).toEqual({ style: 'oak', season: 'autumn' });
  });

  it('should support y offset', () => {
    const points = [
      { x: 1, z: 2 },
      { x: 5, z: 8 }
    ];

    const group = createInstanceGroupFromScatter(points, 'Tree', 42, {
      yOffset: 10
    });

    expect(group.instances[0].transform.position.y).toBe(10);
    expect(group.instances[1].transform.position.y).toBe(10);
  });

  it('should support random rotation', () => {
    const points = [
      { x: 1, z: 2 },
      { x: 5, z: 8 }
    ];

    const group = createInstanceGroupFromScatter(points, 'Tree', 42, {
      randomRotation: true
    });

    // All instances should have rotation
    for (const instance of group.instances) {
      expect(instance.transform.rotation).toBeDefined();
      expect(instance.transform.rotation!.y).toBeGreaterThanOrEqual(0);
      expect(instance.transform.rotation!.y).toBeLessThanOrEqual(360);
    }
  });

  it('should support scale variation', () => {
    const points = [
      { x: 1, z: 2 },
      { x: 5, z: 8 }
    ];

    const group = createInstanceGroupFromScatter(points, 'Tree', 42, {
      scaleVariation: 0.2  // ±10%
    });

    // All instances should have scale
    for (const instance of group.instances) {
      expect(instance.transform.scale).toBeDefined();
      const scale = instance.transform.scale as number;
      expect(scale).toBeGreaterThan(0.9);
      expect(scale).toBeLessThan(1.1);
    }
  });
});

describe('Instance - Transform Validation', () => {
  it('should handle minimal transform (position only)', () => {
    const transform: InstanceTransform = {
      position: { x: 5, y: 0, z: 10 }
    };

    expect(transform.position).toEqual({ x: 5, y: 0, z: 10 });
    expect(transform.rotation).toBeUndefined();
    expect(transform.scale).toBeUndefined();
  });

  it('should handle full transform', () => {
    const transform: InstanceTransform = {
      position: { x: 5, y: 0, z: 10 },
      rotation: { x: 0, y: 45, z: 0 },
      scale: 1.5
    };

    expect(transform.position).toBeDefined();
    expect(transform.rotation).toBeDefined();
    expect(transform.scale).toBe(1.5);
  });

  it('should handle non-uniform scale', () => {
    const transform: InstanceTransform = {
      position: { x: 5, y: 0, z: 10 },
      scale: { x: 1.0, y: 2.0, z: 1.0 }
    };

    expect(transform.scale).toEqual({ x: 1.0, y: 2.0, z: 1.0 });
  });
});

describe('Instance - Real World Scenarios', () => {
  it('should handle forest with 100 trees', () => {
    // Generate 100 random positions (simulating Poisson scatter output)
    const points = [];
    for (let i = 0; i < 100; i++) {
      points.push({
        x: Math.random() * 100,
        z: Math.random() * 100
      });
    }

    const group = createInstanceGroupFromScatter(points, 'Tree', 42, {
      randomRotation: true,
      scaleVariation: 0.3
    });

    expect(group.count).toBe(100);
    expect(group.instances.length).toBe(100);

    // All instances should have transforms
    for (const instance of group.instances) {
      expect(instance.transform.position).toBeDefined();
      expect(instance.transform.rotation).toBeDefined();
      expect(instance.transform.scale).toBeDefined();
    }
  });

  it('should handle mixed instance groups', () => {
    // Trees
    const treePoints = [
      { x: 5, z: 10 },
      { x: 15, z: 20 }
    ];
    const trees = createInstanceGroupFromScatter(treePoints, 'Tree', 100);

    // Rocks
    const rockPoints = [
      { x: 8, z: 12 },
      { x: 18, z: 22 },
      { x: 25, z: 30 }
    ];
    const rocks = createInstanceGroupFromScatter(rockPoints, 'Rock', 200);

    expect(trees.count).toBe(2);
    expect(rocks.count).toBe(3);
    expect(trees.builderName).toBe('Tree');
    expect(rocks.builderName).toBe('Rock');
  });

  it('should handle table clutter pattern', () => {
    // Small objects on a table
    const clutterPoints = [
      { x: 0.2, z: 0.3 },
      { x: 0.5, z: 0.6 },
      { x: 0.8, z: 0.2 }
    ];

    const clutter = createInstanceGroupFromScatter(clutterPoints, 'Mug', 42, {
      yOffset: 0.8,  // Table height
      randomRotation: true,
      scaleVariation: 0.1
    });

    expect(clutter.count).toBe(3);

    // All on table surface
    for (const instance of clutter.instances) {
      expect(instance.transform.position.y).toBe(0.8);
    }
  });
});

describe('Instance - Integration with Poisson Scatter', () => {
  it('should work seamlessly with Poisson scatter output', () => {
    // Simulate Poisson disk scatter result
    const scatterResult = {
      points: [
        { x: 5.2, z: 10.8 },
        { x: 12.3, z: 8.1 },
        { x: 18.7, z: 15.2 },
        { x: 25.1, z: 22.9 }
      ],
      rejectedAttempts: 42,
      successfulPoints: 4
    };

    const group = createInstanceGroupFromScatter(
      scatterResult.points,
      'Tree',
      12345,
      {
        randomRotation: true,
        scaleVariation: 0.2,
        sharedOverrides: { style: 'oak' }
      }
    );

    expect(group.count).toBe(scatterResult.successfulPoints);
    expect(group.instances.length).toBe(4);

    // Verify all instances have proper transforms
    for (const instance of group.instances) {
      expect(instance.builderName).toBe('Tree');
      expect(instance.transform.position).toBeDefined();
      expect(instance.transform.rotation).toBeDefined();
      expect(instance.transform.scale).toBeDefined();
      expect(instance.overrides).toEqual({ style: 'oak' });
    }
  });
});


/**
 * Skeleton Tests (E1-001: Skeleton Declaration)
 *
 * Tests for skeleton parsing, validation, and serialization.
 */

import { TracedBuilder } from '../../generation/builder/TracedBuilder';
import { Vec3 } from '../../platform/math/Vec3';
import { executeBuilder } from '../../generation/builder/YamlBuilderExecutor';
import { serializeToPSD, PSDMeshPrim } from '../../generation/builder/PSD';
import type { YamlBuilderDefinition } from '../../generation/builder/YamlBuilderTypes';

describe('Skeleton (E1-001)', () => {
  describe('TracedBuilder.registerSkeleton', () => {
    it('should register a simple skeleton with one root joint', () => {
      const builder = new TracedBuilder('TestBuilder', 42);

      builder.registerSkeleton([
        {
          name: 'root',
          parent: null,
          position: new Vec3(0, 0, 0),
          orientation: new Vec3(0, 0, 0)
        }
      ]);

      const skeleton = builder.getSkeleton();
      expect(skeleton).not.toBeNull();
      expect(skeleton!.joints.length).toBe(1);
      expect(skeleton!.roots).toEqual(['root']);
      expect(skeleton!.jointMap.get('root')?.name).toBe('root');
    });

    it('should register a skeleton with parent-child hierarchy', () => {
      const builder = new TracedBuilder('TestBuilder', 42);

      builder.registerSkeleton([
        {
          name: 'root',
          parent: null,
          position: new Vec3(0, 0, 0),
          orientation: new Vec3(0, 0, 0)
        },
        {
          name: 'spine',
          parent: 'root',
          position: new Vec3(0, 0.5, 0),
          orientation: new Vec3(0, 0, 0)
        },
        {
          name: 'neck',
          parent: 'spine',
          position: new Vec3(0, 0.3, 0),
          orientation: new Vec3(0, 0, 0)
        }
      ]);

      const skeleton = builder.getSkeleton();
      expect(skeleton!.joints.length).toBe(3);
      expect(skeleton!.roots).toEqual(['root']);

      // Check world positions are computed correctly
      const spine = skeleton!.jointMap.get('spine')!;
      expect(spine.worldPosition.y).toBeCloseTo(0.5);

      const neck = skeleton!.jointMap.get('neck')!;
      expect(neck.worldPosition.y).toBeCloseTo(0.8); // 0.5 + 0.3
    });

    it('should compute world positions with rotation', () => {
      const builder = new TracedBuilder('TestBuilder', 42);

      builder.registerSkeleton([
        {
          name: 'root',
          parent: null,
          position: new Vec3(0, 0, 0),
          orientation: new Vec3(0, Math.PI / 2, 0)  // 90 degree Y rotation
        },
        {
          name: 'child',
          parent: 'root',
          position: new Vec3(1, 0, 0),  // 1 unit in X
          orientation: new Vec3(0, 0, 0)
        }
      ]);

      const skeleton = builder.getSkeleton();
      const child = skeleton!.jointMap.get('child')!;
      // After 90 degree Y rotation, X becomes Z
      expect(child.worldPosition.x).toBeCloseTo(0);
      expect(child.worldPosition.z).toBeCloseTo(-1);
    });

    it('should store joint constraints', () => {
      const builder = new TracedBuilder('TestBuilder', 42);

      builder.registerSkeleton([
        {
          name: 'root',
          parent: null,
          position: new Vec3(0, 0, 0),
          orientation: new Vec3(0, 0, 0)
        },
        {
          name: 'elbow',
          parent: 'root',
          position: new Vec3(0.5, 0, 0),
          orientation: new Vec3(0, 0, 0),
          constraints: {
            type: 'hinge',
            axis: 'z',
            limits: { min: 0, max: 145 }
          }
        }
      ]);

      const skeleton = builder.getSkeleton();
      const elbow = skeleton!.jointMap.get('elbow')!;
      expect(elbow.constraints).toEqual({
        type: 'hinge',
        axis: 'z',
        limits: { min: 0, max: 145 }
      });
    });

    it('should throw on duplicate joint names', () => {
      const builder = new TracedBuilder('TestBuilder', 42);

      expect(() => builder.registerSkeleton([
        { name: 'root', parent: null, position: new Vec3(0, 0, 0), orientation: new Vec3(0, 0, 0) },
        { name: 'root', parent: null, position: new Vec3(1, 0, 0), orientation: new Vec3(0, 0, 0) }
      ])).toThrow(/Duplicate joint name/);
    });

    it('should throw on invalid parent reference', () => {
      const builder = new TracedBuilder('TestBuilder', 42);

      expect(() => builder.registerSkeleton([
        { name: 'child', parent: 'nonexistent', position: new Vec3(0, 0, 0), orientation: new Vec3(0, 0, 0) }
      ])).toThrow(/non-existent parent/);
    });

    it('should throw on cycle in hierarchy', () => {
      const builder = new TracedBuilder('TestBuilder', 42);

      // This shouldn't be possible with proper parent checking, but test anyway
      // Actually with our validation, the parent check will catch this first
      expect(() => builder.registerSkeleton([
        { name: 'a', parent: 'b', position: new Vec3(0, 0, 0), orientation: new Vec3(0, 0, 0) },
        { name: 'b', parent: 'a', position: new Vec3(0, 0, 0), orientation: new Vec3(0, 0, 0) }
      ])).toThrow(); // Will throw on either cycle or invalid parent
    });

    it('should include skeleton in build output', () => {
      const builder = new TracedBuilder('TestBuilder', 42);
      builder.registerSkeleton([
        { name: 'root', parent: null, position: new Vec3(0, 0, 0), orientation: new Vec3(0, 0, 0) }
      ]);

      const output = builder.build();
      expect(output.skeleton).toBeDefined();
      expect(output.skeleton!.joints.length).toBe(1);
    });
  });

  describe('YAML skeleton parsing', () => {
    it('should parse skeleton from YAML builder', async () => {
      const yaml: YamlBuilderDefinition = {
        version: '1.0',
        name: 'SkeletonTest',
        measurements: {
          hip_height: { value: 0.5 },
          torso_height: { value: 0.4 }
        },
        skeleton: [
          {
            name: 'root',
            position: { x: 0, y: 0, z: 0 }
          },
          {
            name: 'spine',
            parent: 'root',
            position: { x: 0, y: 'hip_height', z: 0 }
          },
          {
            name: 'neck',
            parent: 'spine',
            position: { x: 0, y: 'torso_height', z: 0 }
          }
        ],
        geometry: [
          { box: { name: 'body', center: { x: '0', y: '0.5', z: '0' }, size: { x: '0.3', y: '1', z: '0.2' } } }
        ]
      };

      const output = await executeBuilder(yaml, { seed: 42 });

      expect(output.skeleton).toBeDefined();
      expect(output.skeleton!.joints.length).toBe(3);
      expect(output.skeleton!.roots).toEqual(['root']);

      // Check expression evaluation worked
      const spine = output.skeleton!.jointMap.get('spine')!;
      expect(spine.position.y).toBeCloseTo(0.5);  // hip_height

      const neck = output.skeleton!.jointMap.get('neck')!;
      expect(neck.position.y).toBeCloseTo(0.4);  // torso_height
      expect(neck.worldPosition.y).toBeCloseTo(0.9);  // 0.5 + 0.4
    });

    it('should parse orientation in degrees and convert to radians', async () => {
      const yaml: YamlBuilderDefinition = {
        version: '1.0',
        name: 'OrientationTest',
        skeleton: [
          {
            name: 'root',
            position: { x: 0, y: 0, z: 0 },
            orientation: { x: 0, y: 90, z: 0 }  // 90 degrees
          }
        ],
        geometry: []
      };

      const output = await executeBuilder(yaml, { seed: 42 });

      const root = output.skeleton!.jointMap.get('root')!;
      expect(root.orientation.y).toBeCloseTo(Math.PI / 2);  // 90 deg = π/2 rad
    });

    it('should parse joint constraints', async () => {
      const yaml: YamlBuilderDefinition = {
        version: '1.0',
        name: 'ConstraintTest',
        skeleton: [
          {
            name: 'root',
            position: { x: 0, y: 0, z: 0 }
          },
          {
            name: 'elbow',
            parent: 'root',
            position: { x: 0.3, y: 0, z: 0 },
            constraints: {
              type: 'hinge',
              axis: 'z',
              limits: { min: 0, max: 145 }
            }
          }
        ],
        geometry: []
      };

      const output = await executeBuilder(yaml, { seed: 42 });

      const elbow = output.skeleton!.jointMap.get('elbow')!;
      expect(elbow.constraints).toBeDefined();
      expect(elbow.constraints!.type).toBe('hinge');
      expect(elbow.constraints!.axis).toBe('z');
      expect(elbow.constraints!.limits).toEqual({ min: 0, max: 145 });
    });
  });

  describe('PSD skeleton serialization', () => {
    it('should include skeleton in PSD mesh prim', async () => {
      const yaml: YamlBuilderDefinition = {
        version: '1.0',
        name: 'PSDTest',
        skeleton: [
          { name: 'root', position: { x: 0, y: 0, z: 0 } },
          { name: 'child', parent: 'root', position: { x: 0, y: 1, z: 0 } }
        ],
        geometry: [
          { box: { name: 'body', center: { x: '0', y: '0.5', z: '0' }, size: { x: '0.5', y: '1', z: '0.5' } } }
        ]
      };

      const output = await executeBuilder(yaml, { seed: 42 });
      const psd = serializeToPSD(output);

      // Find the mesh prim
      const meshPrim = Object.values(psd.prims).find(p => p.type === 'Mesh') as PSDMeshPrim;
      expect(meshPrim).toBeDefined();
      expect(meshPrim.skeleton).toBeDefined();
      expect(meshPrim.skeleton!.joints.length).toBe(2);
      expect(meshPrim.skeleton!.roots).toEqual(['root']);
    });

    it('should serialize joint constraints in PSD', async () => {
      const yaml: YamlBuilderDefinition = {
        version: '1.0',
        name: 'PSDConstraintTest',
        skeleton: [
          { name: 'root', position: { x: 0, y: 0, z: 0 } },
          {
            name: 'hinge_joint',
            parent: 'root',
            position: { x: 1, y: 0, z: 0 },
            constraints: { type: 'hinge', axis: 'x', limits: { min: -45, max: 45 } }
          }
        ],
        geometry: [
          { box: { name: 'body', center: { x: '0', y: '0', z: '0' }, size: { x: '1', y: '1', z: '1' } } }
        ]
      };

      const output = await executeBuilder(yaml, { seed: 42 });
      const psd = serializeToPSD(output);

      const meshPrim = Object.values(psd.prims).find(p => p.type === 'Mesh') as PSDMeshPrim;
      const hingeJoint = meshPrim.skeleton!.joints.find(j => j.name === 'hinge_joint');
      expect(hingeJoint).toBeDefined();
      expect(hingeJoint!.constraints).toBeDefined();
      expect(hingeJoint!.constraints!.type).toBe('hinge');
    });
  });

  describe('getJoint helper', () => {
    it('should retrieve joint by name', () => {
      const builder = new TracedBuilder('TestBuilder', 42);
      builder.registerSkeleton([
        { name: 'root', parent: null, position: new Vec3(0, 0, 0), orientation: new Vec3(0, 0, 0) },
        { name: 'child', parent: 'root', position: new Vec3(0, 1, 0), orientation: new Vec3(0, 0, 0) }
      ]);

      const joint = builder.getJoint('child');
      expect(joint).toBeDefined();
      expect(joint!.name).toBe('child');
      expect(joint!.parent).toBe('root');
    });

    it('should return undefined for non-existent joint', () => {
      const builder = new TracedBuilder('TestBuilder', 42);
      builder.registerSkeleton([
        { name: 'root', parent: null, position: new Vec3(0, 0, 0), orientation: new Vec3(0, 0, 0) }
      ]);

      const joint = builder.getJoint('nonexistent');
      expect(joint).toBeUndefined();
    });
  });

  describe('Skeleton Composition (E1-002)', () => {
    it('should merge child skeleton into parent skeleton', () => {
      const parentBuilder = new TracedBuilder('Parent', 42);
      parentBuilder.registerSkeleton([
        { name: 'root', parent: null, position: new Vec3(0, 0, 0), orientation: new Vec3(0, 0, 0) },
        { name: 'shoulder', parent: 'root', position: new Vec3(0.5, 0, 0), orientation: new Vec3(0, 0, 0) }
      ]);

      // Create a child skeleton (e.g., an arm)
      const childSkeleton = {
        joints: [
          {
            name: 'upper_arm',
            parent: null,
            position: new Vec3(0.3, 0, 0),
            orientation: new Vec3(0, 0, 0),
            worldPosition: new Vec3(0.3, 0, 0),
            worldOrientation: new Vec3(0, 0, 0)
          },
          {
            name: 'elbow',
            parent: 'upper_arm',
            position: new Vec3(0.25, 0, 0),
            orientation: new Vec3(0, 0, 0),
            worldPosition: new Vec3(0.55, 0, 0),
            worldOrientation: new Vec3(0, 0, 0)
          }
        ],
        jointMap: new Map(),
        roots: ['upper_arm']
      };
      childSkeleton.jointMap.set('upper_arm', childSkeleton.joints[0]);
      childSkeleton.jointMap.set('elbow', childSkeleton.joints[1]);

      // Merge child skeleton at 'shoulder' joint
      parentBuilder.mergeSkeleton('arm_L', childSkeleton, 'shoulder', {});

      const skeleton = parentBuilder.getSkeleton()!;

      // Parent skeleton should now have 4 joints
      expect(skeleton.joints.length).toBe(4);

      // Check that child joints are prefixed
      expect(skeleton.jointMap.has('arm_L.upper_arm')).toBe(true);
      expect(skeleton.jointMap.has('arm_L.elbow')).toBe(true);

      // Child root should now be parented to 'shoulder'
      const upperArm = skeleton.jointMap.get('arm_L.upper_arm')!;
      expect(upperArm.parent).toBe('shoulder');

      // Child non-root should have prefixed parent
      const elbow = skeleton.jointMap.get('arm_L.elbow')!;
      expect(elbow.parent).toBe('arm_L.upper_arm');
    });

    it('should throw when merging to non-existent parent joint', () => {
      const parentBuilder = new TracedBuilder('Parent', 42);
      parentBuilder.registerSkeleton([
        { name: 'root', parent: null, position: new Vec3(0, 0, 0), orientation: new Vec3(0, 0, 0) }
      ]);

      const childSkeleton = {
        joints: [{ name: 'child_root', parent: null, position: new Vec3(0, 0, 0), orientation: new Vec3(0, 0, 0), worldPosition: new Vec3(0, 0, 0), worldOrientation: new Vec3(0, 0, 0) }],
        jointMap: new Map([['child_root', { name: 'child_root', parent: null, position: new Vec3(0, 0, 0), orientation: new Vec3(0, 0, 0), worldPosition: new Vec3(0, 0, 0), worldOrientation: new Vec3(0, 0, 0) }]]),
        roots: ['child_root']
      };

      expect(() => parentBuilder.mergeSkeleton('child', childSkeleton, 'nonexistent', {}))
        .toThrow(/parent joint 'nonexistent' not found/);
    });

    it('should throw when merging to builder without skeleton', () => {
      const parentBuilder = new TracedBuilder('Parent', 42);
      // No skeleton registered

      const childSkeleton = {
        joints: [{ name: 'child_root', parent: null, position: new Vec3(0, 0, 0), orientation: new Vec3(0, 0, 0), worldPosition: new Vec3(0, 0, 0), worldOrientation: new Vec3(0, 0, 0) }],
        jointMap: new Map([['child_root', { name: 'child_root', parent: null, position: new Vec3(0, 0, 0), orientation: new Vec3(0, 0, 0), worldPosition: new Vec3(0, 0, 0), worldOrientation: new Vec3(0, 0, 0) }]]),
        roots: ['child_root']
      };

      expect(() => parentBuilder.mergeSkeleton('child', childSkeleton, 'root', {}))
        .toThrow(/parent builder has no skeleton/);
    });

    it('should apply composition transform to merged joints', () => {
      const parentBuilder = new TracedBuilder('Parent', 42);
      parentBuilder.registerSkeleton([
        { name: 'root', parent: null, position: new Vec3(0, 0, 0), orientation: new Vec3(0, 0, 0) },
        { name: 'shoulder', parent: 'root', position: new Vec3(0, 1, 0), orientation: new Vec3(0, 0, 0) }
      ]);

      const childSkeleton = {
        joints: [{
          name: 'arm',
          parent: null,
          position: new Vec3(1, 0, 0),
          orientation: new Vec3(0, 0, 0),
          worldPosition: new Vec3(1, 0, 0),
          worldOrientation: new Vec3(0, 0, 0)
        }],
        jointMap: new Map(),
        roots: ['arm']
      };
      childSkeleton.jointMap.set('arm', childSkeleton.joints[0]);

      // Merge with offset and scale
      parentBuilder.mergeSkeleton('arm_L', childSkeleton, 'shoulder', {
        offset: { x: 0.5, y: 0, z: 0 },
        scale: 2
      });

      const arm = parentBuilder.getSkeleton()!.jointMap.get('arm_L.arm')!;
      // Position should be scaled (1 * 2 = 2) plus offset (0.5)
      expect(arm.position.x).toBeCloseTo(2.5);
    });
  });
});

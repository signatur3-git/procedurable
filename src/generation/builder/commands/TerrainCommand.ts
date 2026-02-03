/**
 * TerrainCommand - Generate terrain meshes from height functions
 *
 * G1-001: Terrain mesh generation using scalar fields (Perlin noise, FBM, etc.)
 *
 * YAML syntax:
 *   - terrain:
 *       name: ground
 *       width: 10
 *       depth: 10
 *       segments_x: 32
 *       segments_z: 32
 *       noise_scale: 0.1       # Frequency of noise
 *       noise_amplitude: 1.0   # Height variation
 *       base_height: 0         # Baseline height
 *       octaves: 4             # FBM octaves (detail layers)
 *       seed: 42               # Random seed
 *       flatten:               # Optional building pads
 *         - center: { x: 0, z: 0 }
 *           radius: 2
 *           elevation: 0.5
 *           falloff: 0.5
 */

import { BaseGeometryCommandHandler, GeometryCommandContext } from '../GeometryCommandHandler';
import type { YamlGeometryCommand } from '../YamlBuilderTypes';
import { resolveGeometryMaterial } from '../MaterialResolver';
import { MeshOperations, TerrainModification } from '../../../platform/geometry/MeshOperations';
import { FBMField, ConstantField, ScalarField, AddField } from '../../../platform/spatial/ScalarField';

interface TerrainCommandDef {
  terrain: {
    name: string;
    width: number | string;
    depth: number | string;
    segments_x?: number | string;
    segments_z?: number | string;
    noise_scale?: number | string;
    noise_amplitude?: number | string;
    base_height?: number | string;
    octaves?: number | string;
    seed?: number | string;
    center?: { x: number | string; z: number | string };
    flatten?: Array<{
      center: { x: number | string; z: number | string };
      radius: number | string;
      elevation: number | string;
      falloff?: number | string;
    }>;
    color?: string;
  };
}

export class TerrainCommandHandler extends BaseGeometryCommandHandler {
  readonly commandKey = 'terrain';

  async execute(cmd: YamlGeometryCommand, context: GeometryCommandContext): Promise<void> {
    const terrainCmd = cmd as TerrainCommandDef;
    const def = terrainCmd.terrain;
    const { builder, materials, materialSlots, evaluateExpression } = context;

    // Evaluate numeric parameters
    const width = evaluateExpression(String(def.width));
    const depth = evaluateExpression(String(def.depth));
    const segmentsX = def.segments_x !== undefined
      ? evaluateExpression(String(def.segments_x))
      : Math.max(8, Math.ceil(width * 4));
    const segmentsZ = def.segments_z !== undefined
      ? evaluateExpression(String(def.segments_z))
      : Math.max(8, Math.ceil(depth * 4));
    const noiseScale = def.noise_scale !== undefined
      ? evaluateExpression(String(def.noise_scale))
      : 0.1;
    const noiseAmplitude = def.noise_amplitude !== undefined
      ? evaluateExpression(String(def.noise_amplitude))
      : 1.0;
    const baseHeight = def.base_height !== undefined
      ? evaluateExpression(String(def.base_height))
      : 0;
    const octaves = def.octaves !== undefined
      ? Math.floor(evaluateExpression(String(def.octaves)))
      : 4;
    const seed = def.seed !== undefined
      ? Math.floor(evaluateExpression(String(def.seed)))
      : builder.getSeed();

    // Evaluate center
    const centerX = def.center?.x !== undefined
      ? evaluateExpression(String(def.center.x))
      : 0;
    const centerZ = def.center?.z !== undefined
      ? evaluateExpression(String(def.center.z))
      : 0;

    // Create height field from noise
    let heightField: ScalarField;

    if (noiseAmplitude > 0) {
      // FBM for natural-looking terrain
      const noiseField = new FBMField(seed, noiseScale, noiseAmplitude, octaves);

      if (baseHeight !== 0) {
        const baseField = new ConstantField(baseHeight);
        heightField = new AddField(baseField, noiseField);
      } else {
        heightField = noiseField;
      }
    } else {
      // Flat terrain
      heightField = new ConstantField(baseHeight);
    }

    // Convert flatten specs to modifications
    const modifications: TerrainModification[] = (def.flatten || []).map(f => ({
      type: 'flatten' as const,
      center: {
        x: evaluateExpression(String(f.center.x)),
        z: evaluateExpression(String(f.center.z))
      },
      radius: evaluateExpression(String(f.radius)),
      elevation: evaluateExpression(String(f.elevation)),
      falloff: f.falloff !== undefined ? evaluateExpression(String(f.falloff)) : undefined
    }));

    // Generate mesh
    const mesh = MeshOperations.createHeightFieldMesh({
      width,
      depth,
      segmentsX,
      segmentsZ,
      heightFunction: (x, z) => heightField.sample(x, 0, z),
      modifications,
      center: { x: centerX, z: centerZ }
    });

    // Resolve color and material slot
    const { color, materialSlotIndex } = resolveGeometryMaterial(def.color, materials, materialSlots, builder.mesh);

    // Apply color/material to faces
    if (color || materialSlotIndex !== undefined) {
      for (const face of mesh.faces) {
        if (color) face.color = color;
        if (materialSlotIndex !== undefined) face.materialSlotIndex = materialSlotIndex;
      }
    }

    // Merge into builder
    builder.getMesh().merge(mesh);

    // Add trace
    builder.trace(`terrain:${def.name}`, {
      type: 'terrain',
      name: def.name,
      width,
      depth,
      segmentsX,
      segmentsZ,
      noiseScale,
      noiseAmplitude,
      baseHeight,
      octaves,
      seed,
      centerX,
      centerZ,
      vertexCount: mesh.vertices.length,
      faceCount: mesh.faces.length,
      modifications: modifications.length
    });
  }
}


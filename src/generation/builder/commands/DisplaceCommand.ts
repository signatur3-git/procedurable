/**
 * DisplaceCommand - Displace mesh vertices using noise
 *
 * Applies noise-based displacement to mesh surfaces for organic,
 * hand-shaped, or weathered effects.
 *
 * YAML usage:
 *   - displace: surface_variation
 *     amplitude: 0.02        # Max displacement distance
 *     frequency: 5.0         # Noise detail level (1-10 typical)
 *     seed: 42               # Optional: override builder seed
 *
 * The amplitude can be negative for inward displacement effect.
 * Frequency controls detail level - higher = more bumps.
 */

import { BaseGeometryCommandHandler, GeometryCommandContext } from '../GeometryCommandHandler';
import type { YamlGeometryCommand } from '../YamlBuilderTypes';
import { MeshOperations } from '../../../platform/geometry/MeshOperations';

interface DisplaceCommandDef {
  displace: string;             // Trace name
  amplitude?: number | string;  // Displacement magnitude (can be expression)
  frequency?: number | string;  // Noise frequency (can be expression)
  seed?: number;                // Override seed (optional)
}

export class DisplaceCommandHandler extends BaseGeometryCommandHandler {
  readonly commandKey = 'displace';

  async execute(cmd: YamlGeometryCommand, context: GeometryCommandContext): Promise<void> {
    const dispCmd = cmd as DisplaceCommandDef;
    const { builder, evaluateExpression } = context;

    // Evaluate parameters (support expressions like "base_amplitude * 0.5")
    const amplitude = evaluateExpression(dispCmd.amplitude ?? 0.01);
    const frequency = evaluateExpression(dispCmd.frequency ?? 1.0);

    // Use command seed if provided, otherwise use builder's seed
    const seed = dispCmd.seed ?? builder.getSeed();

    // Get current mesh and apply displacement
    const currentMesh = builder.getMesh();
    const displaced = MeshOperations.displaceByNoise(currentMesh, amplitude, frequency, seed);

    // Replace mesh with displaced version
    builder.replaceMesh(displaced);

    // Trace the operation
    builder.trace(`displace:${dispCmd.displace}`, {
      amplitude,
      frequency,
      seed,
      vertexCount: displaced.vertices.length
    });
  }
}

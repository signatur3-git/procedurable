/**
 * Geometry Command Handlers
 *
 * This module exports all geometry command handlers and a function
 * to create a registry with all handlers registered.
 */

import { GeometryCommandRegistry } from '../GeometryCommandHandler';

// Import command handlers
import { BoxCommandHandler } from './BoxCommand';
import { BevelCommandHandler } from './BevelCommand';
import { VertexCommandHandler } from './VertexCommand';
import { FaceCommandHandler } from './FaceCommand';
import { LoftCommandHandler } from './LoftCommand';
import { CapCommandHandler } from './CapCommand';
import { LatheCommandHandler } from './LatheCommand';
import { CircleCommandHandler } from './CircleCommand';
import { LoopCommandHandler } from './LoopCommand';
import { SweepCommandHandler } from './SweepCommand';
import { SubdivideCommandHandler } from './SubdivideCommand';
import { RadialArrayCommandHandler } from './RadialArrayCommand';
import { WhenCommandHandler, IfCommandHandler, RepeatCommandHandler, ForCommandHandler, GridCommandHandler } from './ControlFlowCommands';
import { Extrude2DCommandHandler } from './Extrude2DCommand';
import { DisplaceCommandHandler } from './DisplaceCommand';
import { BendCommandHandler } from './BendCommand';
import { TwistCommandHandler } from './TwistCommand';
import { TaperCommandHandler } from './TaperCommand';
import { MirrorCommandHandler } from './MirrorCommand';
import { MeshRadialArrayCommandHandler } from './MeshRadialArrayCommand';
import { TerrainCommandHandler } from './TerrainCommand';
import { BillboardCommandHandler } from './BillboardCommand';

// Export individual handlers for direct use
export { BoxCommandHandler } from './BoxCommand';
export { BevelCommandHandler } from './BevelCommand';
export { VertexCommandHandler } from './VertexCommand';
export { FaceCommandHandler } from './FaceCommand';
export { LoftCommandHandler } from './LoftCommand';
export { CapCommandHandler } from './CapCommand';
export { LatheCommandHandler } from './LatheCommand';
export { CircleCommandHandler } from './CircleCommand';
export { LoopCommandHandler } from './LoopCommand';
export { SweepCommandHandler } from './SweepCommand';
export { SubdivideCommandHandler } from './SubdivideCommand';
export { RadialArrayCommandHandler } from './RadialArrayCommand';
export { WhenCommandHandler, IfCommandHandler, RepeatCommandHandler, ForCommandHandler, GridCommandHandler } from './ControlFlowCommands';
export { DisplaceCommandHandler } from './DisplaceCommand';
export { BendCommandHandler } from './BendCommand';
export { TwistCommandHandler } from './TwistCommand';
export { TaperCommandHandler } from './TaperCommand';
export { MirrorCommandHandler } from './MirrorCommand';
export { MeshRadialArrayCommandHandler } from './MeshRadialArrayCommand';
export { TerrainCommandHandler } from './TerrainCommand';
export { BillboardCommandHandler } from './BillboardCommand';

/**
 * Create a new registry with all standard geometry command handlers registered.
 */
export function createStandardRegistry(): GeometryCommandRegistry {
  const registry = new GeometryCommandRegistry();

  // Primitive geometry
  registry.register(new BoxCommandHandler());
  registry.register(new VertexCommandHandler());
  registry.register(new CircleCommandHandler());
  registry.register(new LoopCommandHandler());
  registry.register(new FaceCommandHandler());
  registry.register(new LoftCommandHandler());
  registry.register(new CapCommandHandler());

  // Advanced geometry
  registry.register(new LatheCommandHandler());
  registry.register(new SweepCommandHandler());
  registry.register(new SubdivideCommandHandler());
  registry.register(new BevelCommandHandler());
  registry.register(new RadialArrayCommandHandler());

  // Control flow
  registry.register(new WhenCommandHandler());
  registry.register(new IfCommandHandler());
  registry.register(new RepeatCommandHandler());
  registry.register(new ForCommandHandler());
  registry.register(new GridCommandHandler());

  // Complex geometry
  registry.register(new Extrude2DCommandHandler());

  // Deformers
  registry.register(new DisplaceCommandHandler());
  registry.register(new BendCommandHandler());
  registry.register(new TwistCommandHandler());
  registry.register(new TaperCommandHandler());

  // Symmetry
  registry.register(new MirrorCommandHandler());
  registry.register(new MeshRadialArrayCommandHandler());

  // World/Terrain (G1-001)
  registry.register(new TerrainCommandHandler());

  // Billboard (G7-001)
  registry.register(new BillboardCommandHandler());

  return registry;
}

/**
 * List of all command keys handled by the standard registry.
 * Useful for documentation and validation.
 */
export const STANDARD_COMMAND_KEYS = [
  // Primitive geometry
  'box',
  'vertex',
  'circle',
  'loop',
  'face',
  'loft',
  'cap',
  // Advanced geometry
  'lathe',
  'sweep',
  'subdivide',
  'bevel',
  'radialArray',
  'extrude2d',
  // Control flow
  'when',
  'if',
  'repeat',
  // Deformers
  'displace',
  'bend',
  'twist',
  'taper',
  // Symmetry
  'mirror',
  'mesh_radial_array',
  // World/Terrain (G1-001)
  'terrain',
  // Billboard (G7-001)
  'billboard',
] as const;

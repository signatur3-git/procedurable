/**
 * Scene Module - Hierarchical scene organization
 */

export { SceneNode } from './SceneNode';
// SceneGraph exports SceneNode as an interface type - use type-only export to avoid conflict
export { SceneGraph, Transform, SceneNode as SceneNodeData } from './SceneGraph';
export { placeAroundRectangle, placeAroundCircle, PlacementCandidate } from './Placement';
export {
  TerrainChunk,
  TerrainChunkOptions,
  generateTerrainChunk,
  generateTerrainRegion,
  verifyChunkBoundary
} from './TerrainChunk';
export {
  ViewConfig,
  LODConfig,
  LODObject,
  LODTerrainChunk,
  ViewGenerationResult,
  DEFAULT_LOD_DISTANCES,
  computeLODTier,
  isInViewFrustum,
  computeObjectLOD,
  generateViewDependentTerrain,
  generateView,
  sortByDistance,
  filterVisible,
  getObjectsAtLOD
} from './ViewDependentGenerator';

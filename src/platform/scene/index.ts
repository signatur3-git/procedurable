/**
 * Scene Module - Hierarchical scene organization
 */

export { SceneNode } from './SceneNode';
// SceneGraph exports SceneNode as an interface type - use type-only export to avoid conflict
export { SceneGraph, Transform, SceneNode as SceneNodeData } from './SceneGraph';
export { placeAroundRectangle, placeAroundCircle, PlacementCandidate } from './Placement';

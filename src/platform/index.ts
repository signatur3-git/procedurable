// Platform Module - Core infrastructure
//
// For clean imports, import from submodules directly:
// import { Vec3 } from './platform/math'

// Math exports
export { Vec3, Mat4, Transform, AABB, Spline, Random, evaluate, validate } from './math';

// Spatial exports (avoid Point2D conflict by not re-exporting it)
export { field, ScalarField } from './spatial/ScalarField';
export { poissonDiskScatter, poissonDiskCircle, createRadialDensityField } from './spatial/PoissonDisk';
export { poissonDiskSample, uniformScatter } from './spatial/Scatter';
export { createInstanceFromPoint, createInstanceGroupFromScatter } from './spatial/Instance';

// Geometry exports (selective to avoid Point2D conflict)
export { Mesh, Vertex, Face, EdgeLoop, Shape2D } from './geometry';

// Scene exports (selective to avoid SceneNode conflict)
export { SceneNode, SceneGraph, placeAroundRectangle, placeAroundCircle } from './scene';

// Materials exports
export * from './materials';

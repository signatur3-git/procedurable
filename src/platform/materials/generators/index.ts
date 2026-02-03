/**
 * Texture Generators Index (G4-002)
 *
 * Exports all built-in texture generators.
 */

// Import all generators to register them
import './WoodGrainGenerator';
import './WearGenerator';
import './StoneGenerator';
import './MetalBrushedGenerator';
import './NoiseColorGenerator';
import './SolidColorGenerator';

// Re-export for direct import
export { WoodGrainGenerator } from './WoodGrainGenerator';
export { EdgeWearGenerator, DirtAccumulationGenerator } from './WearGenerator';
export { StoneGenerator } from './StoneGenerator';
export { MetalBrushedGenerator } from './MetalBrushedGenerator';
export { NoiseColorGenerator } from './NoiseColorGenerator';
export { SolidColorGenerator } from './SolidColorGenerator';

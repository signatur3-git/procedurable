import { Random } from '../core/Random';
export interface GenerationContext {
  random: Random;
  seed: number;
  lodLevel: number;
  metadata: Map<string, any>;
}
export function createContext(seed: number, lodLevel: number = 1.0): GenerationContext {
  return {
    random: new Random(seed),
    seed,
    lodLevel,
    metadata: new Map()
  };
}

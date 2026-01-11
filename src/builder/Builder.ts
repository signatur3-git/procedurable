import { Random } from '../core/Random';
import { BuildSpec, SceneObject } from './BuildSpec';
import { GenerationContext } from '../archetypes/GenerationContext';
export abstract class Builder<T = SceneObject> {
  protected random: Random;
  constructor(seed?: number) {
    this.random = new Random(seed || Date.now());
  }
  abstract build(spec: BuildSpec, context: GenerationContext): T | T[];
  protected getCount(spec: BuildSpec): number {
    if (!spec.count) return 1;
    if (typeof spec.count === 'number') {
      return spec.count;
    }
    const [min, max] = spec.count;
    return this.random.int(min, max);
  }
  protected resolveSpec(spec: BuildSpec): BuildSpec {
    return {
      seed: spec.seed || this.random.int(0, 1000000),
      style: spec.style || 'default',
      parameters: spec.parameters || {},
      ...spec
    };
  }
}

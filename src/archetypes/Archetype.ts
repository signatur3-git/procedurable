import { Mesh } from '../geometry/Mesh';
import { ParameterDefinition, ParameterSet } from './ParameterSet';
import { GenerationContext, createContext } from './GenerationContext';
export abstract class Archetype {
  public readonly name: string;
  public readonly parameters: ParameterDefinition[];
  constructor(name: string, parameters: ParameterDefinition[]) {
    this.name = name;
    this.parameters = parameters;
  }
  getDefaultParameters(): ParameterSet {
    const defaults: Record<string, any> = {};
    for (const param of this.parameters) {
      defaults[param.name] = param.defaultValue;
    }
    return new ParameterSet(defaults);
  }
  validateParameters(params: ParameterSet): void {
    const result = params.validate(this.parameters);
    if (!result.valid) {
      throw new Error(
        `Parameter validation failed for ${this.name}:\n` +
        result.errors.map(e => `  - ${e}`).join('\n')
      );
    }
  }
  abstract generate(params: ParameterSet, context: GenerationContext): Mesh;
  createVariant(seed: number, overrides?: Partial<Record<string, any>>): Mesh {
    const params = this.getDefaultParameters();
    if (overrides) {
      const merged = params.merge(overrides);
      this.validateParameters(merged);
      const context = createContext(seed);
      return this.generate(merged, context);
    }
    this.validateParameters(params);
    const context = createContext(seed);
    return this.generate(params, context);
  }
}

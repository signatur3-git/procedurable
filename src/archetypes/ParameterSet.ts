export type ParameterType = 'number' | 'enum' | 'boolean' | 'vector3';
export interface ParameterDefinition {
  name: string;
  type: ParameterType;
  defaultValue: any;
  min?: number;
  max?: number;
  options?: string[];
  description?: string;
}
export class ParameterSet {
  private values: Map<string, any>;
  constructor(initial?: Record<string, any>) {
    this.values = new Map(Object.entries(initial || {}));
  }
  get(name: string): any {
    return this.values.get(name);
  }
  set(name: string, value: any): void {
    this.values.set(name, value);
  }
  has(name: string): boolean {
    return this.values.has(name);
  }
  validate(definitions: ParameterDefinition[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    for (const def of definitions) {
      if (!this.has(def.name)) {
        errors.push(`Missing required parameter: ${def.name}`);
        continue;
      }
      const value = this.get(def.name);
      switch (def.type) {
        case 'number':
          if (typeof value !== 'number') {
            errors.push(`Parameter ${def.name} must be a number, got ${typeof value}`);
          } else if (def.min !== undefined && value < def.min) {
            errors.push(`Parameter ${def.name} (${value}) below minimum ${def.min}`);
          } else if (def.max !== undefined && value > def.max) {
            errors.push(`Parameter ${def.name} (${value}) above maximum ${def.max}`);
          }
          break;
        case 'boolean':
          if (typeof value !== 'boolean') {
            errors.push(`Parameter ${def.name} must be a boolean`);
          }
          break;
        case 'enum':
          if (def.options && !def.options.includes(value)) {
            errors.push(
              `Parameter ${def.name} must be one of [${def.options.join(', ')}], got ${value}`
            );
          }
          break;
        case 'vector3':
          if (!value || typeof value !== 'object' || !('x' in value && 'y' in value && 'z' in value)) {
            errors.push(`Parameter ${def.name} must be a Vec3`);
          }
          break;
      }
    }
    return { valid: errors.length === 0, errors };
  }
  merge(other: Partial<Record<string, any>>): ParameterSet {
    const merged = new ParameterSet();
    this.values.forEach((value, key) => merged.set(key, value));
    Object.entries(other).forEach(([key, value]) => {
      if (value !== undefined) merged.set(key, value);
    });
    return merged;
  }
  clone(): ParameterSet {
    const cloned = new ParameterSet();
    this.values.forEach((value, key) => cloned.set(key, value));
    return cloned;
  }
  toObject(): Record<string, any> {
    const obj: Record<string, any> = {};
    this.values.forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  }
}

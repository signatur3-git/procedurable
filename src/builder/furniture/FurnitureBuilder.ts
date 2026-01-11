﻿import { Builder } from '../Builder';
import { BuildSpec, SceneObject, createSceneObject } from '../BuildSpec';
import { GenerationContext, createContext } from '../../archetypes/GenerationContext';
import { ChairGenerator } from './ChairGenerator';
import { TableGenerator } from './TableGenerator';
import { Mesh } from '../../geometry/Mesh';
export class FurnitureBuilder extends Builder {
  build(spec: BuildSpec, context: GenerationContext): SceneObject | SceneObject[] {
    const resolved = this.resolveSpec(spec);
    const count = this.getCount(resolved);
    if (count === 1) {
      return this.buildSingle(resolved, context);
    }
    const objects: SceneObject[] = [];
    for (let i = 0; i < count; i++) {
      const itemContext = createContext(context.seed + i, context.lodLevel);
      objects.push(this.buildSingle(resolved, itemContext));
    }
    return objects;
  }
  private buildSingle(spec: BuildSpec, context: GenerationContext): SceneObject {
    let mesh: Mesh;
    let type = spec.type;
    switch (spec.type) {
      case 'chair':
        mesh = ChairGenerator.createSimpleChair(spec.style);
        break;
      case 'table':
        mesh = TableGenerator.createTable(spec.style);
        break;
      default:
        throw new Error(`Unknown furniture type: ${spec.type}`);
    }
    const obj = createSceneObject(type, mesh, {
      style: spec.style,
      seed: context.seed,
      ...spec.parameters
    });
    if (spec.position) {
      obj.position = spec.position;
    }
    if (spec.rotation) {
      obj.rotation = spec.rotation;
    }
    return obj;
  }
}

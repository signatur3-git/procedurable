/**
 * BoxCommand - Creates a box primitive with 8 vertices and 6 faces
 */

import { BaseGeometryCommandHandler, GeometryCommandContext } from '../GeometryCommandHandler';
import type { YamlGeometryCommand, YamlPosition } from '../YamlBuilderTypes';
import { resolveGeometryColor } from '../MaterialResolver';

interface BoxCommandDef {
  box: {
    name: string;
    center: YamlPosition;
    size: YamlPosition;
    color?: string;
  };
}

export class BoxCommandHandler extends BaseGeometryCommandHandler {
  readonly commandKey = 'box';

  async execute(cmd: YamlGeometryCommand, context: GeometryCommandContext): Promise<void> {
    const boxCmd = cmd as BoxCommandDef;
    const boxDef = boxCmd.box;
    const name = boxDef.name;

    const { builder, materials, evaluateExpression } = context;

    // Evaluate center and size
    const cx = evaluateExpression(String(boxDef.center.x));
    const cy = evaluateExpression(String(boxDef.center.y));
    const cz = evaluateExpression(String(boxDef.center.z));
    const sx = evaluateExpression(String(boxDef.size.x)) / 2;
    const sy = evaluateExpression(String(boxDef.size.y)) / 2;
    const sz = evaluateExpression(String(boxDef.size.z)) / 2;

    // Get color if specified
    const color = boxDef.color ? resolveGeometryColor(boxDef.color, materials) : undefined;

    // Create 8 vertices
    const v = [
      `${name}_v0`, `${name}_v1`, `${name}_v2`, `${name}_v3`,
      `${name}_v4`, `${name}_v5`, `${name}_v6`, `${name}_v7`
    ];
    builder.placeVertex(v[0], { x: String(cx - sx), y: String(cy - sy), z: String(cz - sz) });
    builder.placeVertex(v[1], { x: String(cx + sx), y: String(cy - sy), z: String(cz - sz) });
    builder.placeVertex(v[2], { x: String(cx + sx), y: String(cy - sy), z: String(cz + sz) });
    builder.placeVertex(v[3], { x: String(cx - sx), y: String(cy - sy), z: String(cz + sz) });
    builder.placeVertex(v[4], { x: String(cx - sx), y: String(cy + sy), z: String(cz - sz) });
    builder.placeVertex(v[5], { x: String(cx + sx), y: String(cy + sy), z: String(cz - sz) });
    builder.placeVertex(v[6], { x: String(cx + sx), y: String(cy + sy), z: String(cz + sz) });
    builder.placeVertex(v[7], { x: String(cx - sx), y: String(cy + sy), z: String(cz + sz) });

    // Create 6 faces
    builder.createFace(`${name}_bottom`, [v[3], v[2], v[1], v[0]], color);
    builder.createFace(`${name}_top`, [v[4], v[5], v[6], v[7]], color);
    builder.createFace(`${name}_front`, [v[0], v[1], v[5], v[4]], color);
    builder.createFace(`${name}_back`, [v[2], v[3], v[7], v[6]], color);
    builder.createFace(`${name}_left`, [v[3], v[0], v[4], v[7]], color);
    builder.createFace(`${name}_right`, [v[1], v[2], v[6], v[5]], color);
  }
}

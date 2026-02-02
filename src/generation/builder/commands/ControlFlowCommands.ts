/**
 * Control Flow Commands - when, if/else, repeat
 *
 * These commands handle conditional and iterative geometry generation.
 */

import { BaseGeometryCommandHandler, GeometryCommandContext } from '../GeometryCommandHandler';
import type { YamlGeometryCommand } from '../YamlBuilderTypes';
import {
  createContext,
  evaluateCondition as exprEvalCondition
} from '../ExpressionService';
import { evaluate as mathEvaluate } from '../../../platform/math/MathService';

// ============================================================================
// When Command (legacy conditional)
// ============================================================================

interface WhenCommandDef {
  when: string;
  geometry: YamlGeometryCommand[];
}

export class WhenCommandHandler extends BaseGeometryCommandHandler {
  readonly commandKey = 'when';

  async execute(cmd: YamlGeometryCommand, context: GeometryCommandContext): Promise<void> {
    const whenCmd = cmd as WhenCommandDef;
    const { builder, decisionValues, processGeometry } = context;

    const evalCtx = createContext(builder, decisionValues);
    if (exprEvalCondition(whenCmd.when, evalCtx)) {
      await processGeometry(whenCmd.geometry);
    }
  }
}

// ============================================================================
// If/Else Command
// ============================================================================

interface IfCommandDef {
  if: string;
  then: YamlGeometryCommand[];
  else?: YamlGeometryCommand[];
}

export class IfCommandHandler extends BaseGeometryCommandHandler {
  readonly commandKey = 'if';

  async execute(cmd: YamlGeometryCommand, context: GeometryCommandContext): Promise<void> {
    const ifCmd = cmd as IfCommandDef;
    const { builder, decisionValues, processGeometry } = context;

    const evalCtx = createContext(builder, decisionValues);
    if (exprEvalCondition(ifCmd.if, evalCtx)) {
      await processGeometry(ifCmd.then);
    } else if (ifCmd.else) {
      await processGeometry(ifCmd.else);
    }
  }
}

// ============================================================================
// Repeat Command
// ============================================================================

interface RepeatCommandDef {
  repeat: number | string;
  as: string;
  geometry: YamlGeometryCommand[];
}

export class RepeatCommandHandler extends BaseGeometryCommandHandler {
  readonly commandKey = 'repeat';

  async execute(cmd: YamlGeometryCommand, context: GeometryCommandContext): Promise<void> {
    const repeatCmd = cmd as RepeatCommandDef;
    const { builder, decisionValues, processGeometry } = context;

    // Get repeat count (can be number or expression/variable reference)
    let count: number;
    if (typeof repeatCmd.repeat === 'number') {
      count = repeatCmd.repeat;
    } else {
      // Evaluate as expression (could be a decision value like "leg_count")
      if (decisionValues.has(repeatCmd.repeat)) {
        count = decisionValues.get(repeatCmd.repeat);
      } else {
        const vars = builder.context.toObject();
        const result = mathEvaluate(repeatCmd.repeat, vars);
        count = Math.round(result.value);
      }
    }

    const indexVar = repeatCmd.as;

    // Execute geometry for each iteration
    for (let i = 0; i < count; i++) {
      // Add index to context temporarily
      const originalValue = builder.context.get(indexVar);
      builder.context.setMeasurement(indexVar, i);

      // Also add to decisionValues for condition evaluation
      const originalDecision = decisionValues.get(indexVar);
      decisionValues.set(indexVar, i);

      // Process geometry with index available
      await processGeometry(repeatCmd.geometry);

      // Restore original values
      if (originalValue !== undefined) {
        builder.context.setMeasurement(indexVar, originalValue);
      }
      if (originalDecision !== undefined) {
        decisionValues.set(indexVar, originalDecision);
      } else {
        decisionValues.delete(indexVar);
      }
    }
  }
}

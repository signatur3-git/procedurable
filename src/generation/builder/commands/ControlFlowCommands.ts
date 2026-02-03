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

// ============================================================================
// For Command (alias for repeat, more conventional naming)
// ============================================================================

interface ForCommandDef {
  for: number | string;
  as: string;
  geometry: YamlGeometryCommand[];
}

export class ForCommandHandler extends BaseGeometryCommandHandler {
  readonly commandKey = 'for';

  async execute(cmd: YamlGeometryCommand, context: GeometryCommandContext): Promise<void> {
    // Reuse repeat implementation - for is just an alias
    const forCmd = cmd as ForCommandDef;
    const repeatCmd = {
      repeat: forCmd.for,
      as: forCmd.as,
      geometry: forCmd.geometry
    };
    const repeatHandler = new RepeatCommandHandler();
    await repeatHandler.execute(repeatCmd as YamlGeometryCommand, context);
  }
}

// ============================================================================
// Grid Command (2D iteration for patterns like chessboards)
// ============================================================================

interface GridCommandDef {
  grid: {
    rows: number | string;
    cols: number | string;
    row_var?: string;  // default: 'row'
    col_var?: string;  // default: 'col'
  };
  geometry: YamlGeometryCommand[];
}

export class GridCommandHandler extends BaseGeometryCommandHandler {
  readonly commandKey = 'grid';

  async execute(cmd: YamlGeometryCommand, context: GeometryCommandContext): Promise<void> {
    const gridCmd = cmd as GridCommandDef;
    const { builder, decisionValues, processGeometry } = context;

    // Evaluate row and column counts
    const evalCount = (val: number | string): number => {
      if (typeof val === 'number') return val;
      if (decisionValues.has(val)) return decisionValues.get(val);
      const vars = builder.context.toObject();
      const result = mathEvaluate(val, vars);
      return Math.round(result.value);
    };

    const rows = evalCount(gridCmd.grid.rows);
    const cols = evalCount(gridCmd.grid.cols);
    const rowVar = gridCmd.grid.row_var ?? 'row';
    const colVar = gridCmd.grid.col_var ?? 'col';
    const indexVar = 'index'; // Combined index: row * cols + col

    // Execute geometry for each cell
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        // Store original values
        const origRow = builder.context.get(rowVar);
        const origCol = builder.context.get(colVar);
        const origIndex = builder.context.get(indexVar);
        const origRowDec = decisionValues.get(rowVar);
        const origColDec = decisionValues.get(colVar);
        const origIndexDec = decisionValues.get(indexVar);

        // Set grid variables
        builder.context.setMeasurement(rowVar, row);
        builder.context.setMeasurement(colVar, col);
        builder.context.setMeasurement(indexVar, row * cols + col);
        decisionValues.set(rowVar, row);
        decisionValues.set(colVar, col);
        decisionValues.set(indexVar, row * cols + col);

        // Process geometry
        await processGeometry(gridCmd.geometry);

        // Restore original values
        if (origRow !== undefined) builder.context.setMeasurement(rowVar, origRow);
        if (origCol !== undefined) builder.context.setMeasurement(colVar, origCol);
        if (origIndex !== undefined) builder.context.setMeasurement(indexVar, origIndex);
        if (origRowDec !== undefined) decisionValues.set(rowVar, origRowDec);
        else decisionValues.delete(rowVar);
        if (origColDec !== undefined) decisionValues.set(colVar, origColDec);
        else decisionValues.delete(colVar);
        if (origIndexDec !== undefined) decisionValues.set(indexVar, origIndexDec);
        else decisionValues.delete(indexVar);
      }
    }
  }
}



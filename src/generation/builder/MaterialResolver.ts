/**
 * MaterialResolver - Resolve YAML material definitions to runtime colors
 *
 * Handles conditional materials, named colors, and hex color parsing.
 */

import { NAMED_COLORS, hexToRgb, RGBColor } from '../../platform/materials/MaterialLibrary';
import type {
  YamlMaterial,
  YamlMaterialValue,
  YamlColorValue,
  YamlConditionalValue
} from './YamlBuilderTypes';

/**
 * Resolve a color value to RGB using the MaterialLibrary
 */
export function resolveColor(color: YamlColorValue): RGBColor {
  if (typeof color === 'object') {
    return color;
  }

  // Hex string: "#8b5a2b"
  if (color.startsWith('#')) {
    return hexToRgb(color);
  }

  // Named color from library
  return NAMED_COLORS[color] || NAMED_COLORS.wood_oak;
}

/**
 * Check if a value is a conditional value (has 'default' and optionally 'when')
 */
export function isConditionalValue<T>(value: any): value is YamlConditionalValue<T> {
  return value !== null &&
         typeof value === 'object' &&
         'default' in value &&
         !('r' in value);  // Not an RGB color object
}

/**
 * Evaluate a simple condition string against decision values
 * Supports: "decision_name == value", "decision_name", boolean comparisons
 */
function evaluateCondition(condition: string, values: Map<string, any>): boolean {
  // Check for == comparison
  if (condition.includes('==')) {
    const [left, right] = condition.split('==').map(s => s.trim());
    const leftValue = values.get(left) ?? left;
    // Remove quotes from right side if present
    const rightValue = right.replace(/['"]/g, '');
    return String(leftValue) === rightValue;
  }

  // Check for != comparison
  if (condition.includes('!=')) {
    const [left, right] = condition.split('!=').map(s => s.trim());
    const leftValue = values.get(left) ?? left;
    const rightValue = right.replace(/['"]/g, '');
    return String(leftValue) !== rightValue;
  }

  // Check for boolean decision value
  const boolValue = values.get(condition);
  if (boolValue !== undefined) {
    return Boolean(boolValue);
  }

  return false;
}

/**
 * Resolve a conditional material property based on decision values
 */
export function resolveConditionalValue<T>(
  value: YamlMaterialValue<T>,
  decisionValues: Map<string, any>
): T {
  // Static value - return as-is
  if (!isConditionalValue<T>(value)) {
    return value;
  }

  // Conditional value - check 'when' clauses
  if (value.when) {
    for (const clause of value.when) {
      if (evaluateCondition(clause.if, decisionValues)) {
        return clause.value;
      }
    }
  }

  // No condition matched - return default
  return value.default;
}

/**
 * Resolve all materials based on decision values
 * Returns a map of material name -> resolved RGB color
 */
export function resolveMaterials(
  yamlMaterials: Record<string, YamlMaterial> | undefined,
  decisionValues: Map<string, any>
): Map<string, RGBColor> {
  const resolved = new Map<string, RGBColor>();

  if (!yamlMaterials) return resolved;

  for (const [name, material] of Object.entries(yamlMaterials)) {
    // Resolve the color (may be conditional)
    const colorValue = resolveConditionalValue(material.color, decisionValues);
    const color = resolveColor(colorValue);
    resolved.set(name, color);
  }

  return resolved;
}

/**
 * Resolve a color specification from geometry commands.
 * Can be a material name reference, hex color, or named color.
 */
export function resolveGeometryColor(
  colorDef: string | { r: number; g: number; b: number } | undefined,
  materials: Map<string, RGBColor>
): RGBColor | undefined {
  if (!colorDef) return undefined;

  // Already an RGB object
  if (typeof colorDef === 'object') {
    return colorDef;
  }

  // Material reference: $wood or $primary_color
  if (colorDef.startsWith('$')) {
    const materialName = colorDef.slice(1);
    return materials.get(materialName);
  }

  // Named color or hex string
  return resolveColor(colorDef);
}

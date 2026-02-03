/**
 * MaterialResolver - Resolve YAML material definitions to runtime colors
 *
 * Handles conditional materials, named colors, hex color parsing,
 * and F2-003 role-based resolution from style palettes.
 */

import { NAMED_COLORS, hexToRgb, RGBColor, MaterialSlot } from '../../platform/materials/MaterialLibrary';
import type {
  YamlMaterial,
  YamlMaterialValue,
  YamlColorValue,
  YamlConditionalValue
} from './YamlBuilderTypes';
import type { StyleDefinition, StyleMaterialDef } from './StyleResolver';

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
 * F2-003: Resolve a material from the style's palette by role name
 * Returns the palette entry if found, undefined otherwise
 */
export function resolveFromStylePalette(
  role: string,
  style: StyleDefinition | null | undefined
): StyleMaterialDef | undefined {
  if (!style?.material_palette) return undefined;
  return style.material_palette[role];
}

/**
 * F2-003: Convert a StyleMaterialDef to RGB color
 */
export function styleMaterialToColor(mat: StyleMaterialDef): RGBColor {
  if (mat.rgb) {
    return { r: mat.rgb[0], g: mat.rgb[1], b: mat.rgb[2] };
  }
  if (mat.color) {
    return resolveColor(mat.color);
  }
  // Default fallback
  return { r: 0.5, g: 0.5, b: 0.5 };
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
 * F2-003: Now accepts optional style for role-based resolution
 */
export function resolveMaterials(
  yamlMaterials: Record<string, YamlMaterial> | undefined,
  decisionValues: Map<string, any>,
  style?: StyleDefinition | null
): Map<string, RGBColor> {
  const resolved = new Map<string, RGBColor>();

  if (!yamlMaterials) return resolved;

  for (const [name, material] of Object.entries(yamlMaterials)) {
    let color: RGBColor;

    // F2-003: Check for role-based resolution first
    if (material.role) {
      const paletteMat = resolveFromStylePalette(material.role, style);
      if (paletteMat) {
        color = styleMaterialToColor(paletteMat);
      } else if (material.fallback_color) {
        // Role not found, use fallback
        color = resolveColor(material.fallback_color);
      } else if (material.color) {
        // Role not found, use explicit color
        const colorValue = resolveConditionalValue(material.color, decisionValues);
        color = resolveColor(colorValue);
      } else {
        // No fallback, use default grey
        color = { r: 0.5, g: 0.5, b: 0.5 };
      }
    } else if (material.color) {
      // Traditional color resolution
      const colorValue = resolveConditionalValue(material.color, decisionValues);
      color = resolveColor(colorValue);
    } else {
      // No color or role specified
      color = { r: 0.5, g: 0.5, b: 0.5 };
    }

    resolved.set(name, color);
  }

  return resolved;
}

/**
 * Resolve all materials to full MaterialSlot objects (PBR-ready).
 * Returns a map of material name -> MaterialSlot.
 * F2-003: Now accepts optional style for role-based resolution
 */
export function resolveMaterialSlots(
  yamlMaterials: Record<string, YamlMaterial> | undefined,
  decisionValues: Map<string, any>,
  style?: StyleDefinition | null
): Map<string, MaterialSlot> {
  const resolved = new Map<string, MaterialSlot>();

  if (!yamlMaterials) return resolved;

  for (const [name, material] of Object.entries(yamlMaterials)) {
    let color: RGBColor;
    let roughness: number;
    let metalness: number;

    // F2-003: Check for role-based resolution first
    if (material.role) {
      const paletteMat = resolveFromStylePalette(material.role, style);
      if (paletteMat) {
        color = styleMaterialToColor(paletteMat);
        // Use palette's PBR properties if available, otherwise fall back to material definition or defaults
        roughness = paletteMat.roughness ?? (material.roughness !== undefined
          ? resolveConditionalValue(material.roughness, decisionValues) : 0.5);
        metalness = paletteMat.metalness ?? (material.metalness !== undefined
          ? resolveConditionalValue(material.metalness, decisionValues) : 0.0);
      } else if (material.fallback_color) {
        // Role not found, use fallback
        color = resolveColor(material.fallback_color);
        roughness = material.roughness !== undefined
          ? resolveConditionalValue(material.roughness, decisionValues) : 0.5;
        metalness = material.metalness !== undefined
          ? resolveConditionalValue(material.metalness, decisionValues) : 0.0;
      } else if (material.color) {
        // Role not found, use explicit color
        const colorValue = resolveConditionalValue(material.color, decisionValues);
        color = resolveColor(colorValue);
        roughness = material.roughness !== undefined
          ? resolveConditionalValue(material.roughness, decisionValues) : 0.5;
        metalness = material.metalness !== undefined
          ? resolveConditionalValue(material.metalness, decisionValues) : 0.0;
      } else {
        // No fallback, use defaults
        color = { r: 0.5, g: 0.5, b: 0.5 };
        roughness = 0.5;
        metalness = 0.0;
      }
    } else if (material.color) {
      // Traditional color resolution
      const colorValue = resolveConditionalValue(material.color, decisionValues);
      color = resolveColor(colorValue);
      roughness = material.roughness !== undefined
        ? resolveConditionalValue(material.roughness, decisionValues) : 0.5;
      metalness = material.metalness !== undefined
        ? resolveConditionalValue(material.metalness, decisionValues) : 0.0;
    } else {
      // No color or role specified
      color = { r: 0.5, g: 0.5, b: 0.5 };
      roughness = 0.5;
      metalness = 0.0;
    }

    resolved.set(name, { name, color, roughness, metalness });
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

/**
 * Resolve a geometry command's color/material reference to a material slot name.
 * Returns the slot name if it's a $reference, undefined otherwise.
 */
export function resolveGeometryMaterialSlotName(
  colorDef: string | { r: number; g: number; b: number } | undefined
): string | undefined {
  if (!colorDef || typeof colorDef !== 'string') return undefined;
  if (colorDef.startsWith('$')) return colorDef.slice(1);
  return undefined;
}

/**
 * Resolve both color and material slot index from a color/material reference.
 * When a $material reference is used and the slot exists, returns both.
 * Backward compatible: non-$references resolve to color only.
 */
export function resolveGeometryMaterial(
  colorDef: string | { r: number; g: number; b: number } | undefined,
  materials: Map<string, RGBColor>,
  _materialSlots: Map<string, MaterialSlot>,
  mesh: { getMaterialSlotIndex(name: string): number }
): { color?: RGBColor; materialSlotIndex?: number } {
  const color = resolveGeometryColor(colorDef, materials);
  const slotName = resolveGeometryMaterialSlotName(colorDef);
  let materialSlotIndex: number | undefined;
  if (slotName !== undefined) {
    const idx = mesh.getMaterialSlotIndex(slotName);
    if (idx !== -1) materialSlotIndex = idx;
  }
  return { color, materialSlotIndex };
}

/**
 * StyleResolver - Style Definition and Resolution
 *
 * F2-001: Style Schema and Resolution
 *
 * A style is a first-class data object that influences:
 * - Decision defaults: fallback values when decisions aren't explicitly set
 * - Material palette: role-based material definitions
 * - Proportion rules: constraints on measurement relationships
 * - Pattern preferences: symmetry, repetition, ornamentation level
 *
 * Styles cascade through composition: parent style flows to children
 * unless explicitly overridden.
 */

import { getMetadataStore, MetadataNotFoundError } from '../../storage/MetadataStore';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Material definition within a style palette
 */
export interface StyleMaterialDef {
  color?: string;           // Hex color or named reference
  rgb?: [number, number, number];  // RGB values [0-1]
  roughness?: number;       // PBR roughness [0-1]
  metalness?: number;       // PBR metalness [0-1]
  name?: string;            // Optional material name for reference
}

/**
 * Pattern preferences for a style
 */
export interface StylePatternPreferences {
  symmetry?: 'bilateral' | 'radial' | 'none' | 'functional' | 'approximate';
  repetition?: 'low' | 'medium' | 'high';
  ornamentation?: 'none' | 'minimal' | 'moderate' | 'elaborate';
}

/**
 * Style definition following the new F2-001 schema
 */
export interface StyleDefinition {
  name: string;
  description?: string;

  /** Decision defaults: map of decision_name -> preferred_value */
  decision_defaults?: Record<string, string | number | boolean>;

  /** Material palette: map of role -> material definition */
  material_palette?: Record<string, StyleMaterialDef>;

  /** Proportion rules: expressions that should hold (e.g., "table_height / seat_height >= 1.15") */
  proportion_rules?: string[];

  /** Pattern preferences */
  pattern_preferences?: StylePatternPreferences;

  // Legacy fields (from B3-003 format, preserved for compatibility)
  colors?: Record<string, any[]>;
  materials?: Record<string, any[]>;
  proportions?: Record<string, any>;
  ornamentation?: {
    level?: string;
    allowed?: string[];
    forbidden?: string[];
  };
}

/**
 * Result of resolving a style
 */
export interface ResolvedStyle {
  name: string;
  definition: StyleDefinition;
  source: 'metadata' | 'inline' | 'default';
}

/**
 * Validation result for proportion rules
 */
export interface ProportionValidationResult {
  rule: string;
  passed: boolean;
  message?: string;
}

// =============================================================================
// DEFAULT STYLE
// =============================================================================

/**
 * Default style when none is specified
 */
export const DEFAULT_STYLE: StyleDefinition = {
  name: 'default',
  description: 'Default neutral style',
  decision_defaults: {},
  material_palette: {
    primary: { rgb: [0.6, 0.6, 0.6], roughness: 0.5, metalness: 0.0 },
    secondary: { rgb: [0.4, 0.4, 0.4], roughness: 0.6, metalness: 0.0 },
    accent: { rgb: [0.8, 0.5, 0.2], roughness: 0.4, metalness: 0.0 },
  },
  proportion_rules: [],
  pattern_preferences: {
    symmetry: 'bilateral',
    repetition: 'medium',
    ornamentation: 'minimal'
  }
};

// =============================================================================
// STYLE RESOLVER
// =============================================================================

/**
 * Cache for loaded styles
 */
const styleCache = new Map<string, StyleDefinition>();

/**
 * Clear the style cache (useful for testing)
 */
export function clearStyleCache(): void {
  styleCache.clear();
}

/**
 * Load a style definition from metadata store
 */
export async function loadStyle(styleName: string): Promise<StyleDefinition | null> {
  // Check cache first
  if (styleCache.has(styleName)) {
    return styleCache.get(styleName)!;
  }

  // Try loading from metadata
  const key = styleName.startsWith('styles/') ? styleName : `styles/${styleName}`;

  try {
    const store = getMetadataStore();
    const entry = await store.get<any>(key);

    // The metadata store wraps values - the actual style is in entry.value
    const style = entry?.value;

    if (style) {
      // Normalize the style (convert legacy format if needed)
      const normalized = normalizeStyleDefinition(style, styleName);
      styleCache.set(styleName, normalized);
      return normalized;
    }
    return null;
  } catch (err) {
    if (err instanceof MetadataNotFoundError) {
      return null;
    }
    throw err;
  }
}

/**
 * Resolve a style by name, returning the definition
 */
export async function resolveStyle(styleName: string | undefined): Promise<ResolvedStyle> {
  if (!styleName) {
    return {
      name: 'default',
      definition: DEFAULT_STYLE,
      source: 'default'
    };
  }

  const loaded = await loadStyle(styleName);
  if (loaded) {
    return {
      name: styleName,
      definition: loaded,
      source: 'metadata'
    };
  }

  // Fall back to default
  console.warn(`[StyleResolver] Style '${styleName}' not found, using default`);
  return {
    name: 'default',
    definition: DEFAULT_STYLE,
    source: 'default'
  };
}

/**
 * Normalize a style definition, converting legacy B3-003 format to F2-001 format
 */
export function normalizeStyleDefinition(raw: any, name?: string): StyleDefinition {
  const style: StyleDefinition = {
    name: raw.name || name || 'unnamed',
    description: raw.description,
    decision_defaults: raw.decision_defaults || {},
    material_palette: {},
    proportion_rules: raw.proportion_rules || [],
    pattern_preferences: raw.pattern_preferences,
  };

  // Convert legacy material_palette if present
  if (raw.material_palette) {
    style.material_palette = raw.material_palette;
  }

  // Convert legacy materials format to material_palette
  if (raw.materials && !raw.material_palette) {
    // Old format: materials.primary = [{ name, roughness, metalness }]
    // New format: material_palette.primary_wood = { color, roughness, metalness }
    for (const [category, mats] of Object.entries(raw.materials)) {
      if (Array.isArray(mats) && mats.length > 0) {
        const mat = mats[0] as any;
        style.material_palette![`${category}_default`] = {
          name: mat.name,
          roughness: mat.roughness,
          metalness: mat.metalness,
        };
      }
    }
  }

  // Convert legacy colors to material palette colors if needed
  if (raw.colors && !raw.material_palette) {
    for (const [category, colors] of Object.entries(raw.colors)) {
      if (Array.isArray(colors) && colors.length > 0) {
        const color = colors[0] as any;
        const key = `${category}_color`;
        if (!style.material_palette![key]) {
          style.material_palette![key] = {
            color: color.hex,
            rgb: color.rgb,
            name: color.name
          };
        }
      }
    }
  }

  // Convert legacy proportions to decision_defaults
  if (raw.proportions && !raw.decision_defaults) {
    for (const [key, value] of Object.entries(raw.proportions)) {
      if (typeof value === 'number' || typeof value === 'string') {
        style.decision_defaults![key] = value;
      }
    }
  }

  // Convert legacy ornamentation to pattern_preferences
  if (raw.ornamentation && !raw.pattern_preferences) {
    style.pattern_preferences = style.pattern_preferences || {};
    if (raw.ornamentation.level) {
      style.pattern_preferences.ornamentation = raw.ornamentation.level as any;
    }
  }

  // Preserve legacy fields for backward compatibility
  if (raw.colors) style.colors = raw.colors;
  if (raw.materials) style.materials = raw.materials;
  if (raw.proportions) style.proportions = raw.proportions;
  if (raw.ornamentation) style.ornamentation = raw.ornamentation;

  return style;
}

/**
 * Get a decision default from a style
 */
export function getDecisionDefault(
  style: StyleDefinition,
  decisionName: string
): string | number | boolean | undefined {
  return style.decision_defaults?.[decisionName];
}

/**
 * Get a material from the style palette
 */
export function getMaterialFromPalette(
  style: StyleDefinition,
  role: string
): StyleMaterialDef | undefined {
  return style.material_palette?.[role];
}

/**
 * Validate proportion rules against current measurements
 */
export function validateProportionRules(
  style: StyleDefinition,
  measurements: Record<string, number>,
  evaluator: (expr: string, vars: Record<string, number>) => number
): ProportionValidationResult[] {
  if (!style.proportion_rules || style.proportion_rules.length === 0) {
    return [];
  }

  const results: ProportionValidationResult[] = [];

  for (const rule of style.proportion_rules) {
    try {
      const result = evaluator(rule, measurements);
      const passed = result !== 0; // Non-zero = truthy
      results.push({
        rule,
        passed,
        message: passed ? 'Rule satisfied' : 'Rule not satisfied'
      });
    } catch (err) {
      results.push({
        rule,
        passed: false,
        message: `Evaluation error: ${(err as Error).message}`
      });
    }
  }

  return results;
}

/**
 * List all available styles from metadata
 */
export async function listStyles(): Promise<string[]> {
  const store = getMetadataStore();
  const result = await store.list({ prefix: 'styles/' });
  return result.keys.map(key => key.replace('styles/', ''));
}

/**
 * MaterialLibrary - Pre-defined named colors and material presets
 *
 * Organized by category for easy extension.
 * All colors are in 0-1 RGB range.
 */

export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

export interface MaterialPreset {
  color: RGBColor;
  roughness?: number;
  metalness?: number;
}

// =============================================================================
// NAMED COLORS
// =============================================================================

export const NAMED_COLORS: Record<string, RGBColor> = {
  // Woods - Light to Dark
  wood_pine:      { r: 0.722, g: 0.580, b: 0.380 },
  wood_maple:     { r: 0.735, g: 0.604, b: 0.459 },
  wood_oak:       { r: 0.545, g: 0.353, b: 0.169 },
  wood_cherry:    { r: 0.545, g: 0.271, b: 0.208 },
  wood_walnut:    { r: 0.373, g: 0.235, b: 0.157 },
  wood_mahogany:  { r: 0.400, g: 0.200, b: 0.133 },
  wood_ebony:     { r: 0.180, g: 0.150, b: 0.130 },

  // Metals
  metal_steel:    { r: 0.600, g: 0.600, b: 0.620 },
  metal_iron:     { r: 0.400, g: 0.400, b: 0.420 },
  metal_brass:    { r: 0.710, g: 0.650, b: 0.259 },
  metal_copper:   { r: 0.722, g: 0.451, b: 0.200 },
  metal_bronze:   { r: 0.545, g: 0.388, b: 0.224 },
  metal_gold:     { r: 0.831, g: 0.686, b: 0.216 },
  metal_silver:   { r: 0.753, g: 0.753, b: 0.753 },

  // Fabrics
  fabric_white:   { r: 0.950, g: 0.950, b: 0.950 },
  fabric_cream:   { r: 0.961, g: 0.933, b: 0.859 },
  fabric_beige:   { r: 0.761, g: 0.698, b: 0.502 },
  fabric_brown:   { r: 0.396, g: 0.263, b: 0.129 },
  fabric_red:     { r: 0.698, g: 0.133, b: 0.133 },
  fabric_burgundy:{ r: 0.502, g: 0.000, b: 0.125 },
  fabric_blue:    { r: 0.200, g: 0.329, b: 0.529 },
  fabric_navy:    { r: 0.098, g: 0.137, b: 0.294 },
  fabric_green:   { r: 0.235, g: 0.420, b: 0.235 },
  fabric_olive:   { r: 0.333, g: 0.333, b: 0.184 },
  fabric_gray:    { r: 0.500, g: 0.500, b: 0.500 },
  fabric_charcoal:{ r: 0.212, g: 0.212, b: 0.212 },
  fabric_black:   { r: 0.100, g: 0.100, b: 0.100 },

  // Stone
  stone_marble:   { r: 0.941, g: 0.933, b: 0.898 },
  stone_granite:  { r: 0.502, g: 0.502, b: 0.502 },
  stone_slate:    { r: 0.439, g: 0.502, b: 0.565 },
  stone_sandstone:{ r: 0.761, g: 0.698, b: 0.502 },
  stone_limestone:{ r: 0.871, g: 0.843, b: 0.780 },

  // Leather
  leather_tan:    { r: 0.824, g: 0.706, b: 0.549 },
  leather_brown:  { r: 0.545, g: 0.353, b: 0.169 },
  leather_dark:   { r: 0.298, g: 0.188, b: 0.118 },
  leather_black:  { r: 0.118, g: 0.098, b: 0.078 },
  leather_red:    { r: 0.545, g: 0.137, b: 0.137 },

  // Plastic/Synthetic
  plastic_white:  { r: 0.950, g: 0.950, b: 0.950 },
  plastic_black:  { r: 0.050, g: 0.050, b: 0.050 },
  plastic_red:    { r: 0.800, g: 0.100, b: 0.100 },
  plastic_blue:   { r: 0.100, g: 0.200, b: 0.800 },
  plastic_green:  { r: 0.100, g: 0.600, b: 0.200 },
  plastic_yellow: { r: 0.900, g: 0.800, b: 0.100 },
  plastic_orange: { r: 0.900, g: 0.400, b: 0.100 },

  // Basic colors
  white:          { r: 1.000, g: 1.000, b: 1.000 },
  black:          { r: 0.050, g: 0.050, b: 0.050 },
  gray:           { r: 0.500, g: 0.500, b: 0.500 },
  red:            { r: 0.800, g: 0.100, b: 0.100 },
  green:          { r: 0.100, g: 0.600, b: 0.100 },
  blue:           { r: 0.100, g: 0.100, b: 0.800 },
};

// =============================================================================
// MATERIAL PRESETS (color + PBR properties)
// =============================================================================

export const MATERIAL_PRESETS: Record<string, MaterialPreset> = {
  // Wood presets with typical roughness
  matte_oak: {
    color: NAMED_COLORS.wood_oak,
    roughness: 0.8,
    metalness: 0.0
  },
  satin_oak: {
    color: NAMED_COLORS.wood_oak,
    roughness: 0.5,
    metalness: 0.0
  },
  gloss_oak: {
    color: NAMED_COLORS.wood_oak,
    roughness: 0.2,
    metalness: 0.0
  },

  // Metal presets
  polished_steel: {
    color: NAMED_COLORS.metal_steel,
    roughness: 0.1,
    metalness: 0.9
  },
  brushed_steel: {
    color: NAMED_COLORS.metal_steel,
    roughness: 0.4,
    metalness: 0.9
  },
  polished_brass: {
    color: NAMED_COLORS.metal_brass,
    roughness: 0.1,
    metalness: 0.9
  },
  antique_brass: {
    color: NAMED_COLORS.metal_brass,
    roughness: 0.5,
    metalness: 0.7
  },
};

// =============================================================================
// LOOKUP FUNCTIONS
// =============================================================================

/**
 * Get a color by name, supporting both named colors and hex strings
 */
export function getNamedColor(name: string): RGBColor | undefined {
  // Direct lookup
  if (NAMED_COLORS[name]) {
    return NAMED_COLORS[name];
  }

  // Hex string
  if (name.startsWith('#')) {
    return hexToRgb(name);
  }

  return undefined;
}

/**
 * Convert hex string to RGB (0-1 range)
 */
export function hexToRgb(hex: string): RGBColor {
  const cleaned = hex.replace('#', '');
  return {
    r: parseInt(cleaned.slice(0, 2), 16) / 255,
    g: parseInt(cleaned.slice(2, 4), 16) / 255,
    b: parseInt(cleaned.slice(4, 6), 16) / 255
  };
}

/**
 * Get a material preset by name
 */
export function getMaterialPreset(name: string): MaterialPreset | undefined {
  return MATERIAL_PRESETS[name];
}

/**
 * List all available named colors
 */
export function listNamedColors(): string[] {
  return Object.keys(NAMED_COLORS);
}

/**
 * List colors by category prefix
 */
export function listColorsByCategory(prefix: string): string[] {
  return Object.keys(NAMED_COLORS).filter(name => name.startsWith(prefix));
}


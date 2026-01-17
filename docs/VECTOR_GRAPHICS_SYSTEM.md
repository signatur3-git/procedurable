# Vector Graphics Library System (P2-M4 Extension)

## Vision

Enable builders to define and share reusable 2D vector graphics with semantic annotations, creating a procedural "clip art" system that works compositionally.

## Architecture

### Core Concept: **Vector Graphics as Builders**

Vector graphics are just specialized builders that:
1. Define 2D shapes via `shapes:` section
2. Have semantic tags for discovery
3. Can be parametric (decisions/measurements)
4. Output Shape2D data that other builders can reference

### Example: Icon Library

```yaml
# builders/icons/Heart.yaml
version: "1.0"
name: Heart
description: Parametric heart icon for decorative elements
tags: [icon, decorative, symbol, love]

decisions:
  style:
    type: choice
    options: [rounded, sharp, modern]
    weights: [0.5, 0.3, 0.2]

measurements:
  width:
    value: 0.1
    min: 0.05
    max: 0.5
    source: "Heart width"

derived:
  height: "width * 0.9"
  curve_radius: "width * 0.25"
  tip_sharpness: "if(eq(style, 'sharp'), 0.8, if(eq(style, 'modern'), 0.95, 1.0))"

shapes:
  heart_outline:
    type: polygon
    points:
      # Parametric heart shape using measurements
      - { x: 0, z: "-height * 0.3" }  # Bottom point
      - { x: "width * 0.4", z: "height * 0.2" }
      - { x: "width * 0.5", z: "height * 0.4" }
      - { x: 0, z: "height * 0.5" }  # Top center
      - { x: "-width * 0.5", z: "height * 0.4" }
      - { x: "-width * 0.4", z: "height * 0.2" }

# This builder outputs Shape2D data
# Other builders can compose it or reference its shapes
```

```yaml
# builders/decorative/LoveSign.yaml
version: "1.0"
name: LoveSign
description: Sign with heart decoration
tags: [sign, decorative]

compose:
  # Compose the heart as a sub-builder
  heart_decoration:
    builder: Heart
    offset: { x: 0, y: 0.05, z: 0 }
    overrides:
      width: 0.15
      style: rounded

geometry:
  # Main sign plate
  - extrude2d: plate
    shape: rect_plate
    depth: 0.02
    
  # Could also directly reference heart's shape if exposed
  # - extrude2d: heart_emboss
  #   shape: $heart_decoration.heart_outline
  #   depth: 0.01
```

## Implementation Plan

### Current Status: Procedural Fonts + Polygon Approximation (P2M4-002)

**✅ Implemented: ProceduralFont System**

We now have a built-in procedural font system that works without external font files:

```typescript
// src/text/ProceduralFont.ts
export const proceduralFontRegistry = new ProceduralFontRegistry();

// Built-in 'simple' font with these characters:
// H, E, L, O, I, N, X, T (plus space)

// Usage in YAML:
shapes:
  sign_text:
    type: text
    content: "HELLO"
    font: "simple"  # Built-in procedural font
    size: 0.5
```

**Architecture:**
- `ProceduralFontRegistry` - Singleton registry for procedural fonts
- `ProceduralGlyph` - Letter data with contours (polygon points)
- `FontParser` - Falls back to procedural fonts when external fonts aren't loaded
- Letters can be defined as YAML builders in `builders/letters/`

**Current Limitations:**
- Only ~8 letters available in 'simple' font
- Letters are simplified polygons (no curves)
- Need to add more letters over time

**Note:** The current implementation uses **polygon approximation** - curved shapes are represented as many small straight line segments. This is how FontParser works: it converts bezier curves from fonts into polygons.

**Example:**
```yaml
shapes:
  letter_h:
    type: polygon  # Straight line segments only
    points:
      - { x: 0, z: 0 }
      - { x: 0.1, z: 0 }
      # ... 20 more points approximating curves
```

**Limitations:**
- ❌ Curves look faceted at low resolution
- ❌ Can't smoothly scale without regenerating
- ❌ Larger file sizes (many points)
- ✅ But: Works immediately with existing extrusion system

### Future: True Bezier Curves (P2M4-Ext-005)

For **true vector graphics**, we should add bezier curve support:

```yaml
shapes:
  letter_a:
    type: path  # NEW: Path with curves
    segments:
      - type: moveTo
        point: { x: 0, z: 0 }
      - type: lineTo
        point: { x: 0.5, z: 1 }
      - type: quadraticCurveTo
        control: { x: 0.7, z: 0.9 }
        end: { x: 1, z: 0.5 }
      - type: cubicCurveTo
        control1: { x: 0.8, z: 0.2 }
        control2: { x: 0.6, z: 0.1 }
        end: { x: 0, z: 0 }
```

This would require:
- New `Path2D` type with curve support
- Curve tessellation (adaptive subdivision)
- Updated extrusion to handle curves

**Add to backlog as P2M4-Ext-005: Bezier Path Support**

---

### Phase 1: Shape References (P2M4-Extension-001)
Allow builders to reference shapes from composed sub-builders.

**New YAML syntax:**
```yaml
compose:
  icon:
    builder: Heart
    offset: { x: 0, y: 0, z: 0 }
    expose_shapes: true  # NEW: Make child shapes accessible

geometry:
  # Reference shape from composed builder
  - extrude2d: embossed_heart
    shape: $icon.heart_outline  # NEW: $builder.shape_name syntax
    depth: 0.01
```

**Changes needed:**
- TracedBuilder stores shape definitions in output
- YamlBuilderParser resolves `$builder.shape` references
- Shape2D can be serialized/deserialized

### Phase 2: Vector Graphics Library (P2M4-Extension-002)
Create standard library of icons/symbols as YAML builders.

**Library structure:**
```
builders/
  icons/
    Heart.yaml
    Star.yaml
    Arrow.yaml
    Checkmark.yaml
    Warning.yaml
  patterns/
    Fleur.yaml
    Celtic.yaml
    Tribal.yaml
  calligraphy/
    Flourish_Left.yaml
    Flourish_Right.yaml
    Ornament_Corner.yaml
```

**Semantic tagging system:**
```yaml
tags: [icon, decorative, symbol, love, heart]
# Builders can search: storage.search tags=decorative
```

### Phase 3: SVG Import (P2M4-Extension-003)
Import SVG paths as YAML vector graphics.

**Tool:**
```bash
# Convert SVG to YAML builder
node tools/svg-to-yaml.js input.svg output.yaml
```

**SVG → YAML conversion:**
```svg
<svg>
  <path d="M 0,0 L 100,0 L 100,100 Z" />
</svg>
```

Becomes:
```yaml
shapes:
  imported_shape:
    type: polygon
    points:
      - { x: 0, z: 0 }
      - { x: 1, z: 0 }
      - { x: 1, z: 1 }
```

### Phase 4: Procedural Calligraphy (P2M4-Extension-004)
Generate decorative elements procedurally.

**Spline-based flourishes:**
```yaml
# builders/calligraphy/Flourish.yaml
decisions:
  complexity:
    type: number
    min: 1
    max: 5

derived:
  curve_count: "floor(complexity)"

splines:
  # Generate curved flourish from parameters
  flourish_path:
    type: catmull-rom
    points:
      - { x: 0, y: 0, z: 0 }
      # Procedurally generated control points based on decisions
      - { x: "complexity * 0.1", y: "complexity * 0.05", z: 0 }
      # ...more points

geometry:
  # Sweep profile along flourish spline
  - sweep: flourish
    profile: thin_ribbon
    path: flourish_path
```

## Benefits

### ✅ **No Dashboard Changes**
- Vector graphics are just builders
- Dashboard already handles builders
- Works with existing preview/rendering

### ✅ **Fully Parametric**
- Icons can have decisions (style, size, detail level)
- Measurements for proportions
- Derived values for complex math

### ✅ **Compositional**
- Builders can reference/compose vector graphics
- Create libraries of reusable elements
- Build complex designs from simple pieces

### ✅ **Semantic Discovery**
- Tags enable searching: "show me all decorative icons"
- storage.search integration
- Natural organization

### ✅ **Procedural Generation**
- Vector graphics can be generative
- Random variations with seeds
- Style decisions affect output

## Use Cases

### **Signage**
```yaml
compose:
  warning_icon:
    builder: WarningTriangle
  open_text:
    builder: TextSign
    overrides:
      content: "OPEN"
```

### **Decorative Furniture**
```yaml
compose:
  corner_flourish_1:
    builder: OrnamentCorner
    offset: { x: -0.5, y: 0, z: 0.5 }
    rotation: { x: 0, y: 0, z: 0 }
  corner_flourish_2:
    builder: OrnamentCorner
    offset: { x: 0.5, y: 0, z: 0.5 }
    rotation: { x: 0, y: 0, z: 3.14159 }  # 180 degrees
```

### **Architectural Details**
```yaml
compose:
  rosette:
    builder: FlourishRosette
    offset: { x: 0, y: 2.0, z: 0 }
    overrides:
      complexity: 3
      radius: 0.3
```

## Alternative: Asset Library Approach

If YAML builders feel too heavyweight, we could create a simpler asset format:

```yaml
# assets/icons/heart.asset.yaml
type: vector_graphic
name: Heart
tags: [icon, decorative]

shapes:
  outline:
    type: polygon
    points:
      - { x: 0, z: -0.3 }
      - { x: 0.4, z: 0.2 }
      # ...
```

**Pros:**
- Lighter weight than full builders
- Faster loading
- Simpler format

**Cons:**
- Not parametric (no decisions/measurements)
- Can't be procedural
- Need new loading system
- Dashboard needs changes to preview

---

## Asset Analysis & Adapter System (Future/Optional)

### Vision: Intelligent Asset Import

Rather than just converting external assets 1:1, we can **analyze** them to:
- Extract semantic information (symmetry, patterns, proportions)
- Identify parametric opportunities (what could be a decision?)
- Generate intelligent builders (not just static shapes)

### Example: Smart SVG Analysis

**Input:** `heart-icon.svg`

**Naive Import:**
```yaml
# Simple conversion: just points
shapes:
  heart:
    type: polygon
    points: [...]  # Raw coordinates
```

**Intelligent Analysis:**
```yaml
# Analyzed and parametrized
name: HeartIcon
description: "Detected: symmetric heart shape with smooth curves"

decisions:
  style:
    type: choice
    options: [rounded, sharp]
    # DETECTED: Two similar SVG variants found in library

measurements:
  width:
    value: 0.1
    # DETECTED: SVG viewBox dimensions normalized

derived:
  height: "width * 0.92"  # DETECTED: Aspect ratio from SVG
  half_width: "width / 2"  # DETECTED: Vertical symmetry axis

shapes:
  heart_outline:
    # GENERATED: Parameterized from analyzed control points
    type: polygon
    points:
      - { x: 0, z: "-height * 0.3" }  # Bottom
      - { x: "half_width * 0.9", z: "height * 0.15" }  # Right
      # ... parameterized, not hardcoded
```

### Adapters for External Formats

**Phase 1: Format Converters**
- SVG → YAML (path data → polygons)
- Font Glyphs → YAML (already have this!)
- DXF → YAML (CAD drawings)
- JSON vector data → YAML

**Phase 2: Semantic Analyzers**
- **Symmetry Detection** - Find reflection/rotational symmetry
- **Pattern Recognition** - Identify repeating elements
- **Hierarchy Extraction** - Grouped elements → compositions
- **Dimension Analysis** - Extract meaningful proportions

**Phase 3: Parametrization Engine**
- **Variation Detection** - Multiple similar assets → one parametric builder
- **Control Point Extraction** - Curves → mathematical expressions
- **Style Classification** - Categorize into style families
- **Semantic Tagging** - Auto-generate tags based on shape analysis

### Implementation Approach

#### Tool: Asset Analyzer

```bash
# Basic conversion
npm run asset-import input.svg output.yaml

# Intelligent analysis
npm run asset-analyze input.svg --output output.yaml --smart

# Batch analysis (learns from multiple similar assets)
npm run asset-analyze-batch icons/*.svg --output builders/icons/
```

**What the analyzer does:**

```typescript
interface AssetAnalysisResult {
  // Detected properties
  symmetry: {
    vertical?: { axis: number };
    horizontal?: { axis: number };
    rotational?: { order: number, center: Point2D };
  };
  
  // Detected patterns
  proportions: {
    aspectRatio: number;
    dominantDimensions: string[];  // "width", "height", "radius"
  };
  
  // Semantic understanding
  semantics: {
    category: 'icon' | 'pattern' | 'ornament' | 'text' | 'abstract';
    suggestedTags: string[];
    complexity: 'simple' | 'moderate' | 'complex';
  };
  
  // Parametrization suggestions
  parameters: {
    decisions: Array<{
      name: string;
      type: string;
      reason: string;  // "Detected multiple variants"
    }>;
    measurements: Array<{
      name: string;
      derivation?: string;  // "Derived from aspect ratio"
    }>;
  };
  
  // Generated builder
  builder: YamlBuilderDefinition;
}
```

### Use Cases

#### Use Case 1: Icon Library Import

**Scenario:** Import Font Awesome icon pack (6000+ icons)

**Without Analysis:**
- 6000 static YAML files with hardcoded coordinates
- No parametrization
- Manual tagging required

**With Analysis:**
- Detect similar icons → create style variations as decisions
- Extract common proportions → measurements
- Auto-tag based on shape analysis (arrow → directional, heart → emotion)
- Group related icons → families

#### Use Case 2: Ornament Library

**Scenario:** Import decorative Victorian ornament collection

**Analysis Detects:**
- **Symmetry:** 90% have vertical symmetry → auto-add flip decision
- **Patterns:** Repeating elements → create array/scatter parameters
- **Complexity:** High detail → add detail_level decision (LOD)
- **Style:** Classify into "Victorian", "Art Nouveau", "Baroque"

**Generated Builder:**
```yaml
name: VictorianOrnament_37
tags: [ornament, victorian, decorative, symmetric]

decisions:
  detail_level:
    type: choice
    options: [low, medium, high]
    # DETECTED: Can simplify for LOD

  flipped:
    type: boolean
    probability: 0.5
    # DETECTED: Vertical symmetry

derived:
  # DETECTED: Aspect ratio preserved
  height: "width * 1.34"
```

#### Use Case 3: Font-to-Calligraphy

**Scenario:** Analyze decorative font glyphs → extract flourishes

**Analysis Identifies:**
- Glyph components that are reusable (serifs, swashes, terminals)
- Control point patterns for curves
- Spacing/kerning relationships

**Generates:**
```
builders/calligraphy/
  Serif_Type1.yaml
  Swash_Left.yaml
  Swash_Right.yaml
  Terminal_Elegant.yaml
```

### Benefits of Adapter System

✅ **Leverage Existing Assets** - Use decades of vector art libraries  
✅ **Semantic Understanding** - Not just conversion, but comprehension  
✅ **Parametric by Default** - Generate builders, not static assets  
✅ **Learning System** - Batch analysis improves with more data  
✅ **Time Savings** - Don't manually create 1000s of icons  
✅ **Quality Baseline** - Professional assets → professional builders  

### Implementation Priority

**Recommend: Optional/Future**

Reasons:
1. **Phase 3** feature - get core system working first
2. **Complexity** - ML/analysis adds significant scope
3. **Value timing** - Most useful when we have many users creating content
4. **Workaround exists** - Manual import tools (P2M4-Ext-003) sufficient for MVP

**Add to backlog as:**
- **P3-Advanced-001:** Asset Analyzer Framework (L, Optional)
- **P3-Advanced-002:** Symmetry & Pattern Detection (M, Optional)
- **P3-Advanced-003:** Parametrization Engine (L, Optional)

---

## Recommendation

**Start with Option 1: Vector Graphics as Builders**

1. Implement **Phase 1** (Shape References) - enables composition
2. Create **Phase 2** (Library) - build useful icon/pattern library
3. Add **Phase 3** (SVG Import) - tooling for external assets
4. Explore **Phase 4** (Procedural Calligraphy) - generative decorations

**Defer Asset Analysis:**
- Move to **Phase 3** (post-MVP)
- Document in solution domain
- Add as optional backlog items

This gives us maximum flexibility and composability while requiring zero dashboard changes.

## Next Steps

Would you like me to:
1. **Implement Phase 1** (Shape References) so builders can access composed shapes?
2. **Create example vector graphics builders** (Heart, Star, Arrow icons)?
3. **Build SVG import tool** to convert existing vector art?
4. **Design procedural calligraphy system** for generative decorations?

All of these build on what we already have and fit naturally into the existing architecture!

# Asset Analysis & Adapter System

> **Purpose:** Intelligent import and parametrization of external vector graphics and 3D assets
> **Status:** Future/Optional (Phase 3)
> **Category:** Authoring Tools

## Overview

While procedural generation creates content from scratch, we also need to leverage **existing asset libraries**. Rather than simple 1:1 conversion, we want **intelligent analysis** that:

1. **Extracts semantic information** from assets
2. **Identifies parametric opportunities** 
3. **Generates intelligent builders** (not static copies)
4. **Learns from batch analysis** of similar assets

## Problem Statement

### Current State (P2-M4)

**Manual authoring:**
- Hand-craft YAML builders for each icon/ornament
- Slow for large libraries
- Requires understanding of shape mathematics

**Simple import (P2M4-Ext-003):**
- SVG → YAML converter
- 1:1 translation of coordinates
- No parametrization
- Static, hardcoded values

### Desired State (Phase 3)

**Intelligent import:**
- Analyze asset structure and semantics
- Detect parametrization opportunities
- Generate parametric builders automatically
- Batch learning from asset collections

## Solution Domain: Analysis Techniques

### 1. Geometric Analysis

#### **Symmetry Detection**

Identify axes of symmetry to add mirror/flip parameters.

**Algorithm:**
```typescript
interface SymmetryAnalysis {
  vertical?: {
    axis: number;        // X coordinate of symmetry axis
    confidence: number;  // 0-1 match quality
  };
  horizontal?: {
    axis: number;        // Z coordinate
    confidence: number;
  };
  rotational?: {
    order: number;       // 2=180°, 3=120°, 4=90°, etc.
    center: Point2D;
    confidence: number;
  };
}

function detectSymmetry(contours: GlyphContour[]): SymmetryAnalysis {
  // Test vertical symmetry: mirror points across X axis
  // Test horizontal symmetry: mirror points across Z axis  
  // Test rotational: compare after rotation by 360°/n
  // Return highest confidence matches
}
```

**Example:**
- Heart shape → vertical symmetry detected → add `flipped: boolean` decision
- Star → 5-fold rotational symmetry → add `rotation: number` parameter

#### **Proportion Extraction**

Identify meaningful dimensional relationships.

**Algorithm:**
```typescript
interface ProportionAnalysis {
  aspectRatio: number;           // height/width
  dominantDimensions: string[];  // ["width", "height", "radius"]
  relationships: Array<{
    param1: string;
    param2: string;
    ratio: number;                // param1 = param2 * ratio
    confidence: number;
  }>;
}

function analyzeProportions(bounds: AABB, contours: GlyphContour[]): ProportionAnalysis {
  // Extract width, height, diagonal
  // Test common ratios: 1:1, 4:3, 16:9, golden ratio
  // Identify control point relationships
  // Suggest derived measurements
}
```

**Example:**
- Heart: `height = width * 0.92` → generate derived value
- Arrow: `shaft_length = head_width * 3.5` → extract relationship

#### **Curve Analysis**

Parametrize bezier curves as mathematical expressions.

**Techniques:**
- **Curve fitting:** Approximate bezier with simple functions (circles, ellipses)
- **Control point extraction:** Identify strategic points for parametrization
- **Smoothness detection:** Identify C0/C1/C2 continuity for LOD

### 2. Semantic Analysis

#### **Shape Classification**

Categorize shapes into semantic types.

**Categories:**
- **Icons:** Simple, recognizable symbols (heart, star, arrow)
- **Patterns:** Repeating/tileable designs
- **Ornaments:** Decorative flourishes
- **Text:** Letter-like shapes with baseline
- **Abstract:** Uncategorized complex shapes

**Classification features:**
- Complexity (vertex count, contour count)
- Symmetry properties
- Aspect ratio
- Presence of holes
- Curvature characteristics

#### **Tag Generation**

Auto-generate semantic tags based on shape analysis.

**Tag sources:**
1. **Geometric tags:** symmetric, curved, angular, simple, complex
2. **Category tags:** icon, pattern, ornament, decorative
3. **Semantic tags:** (requires external knowledge or filename analysis)
   - Filename: `heart-icon.svg` → tags: [heart, love, emotion]
   - Shape matching: Compare to known shapes → tags: [arrow, directional]

#### **Hierarchy Extraction**

Identify grouped/nested elements for composition.

**SVG Groups → Builder Composition:**
```svg
<svg>
  <g id="frame">
    <rect ... />
    <rect ... />
  </g>
  <g id="content">
    <path ... />
  </g>
</svg>
```

Becomes:
```yaml
compose:
  frame:
    builder: RectFrame  # Generated from <g id="frame">
  content:
    builder: Content    # Generated from <g id="content">
```

### 3. Variation Detection

**Goal:** Analyze multiple similar assets → generate parametric builder

#### **Batch Analysis Algorithm**

```typescript
interface VariationAnalysis {
  baseShape: GlyphContour[];
  variations: Array<{
    name: string;
    differences: Array<{
      point: number;
      delta: Point2D;
    }>;
  }>;
  suggestedDecisions: Array<{
    name: string;
    type: 'choice';
    options: string[];
    reason: string;
  }>;
}

function analyzeVariations(assets: Asset[]): VariationAnalysis {
  // 1. Align all assets (scaling, rotation, translation)
  // 2. Find point correspondence across variants
  // 3. Cluster variations into discrete styles
  // 4. Extract delta vectors for each variation
  // 5. Suggest decision with options
}
```

**Example:**

Input: `heart-rounded.svg`, `heart-sharp.svg`, `heart-modern.svg`

Output:
```yaml
decisions:
  style:
    type: choice
    options: [rounded, sharp, modern]
    # DETECTED: 3 variants with similar topology

derived:
  # DETECTED: Control points vary by style
  top_curve: "if(eq(style, 'rounded'), width * 0.5, width * 0.4)"
```

### 4. Parametrization Engine

**Goal:** Convert static asset → parametric builder

#### **Strategy Hierarchy**

1. **Dimension-based:** Replace absolute coordinates with expressions
   - `x: 10` → `x: "width * 0.5"`
   - `y: 15` → `y: "height * 0.75"`

2. **Symmetry-based:** Use detected symmetry for mirroring
   - Left points → derived from right points
   - `x: -5` → `x: "-right_x"`

3. **Relationship-based:** Use extracted proportions
   - `height: 18` → `height: "width * 0.92"`
   - `radius: 5` → `radius: "width * 0.25"`

4. **Variation-based:** Use detected variations for decisions
   - Multiple curves → `curve_factor` decision

## Implementation Architecture

### Tool: Asset Analyzer

```typescript
class AssetAnalyzer {
  // Phase 1: Load and parse
  async load(path: string): Promise<Asset> {
    // Parse SVG/font/DXF/etc.
  }
  
  // Phase 2: Geometric analysis
  analyzeGeometry(asset: Asset): GeometricAnalysis {
    return {
      symmetry: this.detectSymmetry(asset),
      proportions: this.analyzeProportions(asset),
      curves: this.analyzeCurves(asset)
    };
  }
  
  // Phase 3: Semantic analysis
  analyzeSemantics(asset: Asset): SemanticAnalysis {
    return {
      category: this.classifyShape(asset),
      tags: this.generateTags(asset),
      hierarchy: this.extractHierarchy(asset)
    };
  }
  
  // Phase 4: Batch learning
  analyzeBatch(assets: Asset[]): VariationAnalysis {
    return this.detectVariations(assets);
  }
  
  // Phase 5: Generate builder
  generateBuilder(
    asset: Asset,
    geometric: GeometricAnalysis,
    semantic: SemanticAnalysis,
    variations?: VariationAnalysis
  ): YamlBuilderDefinition {
    // Apply parametrization strategies
    // Generate decisions, measurements, derived
    // Create shapes section
    // Add metadata (tags, description)
    return builder;
  }
}
```

### CLI Tool

```bash
# Analyze single asset
procedurable analyze heart.svg --output builders/icons/Heart.yaml

# Batch analysis (learns variations)
procedurable analyze-batch icons/*.svg --output builders/icons/

# Options
--smart              # Enable intelligent parametrization
--symmetry           # Detect and use symmetry
--variations         # Look for variations in batch
--tags               # Auto-generate tags
--lod                # Generate LOD levels
```

## Use Case Examples

### Use Case 1: Font Awesome Icon Pack

**Input:** 6000+ SVG icons from Font Awesome

**Analysis Results:**
- **Symmetry:** 40% have vertical symmetry
- **Variations:** 200 icon families with 2-5 variants each
- **Categories:** Detected 15 semantic categories (UI, social, media, etc.)
- **Tags:** 8000+ auto-generated tags

**Generated Output:**
```
builders/icons/fontawesome/
  Arrow.yaml          # With direction, style decisions
  Heart.yaml          # With style decision (solid, outline, broken)
  Star.yaml           # With fill, points decisions
  CheckCircle.yaml    # Detected circle + checkmark composition
  ...
  
  categories/
    ui/
      ...
    social/
      ...
```

### Use Case 2: Victorian Ornaments

**Input:** 100 decorative Victorian ornaments

**Analysis Results:**
- **Symmetry:** 85% bilateral, 10% radial (4-fold)
- **Complexity:** High detail → LOD opportunity
- **Patterns:** 30% have repeating elements
- **Style clustering:** 3 distinct style families

**Generated Features:**
```yaml
# Example: VictorianRosette.yaml
decisions:
  style:
    type: choice
    options: [simple, ornate, baroque]
    # DETECTED: 3 style clusters

  detail_level:
    type: choice
    options: [low, medium, high]
    # DETECTED: High complexity suitable for LOD

  rotational_symmetry:
    type: count
    min: 4
    max: 8
    # DETECTED: 4-fold rotational pattern
```

### Use Case 3: Custom Logo Parametrization

**Input:** Company logo with 3 variants (icon, horizontal, stacked)

**Analysis Results:**
- **Hierarchy:** Icon + Text components detected
- **Variations:** 3 layout modes
- **Proportions:** Text height = icon height * 0.6

**Generated Builder:**
```yaml
name: CompanyLogo

decisions:
  layout:
    type: choice
    options: [icon_only, horizontal, stacked]
    # DETECTED: 3 layout variants

compose:
  icon:
    builder: LogoIcon
    # DETECTED: Separate component
  
  text:
    builder: LogoText
    # DETECTED: Separate component
    offset:
      x: "if(eq(layout, 'horizontal'), icon_width * 1.2, 0)"
      y: "if(eq(layout, 'stacked'), -icon_height * 0.8, 0)"
```

## Benefits

✅ **Massive Time Savings** - Import 1000s of icons in batch vs. manual authoring  
✅ **Professional Quality** - Leverage professional asset libraries  
✅ **Parametric by Default** - Generated builders are parametric  
✅ **Learning System** - Improves with more data  
✅ **Semantic Understanding** - Not just geometry, but meaning  
✅ **LOD Generation** - Automatic detail level variants  

## Risks & Mitigations

⚠️ **Complexity:** Analysis algorithms are sophisticated
- **Mitigation:** Start simple (symmetry, proportions), add ML later

⚠️ **Quality:** Auto-generated builders may need manual cleanup
- **Mitigation:** Generate as "draft" with review/edit workflow

⚠️ **Licensing:** External assets may have licensing restrictions
- **Mitigation:** Tool checks licenses, only imports compatible assets

⚠️ **Scope Creep:** Can become infinite research project
- **Mitigation:** Keep as optional Phase 3 feature, define MVP clearly

## Implementation Priority

**Recommendation: Optional/Future (Phase 3)**

**Reasons:**
1. **Core system first** - Get P2-M4 base features working
2. **Diminishing returns** - Simple import (P2M4-Ext-003) covers 80% of use cases
3. **Complexity** - Analysis adds significant engineering scope
4. **User base** - Most valuable when many users import assets

**When to implement:**
- After P2-M4 base complete
- After asset library established (P2M4-Ext-002)
- When users request batch import features
- When we have data (asset collections) to train/test on

## Backlog Integration

Add to backlog as **Phase 3 - Advanced Features:**

- **P3-Advanced-001:** Asset Analyzer Framework (L, Optional)
  - CLI tool structure
  - Format parsers (SVG, DXF, font)
  - Output generator

- **P3-Advanced-002:** Geometric Analysis (M, Optional)
  - Symmetry detection
  - Proportion extraction  
  - Curve analysis

- **P3-Advanced-003:** Semantic Analysis (M, Optional)
  - Shape classification
  - Tag generation
  - Hierarchy extraction

- **P3-Advanced-004:** Parametrization Engine (L, Optional)
  - Variation detection
  - Decision generation
  - Expression synthesis

## References

- **Related:** `VECTOR_GRAPHICS_SYSTEM.md` - Base system this enhances
- **Related:** `AUTHORING_SOLUTION_DOMAIN.md` - Authoring tools inventory
- **Related:** P2M4-Ext-003 (Simple SVG Import) - Simpler alternative

---

**Status:** 📋 Documented, 🔮 Future, ⚡ Optional

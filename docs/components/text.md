# Text

Font parsing and text-to-geometry conversion.

## Current State [partial]

| Class | Purpose | Status |
|-------|---------|--------|
| `FontParser` | Parse OpenType/TrueType font files | Working |
| `ProceduralFont` | Generate fonts algorithmically | Working (basic registry) |
| `TextToShape` | Convert glyph outlines to 2D shapes | **Broken for glyphs with holes** |

## How It Works

```
Font file (.ttf/.otf)
  │
  ▼ FontParser
Glyph contours (arrays of Path2D curves)
  │
  ▼ TextToShape
Shape2D per character (positioned with kerning)
  │
  ▼ Extrude
3D text mesh
```

## The Hole Problem

Letters like A, B, D, O, P, Q, R have inner contours (holes). The current implementation extrudes outer and inner contours independently, producing filled shapes instead of hollow ones.

**Fix requires:** 2D boolean subtraction (Component [C1]). Once 2D booleans exist:

```
Outer contour of "O" → Shape2D
Inner contour of "O" → Shape2D
Subtract inner from outer → Correct "O" shape
Extrude → Correct 3D "O"
```

## Target State

| Capability | Status | Depends On |
|------------|--------|------------|
| Basic text extrusion (no holes) | Working | — |
| Text with holes (A, O, P, etc.) | Blocked | 2D Booleans [C1] |
| Text on path (curved text) | Planned | Sweep improvements |
| Beveled/rounded text edges | Planned | Bevel [C2] |
| Multi-line text layout | Planned | — |
| Procedural font variety | Partial | — |

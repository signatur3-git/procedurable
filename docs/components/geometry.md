# Geometry

Mesh data structures and shape creation engines. This is the layer that turns abstract specifications into triangles.

## Data Structures [exists]

| Class | Role |
|-------|------|
| `Mesh` | Core container: vertices + faces + materialSlots. Supports clone, merge, triangulate, computeNormals, computeAABB |
| `Vertex` | Position + optional color, normal. Future: UV, bone weights |
| `Face` | Polygon with vertex indices + optional color and materialSlotIndex. Supports n-gons, auto-triangulation |
| `EdgeLoop` | Ring of connected edges — input for sweep/loft operations |
| `Path2D` | 2D path with line segments, quadratic/cubic bezier curves, arcs |
| `Shape2D` | Closed 2D polygon — input for extrude/lathe. Handles winding order |

### Mesh Contract

A valid Mesh in Procedurable satisfies:

- No NaN or Infinity in vertex positions
- No degenerate faces (zero-area triangles)
- Consistent winding order (CCW = front-facing)
- Bounded scale (no vertices at 1e10)
- All face indices reference valid vertices

Validation enforces these checks — see [Validation & Quality](./validation).

## Shape Creation Engines [exists]

### Extrude

Takes a 2D Shape and a height, produces a 3D mesh.

```
Shape2D (rectangle) + height=2.0 → Box mesh
Shape2D (circle)    + height=0.5 → Cylinder mesh
Shape2D (L-shape)   + height=3.0 → L-beam mesh
```

Options: top cap, bottom cap, segments along height.

### Lathe (Surface of Revolution)

Rotates a 2D profile around the Y axis.

```
Profile (vase silhouette) + segments=32 → Vase mesh
Profile (wine glass)      + segments=24 → Glass mesh
```

This is the workhorse for any rotationally symmetric object: vases, glasses, table legs, knobs, spindles.

### Sweep

Moves a 2D profile along a 3D spline path.

```
Profile (circle r=0.02) + Path (S-curve) → Pipe/tube mesh
Profile (rectangle)     + Path (helix)   → Spiral rail
```

Options: twist along path, scale along path, orient to path tangent.

### Subdivision (Catmull-Clark)

Smooths a mesh by iteratively subdividing faces.

```
Box (6 faces) → Level 1 (24 faces) → Level 2 (96 faces) → smooth shape
```

Used for organic forms: character bodies, cushions, organic furniture.

## Target State Additions

### 2D Booleans [planned — C1]

Union, subtract, and intersect 2D polygons. This is the **most critical missing piece**.

```
Outer contour (letter "O") - Inner contour (hole) = Correct "O" glyph
Gear outer circle - Tooth cutouts = Gear profile
Floor plan - Window openings = Wall cross-section
```

Blocks: text rendering (glyph holes), gear profiles, mechanical parts, architectural openings.

**Implementation approach:** Greiner-Hormann or Martinez polygon clipping.

### Bevel & Chamfer [planned — C2]

Edge treatment to break hard edges. Required for Tier 2 quality.

```
Box with sharp edges → Beveled box (small curved transitions at edges)
Table top → Rounded edges look manufactured, not CG
```

Without bevel, everything looks like a programmer made it. This is the single biggest visual quality jump.

### UV Generation [planned — C4]

Automatic texture coordinate generation for each creation method:

| Method | UV Strategy |
|--------|-------------|
| Extrude | Planar projection on caps, cylindrical on sides |
| Lathe | Cylindrical mapping (angle → U, height → V) |
| Sweep | Path distance → U, profile position → V |
| Subdivision | Interpolate from base mesh UVs |

Required for texturing and glTF export.

### Deformers [planned — C5]

Post-creation mesh modification:

| Deformer | Effect |
|----------|--------|
| Bend | Curve mesh along an axis |
| Twist | Rotate mesh progressively along an axis |
| Taper | Scale mesh progressively along an axis |
| Noise | Displace vertices by noise field |
| Lattice | Free-form deformation via control cage |

These break the "CG-perfect" look and enable organic variation.

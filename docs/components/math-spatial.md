# Math & Spatial

Foundation layer — pure math primitives and spatial algorithms. Everything else builds on this.

## Math Primitives [exists]

| Class | Purpose | Key Operations |
|-------|---------|----------------|
| `Vec3` | 3D vector | add, sub, mul, dot, cross, normalize, lerp, distance |
| `Mat4` | 4×4 matrix | identity, translation, rotation, scale, multiply, invert, transformPoint |
| `Transform` | Position + rotation + scale | fromPosition, fromRotation, fromScale, compose, toMat4 |
| `AABB` | Axis-aligned bounding box | contains, intersects, union, center, size, expandToInclude |
| `Spline` | Bezier/B-spline curves | evaluate(t), tangent(t), curvature(t), length(), subdivide() |
| `MathService` | Expression evaluator | `evaluate("seat_height * 0.9 + 0.1", vars)` — supports if/sin/cos/pow/eq/min/max |

### MathService Expression Language

The expression evaluator is a critical glue piece — it lets YAML builders compute derived values without code:

```yaml
derived:
  rail_height: "seat_height * back_ratio"
  leg_bottom: "if(has_foot, foot_height, 0)"
  circumference: "2 * PI * radius"
```

Supports: arithmetic, comparisons, ternary via `if()`, trig functions, `min`/`max`/`clamp`/`abs`, constants (`PI`, `TAU`).

## Spatial Algorithms [exists]

| Class | Purpose | When Used |
|-------|---------|-----------|
| `ScalarField` | Perlin noise generation | Terrain, surface variation, organic displacement |
| `PoissonDisk` | Blue-noise point sampling | Uniform random scattering without clumping |
| `Scatter` | Object distribution in space | Placing trees, rocks, items on surfaces |
| `Instance` | Instanced object placement | Efficient replication of identical geometry |

### Target State Additions

| Capability | Status | Needed For |
|------------|--------|------------|
| Improved noise (Simplex, Worley) | [planned] | Better terrain and surface detail |
| Spatial hashing / BVH | [planned] | Collision queries for placement |
| Curve operations (offset, boolean) | [planned] | 2D path manipulation |

## SeededRandom [exists]

Deterministic RNG with fork-based hierarchy — critical for reproducibility.

```
Scene seed: 42
  ├── fork("table")     → Table gets its own RNG stream
  ├── fork("chair_0")   → First chair gets its own stream
  ├── fork("chair_1")   → Second chair gets its own stream
  └── fork("chair_2")   → Third chair gets its own stream
```

Adding or removing a chair doesn't change the table's random values. This is what makes Procedurable's output **deterministic and stable under composition changes**.

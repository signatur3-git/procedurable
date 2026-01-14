# Solution Domain - 3D Artist Tools & Techniques

> Standard tools and techniques used by 3D artists.
> We map these to our procedural equivalents.
> Status: ✅ Built & Exposed | 🔧 Built but not DSL-exposed | ⬜ Not built

---

## Overview

This document catalogs the **solution space** - the tools that 3D artists use to create
content. For each tool, we document:
- What it does
- Where it's used (which domains from PROBLEM_DOMAIN.md)
- Our implementation status
- Dependencies on other tools

---

## Missing-from-v1 reminder

A real procedural “virtual artist” toolkit isn’t only about mesh generation.
Artists rely heavily on:
- **UVs & texel density** (to make materials believable)
- **Normals control + beveling** (to make hard-surface assets look real)
- **Deformers** (bend/twist/taper/noise) for “not too perfect”
- **Constraints and packing** (avoid interpenetration; plausible layout)
- **Optimization & LODs** (shipping assets)
- **Export/pipeline artifacts** (glTF, colliders, sockets, metadata)

We list these explicitly below.

---

## Tool Categories

### Category 1: Primitive Generation

Basic shape creation - the building blocks.

#### 1.1 Box/Cube
**What it does:** Creates 6-sided rectangular solid
**Used in:** Furniture, Architecture, everything
**Status:** ✅ Built & Exposed (`MeshOperations.createBox`)
**DSL:** Not directly exposed (use YAML geometry)
**Dependencies:** None

#### 1.2 Sphere
**What it does:** Creates spherical mesh
**Used in:** Decorative elements, heads (base), planets
**Status:** ✅ Built (`MeshOperations.createSphere`)
**DSL:** Not directly exposed
**Dependencies:** None

#### 1.3 Cylinder
**What it does:** Creates cylindrical mesh
**Used in:** Legs, posts, pipes
**Status:** ✅ Built (via loft of circle loops)
**DSL:** Not directly exposed (use loft)
**Dependencies:** Edge loops

#### 1.4 Icosphere
**What it does:** Subdivision-friendly sphere (triangles)
**Used in:** Organic shapes, heads
**Status:** 🔧 Built (`createIcosphere` in Subdivision.ts)
**DSL:** Not exposed
**Dependencies:** Subdivision

---

### Category 2: Profile-Based Generation

Creating 3D shapes from 2D profiles.

#### 2.1 Loft / Skin
**What it does:** Create surface between multiple edge loops
**Used in:** Chair legs, table legs, any tapered forms
**Status:** ✅ Built & Used (`loftLoops` in TracedBuilder)
**DSL:** Via YAML `loft:` geometry command
**Dependencies:** Edge loops

#### 2.2 Lathe / Revolve
**What it does:** Spin 2D profile around axis to create rotational solid
**Used in:** Vases, bottles, cups, balusters, table legs
**Status:** ✅ Built & Exposed (YAML `lathe:`)
**DSL:** YAML geometry command
**Dependencies:** Profiles

#### 2.3 Sweep / Extrude Along Path
**What it does:** Move profile along a curve, creating tube-like surface
**Used in:** Pipes, cables, organic tubes, handles, handrails
**Status:** ✅ Built & Exposed (YAML `sweep:`)
**DSL:** YAML geometry command
**Dependencies:** Spline paths, profiles

#### 2.4 Extrude (Linear)
**What it does:** Push 2D shape along straight line to create 3D
**Used in:** Text, architectural moldings, mechanical parts
**Status:** ✅ Built (`MeshOperations.extrude`)
**DSL:** Via YAML but limited to edge loops
**Dependencies:** 2D shapes (for full use)

#### 2.5 2D Shape Primitives
**What it does:** Create 2D outlines (rect, circle, polygon, bezier)
**Used in:** Base for extrusion, text, patterns
**Status:** ⬜ Not built as DSL-accessible
**DSL:** ⬜ NEEDS IMPLEMENTATION
**Dependencies:** None

#### 2.6 2D Boolean Operations
**What it does:** Union, subtract, intersect 2D shapes
**Used in:** Complex profiles, text with holes
**Status:** ⬜ Not built
**DSL:** ⬜ NEEDS IMPLEMENTATION
**Dependencies:** 2D shapes

---

### Category 3: Splines & Curves

#### 3.1 Spline Evaluation & Frames
**What it does:** Smooth curve evaluation + tangent/frame generation
**Used in:** Sweep paths; future text-on-path
**Status:** ✅ Built & Exposed (YAML `splines:` + Spline.getFrame)
**DSL:** YAML section
**Dependencies:** Vec3

#### 3.2 Bezier Spline
**What it does:** Smooth curve through control points
**Used in:** Profiles for lathe, paths for sweep, organic shapes
**Status:** 🔧 Built (`Spline.ts`)
**DSL:** ⬜ Not exposed - NEEDS DSL COMMAND
**Dependencies:** None

```text
// Current implementation (abridged)
export class Spline {
  static fromPoints(points: Vec3[], closed?: boolean): Spline
  evaluate(t: number): Vec3
  tangent(t: number): Vec3
}
```

#### 3.3 Profile Definition
**What it does:** Define 2D cross-section for sweeping
**Used in:** Lathe profiles, sweep cross-sections
**Status:** 🔧 Built (`Profiles` in Sweep.ts)
**DSL:** ⬜ Not exposed
**Dependencies:** None

---

### Category 4: Subdivision & Smoothing

#### 4.1 Catmull-Clark Subdivision
**What it does:** Smooth low-poly mesh into organic surface
**Used in:** Characters, cushions, organic furniture
**Status:** ✅ Built & Exposed (YAML `subdivide:`)
**DSL:** YAML geometry command
**Dependencies:** Base mesh

#### 4.2 Edge Crease / Sharp Edges
**What it does:** Mark edges to stay sharp during subdivision
**Used in:** Mechanical parts with subdivision, character eyelids
**Status:** ⬜ Not built
**DSL:** ⬜ NEEDS IMPLEMENTATION
**Dependencies:** Subdivision

#### 4.3 Loop Subdivision (Triangles)
**What it does:** Subdivision for triangle meshes
**Used in:** Imported triangle meshes
**Status:** ⬜ Not built (Catmull-Clark handles quads)
**DSL:** ⬜ Not needed if we control topology
**Dependencies:** None

---

### Category 5: Boolean CSG (3D)

Constructive Solid Geometry operations.

#### 5.1 Union
**What it does:** Combine two meshes into one solid
**Used in:** Assembling parts, T-junctions
**Status:** ⬜ Not built
**DSL:** ⬜ NEEDS IMPLEMENTATION
**Dependencies:** Mesh intersection algorithm

#### 5.2 Subtract (Difference)
**What it does:** Cut one mesh from another
**Used in:** Windows in walls, keyholes, grooves
**Status:** ⬜ Not built
**DSL:** ⬜ NEEDS IMPLEMENTATION
**Dependencies:** Mesh intersection algorithm

#### 5.3 Intersect
**What it does:** Keep only overlapping volume
**Used in:** Complex shapes, trimming
**Status:** ⬜ Not built
**DSL:** ⬜ NEEDS IMPLEMENTATION
**Dependencies:** Mesh intersection algorithm

**Implementation Options:**
1. Port a library (csg.js, OpenCSG concepts)
2. Implement from scratch (complex, error-prone)
3. Use external tool and bridge (breaks agent-only goal)

**Recommendation:** Port simplified csg.js approach

---

### Category 6: Instancing & Arrays

Repeating elements efficiently.

#### 6.1 Linear Array
**What it does:** Repeat element along line
**Used in:** Fence posts, shelf dividers, stair treads
**Status:** ✅ Built (YAML `repeat:` construct)
**DSL:** Via YAML repeat with transform
**Dependencies:** Composition

#### 6.2 Radial Array (first-class)
**What it does:** Repeat element around a center/axis
**Used in:** Gear teeth, petals, spokes
**Status:** ⬜ Not built
**DSL:** ⬜ SHOULD be first-class (repeat+sin/cos is too verbose for agents)
**Dependencies:** Transform

#### 6.3 Scatter / Packing
**What it does:** Place instances on surfaces / volumes with collision avoidance
**Used in:** Set dressing, foliage, tabletop clutter
**Status:** ⬜ Not built
**DSL:** ⬜ NEEDS IMPLEMENTATION
**Dependencies:** Random, constraints

---

### Category 7: Materials & Texturing

Surface appearance.

#### 7.1 Vertex Colors
**What it does:** Per-vertex RGB color
**Used in:** Simple coloring, per-part materials
**Status:** ✅ Built & Working
**DSL:** Via YAML `color:` on geometry
**Dependencies:** None

#### 7.2 Named Material Library
**What it does:** Predefined colors/materials by name
**Used in:** Consistent wood tones, metal colors
**Status:** ✅ Built (`MaterialLibrary.ts`)
**DSL:** Via `$material_name` syntax
**Dependencies:** None

#### 7.3 Conditional Materials
**What it does:** Material changes based on decisions
**Used in:** Wood type affects color, weathered variants
**Status:** ✅ Built (when/default in YAML materials)
**DSL:** Via YAML materials section
**Dependencies:** Decisions system

#### 7.4 Map Baking (Mesh-Derived)
**What it does:** Generate AO, curvature, height maps from geometry
**Used in:** Smart materials, wear effects
**Status:** ✅ Built (`MeshMapBaker.ts`)
**DSL:** `material.bake-maps`, `material.maps`
**Dependencies:** Mesh with normals

#### 7.5 Layer Stack System
**What it does:** Combine multiple material layers with masks
**Used in:** Complex materials, wear, dirt
**Status:** ⬜ Not built
**DSL:** ⬜ NEEDS IMPLEMENTATION
**Dependencies:** Map baking

#### 7.6 PBR Textures (Roughness, Metalness, Normal)
**What it does:** Physically-based rendering textures
**Used in:** Realistic materials
**Status:** ⬜ Partially (we have maps, not PBR output)
**DSL:** ⬜ NEEDS IMPLEMENTATION
**Dependencies:** Layer stack

#### 7.7 Procedural Textures (Noise, Patterns)
**What it does:** Generate textures mathematically
**Used in:** Wood grain, marble, fabric patterns
**Status:** ⬜ Not built
**DSL:** ⬜ NEEDS IMPLEMENTATION
**Dependencies:** Math expressions

---

### Category 8: Text & Typography

Text rendering for signs, labels, engravings.

#### 8.1 Text to 2D Path
**What it does:** Convert string + font to 2D outline
**Used in:** Signs, labels, engravings
**Status:** ⬜ Not built
**DSL:** ⬜ NEEDS IMPLEMENTATION
**Dependencies:** Font parsing library

#### 8.2 Text Along Curve
**What it does:** Place text following a curved path
**Used in:** Circular labels, flowing text
**Status:** ⬜ Not built
**DSL:** ⬜ NEEDS IMPLEMENTATION
**Dependencies:** Text to path, splines

**Implementation Options:**
1. opentype.js - Parse fonts, get glyph outlines
2. Simple built-in font (pixel-art style letters)
3. Pre-defined glyph library for common characters

**Recommendation:** Start with opentype.js for flexibility

---

### Category 9: Branching & L-Systems

Organic branching structures.

#### 9.1 L-System Grammar
**What it does:** Generate branching patterns via string rewriting
**Used in:** Trees, plants, coral, fractals
**Status:** ⬜ Not built
**DSL:** ⬜ NEEDS IMPLEMENTATION
**Dependencies:** Grammar parser, turtle graphics

#### 9.2 Branch Geometry
**What it does:** Convert L-system output to 3D branches
**Used in:** Tree trunks, limbs
**Status:** ⬜ Not built (sweep could help)
**DSL:** ⬜ NEEDS IMPLEMENTATION
**Dependencies:** Sweep, L-system

#### 9.3 Leaf/Flower Placement
**What it does:** Attach leaves at branch endpoints
**Used in:** Foliage
**Status:** ⬜ Not built
**DSL:** ⬜ NEEDS IMPLEMENTATION
**Dependencies:** Branching, instancing

---

### Category 10: Cloth & Soft Bodies

Fabric simulation and draping.

#### 10.1 2D Pattern to 3D
**What it does:** Take flat pattern pieces, stitch, drape
**Used in:** Clothing, upholstery
**Status:** ⬜ Not built
**DSL:** ⬜ NEEDS IMPLEMENTATION - COMPLEX
**Dependencies:** Physics simulation or approximation

#### 10.2 Static Drape
**What it does:** Approximate draped fabric without simulation
**Used in:** Tablecloths, curtains, simple clothing
**Status:** ⬜ Not built
**DSL:** ⬜ NEEDS IMPLEMENTATION
**Dependencies:** Deformation system

#### 10.3 Seam Definition
**What it does:** Define how pattern pieces connect
**Used in:** Clothing construction
**Status:** ⬜ Not built
**DSL:** ⬜ NEEDS IMPLEMENTATION
**Dependencies:** 2D patterns

**Recommendation:** Start with static drape approximation, not full physics

---

### Category 11: Character-Specific

Tools specifically for humanoid/creature creation.

#### 11.1 Anatomical Proportions
**What it does:** Define body measurements in head units
**Used in:** Human figures
**Status:** 🔧 Built (`HumanProportions` in PersonBuilder.ts)
**DSL:** ⬜ Not exposed
**Dependencies:** None

#### 11.2 Limb Segments
**What it does:** Create tapered limb sections
**Used in:** Arms, legs
**Status:** 🔧 Built (`createLimbSegment` in Sweep.ts)
**DSL:** ⬜ Not exposed
**Dependencies:** Sweep

#### 11.3 Animation-Ready Topology
**What it does:** Edge loops at joints for deformation
**Used in:** Rigged characters
**Status:** ⬜ Not built (requires careful mesh construction)
**DSL:** ⬜ NEEDS IMPLEMENTATION
**Dependencies:** Subdivision, topology control

---

### Category 12: UVs & Texture Space (MAJOR MISSING PILLAR)

> Without UVs, we can’t realistically use most texture workflows.

#### 12.1 UV generation for generated geometry
**What it does:** Creates UV coordinates for primitives, lathes, sweeps, extrusions
**Used in:** Materials, decals, texturing
**Status:** ⬜ Not built
**DSL:** ⬜ NEEDS IMPLEMENTATION
**Dependencies:** Mesh topology, seams

#### 12.2 Seam marking & unwrap
**What it does:** Mark seams; perform unwrap (angle-based / LSCM-style)
**Used in:** Clothing seams, organic unwrapping, hard-surface unwrap
**Status:** ⬜ Not built
**DSL:** ⬜ NEEDS IMPLEMENTATION
**Dependencies:** UV islanding + pack

#### 12.3 UV packing & texel density
**What it does:** Pack islands + enforce consistent texel density
**Used in:** Real production assets
**Status:** ⬜ Not built
**DSL:** ⬜ NEEDS IMPLEMENTATION
**Dependencies:** Unwrap

---

### Category 13: Hard-Surface Finishing (Bevels + Normals)

Artists bevel almost everything to catch highlights.

#### 13.1 Bevel / Chamfer
**What it does:** Adds edge bevels with segments
**Used in:** Devices, architecture trim, mechanical parts, furniture edges
**Status:** ⬜ Not built
**DSL:** ⬜ NEEDS IMPLEMENTATION
**Dependencies:** Topology ops

#### 13.2 Auto-smooth / hard edges
**What it does:** Split normals by angle threshold; smoothing groups
**Used in:** Hard-surface assets
**Status:** ⬜ Partially (we calculate normals, but no hard-edge control)
**DSL:** ⬜ NEEDS IMPLEMENTATION
**Dependencies:** Mesh normals

#### 13.3 Weighted normals
**What it does:** Face-weighted normals for better shading
**Used in:** Low poly hard-surface that must shade well
**Status:** ⬜ Not built
**DSL:** ⬜ NEEDS IMPLEMENTATION
**Dependencies:** Normals

---

### Category 14: Deformers & Non-Perfectness

Procedural assets look “CG perfect” without controlled irregularity.

#### 14.1 Bend / Twist / Taper
**What it does:** Parametric deformations
**Used in:** Cables, cloth-ish folds, stylized shapes
**Status:** ⬜ Not built
**DSL:** ⬜ NEEDS IMPLEMENTATION
**Dependencies:** Transforms

#### 14.2 Noise displacement
**What it does:** Adds subtle surface variation
**Used in:** Wood imperfections, rocks, terrain-ish surfaces
**Status:** ⬜ Not built
**DSL:** ⬜ NEEDS IMPLEMENTATION
**Dependencies:** Noise

#### 14.3 Shrinkwrap / surface projection
**What it does:** Project mesh/points onto a target surface
**Used in:** Decals, clothing placement, embossing
**Status:** ⬜ Not built
**DSL:** ⬜ NEEDS IMPLEMENTATION
**Dependencies:** Spatial queries

---

### Category 15: Constraints, Collision Avoidance & Layout

This is essential for “builders that behave like artists” at scene level.

#### 15.1 Collision queries
**What it does:** AABB/OBB checks, distance to surface, ray casts
**Used in:** Chair placement around tables; clutter placement
**Status:** ⬜ Not built
**DSL:** ⬜ NEEDS IMPLEMENTATION
**Dependencies:** Spatial acceleration

#### 15.2 Packing / spacing constraints
**What it does:** Place N objects with min distance and avoid intersections
**Used in:** DiningScene (chairs), set dressing
**Status:** ⬜ Not built
**DSL:** ⬜ NEEDS IMPLEMENTATION
**Dependencies:** Collision queries, seeded randomness

#### 15.3 Structural plausibility checks
**What it does:** Stability heuristics, thickness minimums, clearances
**Used in:** Furniture, architecture
**Status:** ⬜ Not built
**DSL:** ⬜ NEEDS IMPLEMENTATION
**Dependencies:** Measurements, validation

---

### Category 16: Geometry Cleanup, Optimization & LOD

#### 16.1 Weld / merge / remove doubles
**What it does:** Merge near-identical vertices; cleanup
**Used in:** Boolean output cleanup; general robustness
**Status:** ⬜ Not built
**DSL:** ⬜ NEEDS IMPLEMENTATION
**Dependencies:** Mesh topology

#### 16.2 Simplify / decimate
**What it does:** Reduce polycount; generate LODs
**Used in:** Production assets
**Status:** ⬜ Not built
**DSL:** ⬜ NEEDS IMPLEMENTATION
**Dependencies:** Mesh metrics

#### 16.3 Remesh / relax
**What it does:** Improve triangle quality / even out topology
**Used in:** Organic meshes, post-boolean cleanup
**Status:** ⬜ Not built
**DSL:** ⬜ NEEDS IMPLEMENTATION
**Dependencies:** Mesh ops

---

### Category 17: Export & Pipeline Artifacts

Builders should eventually output more than a render mesh.

#### 17.1 glTF export (mesh + materials)
**What it does:** Export assets for downstream engines
**Used in:** Deployment, interchange
**Status:** ⬜ Not built
**DSL:** ⬜ NEEDS IMPLEMENTATION
**Dependencies:** Material system, UVs

#### 17.2 Colliders
**What it does:** Generate simplified collision shapes
**Used in:** Games/sims
**Status:** ⬜ Not built
**DSL:** ⬜ NEEDS IMPLEMENTATION
**Dependencies:** Mesh analysis

#### 17.3 Sockets / attachment points
**What it does:** Named transforms for attaching props
**Used in:** Scene building; animation rigs
**Status:** ⬜ Not built
**DSL:** ⬜ NEEDS IMPLEMENTATION
**Dependencies:** Transform system

---

## Status Summary

### Built & Exposed via DSL (✅)
1. Box primitive (via YAML geometry)
2. Loft (via YAML loft command)
3. Lathe (via YAML `lathe:`)
4. Sweep (via YAML `sweep:`)
5. Spline paths (via YAML `splines:`)
6. Subdivision (via YAML `subdivide:`)
7. Linear extrude (via YAML)
8. Repeat/array (via YAML repeat)
9. Vertex colors (via YAML color)
10. Material library (via $material refs)
11. Conditional materials (via YAML when/default)
12. Map baking (via material.* DSL commands)
13. Math expressions (via MathService)
14. Composition (via YAML compose)

### Built but NOT Exposed via DSL (🔧)
1. **Icosphere** - `Subdivision.ts` (useful primitive, not yet YAML)
2. **Sphere** - `MeshOperations.ts` (not direct YAML)
3. **Human Proportions** - `PersonBuilder.ts`
4. **Limb Segments** - `Sweep.ts`

### Not Built (⬜) (selected high-impact items)
- UV generation + unwrap + packing
- Bevel/chamfer + normals control
- 2D shapes + 2D boolean (still the major next geometry block)
- Scatter/packing + collision avoidance
- 3D boolean CSG
- Deformers (bend/twist/taper/noise)
- LOD/decimation
- glTF export + colliders + sockets

---

## Recommendations (updated)

1. **2D Shapes next** (P2-M2): unlocks gears, signage, moldings.
2. Add **UVs + bevel + normals** before serious hard-surface domains (devices, architecture).
3. Add **constraints/packing** early for believable scenes (fix chair overlap class of problems).
4. Treat export artifacts (glTF/colliders/sockets) as first-class builder outputs (Phase 2.5+).

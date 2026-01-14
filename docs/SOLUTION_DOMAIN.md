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

### Category 18: Retopology & Mesh Quality

> Procedural geometry often produces suboptimal topology. Retopology creates animation-friendly meshes.

#### 18.1 Quad remesh
**What it does:** Convert arbitrary mesh to clean quad-dominant topology
**Used in:** Post-boolean cleanup, subdivision prep, character bodies
**Status:** ⬜ Not built (Phase 3)
**Complexity:** XL

#### 18.2 Edge loop insertion / sliding
**What it does:** Add edge loops at specific locations for deformation
**Used in:** Joint areas (elbows, knees), animation-ready topology
**Status:** ⬜ Not built (Phase 3)

#### 18.3 Topology transfer / projection
**What it does:** Project high-res detail onto low-res base mesh
**Used in:** LOD creation, normal map baking source
**Status:** ⬜ Not built (Phase 3)

---

### Category 19: Mesh Repair & Validation

> Boolean ops and complex geometry can produce invalid meshes.

#### 19.1 Hole detection & filling
**What it does:** Find boundary edges and fill holes
**Used in:** Post-boolean cleanup, watertight meshes
**Status:** ⬜ Not built (needed with P2-M5 CSG)

#### 19.2 Non-manifold detection & repair
**What it does:** Find and fix edges with >2 faces, isolated vertices
**Used in:** Mesh validation before export
**Status:** ⬜ Not built

#### 19.3 Normal repair / consistency
**What it does:** Ensure all face normals point outward consistently
**Status:** ⬜ Partial (we calculate normals but don't repair flipped faces)

#### 19.4 Degenerate face removal
**What it does:** Remove zero-area triangles, colinear edges
**Status:** ⬜ Not built

---

### Category 20: Blend Shapes & Interpolation

> Enable smooth transitions between mesh variants (ethnicities, expressions, body types).

#### 20.1 Morph target storage
**What it does:** Store multiple vertex position sets for same topology mesh
**Used in:** Facial expressions, body type morphs, ethnicity blending
**Status:** ⬜ Not built (Phase 2.5 - before Characters)
**Dependencies:** Mesh must have stable vertex indices

#### 20.2 Blend shape interpolation
**What it does:** Linearly interpolate between morph targets
**Used in:** Ethnicity slider (0.0 = archetype A, 1.0 = archetype B)
**Status:** ⬜ Not built

#### 20.3 Corrective blend shapes
**What it does:** Apply corrections when multiple morphs combine
**Status:** ⬜ Not built (Phase 3)

**Design Decision:**
- **Option A (Recommended):** Store archetype meshes with identical topology, interpolate vertices
  - Pros: Simple math, glTF morph target compatible
  - Cons: Requires identical vertex count/order
- **Option B:** Store parametric modifiers, regenerate mesh
  - Pros: More flexible
  - Cons: Topology may change, harder to blend

---

### Category 21: Rigging & Skeletal Systems (Phase 3)

> Enable deformation and posing of meshes.

#### 21.1 Skeleton definition
**What it does:** Define bone hierarchy with transforms
**Status:** ⬜ Not built (Phase 3)
**Phase 2 Foundation:** Add bone indices + weights to Vertex class now.

#### 21.2 Automatic weight painting
**What it does:** Assign vertex weights to bones based on proximity
**Status:** ⬜ Not built (Phase 3)

#### 21.3 Skinning deformation (LBS / DQS)
**What it does:** Deform mesh based on bone transforms + weights
**Status:** ⬜ Not built (Phase 3)

#### 21.4 Inverse kinematics (IK)
**What it does:** Compute bone chain to reach target position
**Status:** ⬜ Not built (Phase 3)

---

### Phase 2 Foundation for Phase 3
Must be designed/stubbed in Phase 2:
1. Extended Vertex class with optional bone/weight/tangent/uv fields
2. Mesh.morphTargets storage (Map<string, Vec3[]>)
3. Mesh.skeleton reference (null until Phase 3)
4. Material.density property (for mass calculation)
5. Volume calculation for closed meshes

---

### Category 21: Fields (Scalar & Vector)

Continuous value functions over space for natural variation.

#### 21.1 Scalar Fields
**What it does:** `f(x,y,z) -> number` functions
**Used in:** Terrain height, moisture, temperature, density masks
**Status:** ⬜ Not built (P2-M2c)
**DSL:** ⬜ NEEDS IMPLEMENTATION (field definitions in YAML)
**Dependencies:** Math functions, noise

#### 21.2 Vector Fields
**What it does:** `f(x,y,z) -> Vec2/Vec3` functions
**Used in:** Wind direction, river flow, hair orientation
**Status:** ⬜ Not built (P2-M2c)
**DSL:** ⬜ NEEDS IMPLEMENTATION
**Dependencies:** Scalar fields

#### 21.3 Field Composition
**What it does:** Combine fields (add, multiply, remap, clamp)
**Used in:** Biome blending, masked scattering
**Status:** ⬜ Not built (P2-M2c)
**DSL:** ⬜ NEEDS IMPLEMENTATION
**Dependencies:** Field types

#### 21.4 Field Sampling
**What it does:** Query field values at specific points
**Used in:** Terrain generation, scatter placement
**Status:** ⬜ Not built (P2-M2c)
**DSL:** ⬜ NEEDS IMPLEMENTATION
**Dependencies:** Field composition

---

### Category 22: Scatter & Point Sampling

Distributing points/objects naturally.

#### 22.1 Poisson Disk Sampling
**What it does:** Generate points with minimum distance constraint
**Used in:** Natural object placement (trees, rocks, clutter)
**Status:** ⬜ Not built (P2-M2c)
**DSL:** ⬜ NEEDS IMPLEMENTATION
**Dependencies:** Random, spatial queries

#### 22.2 Field-Driven Scatter
**What it does:** Density controlled by scalar field
**Used in:** Forests avoid slopes, rocks near ridges
**Status:** ⬜ Not built (P2-M2c)
**DSL:** ⬜ NEEDS IMPLEMENTATION
**Dependencies:** Fields, Poisson disk

#### 22.3 Collision-Aware Scatter
**What it does:** Avoid overlapping with existing objects
**Used in:** Set dressing, furniture placement
**Status:** ⬜ Not built (P2-M2c)
**DSL:** ⬜ NEEDS IMPLEMENTATION
**Dependencies:** AABB, spatial indexing

---

### Category 23: Instancing & Performance

Efficient rendering of many objects.

#### 23.1 Instance Representation
**What it does:** Store transforms + builder refs instead of merged meshes
**Used in:** Large scenes, repeated elements
**Status:** ⬜ Not built (P2-M2c)
**DSL:** ⬜ NEEDS IMPLEMENTATION
**Dependencies:** Composition system

#### 23.2 Instance Rendering
**What it does:** Dashboard support for non-merged instances
**Used in:** Visualizing scattered objects
**Status:** ⬜ Not built (P2-M2c)
**DSL:** ⬜ NEEDS IMPLEMENTATION
**Dependencies:** Instance representation

#### 23.3 Instance Culling
**What it does:** Hide instances outside view/camera
**Used in:** Performance in large worlds
**Status:** ⬜ Not built (P2-M2c)
**DSL:** ⬜ NEEDS IMPLEMENTATION
**Dependencies:** Instance rendering

---

### Category 24: Chunking & Streaming

Dividing worlds into manageable pieces.

#### 24.1 Coordinate-Based Seeding
**What it does:** Deterministic seed from world coordinates
**Used in:** Reproducible chunks, infinite worlds
**Status:** ✅ Built (`coordinateHash()` in MathService)
**DSL:** ⬜ NEEDS DSL COMMAND
**Dependencies:** Hash function

#### 24.2 Chunk Contract
**What it does:** Query-based generation API
**Used in:** `getChunk(cx, cy, lod)`, `sampleHeight(x,z)`
**Status:** ⬜ Not built (P2-M2c design)
**DSL:** ⬜ NEEDS IMPLEMENTATION
**Dependencies:** Coordinate seeding

#### 24.3 Chunk Management
**What it does:** Load/unload regions, cache eviction
**Used in:** Memory management for large worlds
**Status:** ⬜ Not built (P2-M2c)
**DSL:** ⬜ NEEDS IMPLEMENTATION
**Dependencies:** Chunk contract

#### 24.4 Seamless Boundaries
**What it does:** Ensure chunk edges match perfectly
**Used in:** Terrain continuity, road connections
**Status:** ⬜ Not built (P2-M2c)
**DSL:** ⬜ NEEDS IMPLEMENTATION
**Dependencies:** Chunk management

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
1. **Icosphere** - `Subdivision.ts`
2. **Sphere** - `MeshOperations.ts`
3. **Human Proportions** - `PersonBuilder.ts`
4. **Limb Segments** - `Sweep.ts`

### Not Built - Phase 2 (⬜)
- UV generation + unwrap + packing
- Bevel/chamfer + normals control
- 2D shapes + 2D boolean
- Scatter/packing + collision avoidance
- 3D boolean CSG + mesh repair
- Deformers (bend/twist/taper/noise)
- LOD/decimation
- glTF export + colliders + sockets
- Blend shapes / morph targets

### Not Built - Phase 3 (⬜)
- Retopology (quad remesh, edge loops)
- Rigging (skeleton, weights, skinning, IK)
- Animation (keyframes, clips, curves)
- Physics (mass, dynamics, multibody, baking)

### Phase 2 Foundation for Phase 3
Must be designed/stubbed in Phase 2:
1. Extended Vertex class with optional bone/weight/tangent/uv fields
2. Mesh.morphTargets storage (Map<string, Vec3[]>)
3. Mesh.skeleton reference (null until Phase 3)
4. Material.density property (for mass calculation)
5. Volume calculation for closed meshes

---

## Recommendations (updated)

1. **Constraints/Packing next** (P2-M2): fixes scene quality.
2. **2D Shapes** (P2-M3): unlocks gears, signage, moldings.
3. **UVs + bevel + normals** before hard-surface domains.
4. **Mesh repair** alongside CSG (P2-M5).
5. **Blend shapes** before Characters (P2-M9).
6. **Extend Vertex/Mesh classes** early with optional Phase 3 fields.
7. **Rigging + Animation + Physics** are Phase 3.
8. Design all structures to be **glTF-export compatible**.
9. **P2-M2c World Foundations** as critical path for believable scenes/worlds.

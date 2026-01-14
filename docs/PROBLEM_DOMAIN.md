# Problem Domain - What We Want to Build

> Catalog of target builders/scenes organized by domain.
> Each entry describes visual requirements, variation needs, and quality expectations.
> This drives our tool development - we build tools to create these, not tools in isolation.

---

## Overview

We organize target outputs into **domains** (categories of 3D content). Each domain has:
- **Example Builders**: Specific procedural generators to create
- **Visual Requirements**: What it needs to look like
- **Variation Axes**: What should change between seeds
- **Quality Bar**: Minimum acceptable output quality

---

## Core Principle: We build builders (virtual artists), not static models

A Procedurable builder should behave like a **virtual artist**:
- It makes a *stack of decisions* (style, proportions, composition, materials, wear)
- It enforces plausibility constraints (clearances, stability, scale)
- It reuses motifs and families (scene cohesion)
- It can expose/override decisions and keep determinism (seed → same result)

This implies our problem domain must define:
1. **What outputs to generate** (builders/scenes)
2. **What decision space** the builder should cover
3. **What artifacts** a builder may output besides the render mesh

---

## Decision Taxonomy (artist-like decision layers)

These are cross-domain decision types that most builders eventually need.

### A. Art Direction / Style Decisions (global consistency)
- Style archetype: modern / rustic / industrial / vintage / sci-fi / etc.
- Shape language: boxy vs rounded vs tapered vs chunky
- Motifs: ribbing, paneling, slats, insets, fillets
- Palette: coordinated color palette across a scene
- Material palette: wood species + metal type + fabric family

### B. Proportion & Ergonomics Decisions (human scale plausibility)
- Real-world dimension families (chair seat height, door widths, stair rise/run)
- Thickness minimums (structural plausibility)
- Clearance rules (drawer/door swings, leg room)

### C. Composition Decisions (scene-level)
- Reuse families (one chair design repeated; rare outlier)
- Spacing rules (avoid interpenetration; maintain walkways)
- Orientation rules (chairs face table center)
- Clutter density and clustering (storytelling)

### D. Material & Aging Decisions
- New → used spectrum: scratches, dents, dirt, patina
- Wear placement: corners/edges vs protected areas
- Cleanliness level (kitchen vs garage)

### E. Production / Output Decisions
- LOD tier: low/med/high poly
- Where to spend detail (hero side vs hidden side)
- UV density targets (texel density)

### F. Semantics & Metadata Decisions
- Part tagging (wood/metal/glass), functional zones
- Attachment points/sockets (grab points, mounting points)
- Collider strategy (simple boxes vs convex hull)

---

## Builder Output Artifacts (beyond the render mesh)

Over time, builders may output additional artifacts:
- **UVs** (and texel density hints)
- **Material sets** (albedo/roughness/metalness/normal/AO)
- **Baked maps** (AO/curvature/position/thickness)
- **Sockets / anchors** (attachment transforms)
- **Collision meshes** (simple shapes)
- **LOD meshes** (multiple poly budgets)
- **Semantic tags** for parts/faces/regions

---

## Domain 0: Environments & World-Building (NEW)

> These are scene builders (not single props). They stress layout constraints, composition, and reuse.

### Target Builders

#### 0.1 Room Layout (Multi-Room)
**Visual Requirements:**
- Connected rooms with plausible door placement
- Walls with thickness (eventually)
- Optional corridor/hallway

**Variation Axes:**
- Topology graph (1-room studio → 3-6 rooms)
- Room sizes and proportions
- Door count/placement
- Style theme and palette

**Quality Bar:** Navigable layout; no impossible doors

**Tools Needed:** composition, constraints, (later) 3D boolean for openings

---

#### 0.2 Streetscape Block (lightweight)
**Visual Requirements:**
- Ground plane, sidewalk, street
- Repeated props (lamps, benches, signs)
- Sparse vegetation

**Variation Axes:**
- Density (empty → cluttered)
- Prop families and repetition
- Material palette and style

**Quality Bar:** Cohesive and plausible spacing

**Tools Needed:** instancing/scatter, constraints, composition

---

## Domain 1: Furniture (✅ Partially Complete)

### Completed Builders
| Builder | Status | Notes |
|---------|--------|-------|
| DiningChair | ✅ YAML | Basic chair with style decisions |
| Table | ✅ YAML | Rectangular + round styles |
| DiningScene | ✅ YAML | Composition of table + chairs |
| WoodChair | ✅ YAML | Material decisions demo |

### Target Builders (Remaining)

#### 1.1 Bookshelf
**Visual Requirements:**
- Multiple shelves at varying heights
- Optional back panel
- Side supports (solid or decorative)
- Books/objects on shelves (composition)

**Variation Axes:**
- Height (short accent → tall floor-to-ceiling)
- Width (narrow → wide)
- Shelf count and spacing
- Style (modern minimal, traditional, industrial)
- Material (wood types, metal, painted)

**Quality Bar:** Proportions look correct, shelves level, materials consistent

**Tools Needed:** ✅ Loft, ✅ Composition, ✅ Materials

---

#### 1.2 Desk
**Visual Requirements:**
- Work surface at proper height
- Optional drawers (left, right, both)
- Leg styles (panel sides, four legs, trestle)
- Cable management holes (optional)

**Variation Axes:**
- Size (compact → executive)
- Drawer configuration
- Leg style
- Material and finish

**Quality Bar:** Ergonomic proportions, drawers look functional

**Tools Needed:** ✅ Loft, ✅ Composition, ⬜ Boolean (drawer cutouts)

---

#### 1.3 Bed
**Visual Requirements:**
- Mattress on frame
- Headboard (various styles)
- Optional footboard
- Bedding (pillows, blanket) - simplified shapes

**Variation Axes:**
- Size (twin → king)
- Headboard style (plain, tufted, slatted)
- Frame style (platform, legs, storage)
- Bedding colors

**Quality Bar:** Recognizable as a bed, proportions match standard sizes

**Tools Needed:** ✅ Loft, ✅ Composition, ✅ Materials, ⬜ Soft body (bedding drape)

---

#### 1.4 Sofa
**Visual Requirements:**
- Seating cushions
- Back cushions
- Armrests
- Frame/legs

**Variation Axes:**
- Size (loveseat → sectional)
- Style (modern, traditional, mid-century)
- Cushion fullness
- Fabric/leather material

**Quality Bar:** Looks comfortable and proportioned

**Tools Needed:** ✅ Loft, ✅ Subdivision (cushion softness), ✅ Materials

---

## Domain 2: Vessels & Containers

### Target Builders

#### 2.1 Vase
**Visual Requirements:**
- Rotational symmetry (lathe-able)
- Spline-defined profile
- Optional decorative elements

**Variation Axes:**
- Height and width ratio
- Profile curve (bulbous, tall, hourglass)
- Neck width
- Material (ceramic, glass, metal)

**Quality Bar:** Smooth curves, holds water visually

**Tools Needed:** ✅ Lathe, ✅ Profiles, ✅ Materials

---

#### 2.2 Bottle
**Visual Requirements:**
- Body, shoulder, neck, lip
- Optional label area
- Cap/cork

**Variation Axes:**
- Type (wine, beer, water, spirits)
- Size
- Glass color (clear, green, brown, blue)

**Quality Bar:** Recognizable bottle type

**Tools Needed:** ✅ Lathe, ✅ Profiles, ✅ Materials (glass shader)

---

#### 2.3 Bowl / Cup / Mug
**Visual Requirements:**
- Container body
- Handle (for mug/cup)
- Rim detail

**Variation Axes:**
- Depth and width
- Handle style
- Material (ceramic, wood, metal)

**Quality Bar:** Looks like it could hold liquid

**Tools Needed:** ✅ Lathe, ✅ Sweep (handles), ✅ Materials

---

## Domain 3: Architecture

### Target Builders

#### 3.1 Simple Room
**Visual Requirements:**
- Floor, walls, ceiling
- Door opening(s)
- Window opening(s)
- Baseboards, crown molding (optional)

**Variation Axes:**
- Room dimensions
- Door/window count and placement
- Wall color/material
- Floor material

**Quality Bar:** Architecturally plausible proportions

**Tools Needed:** ⬜ Extrusion, ⬜ Boolean CSG (openings), ✅ Materials

---

#### 3.2 Door
**Visual Requirements:**
- Door panel with detail
- Frame
- Handle/knob

**Variation Axes:**
- Style (flat, paneled, glass insert)
- Size (interior, exterior, double)
- Material (wood, metal, glass)

**Quality Bar:** Looks like a real door

**Tools Needed:** ⬜ Extrusion, ⬜ Boolean (panels), ✅ Materials

---

#### 3.3 Window
**Visual Requirements:**
- Glass pane(s)
- Frame
- Mullions (optional grid)
- Sill

**Variation Axes:**
- Style (single, double-hung, casement)
- Pane count
- Frame material

**Quality Bar:** Glass reads as transparent/reflective

**Tools Needed:** ⬜ Extrusion, ⬜ Boolean, ✅ Materials (glass)

---

#### 3.4 Staircase
**Visual Requirements:**
- Treads and risers
- Stringers (side supports)
- Handrail and balusters

**Variation Axes:**
- Step count (floor height)
- Width
- Style (open, closed, spiral)
- Material

**Quality Bar:** Correct rise/run ratios, looks climbable

**Tools Needed:** ⬜ Repeat + Transform, ✅ Sweep (handrails), ✅ Materials

---

## Domain 4: Botanical

### Target Builders

#### 4.1 Simple Tree
**Visual Requirements:**
- Trunk with bark texture
- Branching structure
- Foliage mass (simplified or individual leaves)

**Variation Axes:**
- Species (oak, pine, birch, palm)
- Age/size
- Season (full, autumn, bare)
- Health (full, sparse)

**Quality Bar:** Recognizable tree silhouette, natural randomness

**Tools Needed:** ⬜ L-system/branching, ⬜ Sweep (trunk/branches), ⬜ Instancing (leaves), ✅ Materials

---

#### 4.2 Potted Plant
**Visual Requirements:**
- Pot/planter
- Soil visible
- Plant (various types)

**Variation Axes:**
- Pot style and size
- Plant type (succulent, fern, flowering)
- Fullness

**Quality Bar:** Looks alive, pot and plant match scale

**Tools Needed:** ✅ Lathe (pot), ⬜ Branching (stems), ✅ Materials

---

#### 4.3 Flower
**Visual Requirements:**
- Stem
- Leaves
- Petals arranged around center
- Center (stamen, pistil)

**Variation Axes:**
- Species (rose, daisy, tulip)
- Color
- Bloom stage (bud, open, wilting)

**Quality Bar:** Recognizable flower type

**Tools Needed:** ✅ Sweep (stem), ⬜ Radial instancing, ⬜ Petal shapes, ✅ Materials

---

## Domain 5: Mechanical / Industrial

### Target Builders

#### 5.1 Gear
**Visual Requirements:**
- Toothed wheel
- Central bore
- Correct involute tooth profile (simplified OK)

**Variation Axes:**
- Tooth count
- Module (tooth size)
- Width
- Material (steel, brass, plastic)

**Quality Bar:** Teeth look like they could mesh

**Tools Needed:** ⬜ 2D shapes, ⬜ Extrusion, ⬜ Radial array, ✅ Materials

---

#### 5.2 Pipe / Tube Assembly
**Visual Requirements:**
- Cylindrical sections
- Elbows, T-junctions
- Flanges, valves (optional)

**Variation Axes:**
- Diameter
- Route/path
- Fitting types
- Material (copper, PVC, steel)

**Quality Bar:** Looks plumbed correctly

**Tools Needed:** ⬜ Sweep along path, ⬜ Fittings library, ✅ Materials

---

#### 5.3 Simple Machine (Pulley, Lever)
**Visual Requirements:**
- Functional-looking mechanism
- Mounting points
- Moving parts visually distinct

**Variation Axes:**
- Size
- Material
- Wear/age

**Quality Bar:** Looks like it could work

**Tools Needed:** ⬜ Lathe, ⬜ Boolean, ⬜ Composition, ✅ Materials

---

## Domain 6: Signage & Text

### Target Builders

#### 6.1 Wall Sign / Plaque
**Visual Requirements:**
- Background panel
- Raised or engraved text/symbols
- Mounting hardware (optional)

**Variation Axes:**
- Text content
- Font style
- Material (wood, metal, plastic)
- Shape (rectangle, oval, custom)

**Quality Bar:** Text is legible, material looks authentic

**Tools Needed:** ⬜ 2D text to path, ⬜ Extrusion, ⬜ Boolean (engraving), ✅ Materials

---

#### 6.2 Standing Sign
**Visual Requirements:**
- Sign panel
- Post/stand
- Optional lighting

**Variation Axes:**
- Height
- Sign content
- Style (rustic, modern, vintage)

**Quality Bar:** Proportions correct, stable-looking

**Tools Needed:** ⬜ 2D text, ⬜ Extrusion, ⬜ Composition, ✅ Materials

---

## Domain 7: Clothing & Fabric

### Target Builders

#### 7.1 Simple Shirt (T-shirt)
**Visual Requirements:**
- Body tube
- Sleeves
- Neckline
- Hem details

**Variation Axes:**
- Size (fitted, loose)
- Sleeve length
- Neckline type (crew, v-neck)
- Color/pattern

**Quality Bar:** Looks wearable, drapes naturally

**Tools Needed:** ⬜ 2D patterns, ⬜ Cloth drape, ⬜ Seams, ✅ Materials (fabric)

---

#### 7.2 Pants / Trousers
**Visual Requirements:**
- Two leg tubes
- Waistband
- Pockets (optional)
- Fly front

**Variation Axes:**
- Fit (slim, regular, wide)
- Length
- Style (jeans, dress, casual)

**Quality Bar:** Proportioned to human, looks wearable

**Tools Needed:** ⬜ 2D patterns, ⬜ Cloth drape, ⬜ Seams, ✅ Materials

---

#### 7.3 Hat / Cap
**Visual Requirements:**
- Crown
- Brim (optional)
- Band (optional)

**Variation Axes:**
- Style (baseball cap, fedora, beanie)
- Size
- Material

**Quality Bar:** Fits on head, style is recognizable

**Tools Needed:** ✅ Subdivision, ✅ Lathe, ✅ Materials

---

## Domain 8: Characters (Capstone)

### Target Builders

#### 8.1 Person (Adult Human)
**Visual Requirements:**
- Anatomically proportioned body
- Head with facial features
- Hands with fingers
- Feet
- Proper edge loop topology

**Variation Axes:**
- Body type (slim, average, muscular, heavy)
- Height
- Gender expression
- Age indicators
- Pose (standing, sitting)

**Quality Bar:** Professional-quality humanoid, not uncanny valley

**Tools Needed:** ALL - Subdivision, Sweep, Materials, Composition, Cloth (clothes)

---

#### 8.2 Simplified Character (Stylized/Cartoon)
**Visual Requirements:**
- Recognizable humanoid
- Exaggerated proportions OK
- Simple hands (mittens OK)
- Expressive face

**Variation Axes:**
- Style (chibi, Pixar-like, geometric)
- Personality expression
- Colors

**Quality Bar:** Appealing, consistent style

**Tools Needed:** ✅ Subdivision, ✅ Materials, less anatomical precision

---

#### 8.3 Animal (Quadruped)
**Visual Requirements:**
- Four-legged body plan
- Head appropriate to species
- Tail
- Fur/skin texture

**Variation Axes:**
- Species (dog, cat, horse, etc.)
- Breed within species
- Size
- Coloring

**Quality Bar:** Recognizable species, appealing

**Tools Needed:** ✅ Subdivision, ✅ Sweep, ⬜ Fur/hair system (later), ✅ Materials

---

## Domain 9: Set Dressing & Clutter (NEW)

> Small objects that make scenes believable.

### Target Builders

#### 9.1 Tabletop Clutter Set
**Visual Requirements:**
- Group of small objects (cups, plates, cutlery, napkin)
- Coherent style set (same family)

**Variation Axes:**
- Density (minimal → messy)
- Object families (matching set)
- Wear/cleanliness

**Quality Bar:** No intersections; objects rest on surfaces

**Tools Needed:** instancing/scatter with collision avoidance, composition

---

#### 9.2 Books / Papers
**Visual Requirements:**
- Stacks, piles, shelf fill
- Randomness but stable

**Variation Axes:**
- Stack height, lean, disorder
- Variation in thickness/size

**Quality Bar:** Looks like gravity applies

**Tools Needed:** constraints/packing, simple deformation (bend)

---

## Domain 10: Devices & Electronics (NEW)

### Target Builders

#### 10.1 Desk Lamp
**Visual Requirements:**
- Base + arm + shade
- Plausible joint structure

**Variation Axes:**
- Style (anglepoise, modern)
- Shade size
- Arm segments

**Quality Bar:** Stable; joint structure plausible

**Tools Needed:** sweep, lathe, constraints, materials (metal/plastic)

---

#### 10.2 Monitor / TV (simplified)
**Visual Requirements:**
- Bezel + screen + stand
- Back housing thickness

**Variation Axes:**
- Size, aspect ratio
- Stand style

**Quality Bar:** Clean hard-surface edges (needs bevel later)

**Tools Needed:** bevel/chamfer, normals control, materials

---

## Domain 11: Vehicles (Optional / Later)

### Target Builders

#### 11.1 Bicycle (stylized)
**Visual Requirements:**
- Frame, wheels, handlebars

**Variation Axes:**
- Frame style, wheel size

**Quality Bar:** Recognizable silhouette

**Tools Needed:** sweep, instancing, constraints

---

## Domain 12: Soft Goods (NEW)

### Target Builders

#### 12.1 Curtain / Blanket (static drape)
**Visual Requirements:**
- Hanging cloth folds (approx)

**Variation Axes:**
- Fold density, length

**Quality Bar:** Looks like fabric, not rigid sheet

**Tools Needed:** deformers, static drape, collisions

---

## Notes on Priority Ranking

The priority ranking below focuses on **tool unlocks**, but scene cohesion and decision taxonomy should be validated for each new builder:
- Does it reuse families?
- Does it produce plausible spacing?
- Does it expose decisions for overrides?

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
- **Morph targets** (blend shapes for variation interpolation)
- **Skeleton reference** (Phase 3: rigging)
- **Animation clips** (Phase 3: keyframe data)

---

## Explicit Non-Goals (Phase 2)

To maintain focus, the following are explicitly OUT OF SCOPE for Phase 2:

1. **Real-time physics simulation** - We may bake physics to keyframes in Phase 3
2. **Skeletal animation playback** - Rigging is Phase 3; Phase 2 outputs static meshes
3. **Procedural facial expressions** - Phase 3 via blend shapes + rigging
4. **Real-time mesh editing** - Builders regenerate from seed; no live manipulation
5. **External asset import** - We generate procedurally; no FBX/OBJ import
6. **Game engine runtime** - Export formats (glTF) enable integration; runtime is out of scope
7. **Full cloth simulation** - Phase 2 uses static drape approximation only

---

## Professional Polish Principles

> What distinguishes seasoned seniors from hobbyists? Attention to detail that creates "magical" content.

### The Soul of Content: Beyond Generic Slop

**Hobbyist Approach:** "Slap material on a ball and apply some smear" → Generic, forgettable, CG-obvious
**Professional Approach:** Every element tells a story, feels authentic, invites closer inspection

### What Makes Content "Magical"?

1. **Contextual Authenticity**
   - Manufacturing marks (injection molding lines, wood grain direction)
   - Use-wear patterns (scuffs where hands grip, polish where surfaces meet)
   - Environmental integration (dust in corners, light bounce realism)

2. **Proportion Mastery**
   - Ergonomic perfection (comfortable reach, natural balance)
   - Visual weight distribution (heavy elements look heavy)
   - Scale relationships that feel "right" to human intuition

3. **Material Truthfulness**
   - Proper density/behavior (wood bends, metal dents, fabric drapes)
   - Aging that makes sense (sun fading, wear accumulation)
   - Surface variation (imperfections that prove it's real)

4. **Storytelling Details**
   - Objects that suggest narrative (personalized items, functional wear)
   - Cultural/period authenticity (joinery techniques, fastener choices)
   - Personality through variation (no two identical, but cohesive family)

5. **Presentation Excellence**
   - Lighting that flatters (rim lights, bounce fill, motivated shadows)
   - Camera angles that reveal (hero shots, detail closeups, environmental context)
   - Staging that communicates use (arranged for function, not just display)

### Attention to Detail: Professional Habits

**Seasoned Artists Add:**
- **Micro-details**: Screw heads, fabric weave, subtle asymmetries
- **Manufacturing realism**: Tool marks, assembly evidence, material waste
- **Environmental storytelling**: Weathering, usage patterns, contextual clues
- **Performance consideration**: LOD transitions, texture density, memory efficiency
- **Iterative refinement**: Generate → critique → adjust → repeat

**Hobbyists Skip:**
- Surface finish variation
- Functional constraints
- Environmental integration
- Performance optimization
- User experience polish

### Demo-Worthy Capabilities

To showcase our system as world-class:

1. **Hero Shots**: Single objects with dramatic lighting, multiple angles
2. **Scene Context**: Objects in meaningful environments (not floating)
3. **Variation Galleries**: Same seed family showing controlled randomness
4. **Material Studies**: Closeups showing material complexity
5. **Performance Demos**: Large scenes with smooth interaction
6. **Comparison Views**: Side-by-side showing iteration improvement

### Quality Bar Elevation

**Before:** "Looks like a chair" → Generic blob
**After:** "Looks like a chair I'd buy, use daily, and remember fondly"

Each domain below now includes:
- **Professional Polish**: Specific details that elevate quality
- **Attention to Detail**: What seasoned artists add
- **Demo-worthy Features**: Ways to showcase capabilities

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

**Professional Polish:**
- Door swings that don't intersect walls
- Natural light placement (windows oriented correctly)
- Furniture arrangement that suggests function (desk near outlets, bed in quiet corner)

**Attention to Detail:**
- Baseboards, crown molding variations
- Electrical outlets positioned realistically
- Wall texture variation (plaster vs drywall vs paneling)

**Demo-worthy Features:**
- Walkthrough videos showing spatial relationships
- Lighting studies showing natural illumination

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

**Professional Polish:**
- Street lighting that creates pools of illumination
- Vegetation that respects sunlight/shadow patterns
- Signage that tells neighborhood stories

**Attention to Detail:**
- Manhole covers, utility boxes, street markings
- Weathering on outdoor surfaces (rust, moss, fading)
- Seasonal variations (fallen leaves, snow accumulation)

**Demo-worthy Features:**
- Time-of-day lighting transitions
- Crowd simulation integration potential

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

**Professional Polish:**
- Adjustable shelf heights with visible peg holes
- Books with realistic spine variations (thickness, color, wear)
- Dust accumulation on upper shelves
- Subtle wood grain direction consistency

**Attention to Detail:**
- Shelf sag under book weight (slight deformation)
- Manufacturing marks on joinery (dowel holes, screw heads)
- Book titles that tell micro-stories (personal library)
- Cable management cutouts in back panel

**Demo-worthy Features:**
- Closeup shots of book details and shelf joinery
- Time-lapse of shelf adjustment mechanism
- Material study showing wood grain and finish variation

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

**Professional Polish:**
- Drawer pulls that match hardware style
- Keyboard tray integration options
- Cable grommets in work surface
- Monitor arm mounting points

**Attention to Detail:**
- Drawer runners with realistic extension limits
- Pencil grooves and wear marks on surface
- Power outlet cutouts positioned ergonomically
- Joinery details (dovetails, mortise-and-tenon)

**Demo-worthy Features:**
- Drawer opening/closing animations
- Ergonomic measurement overlays
- Material closeups showing finish and hardware

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

**Professional Polish:**
- Mattress ticking with realistic fabric texture
- Bedding that shows natural drape and folds
- Storage drawers under bed with smooth slides
- Headboard lighting integration

**Attention to Detail:**
- Slat spacing that prevents mattress sag
- Bedding wrinkles that suggest recent use
- Dust ruffles with proper overhang
- Frame joinery with visible fasteners

**Demo-worthy Features:**
- Bed-making sequence showing fabric behavior
- Size comparison overlays (twin vs king)
- Closeup of headboard upholstery details

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

**Professional Polish:**
- Cushion tufting with realistic button patterns
- Welt cord details on seams
- Leg attachment with visible screws/bolts
- Fabric that shows directional nap

**Attention to Detail:**
- Cushion compression showing use patterns
- Piping that follows complex curves perfectly
- Wood frame with authentic finish variations
- Springs/coils subtly visible through fabric

**Demo-worthy Features:**
- Cushion compression tests (before/after sitting)
- Fabric closeups showing weave and texture
- Style comparison gallery (modern vs traditional)

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

**Professional Polish:**
- Glaze drips and pooling at the base
- Subtle surface imperfections from kiln firing
- Interior lip detail for pouring
- Weight distribution that feels balanced when held

**Attention to Detail:**
- Foot ring that prevents scratching surfaces
- Wall thickness variation (thinner at neck)
- Manufacturing marks (potter's wheel ridges, trimming lines)
- Material-appropriate translucency/reflectivity

**Demo-worthy Features:**
- Water fill animation showing liquid behavior
- Rotation reveals profile elegance
- Material comparison (ceramic vs crystal)

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

**Professional Polish:**
- Punt (bottom indentation) for stability
- Neck finish appropriate for cap type
- Label positioning with realistic adhesion
- Glass thickness variation for authenticity

**Attention to Detail:**
- Mold seams running vertically
- Air bubbles trapped in glass
- Cap threads that match industry standards
- Weight distribution for pouring stability

**Demo-worthy Features:**
- Pouring simulation with realistic liquid flow
- Label closeup showing printing quality
- Type comparison gallery (wine vs beer bottles)

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

**Professional Polish:**
- Handle attachment that feels comfortable to grip
- Rim thickness appropriate for drinking
- Base that sits stably without wobbling
- Interior glaze that suggests liquid capacity

**Attention to Detail:**
- Finger impressions in handle clay
- Glaze drips on exterior
- Foot ring for surface protection
- Material-specific acoustic properties

**Demo-worthy Features:**
- Handle grip comfort visualization
- Liquid capacity demonstrations
- Material warmth/coolness indications

**Tools Needed:** ✅ Lathe, ✅ Sweep (handles), ✅ Materials

---

## Domain 8: Characters (NEW)

> These builders create character models with adjustable features to cover a range of human and animal forms.

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
- Pose (standing, sitting) - Phase 2: static only; Phase 3: rigged posing
- **Ethnicity** - Implemented via blend shapes between archetype meshes
  - Archetypes maintain identical topology for interpolation
  - Slider-based blending (e.g., 0.0–1.0 between two archetypes)
  - See SOLUTION_DOMAIN Category 20 for implementation approach

**Quality Bar:** Professional-quality humanoid, not uncanny valley

**Professional Polish:**
- Facial asymmetry that makes characters unique
- Skin texture with realistic pore patterns and subtle veins
- Hair that responds to airflow and styling
- Clothing that fits body contours naturally

**Attention to Detail:**
- Knuckle wrinkles and finger joint articulation
- Eyelash shadows and eye reflection complexity
- Tooth variations and dental work indications
- Fingernail details and cuticle realism

**Demo-worthy Features:**
- Facial expression range demonstrations
- Body type morphing sequences
- Ethnicity blend explorations
- Clothing fit and drape studies

**Tools Needed:** ALL - Subdivision, Sweep, Materials, Composition, Cloth (clothes), Blend Shapes

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

**Professional Polish:**
- Silhouette that reads clearly from distance
- Feature exaggeration that conveys emotion
- Color palette that supports character personality
- Proportions that communicate age/gender clearly

**Attention to Detail:**
- Eye shapes that suggest emotional range
- Clothing details that indicate character background
- Accessory integration that feels natural
- Pose language that tells stories

**Demo-worthy Features:**
- Emotional expression library
- Style comparison galleries
- Character personality studies
- Animation pose tests (future)

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

**Professional Polish:**
- Muscle definition that suggests movement capability
- Fur direction and length variation by body region
- Eye reflection and pupil response to light
- Species-specific behavioral posture cues

**Attention to Detail:**
- Paw pad textures and claw details
- Whisker placement and ear mobility
- Breed-specific markings and patterns
- Age indicators (graying fur, joint wear)

**Demo-worthy Features:**
- Species comparison galleries
- Breed variation studies
- Fur detail closeups
- Movement pose explorations

**Tools Needed:** ✅ Subdivision, ✅ Sweep, ⬜ Fur/hair system (later), ✅ Materials

# Procedurable - CAD-Based Furniture System Design

## 🎯 Core Insight: Parts, Joints, and Assembly

Real furniture is designed around **connection points** and **parts** that fit together.
A chair isn't "a box for a seat plus cylinders for legs" - it's a carefully designed
assembly where parts connect at specific points with specific orientations.

## 🔧 The CAD Approach

### 1. Attachment Points (Joints)

Every furniture part has **attachment points** - locations where other parts can connect.

```typescript
interface AttachmentPoint {
  id: string;                    // e.g., "leg_front_left"
  position: Vec3;                // Local position on the part
  direction: Vec3;               // Normal direction (which way it faces)
  up: Vec3;                      // Up vector for orientation
  type: 'socket' | 'plug' | 'surface';  // Connection type
  compatible: string[];          // What types can connect here
}
```

### 2. Parts with Geometry + Attachments

```typescript
interface FurniturePart {
  id: string;
  mesh: Mesh;
  attachments: AttachmentPoint[];
  bounds: BoundingBox;
}
```

### 3. Assembly Rules

A chair is assembled by:
1. Creating a seat (with leg attachment points on bottom)
2. Creating legs (with top attachment point)
3. Snapping leg tops to seat bottom attachment points
4. Creating a back (with bottom attachment point)
5. Snapping back bottom to seat back edge

## 🪑 Chair Taxonomy

### By Structure:
1. **Four-Leg Chair** - Traditional dining chair
2. **Pedestal Chair** - Single central support (office chair, tulip chair)
3. **Cantilever Chair** - Legs on one side only (modern design)
4. **Sled Base Chair** - Two U-shaped runners (conference room)
5. **Stool** - No back, typically taller

### By Back Style:
1. **Solid Back** - Single panel
2. **Spindle Back** - Multiple vertical rods (Windsor chair)
3. **Ladder Back** - Horizontal slats
4. **Open Back** - Frame only (modern)
5. **Upholstered** - Padded surface

### By Leg Style:
1. **Straight** - Simple vertical
2. **Tapered** - Wider at top, narrow at bottom
3. **Cabriole** - S-curved (Queen Anne style)
4. **Splayed** - Angled outward
5. **Turned** - Decorative lathe-cut patterns

## 📐 Dimensional Standards (in meters)

### Seat Heights:
- Dining chair: 0.43-0.48
- Office chair: 0.40-0.52 (adjustable)
- Bar stool: 0.65-0.75
- Counter stool: 0.58-0.65
- Lounge chair: 0.35-0.42

### Seat Dimensions:
- Width: 0.40-0.50 (dining), 0.50-0.65 (lounge)
- Depth: 0.38-0.45 (dining), 0.50-0.60 (lounge)

### Back Heights (from seat):
- Low back: 0.30-0.40
- Mid back: 0.40-0.55
- High back: 0.55-0.80

### Arm Heights (from seat):
- Standard: 0.18-0.25

## 🔨 Implementation Plan

### Phase 1: Part Primitives
- `createSeatPan(width, depth, thickness, profile)` 
- `createLeg(style, height, topRadius, bottomRadius)`
- `createBack(style, width, height, curvature)`
- `createArm(style, length, height)`
- `createStretcher(length, thickness)` - horizontal supports between legs

### Phase 2: Assembly System
- Attachment point matching
- Transform computation for alignment
- Validation (parts don't intersect, stable structure)

### Phase 3: Chair Archetypes
- Windsor Chair (spindle back, splayed legs)
- Modern Dining Chair (minimal, clean lines)
- Lounge Chair (low, wide, comfortable)
- Office Chair (pedestal, adjustable concept)
- Bar Stool (tall, with footrest)

### Phase 4: Variation System
- Material variations (wood types, metal, plastic)
- Proportion variations within style constraints
- Detail level (simple to ornate)

## 🎨 Visual Hierarchy

When generating a chair, quality comes from:

1. **Proportions** - Golden ratio relationships
2. **Curvature** - Subtle curves vs. harsh edges  
3. **Thickness** - Visual weight distribution
4. **Details** - Chamfers, rounds, tapers
5. **Symmetry** - Intentional asymmetry or perfect mirror

## 💡 Key Insight: Constraints as Design

Good procedural generation isn't about randomness - it's about
**working within constraints** to create coherent designs.

A chair must:
- Support human weight (structural)
- Be comfortable (ergonomic)
- Look balanced (aesthetic)
- Match its context (stylistic)

The procedural system should encode these constraints, not just geometry.


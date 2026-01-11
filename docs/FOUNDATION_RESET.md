# Procedurable - Foundation Reset

## Problem Statement

The current codebase has fundamental architectural issues that make debugging difficult and results unreliable:

1. **Inconsistent transformation model** - Mix of direct vertex manipulation and scene graph transforms
2. **No primitive contracts** - Unclear what bounds/origin each primitive produces
3. **No validation** - Problems only discovered at render time
4. **Workarounds over fixes** - Bugs bypassed rather than fixed

## Solution: Safe Primitives + Scene Graph

### The Key Insight

**Encode the rules into the system, not into developer memory.**

Instead of documenting "remember to use counter-clockwise winding", we provide functions
that ONLY produce correct output. Developers can't make winding mistakes if they use
`createRectLoop()` instead of manually creating vertices.

### Layer 1: Safe Primitives (`SafePrimitives.ts`)

These functions GUARANTEE correct output:

```typescript
// SAFE: Always produces correct rod with Y=[0, height]
const rod = createRod(radius, height);

// SAFE: Always produces correct panel with Y=[0, thickness]
const panel = createPanel(width, depth, thickness, bevel);

// SAFE: Always produces correct winding order
const loop = createRectLoop(width, depth, y);

// SAFE: Handles cap orientation automatically
const mesh = loftAndCap([loop1, loop2, loop3]);
```

### Layer 2: Scene Graph (SceneNode)

ALL positioning uses SceneNode transforms:

```typescript
const part = SceneNode.fromMesh('legPart', createRod(0.02, 0.4));
part.setPosition(x, 0, z);
parent.addChild(part);
```

NO direct vertex manipulation after creation.

### Layer 3: Validated Builders

Builders compose safe primitives using SceneNodes:

```typescript
class ChairBuilder {
  build(spec: ChairSpec): SceneNode {
    const chair = new SceneNode('chair');
    
    // Use safe primitives
    const seat = createPanel(spec.seatWidth, spec.seatDepth, spec.seatThickness);
    const seatNode = SceneNode.fromMesh('seat', seat);
    seatNode.setPosition(0, spec.legHeight, 0);
    chair.addChild(seatNode);
    
    // ... more parts using safe primitives + SceneNode positioning
    
    return chair;
  }
}
```

## What Developers Need to Know

### DO:
- Use `SafePrimitives.ts` functions for all geometry
- Use `SceneNode.setPosition()` for all positioning  
- Add validation tests for new primitives
- Check console for validation warnings

### DON'T:
- Manually create EdgeLoop vertices (use helper functions)
- Call `MeshOperations.loft/cap` directly (use `loftAndCap`)
- Modify vertex positions after mesh creation
- Skip bounds validation

## Current Status

✅ **Fixed**: Face winding in loft, extrude, createBox  
✅ **Fixed**: Flat shading for CAD-like rendering  
✅ **Fixed**: Beveled panel vertex order  
✅ **Created**: SafePrimitives.ts with validated helpers  
✅ **Created**: Primitive validation tests  

## Next Steps

1. Refactor furniture builders to use SafePrimitives
2. Remove old direct vertex manipulation code
3. Add more primitive tests
4. Create example builder using the clean pattern

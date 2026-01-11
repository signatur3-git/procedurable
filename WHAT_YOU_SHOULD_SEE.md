# What You Should See in the Demo

## 🐛 Bug Fixed!

**Issue**: `Uncaught ReferenceError: require is not defined`  
**Cause**: The `Archetype.ts` file was using CommonJS `require()` instead of ES6 imports  
**Fix**: Changed to use the `createContext` helper function with proper imports

## 🎨 Demo Scene Contents

When you open **http://localhost:3006** (or your active port), you should see:

### Visual Elements

1. **Dining Area** (Left side, around position x=-3)
   - 1 large brown dining table (rectangular)
   - 4 brown dining chairs arranged around it:
     - 1 chair on each long side (north/south)
     - 1 chair on each short side (east/west)
   - Chairs are oriented to face the table

2. **Lounge Area** (Right side, around position x=3)
   - 1 medium-height coffee table (rectangular, lower than dining table)
   - 2 larger lounge chairs (wider, lower seat height)
   - Chairs positioned on opposite sides of the coffee table

3. **Decorative Pillars** (Corners, x=±6, z=±3)
   - 4 architectural columns, one in each corner
   - Different styles:
     - **Top-left**: Smooth pillar
     - **Top-right**: Fluted pillar (with vertical grooves)
     - **Bottom-left**: Twisted pillar (spiraling surface)
     - **Bottom-right**: Smooth pillar
   - All pillars are light gray/silver color
   - Each has a base and capital (decorative top)

### Scene Details

- **Ground**: Dark grid pattern (20x20)
- **Lighting**: Warm ambient + directional light with shadows
- **Fog**: Atmospheric fog in the distance
- **Colors**:
  - Dining table: Saddle brown (#8B4513)
  - Dining chairs: Dark brown (#654321)
  - Coffee table: Sienna brown (#A0522D)
  - Lounge chairs: Burlywood (#8B7355)
  - Pillars: Light gray (#D3D3D3)

## 🎮 Controls

- **Rotate Camera**: Click and drag with mouse
- **Zoom**: Scroll wheel
  - Zoom in: Scroll up
  - Zoom out: Scroll down
  - Range: 5 to 30 units from center

## 📊 Console Output

You should see in the browser console:
```
🎨 Procedurable - Phase 3: Builder System Demo
🏗️ Building furniture with Builder pattern...
  📍 Dining area...
  📍 Lounge area...
  📍 Decorative pillars...
✨ Scene generated!
  • 1 dining table + 4 dining chairs
  • 1 coffee table + 2 lounge chairs
  • 4 decorative pillars
🎮 Controls: Click + drag to rotate, scroll to zoom
```

## 🔍 What to Look For

### Furniture Quality
- **Chairs**: Should have 4 legs, a seat, and a back
  - Dining chairs: Slightly taller, tapered legs
  - Lounge chairs: Lower, wider, thicker legs
- **Tables**: Should have 4 legs and a flat top
  - Dining table: Large, tall (76cm)
  - Coffee table: Smaller, low (45cm)

### Pillar Variations
- **Smooth**: Clean cylindrical surface
- **Fluted**: Vertical grooves (classical column style)
- **Twisted**: Spiraling/helical surface

### Shadows
- All furniture should cast shadows on the ground
- Shadows should be soft (PCFSoftShadowMap)

## 🚀 Technical Details

- **Total Objects**: 11 procedurally generated meshes
- **Generation Method**: 
  - Furniture: Simple factory generators
  - Pillars: Parametric archetypes
- **Seed**: 42 (base), with offsets for variations
- **All deterministic**: Same seed = same result

## 🆘 If You Still See Errors

1. **Hard refresh**: Ctrl+Shift+R (or Cmd+Shift+R on Mac)
2. **Clear cache**: Open DevTools → Application → Clear storage
3. **Check console**: Look for any other errors
4. **Verify dev server**: Should show "ready in XXXms" message

## ✨ Success Indicators

✅ No console errors  
✅ Scene loads in ~1-2 seconds  
✅ Camera rotates smoothly  
✅ All 11 objects visible  
✅ Shadows render correctly  
✅ Fog effect visible in distance  

---

**The fix is deployed! Refresh your browser and enjoy the procedurally generated scene!** 🎨


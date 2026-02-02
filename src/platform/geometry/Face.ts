/**
 * RGB color in 0-1 range
 */
export interface FaceColor {
  r: number;
  g: number;
  b: number;
}

export class Face {
  public indices: number[];
  public color?: FaceColor;  // Optional per-face color (legacy fallback)
  public materialSlotIndex?: number;  // Index into Mesh.materialSlots

  constructor(indices: number[], color?: FaceColor, materialSlotIndex?: number) {
    if (indices.length < 3) {
      throw new Error('Face must have at least 3 vertices');
    }
    this.indices = indices;
    this.color = color;
    this.materialSlotIndex = materialSlotIndex;
  }

  isTriangle(): boolean {
    return this.indices.length === 3;
  }

  isQuad(): boolean {
    return this.indices.length === 4;
  }

  triangulate(): Face[] {
    if (this.isTriangle()) {
      return [this];
    }

    const triangles: Face[] = [];
    for (let i = 1; i < this.indices.length - 1; i++) {
      triangles.push(new Face([
        this.indices[0],
        this.indices[i],
        this.indices[i + 1]
      ], this.color, this.materialSlotIndex));  // Preserve color and slot in triangulated faces
    }
    return triangles;
  }

  clone(): Face {
    return new Face([...this.indices], this.color ? { ...this.color } : undefined, this.materialSlotIndex);
  }
}

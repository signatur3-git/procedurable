export class Face {
  public indices: number[];

  constructor(indices: number[]) {
    if (indices.length < 3) {
      throw new Error('Face must have at least 3 vertices');
    }
    this.indices = indices;
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
      ]));
    }
    return triangles;
  }

  clone(): Face {
    return new Face([...this.indices]);
  }
}

export interface BuildSpec {
  type: string;
  style?: string;
  parameters?: Record<string, any>;
  count?: number | [number, number];
  seed?: number;
  position?: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  children?: BuildSpec[];
}
export interface SceneObject {
  id: string;
  type: string;
  mesh: any;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  metadata: Map<string, any>;
  children: SceneObject[];
}
export function createSceneObject(
  type: string,
  mesh: any,
  metadata?: Record<string, any>
): SceneObject {
  return {
    id: `${type}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    mesh,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    metadata: new Map(Object.entries(metadata || {})),
    children: []
  };
}

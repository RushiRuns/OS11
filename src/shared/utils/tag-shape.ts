export type TagShape = 'circle' | 'square' | 'triangle';

/**
 * Returns a deterministic geometric shape for a tag to provide
 * color-blind accessible discrimination without relying solely on color hue.
 */
export function getTagShape(identifier: string): TagShape {
  if (!identifier) return 'circle';
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = (hash * 31 + identifier.charCodeAt(i)) | 0;
  }
  const mod = Math.abs(hash) % 3;
  if (mod === 0) return 'circle';
  if (mod === 1) return 'square';
  return 'triangle';
}

/**
 * Returns the CSS class name corresponding to the tag shape.
 */
export function getTagShapeClass(identifier: string): string {
  const shape = getTagShape(identifier);
  if (shape === 'square') return 'tagDotShapeSquare';
  if (shape === 'triangle') return 'tagDotShapeTriangle';
  return 'tagDotShapeCircle';
}

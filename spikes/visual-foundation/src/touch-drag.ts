/** A touch may still become a tap or native vertical scroll until it moves past the slop. */
export function touchDragDirection(dx: number, dy: number): 'pending' | 'horizontal' | 'vertical' {
  const horizontal = Math.abs(dx);
  const vertical = Math.abs(dy);
  if (Math.max(horizontal, vertical) < 8) return 'pending';
  return horizontal > vertical ? 'horizontal' : 'vertical';
}

/**
 * layout.ts — Pure helper for stacking n text containers in the glasses canvas.
 * Canvas: 288 wide × 144 tall. No SDK import.
 */

const CANVAS_WIDTH = 288;
const CANVAS_HEIGHT = 144;
const MIN_CONTAINERS = 1;
const MAX_CONTAINERS = 8;

export interface ContainerLayout {
  xPosition: number;
  yPosition: number;
  width: number;
  height: number;
}

/**
 * Stacks `n` rows in a 288×144 canvas.
 * - Full width (xPosition=0, width=288).
 * - Each row height = floor(144/n).
 * - yPosition of row i = i * rowHeight.
 * - Clamps n to 1..8.
 */
export function layoutContainers(n: number): ContainerLayout[] {
  const clamped = Math.max(MIN_CONTAINERS, Math.min(MAX_CONTAINERS, n));
  const rowHeight = Math.floor(CANVAS_HEIGHT / clamped);
  const result: ContainerLayout[] = [];
  for (let i = 0; i < clamped; i++) {
    result.push({
      xPosition: 0,
      yPosition: i * rowHeight,
      width: CANVAS_WIDTH,
      height: rowHeight,
    });
  }
  return result;
}

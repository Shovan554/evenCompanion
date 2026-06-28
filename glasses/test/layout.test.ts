import { describe, it, expect } from 'vitest';
import { layoutContainers } from '../src/layout.js';

describe('layoutContainers', () => {
  it('n=4 produces 4 rows of height 36, width 288, starting at y=0,36,72,108', () => {
    const rows = layoutContainers(4);
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.width).toBe(288);
      expect(row.xPosition).toBe(0);
      expect(row.height).toBe(36);
    }
    expect(rows[0].yPosition).toBe(0);
    expect(rows[1].yPosition).toBe(36);
    expect(rows[2].yPosition).toBe(72);
    expect(rows[3].yPosition).toBe(108);
  });

  it('n=8 produces 8 rows of height 18', () => {
    const rows = layoutContainers(8);
    expect(rows).toHaveLength(8);
    for (const row of rows) {
      expect(row.height).toBe(18);
      expect(row.width).toBe(288);
    }
  });

  it('rows never exceed canvas height of 144', () => {
    for (let n = 1; n <= 8; n++) {
      const rows = layoutContainers(n);
      for (const row of rows) {
        expect(row.yPosition + row.height).toBeLessThanOrEqual(144);
      }
    }
  });

  it('n=0 clamps to 1 row', () => {
    const rows = layoutContainers(0);
    expect(rows).toHaveLength(1);
    expect(rows[0].height).toBe(144);
    expect(rows[0].yPosition).toBe(0);
    expect(rows[0].width).toBe(288);
  });

  it('n=9 (>8) clamps to 8 rows', () => {
    const rows = layoutContainers(9);
    expect(rows).toHaveLength(8);
    expect(rows[0].height).toBe(18);
  });

  it('n=1 produces single full-canvas row', () => {
    const rows = layoutContainers(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ xPosition: 0, yPosition: 0, width: 288, height: 144 });
  });

  it('rows are non-overlapping (each yPosition = previous + height)', () => {
    const rows = layoutContainers(4);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].yPosition).toBe(rows[i - 1].yPosition + rows[i - 1].height);
    }
  });

  it('top row first (row 0 has yPosition 0)', () => {
    const rows = layoutContainers(6);
    expect(rows[0].yPosition).toBe(0);
  });
});

/**
 * display.ts — GlassesDisplay interface and MockDisplay for testing.
 * NO SDK import. The real SDK-backed implementation lives in sdkDisplay.ts.
 */

export interface GlassesDisplay {
  init(lineCount: number): void | Promise<void>
  setLines(lines: string[]): void | Promise<void>
  shutdown(): void | Promise<void>
}

/** MockDisplay records all calls for use in tests. */
export class MockDisplay implements GlassesDisplay {
  /** Recorded lineCount arguments from each init() call, in order. */
  inits: number[] = []

  /** The lines array from the most recent setLines() call, or null if never called. */
  lastLines: string[] | null = null

  /** Recorded argument arrays from each setLines() call, each as an independent copy. */
  setCalls: string[][] = []

  /** Count of shutdown() calls. */
  shutdowns = 0

  init(lineCount: number): void {
    this.inits.push(lineCount)
  }

  setLines(lines: string[]): void {
    const copy = [...lines]
    this.setCalls.push(copy)
    this.lastLines = copy
  }

  shutdown(): void {
    this.shutdowns++
  }
}

// locomotive-scroll v4 ships no TypeScript types — minimal shim for our usage.
declare module 'locomotive-scroll' {
  export interface LocomotiveScrollOptions {
    el?: HTMLElement;
    smooth?: boolean;
    lerp?: number;
    multiplier?: number;
    class?: string;
    scrollFromAnywhere?: boolean;
    resetNativeScroll?: boolean;
    smartphone?: { smooth?: boolean };
    tablet?: { smooth?: boolean };
  }
  export default class LocomotiveScroll {
    constructor(options?: LocomotiveScrollOptions);
    scroll: { instance: { scroll: { x: number; y: number } } };
    on(event: string, callback: (...args: any[]) => void): void;
    scrollTo(target: number | string | HTMLElement, options?: Record<string, unknown>): void;
    update(): void;
    destroy(): void;
  }
}

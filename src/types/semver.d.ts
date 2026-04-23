declare module 'semver' {
  export interface ValidOptions {
    loose?: boolean;
  }

  export function valid(version: string, options?: ValidOptions): string | null;
  export function gt(versionA: string, versionB: string): boolean;
  export function compare(versionA: string, versionB: string): number;
}

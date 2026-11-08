// Local-only loose React typings (the sandbox has no @types/react). CI uses the real ones.
declare module 'react' {
  export type ReactNode = any; export type FormEvent = any; export type MouseEvent = any;
  export type LazyExoticComponent<T> = any; export type ComponentType = any;
  export function useState<T>(i: T | (() => T)): [T, (v: T | ((p: T) => T)) => void];
  export function useEffect(f: () => any, d?: any[]): void;
  export function useRef<T>(i?: T | null): { current: T };
  export function useMemo<T>(f: () => T, d: any[]): T;
  export function useCallback<T>(f: T, d: any[]): T;
  export function useSyncExternalStore<T>(s: (f: () => void) => () => void, g: () => T): T;
  export function lazy(f: () => Promise<any>): any;
  export const Suspense: any;
}
declare module 'react/jsx-runtime' {
  export const jsx: any; export const jsxs: any; export const Fragment: any;
  export namespace JSX { interface IntrinsicElements { [k: string]: any } interface Element {} interface IntrinsicAttributes { key?: any } }
}
declare module 'react-dom/client' { export function createRoot(e: any): any; }
declare module '*.css';

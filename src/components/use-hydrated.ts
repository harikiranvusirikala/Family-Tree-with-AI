import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** False in the server-rendered HTML, true once React runs in the browser. Buttons stay disabled until then. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

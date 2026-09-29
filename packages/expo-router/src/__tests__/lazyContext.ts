import type { LoadedRoute } from '../Route';
import type { RequireContext } from '../types';

type PromiseWithResult<T> = Promise<T> & { _result?: T | Promise<T> };

/**
 * A `require.context` stub for the `lazy` import mode. Like Metro's lazy context combined with
 * Expo's async require, `context(key)` returns a promise that carries the module in `_result`
 * once its bundle has loaded. Modules only load after `load()` is called.
 */
export function createLazyContext(modules: Record<string, LoadedRoute>) {
  const loaded = new Set<string>();
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  const context = Object.assign(
    (key: string) => {
      const module = modules[key];
      if (!module) {
        throw new Error(`Module not found in lazy context: ${key}`);
      }
      if (loaded.has(key)) {
        const promise: PromiseWithResult<LoadedRoute> = Promise.resolve(module);
        promise._result = module;
        return promise;
      }
      const promise: PromiseWithResult<LoadedRoute> = gate.then(() => {
        loaded.add(key);
        return module;
      });
      promise._result = promise;
      return promise;
    },
    {
      keys: () => Object.keys(modules),
      resolve: (key: string) => key,
      id: 'lazy-context',
    }
  ) as RequireContext;

  return {
    context,
    /** Resolve every pending module load. */
    async load() {
      release();
      await gate;
      // Let the `then` callbacks that mark modules as loaded run.
      await Promise.resolve();
    },
    isLoaded: (key: string) => loaded.has(key),
  };
}

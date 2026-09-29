import { findRouteNodeByName } from '../Route';
import { getRoutes } from '../getRoutes';
import { createLazyContext } from './lazyContext';

const routes = {
  './_layout.tsx': { default: () => null },
  './index.tsx': { default: () => null },
  './anchored/_layout.tsx': { default: () => null, unstable_settings: { anchor: 'index' } },
  './anchored/index.tsx': { default: () => null },
  './anchored/details.tsx': { default: () => null },
  './(a,b)/_layout.tsx': {
    default: () => null,
    unstable_settings: { anchor: 'index', b: { anchor: 'other' } },
  },
  './(a,b)/index.tsx': { default: () => null },
  './(a,b)/other.tsx': { default: () => null },
};

const options = { skipGenerated: true, ignoreEntryPoints: true, importMode: 'lazy' };

describe('getRoutes in the lazy import mode', () => {
  afterEach(() => {
    delete globalThis.__EXPO_ROUTER_LAYOUT_SETTINGS__;
  });

  it('has no anchor for a layout that has not loaded', () => {
    const lazy = createLazyContext(routes);

    const routeNode = getRoutes(lazy.context, options)!;
    expect(findRouteNodeByName(routeNode, 'anchored')!.initialRouteName).toBeUndefined();
  });

  it('reads the anchor from the settings inlined by the server render', () => {
    globalThis.__EXPO_ROUTER_LAYOUT_SETTINGS__ = {
      './anchored/_layout.tsx': { anchor: 'index' },
      './(a,b)/_layout.tsx': { anchor: 'index', b: { anchor: 'other' } },
    };
    const lazy = createLazyContext(routes);

    const routeNode = getRoutes(lazy.context, options)!;
    expect(findRouteNodeByName(routeNode, 'anchored')!.initialRouteName).toBe('index');
    expect(findRouteNodeByName(routeNode, '(a)')!.initialRouteName).toBe('index');
    expect(findRouteNodeByName(routeNode, '(b)')!.initialRouteName).toBe('other');
  });

  it('reads the anchor from the module once it has loaded', async () => {
    const lazy = createLazyContext(routes);
    getRoutes(lazy.context, options);

    await lazy.load();

    const routeNode = getRoutes(lazy.context, options)!;
    expect(findRouteNodeByName(routeNode, 'anchored')!.initialRouteName).toBe('index');
  });
});

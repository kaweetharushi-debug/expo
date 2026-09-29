/** @jest-environment jsdom */
import { act, render, screen } from '@testing-library/react';
import { Text } from 'react-native';

import { ExpoRoot } from '../ExpoRoot';
import { navigationRef } from '../global-state/navigationRef';
import Stack from '../layouts/StackClient';
import Tabs from '../layouts/Tabs';
import type { NavigationState, PartialState } from '../react-navigation/routers';
import { createLazyContext } from './lazyContext';

// `useScreens` reads the import mode from this module. Babel inlines the `EXPO_ROUTER_IMPORT_MODE`
// environment variable as `sync` in tests, so the environment variable cannot switch it.
jest.mock('../import-mode', () => ({ __esModule: true, default: 'lazy' }));

global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as typeof ResizeObserver;

const routes = {
  './_layout.tsx': { default: () => <Stack /> },
  './(tabs)/_layout.tsx': {
    default: () => (
      <Tabs>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="anchored" />
      </Tabs>
    ),
  },
  './(tabs)/index.tsx': { default: () => <Text testID="home">home</Text> },
  './(tabs)/anchored/_layout.tsx': {
    default: () => <Stack />,
    unstable_settings: { anchor: 'index' },
  },
  './(tabs)/anchored/index.tsx': { default: () => <Text testID="anchored">anchored</Text> },
  './(tabs)/anchored/details.tsx': {
    default: () => <Text testID="details">details</Text>,
  },
};

type State = NavigationState | PartialState<NavigationState>;

function findState(state: State | undefined, routeName: string): State | undefined {
  if (!state) {
    return undefined;
  }
  for (const route of state.routes) {
    if (route.name === routeName) {
      return route.state;
    }
    const found = findState(route.state, routeName);
    if (found) {
      return found;
    }
  }
  return undefined;
}

describe('anchors with async routes', () => {
  afterEach(() => {
    delete globalThis.__EXPO_ROUTER_LAYOUT_SETTINGS__;
  });

  it('seeds the anchor below a deep-linked screen from the server-rendered settings', async () => {
    // The route tree is built before any layout module has loaded, so the server render inlines
    // the settings into the HTML.
    globalThis.__EXPO_ROUTER_LAYOUT_SETTINGS__ = {
      './(tabs)/anchored/_layout.tsx': { anchor: 'index' },
    };
    const lazy = createLazyContext(routes);

    const result = render(<ExpoRoot context={lazy.context} location="/anchored/details" />);
    try {
      const anchored = findState(navigationRef.getRootState(), 'anchored');
      expect(anchored?.routes.map((route) => route.name)).toEqual(['index', 'details']);
      expect(anchored?.index).toBe(1);

      await act(async () => {
        await lazy.load();
      });

      expect(await screen.findByTestId('details')).toBeTruthy();
    } finally {
      result.unmount();
    }
  });

  it('has no anchor without the server-rendered settings', async () => {
    const lazy = createLazyContext(routes);

    const result = render(<ExpoRoot context={lazy.context} location="/anchored/details" />);
    try {
      const anchored = findState(navigationRef.getRootState(), 'anchored');
      expect(anchored?.routes.map((route) => route.name)).toEqual(['details']);
    } finally {
      result.unmount();
    }
  });
});

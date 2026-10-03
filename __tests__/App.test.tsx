/**
 * @format
 */

import 'react-native';
import React from 'react';
import App from '../App';

// Note: import explicitly to use the types shipped with jest.
import {afterEach, it} from '@jest/globals';

// Note: test renderer must be required after react-native.
import renderer, {act, type ReactTestRenderer} from 'react-test-renderer';

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

it('renders correctly', async () => {
  jest.useFakeTimers();
  let app: ReactTestRenderer | undefined;

  await act(async () => {
    app = renderer.create(<App />);
  });

  await act(async () => {
    app?.unmount();
  });
});

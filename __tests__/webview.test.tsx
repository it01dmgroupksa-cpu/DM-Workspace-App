import 'react-native';
import React from 'react';
import {expect, it} from '@jest/globals';
import renderer, {act} from 'react-test-renderer';
import DMWebView from '../src/components/DMWebViewScreen';

it('opens ERP with the app sign-in cookies, also on iPhone', async () => {
  let tree: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<DMWebView />);
  });
  const web = tree!.root.findByProps({mixedContentMode: 'never'});
  expect(web.props.sharedCookiesEnabled).toBe(true);
  expect(web.props.thirdPartyCookiesEnabled).toBe(true);
});

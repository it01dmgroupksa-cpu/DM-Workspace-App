import {Platform} from 'react-native';
import {requireOptionalNativeModule} from 'expo';

// iPhone calls through CallKit (modules/dm-callkit): the phone rings like a phone call,
// woken by a VoIP push from the panel. Missing on Android, and when the iOS app was built
// without the module: then every call quietly does nothing and the app rings itself.
export type CallKitAction = {
  event: 'DmCallKitAnswer' | 'DmCallKitEnd';
  callId: string;
  conversationId: string;
  video: boolean;
};
type Module = {
  voipToken(): string | null;
  pendingActions(): CallKitAction[];
  has(callId: string): boolean;
  startOutgoing(callId: string, name: string, video: boolean): void;
  answered(callId: string): void;
  reportConnected(callId: string): void;
  endCall(callId: string): void;
  addListener(
    event: string,
    listener: (body: any) => void,
  ): {remove: () => void};
};
const native: Module | null =
  Platform.OS === 'ios'
    ? requireOptionalNativeModule<Module>('DmCallKit')
    : null;

function safely<T>(run: (m: Module) => T, fallback: T): T {
  if (!native) return fallback;
  try {
    return run(native);
  } catch {
    return fallback;
  }
}

export const callKit = {
  available: !!native,
  voipToken: () => safely(m => m.voipToken(), null),
  pendingActions: () => safely(m => m.pendingActions(), [] as CallKitAction[]),
  has: (callId: string) => safely(m => m.has(callId), false),
  startOutgoing: (callId: string, name: string, video: boolean) =>
    safely(m => m.startOutgoing(callId, name, video), undefined),
  answered: (callId: string) => safely(m => m.answered(callId), undefined),
  reportConnected: (callId: string) =>
    safely(m => m.reportConnected(callId), undefined),
  endCall: (callId: string) => safely(m => m.endCall(callId), undefined),
  onToken: (listener: (token: string) => void) =>
    safely(
      m => m.addListener('DmCallKitToken', body => listener(body.token)),
      null,
    ),
  onAction: (listener: (action: CallKitAction) => void) => {
    if (!native) return () => {};
    try {
      const subs = (['DmCallKitAnswer', 'DmCallKitEnd'] as const).map(event =>
        native.addListener(event, body => listener({...body, event})),
      );
      return () => subs.forEach(s => s.remove());
    } catch {
      return () => {};
    }
  },
};

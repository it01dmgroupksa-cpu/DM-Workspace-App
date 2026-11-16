import {useEffect, useState} from 'react';
import {DeviceEventEmitter, NativeModules, Platform} from 'react-native';
import {callKit} from './callKit';

// Android's calling features, from DmCallsModule.kt: the ongoing-call service (so a call
// keeps its microphone and camera with the screen locked), Telecom (headset, car and
// watch buttons), the proximity sensor, picture-in-picture and the battery exemption.
// On iPhone the same calls go to CallKit (callKit.ts). If the native side is missing,
// every call quietly does nothing: these features make a call better, never possible.
type Native = {
  callStarted(
    callId: string,
    conversationId: string,
    title: string,
    video: boolean,
    incoming: boolean,
  ): void;
  callConnected(callId: string): void;
  callEnded(callId: string): void;
  presentIncoming(
    callId: string,
    conversationId: string,
    title: string,
    video: boolean,
  ): void;
  stopRinging(callId: string): void;
  deviceId(): Promise<string>;
  callEvents(): Promise<string>;
  setSpeaker(on: boolean): void;
  setBeauty?(on: boolean): void;
  setProximity(on: boolean): void;
  setPip(on: boolean): void;
  batteryExempt(): Promise<boolean>;
  requestBatteryExemption(): void;
  diagnostics(): Promise<Diagnostics>;
  fix(kind: string): void;
  testRingtone(on: boolean): void;
  testCallScreen(): void;
  shareToWhatsApp(
    path: string | null,
    mime: string | null,
    text: string | null,
  ): Promise<number>;
  reportError(message: string, stack: string, fatal: boolean): void;
  reportEvent(message: string): void;
  setUser(id: string | null): void;
};

// What the call check (DiagnosticsScreen) shows, from DmCallsModule.diagnostics.
export type Diagnostics = {
  notifications: boolean;
  callAlerts: boolean;
  fullScreen: boolean;
  microphone: boolean;
  camera: boolean;
  battery: boolean;
  ringer: 'normal' | 'vibrate' | 'silent';
  ringVolume: number;
  ringVolumeMax: number;
  dnd: boolean;
  device: string;
  android: string;
  is64bit: boolean;
  lastRing: string;
  appVersion: string;
};
const native: Native | null =
  Platform.OS === 'android' ? NativeModules.DmCalls ?? null : null;

function safely(run: (n: Native) => void) {
  if (!native) return;
  try {
    run(native);
  } catch {
    /* a missing phone feature must never end a call */
  }
}

export const nativeCalls = {
  started: (
    callId: string,
    conversationId: string,
    title: string,
    video: boolean,
    incoming: boolean,
  ) => {
    safely(n => n.callStarted(callId, conversationId, title, video, incoming));
    // iPhone: an outgoing call is shown by CallKit; an incoming one is already there.
    if (incoming) callKit.answered(callId);
    else callKit.startOutgoing(callId, title, video);
  },
  connected: (callId: string) => {
    safely(n => n.callConnected(callId));
    callKit.reportConnected(callId);
  },
  ended: (callId: string) => {
    safely(n => n.callEnded(callId));
    callKit.endCall(callId);
  },
  // Android: incoming calls ring and show natively (RingService, IncomingCallActivity),
  // whether the push or the live stream saw them first; one ring per call. JavaScript
  // then keeps the call's state but shows no ringing screen of its own.
  nativeIncoming: typeof native?.presentIncoming === 'function',
  presentIncoming: (
    callId: string,
    conversationId: string,
    title: string,
    video: boolean,
  ) =>
    safely(n => n.presentIncoming(callId, conversationId, title, video)),
  // The call stopped ringing for this phone: ringtone, alert and call screen go.
  stopRinging: (callId: string) => safely(n => n.stopRinging(callId)),
  deviceId: async (): Promise<string | null> => {
    try {
      return native?.deviceId ? await native.deviceId() : null;
    } catch {
      return null;
    }
  },
  // This phone's own trail of call steps (Telemetry.kt), newest last.
  callEvents: async (): Promise<string> => {
    try {
      return native?.callEvents ? await native.callEvents() : '';
    } catch {
      return '';
    }
  },
  setSpeaker: (on: boolean) => safely(n => n.setSpeaker(on)),
  // Video calls' "Touch up" skin smoothing (BeautyProcessor.kt / DmBeautyProcessor.m), a
  // camera effect named "dm-beauty". Missing from builds made before it: no button then.
  beautyAvailable:
    typeof native?.setBeauty === 'function' || callKit.beautyAvailable,
  setBeauty: (on: boolean) => {
    safely(n => n.setBeauty?.(on));
    callKit.setBeauty(on);
  },
  setProximity: (on: boolean) => safely(n => n.setProximity(on)),
  setPip: (on: boolean) => safely(n => n.setPip(on)),
  batteryExempt: async () => {
    try {
      return native ? await native.batteryExempt() : true;
    } catch {
      return true; // can't tell: don't nag
    }
  },
  requestBatteryExemption: () => safely(n => n.requestBatteryExemption()),
  // The call check. null where there is no native side (iPhone, or an old build).
  diagnostics: async (): Promise<Diagnostics | null> => {
    try {
      return native?.diagnostics ? await native.diagnostics() : null;
    } catch {
      return null;
    }
  },
  fix: (kind: string) => safely(n => n.fix(kind)),
  testRingtone: (on: boolean) => safely(n => n.testRingtone(on)),
  testCallScreen: () => safely(n => n.testCallScreen()),
  // Forward to WhatsApp (whatsapp.ts). Missing from an app built before it (the update
  // reached an older install): files can't be forwarded there, text still can.
  canShareToWhatsApp: typeof native?.shareToWhatsApp === 'function',
  // How many WhatsApp apps were offered; 0 when none is installed.
  shareToWhatsApp: (
    path: string | null,
    mime: string | null,
    text: string | null,
  ): Promise<number> =>
    native ? native.shareToWhatsApp(path, mime, text) : Promise.resolve(0),
  // Reports to Crashlytics (telemetry.ts).
  reportError: (message: string, stack: string, fatal: boolean) =>
    safely(n => n.reportError(message, stack, fatal)),
  reportEvent: (message: string) => safely(n => n.reportEvent(message)),
  setUser: (id: string | null) => safely(n => n.setUser(id)),
};

// Hang up from the ongoing-call notification, a headset, a car or a watch.
export function onNativeHangUp(handler: (callId: string | null) => void) {
  const sub = DeviceEventEmitter.addListener('DmCallsHangup', handler);
  return () => sub.remove();
}

// True while a video call is shrunk into the floating picture-in-picture window.
export function usePictureInPicture() {
  const [pip, setPip] = useState(false);
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('DmCallsPip', (value: string) =>
      setPip(value === '1'),
    );
    return () => sub.remove();
  }, []);
  return pip;
}

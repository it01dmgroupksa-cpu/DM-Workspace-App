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
  setSpeaker(on: boolean): void;
  setProximity(on: boolean): void;
  setPip(on: boolean): void;
  batteryExempt(): Promise<boolean>;
  requestBatteryExemption(): void;
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
  setSpeaker: (on: boolean) => safely(n => n.setSpeaker(on)),
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

import ExpoModulesCore
import UIKit

// JavaScript's handle on CallKit (src/messenger/callKit.ts).
// Events: DmCallKitToken { token }, DmCallKitAnswer / DmCallKitEnd { callId, conversationId, video }.
public class DmCallKitModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DmCallKit")

    Events("DmCallKitToken", "DmCallKitAnswer", "DmCallKitEnd")

    OnCreate {
      CallKitCenter.shared.module = self
    }

    OnDestroy {
      if CallKitCenter.shared.module === self { CallKitCenter.shared.module = nil }
    }

    // The VoIP token, once Apple has given one (also sent as DmCallKitToken).
    Function("voipToken") { () -> String? in
      CallKitCenter.shared.voipToken
    }

    // Answers and hang-ups that happened before JavaScript was listening (the push woke
    // the app, the person answered on the lock screen). Each is handed out once.
    Function("pendingActions") { () -> [[String: Any]] in
      CallKitCenter.shared.takePending()
    }

    // CallKit is already ringing this call (so the app need not ring too).
    Function("has") { (callId: String) -> Bool in
      CallKitCenter.shared.has(callId: callId)
    }

    Function("startOutgoing") { (callId: String, name: String, video: Bool) in
      CallKitCenter.shared.startOutgoing(callId: callId, name: name, video: video)
    }

    // Answered in the app's own screen (not CallKit's): tell CallKit so it stops ringing.
    Function("answered") { (callId: String) in
      CallKitCenter.shared.answeredInApp(callId: callId)
    }

    Function("reportConnected") { (callId: String) in
      CallKitCenter.shared.reportConnected(callId: callId)
    }

    Function("endCall") { (callId: String) in
      CallKitCenter.shared.endFromApp(callId: callId)
    }
  }

  func emit(_ name: String, _ body: [String: Any]) {
    sendEvent(name, body)
  }
}

// Starts PushKit at launch, so a VoIP push that wakes the app finds it ready.
public class DmCallKitAppDelegate: BaseExpoAppDelegateSubscriber, ExpoAppDelegateSubscriberProtocol {
  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    CallKitCenter.shared.start()
    return true
  }
}

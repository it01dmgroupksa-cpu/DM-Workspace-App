import AVFoundation
import CallKit
import Foundation
import LiveKitWebRTC
import PushKit

/**
 Rings Messenger calls on iPhone the way a phone call rings: the full CallKit screen,
 even on the lock screen and with the app closed, woken by a VoIP push from the panel
 (lib/messenger/apns.ts). The call itself (LiveKit) and its screen stay in JavaScript.

 Apple's rule: every VoIP push must report a call to CallKit at once, or iOS stops
 delivering them. So a "stop ringing" push reports the call and ends it straight away
 (it is usually the call that is already ringing).
 */
final class CallKitCenter: NSObject, PKPushRegistryDelegate, CXProviderDelegate {
  static let shared = CallKitCenter()

  weak var module: DmCallKitModule? {
    didSet {
      if let token = voipToken { module?.emit("DmCallKitToken", ["token": token]) }
    }
  }
  private(set) var voipToken: String?

  private struct Info {
    let callId: String
    let conversationId: String
    let video: Bool
    let outgoing: Bool
    var answered: Bool
  }

  private var registry: PKPushRegistry?
  private var calls: [UUID: Info] = [:]
  private var pending: [[String: Any]] = []
  // Changes the app asked for itself: CallKit confirms them, JavaScript already knows.
  private var fromApp = Set<UUID>()
  private let controller = CXCallController()

  private lazy var provider: CXProvider = {
    let config = CXProviderConfiguration()
    config.supportsVideo = true
    config.maximumCallGroups = 1
    config.maximumCallsPerCallGroup = 1
    config.supportedHandleTypes = [.generic]
    config.includesCallsInRecents = false
    let provider = CXProvider(configuration: config)
    provider.setDelegate(self, queue: nil)
    return provider
  }()

  func start() {
    guard registry == nil else { return }
    let registry = PKPushRegistry(queue: .main)
    registry.delegate = self
    registry.desiredPushTypes = [.voIP]
    self.registry = registry
    _ = provider
  }

  // MARK: PushKit

  func pushRegistry(_ registry: PKPushRegistry, didUpdate pushCredentials: PKPushCredentials, for type: PKPushType) {
    let token = pushCredentials.token.map { String(format: "%02x", $0) }.joined()
    voipToken = token
    module?.emit("DmCallKitToken", ["token": token])
  }

  func pushRegistry(_ registry: PKPushRegistry, didInvalidatePushTokenFor type: PKPushType) {
    voipToken = nil
  }

  func pushRegistry(
    _ registry: PKPushRegistry,
    didReceiveIncomingPushWith payload: PKPushPayload,
    for type: PKPushType,
    completion: @escaping () -> Void
  ) {
    let data = payload.dictionaryPayload
    let callId = data["callId"] as? String ?? ""
    let uuid = UUID(uuidString: callId) ?? UUID()
    let caller = data["caller"] as? String ?? "DM Workspace"
    let video = data["video"] as? Bool ?? false
    let update = CXCallUpdate()
    update.remoteHandle = CXHandle(type: .generic, value: caller)
    update.localizedCallerName = caller
    update.hasVideo = video
    update.supportsHolding = false
    update.supportsGrouping = false
    update.supportsUngrouping = false
    update.supportsDTMF = false

    if (data["type"] as? String) == "call" {
      calls[uuid] = Info(
        callId: callId,
        conversationId: data["conversationId"] as? String ?? "",
        video: video,
        outgoing: false,
        answered: false
      )
      provider.reportNewIncomingCall(with: uuid, update: update) { error in
        if error != nil { self.calls[uuid] = nil }
        completion()
      }
      return
    }
    // Stop ringing: the caller hung up, it was answered elsewhere, or nobody answered.
    let reason: CXCallEndedReason = (data["missed"] as? Bool) == true ? .unanswered : .remoteEnded
    // Answered here: the push was meant for this person's other phones. Never end it.
    if calls[uuid]?.answered == true {
      completion()
      return
    }
    if calls.removeValue(forKey: uuid) != nil {
      provider.reportCall(with: uuid, endedAt: Date(), reason: reason)
      completion()
      return
    }
    provider.reportNewIncomingCall(with: uuid, update: update) { _ in
      self.provider.reportCall(with: uuid, endedAt: Date(), reason: reason)
      completion()
    }
  }

  // MARK: CallKit

  func providerDidReset(_ provider: CXProvider) {
    calls.removeAll()
  }

  func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
    guard var info = calls[action.callUUID] else {
      action.fail()
      return
    }
    info.answered = true
    calls[action.callUUID] = info
    if fromApp.remove(action.callUUID) == nil {
      send("DmCallKitAnswer", info)
    }
    action.fulfill()
  }

  func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
    if let info = calls.removeValue(forKey: action.callUUID), fromApp.remove(action.callUUID) == nil {
      send("DmCallKitEnd", info)
    }
    action.fulfill()
  }

  func provider(_ provider: CXProvider, perform action: CXStartCallAction) {
    provider.reportOutgoingCall(with: action.callUUID, startedConnectingAt: Date())
    action.fulfill()
  }

  // Mute and hold live in the app's own call screen.
  func provider(_ provider: CXProvider, perform action: CXSetMutedCallAction) {
    action.fail()
  }

  func provider(_ provider: CXProvider, perform action: CXSetHeldCallAction) {
    action.fail()
  }

  // CallKit owns the audio session during a call; hand it to WebRTC when it is ready.
  func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {
    LKRTCAudioSession.sharedInstance().audioSessionDidActivate(audioSession)
  }

  func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) {
    LKRTCAudioSession.sharedInstance().audioSessionDidDeactivate(audioSession)
  }

  // MARK: From JavaScript

  func takePending() -> [[String: Any]] {
    let out = pending
    pending.removeAll()
    return out
  }

  func has(callId: String) -> Bool {
    guard let uuid = UUID(uuidString: callId) else { return false }
    return calls[uuid] != nil
  }

  func startOutgoing(callId: String, name: String, video: Bool) {
    guard let uuid = UUID(uuidString: callId), calls[uuid] == nil else { return }
    calls[uuid] = Info(callId: callId, conversationId: "", video: video, outgoing: true, answered: true)
    let action = CXStartCallAction(call: uuid, handle: CXHandle(type: .generic, value: name))
    action.isVideo = video
    controller.request(CXTransaction(action: action)) { _ in }
  }

  func answeredInApp(callId: String) {
    guard let uuid = UUID(uuidString: callId), let info = calls[uuid], !info.answered else { return }
    fromApp.insert(uuid)
    controller.request(CXTransaction(action: CXAnswerCallAction(call: uuid))) { error in
      if error != nil { self.fromApp.remove(uuid) }
    }
  }

  func reportConnected(callId: String) {
    guard let uuid = UUID(uuidString: callId), let info = calls[uuid], info.outgoing else { return }
    provider.reportOutgoingCall(with: uuid, connectedAt: Date())
  }

  func endFromApp(callId: String) {
    guard let uuid = UUID(uuidString: callId), calls[uuid] != nil else { return }
    fromApp.insert(uuid)
    controller.request(CXTransaction(action: CXEndCallAction(call: uuid))) { error in
      if error != nil {
        self.fromApp.remove(uuid)
        self.calls[uuid] = nil
        self.provider.reportCall(with: uuid, endedAt: Date(), reason: .remoteEnded)
      }
    }
  }

  // Delivered live, and also kept for JavaScript that starts later (a cold start from
  // the lock screen). JavaScript ignores the copy it has already handled.
  private func send(_ event: String, _ info: Info) {
    let body: [String: Any] = [
      "event": event,
      "callId": info.callId,
      "conversationId": info.conversationId,
      "video": info.video,
    ]
    pending.append(body)
    if pending.count > 20 { pending.removeFirst(pending.count - 20) }
    module?.emit(event, body)
  }
}

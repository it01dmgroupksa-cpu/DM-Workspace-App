Pod::Spec.new do |s|
  s.name           = 'DmCallKit'
  s.version        = '1.0.0'
  s.summary        = 'Rings DM Workspace calls on iPhone like a phone call (CallKit + PushKit).'
  s.description    = 'Reports Messenger calls to CallKit from VoIP pushes and hands answer and hang-up to JavaScript.'
  s.author         = 'DM Workspace'
  s.homepage       = 'https://github.com/it01dmgroupksa-cpu/DM-Workspace-App'
  s.license        = { :type => 'UNLICENSED' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  # LiveKit's WebRTC build (already in the app through @livekit/react-native-webrtc):
  # CallKit hands the activated audio session to it.
  s.dependency 'LiveKitWebRTC'
  s.frameworks = 'CallKit', 'PushKit', 'AVFoundation'

  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.{h,m,mm,swift}'
end

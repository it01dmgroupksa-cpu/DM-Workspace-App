// "Touch up" for video calls on iPhone: a gentle skin smoothing, as on Android
// (BeautyProcessor.kt). Each camera frame goes through Core Image: a light blur, blended in
// only where the colour is skin, so eyes, hair, lips and the background keep their detail.
//
// Registered with LiveKit's WebRTC as the video effect "dm-beauty" when the app loads; the
// call screen puts it on the camera, and DmCallKitModule.setBeauty switches it (the choice
// lives in UserDefaults "dm.beauty"). Anything unusual sends the camera's own frame on.

#import <Foundation/Foundation.h>
#import <CoreImage/CoreImage.h>
#import <CoreVideo/CoreVideo.h>
#import <LiveKitWebRTC/RTCVideoCapturer.h>
#import <LiveKitWebRTC/RTCVideoFrame.h>
#import <LiveKitWebRTC/RTCCVPixelBuffer.h>

#if __has_include(<livekit_react_native_webrtc/ProcessorProvider.h>)
#import <livekit_react_native_webrtc/ProcessorProvider.h>
#elif __has_include(<livekit-react-native-webrtc/ProcessorProvider.h>)
#import <livekit-react-native-webrtc/ProcessorProvider.h>
#else
#import "ProcessorProvider.h"
#endif

static NSString *const kBeautyKey = @"dm.beauty";
static const float kStrength = 0.62f;
static const double kSlowSeconds = 0.028;

@interface DmBeautyProcessor : NSObject <VideoFrameProcessorDelegate>
@end

@implementation DmBeautyProcessor {
  CIContext *_context;
  NSData *_cube;
  CGColorSpaceRef _srgb;
  CVPixelBufferPoolRef _pool;
  int _width;
  int _height;
  BOOL _off;
  BOOL _enabled;
  int _frames;
  double _spent;
  int _sinceCheck;
}

+ (void)load {
  @autoreleasepool {
    [ProcessorProvider addProcessor:[DmBeautyProcessor new] forName:@"dm-beauty"];
  }
}

- (instancetype)init {
  self = [super init];
  if (self) {
    _srgb = CGColorSpaceCreateWithName(kCGColorSpaceSRGB);
    _cube = [DmBeautyProcessor skinCube];
    _enabled = [DmBeautyProcessor readEnabled];
  }
  return self;
}

- (void)dealloc {
  if (_pool) CVPixelBufferPoolRelease(_pool);
  if (_srgb) CGColorSpaceRelease(_srgb);
}

// On unless switched off in the call screen.
+ (BOOL)readEnabled {
  id value = [[NSUserDefaults standardUserDefaults] objectForKey:kBeautyKey];
  return value == nil ? YES : [value boolValue];
}

// A 32x32x32 colour cube that turns each colour into how much it looks like skin (0..1),
// times the strength: the mask that decides where the blur shows.
+ (NSData *)skinCube {
  const int n = 32;
  NSMutableData *data = [NSMutableData dataWithLength:n * n * n * 4 * sizeof(float)];
  float *p = (float *)data.mutableBytes;
  for (int b = 0; b < n; b++) {
    for (int g = 0; g < n; g++) {
      for (int r = 0; r < n; r++) {
        float R = r / (float)(n - 1), G = g / (float)(n - 1), B = b / (float)(n - 1);
        float cb = -0.1687f * R - 0.3313f * G + 0.5f * B + 0.5f;
        float cr = 0.5f * R - 0.4187f * G - 0.0813f * B + 0.5f;
        float y = 0.299f * R + 0.587f * G + 0.114f * B;
        float w = [self step:0.27f to:0.32f x:cb] * (1.0f - [self step:0.50f to:0.55f x:cb]) *
                  [self step:0.50f to:0.54f x:cr] * (1.0f - [self step:0.68f to:0.72f x:cr]) *
                  [self step:0.12f to:0.22f x:y];
        // The cube's output is read back in sRGB: undo the gamma so the mask stays linear.
        float v = powf(w * kStrength, 1.0f / 2.2f);
        *p++ = v;
        *p++ = v;
        *p++ = v;
        *p++ = 1.0f;
      }
    }
  }
  return data;
}

+ (float)step:(float)a to:(float)b x:(float)x {
  float t = fminf(fmaxf((x - a) / (b - a), 0.0f), 1.0f);
  return t * t * (3.0f - 2.0f * t);
}

- (LKRTCVideoFrame *)capturer:(LKRTCVideoCapturer *)capturer didCaptureVideoFrame:(LKRTCVideoFrame *)frame {
  // Re-read the switch about once a second.
  if (++_sinceCheck >= 30) {
    _sinceCheck = 0;
    _enabled = [DmBeautyProcessor readEnabled];
  }
  if (!_enabled || _off) return frame;
  if (![frame.buffer isKindOfClass:[LKRTCCVPixelBuffer class]]) return frame;
  @try {
    CFAbsoluteTime started = CFAbsoluteTimeGetCurrent();
    LKRTCVideoFrame *out = [self beautify:frame];
    [self watch:CFAbsoluteTimeGetCurrent() - started];
    return out ?: frame;
  } @catch (NSException *e) {
    _off = YES;
    return frame;
  }
}

// A phone that can't keep up gets the plain camera instead of a stuttering one.
- (void)watch:(double)seconds {
  _frames++;
  _spent += seconds;
  if (_frames < 60) return;
  if (_spent / _frames > kSlowSeconds) _off = YES;
  _frames = 0;
  _spent = 0;
}

- (LKRTCVideoFrame *)beautify:(LKRTCVideoFrame *)frame {
  CVPixelBufferRef source = ((LKRTCCVPixelBuffer *)frame.buffer).pixelBuffer;
  int width = (int)CVPixelBufferGetWidth(source);
  int height = (int)CVPixelBufferGetHeight(source);
  if (![self poolFor:width height:height]) return nil;
  if (!_context) _context = [CIContext contextWithOptions:@{kCIContextCacheIntermediates : @NO}];

  CIImage *image = [CIImage imageWithCVPixelBuffer:source];
  CGRect extent = image.extent;
  double sigma = 2.2 * fmax(MIN(width, height) / 720.0, 0.6);
  CIImage *blurred = [[[image imageByClampingToExtent] imageByApplyingGaussianBlurWithSigma:sigma]
      imageByCroppingToRect:extent];

  CIFilter *cube = [CIFilter filterWithName:@"CIColorCubeWithColorSpace"];
  [cube setValue:image forKey:kCIInputImageKey];
  [cube setValue:@32 forKey:@"inputCubeDimension"];
  [cube setValue:_cube forKey:@"inputCubeData"];
  [cube setValue:(__bridge id)_srgb forKey:@"inputColorSpace"];
  CIImage *mask = cube.outputImage;
  if (!mask) return nil;

  CIFilter *blend = [CIFilter filterWithName:@"CIBlendWithMask"];
  [blend setValue:blurred forKey:kCIInputImageKey];
  [blend setValue:image forKey:kCIInputBackgroundImageKey];
  [blend setValue:mask forKey:kCIInputMaskImageKey];
  CIImage *result = blend.outputImage;
  if (!result) return nil;

  CVPixelBufferRef target = NULL;
  if (CVPixelBufferPoolCreatePixelBuffer(kCFAllocatorDefault, _pool, &target) != kCVReturnSuccess || !target)
    return nil;
  [_context render:result toCVPixelBuffer:target bounds:extent colorSpace:_srgb];
  LKRTCCVPixelBuffer *buffer = [[LKRTCCVPixelBuffer alloc] initWithPixelBuffer:target];
  CVPixelBufferRelease(target);
  return [[LKRTCVideoFrame alloc] initWithBuffer:buffer rotation:frame.rotation timeStampNs:frame.timeStampNs];
}

- (BOOL)poolFor:(int)width height:(int)height {
  if (_pool && width == _width && height == _height) return YES;
  if (_pool) {
    CVPixelBufferPoolRelease(_pool);
    _pool = NULL;
  }
  NSDictionary *attributes = @{
    (id)kCVPixelBufferPixelFormatTypeKey : @(kCVPixelFormatType_32BGRA),
    (id)kCVPixelBufferWidthKey : @(width),
    (id)kCVPixelBufferHeightKey : @(height),
    (id)kCVPixelBufferIOSurfacePropertiesKey : @{},
  };
  if (CVPixelBufferPoolCreate(kCFAllocatorDefault, NULL, (__bridge CFDictionaryRef)attributes, &_pool) !=
      kCVReturnSuccess) {
    _pool = NULL;
    return NO;
  }
  _width = width;
  _height = height;
  return YES;
}

@end

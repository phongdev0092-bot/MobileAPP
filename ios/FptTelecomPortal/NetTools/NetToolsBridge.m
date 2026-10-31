#import <React/RCTBridgeModule.h>

/**
 * Objective-C Bridge để export NetTools Swift Module sang React Native
 */
@interface RCT_EXTERN_MODULE(NetTools, NSObject)

RCT_EXTERN_METHOD(pingOnce:(NSString *)host
                  ttl:(NSInteger)ttl
                  timeoutSec:(NSInteger)timeoutSec
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(resolveHost:(NSString *)host
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(tcpPingOnce:(NSString *)host
                  port:(NSInteger)port
                  timeoutMs:(NSInteger)timeoutMs
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

@end

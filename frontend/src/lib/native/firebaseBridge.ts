import { registerPlugin } from "@capacitor/core";

export type RemoteConfigFetchResult = {
  values: Record<string, string>;
};

export interface FirebaseBridgePlugin {
  logEvent(options: { name: string; params?: Record<string, unknown> }): Promise<void>;
  recordException(options: { message: string }): Promise<void>;
  fetchRemoteConfig(options: {
    keys: string[];
    defaults?: Record<string, string | number | boolean>;
    minFetchIntervalSeconds?: number;
  }): Promise<RemoteConfigFetchResult>;
}

export const FirebaseBridge = registerPlugin<FirebaseBridgePlugin>("FirebaseBridge");

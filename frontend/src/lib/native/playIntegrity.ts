import { registerPlugin } from "@capacitor/core";

export interface PlayIntegrityPlugin {
  requestToken(options: { nonce: string; cloudProjectNumber: number }): Promise<{ token: string }>;
}

export const PlayIntegrity = registerPlugin<PlayIntegrityPlugin>("PlayIntegrity");

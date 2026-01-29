export type TidioChatOpenOptions = {
  message?: string;
};

declare global {
  interface Window {
    tidioChatApi?: {
      open?: () => void;
      show?: () => void;
      display?: (visible: boolean) => void;
      // Some Tidio integrations expose a visitor message helper.
      messageFromVisitor?: (message: string) => void;
      sendMessage?: (message: string) => void;
      on?: (event: string, cb: () => void) => void;
    };
  }
}

const tryOpenNow = (options?: TidioChatOpenOptions): boolean => {
  if (typeof window === "undefined") return false;
  const api = window.tidioChatApi;
  if (!api) return false;

  try {
    api.display?.(true);
    api.show?.();
    api.open?.();

    const msg = options?.message?.trim();
    if (msg) {
      // Best-effort: these methods are not always available.
      api.messageFromVisitor?.(msg);
      api.sendMessage?.(msg);
    }

    return true;
  } catch {
    return false;
  }
};

/**
 * Opens the Tidio widget (bottom-right round chat) if available.
 * If the widget script isn't ready yet, retries briefly.
 */
export const openTidioChat = async (options?: TidioChatOpenOptions): Promise<boolean> => {
  if (tryOpenNow(options)) return true;

  if (typeof window === "undefined") return false;

  // Some pages may call this very early; retry for a short window.
  const start = Date.now();
  const timeoutMs = 5000;
  const intervalMs = 250;

  return await new Promise<boolean>((resolve) => {
    const tick = () => {
      if (tryOpenNow(options)) {
        resolve(true);
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        resolve(false);
        return;
      }
      window.setTimeout(tick, intervalMs);
    };

    tick();
  });
};

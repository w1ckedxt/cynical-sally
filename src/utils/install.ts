import { hasInstallPinged, markInstallPinged } from "./config.js";
import { trackEvent } from "./track.js";

/**
 * Fire a one-time "CLI installed" event on the first run of this install.
 *
 * - Fully fire-and-forget: never blocks or throws, never delays a command.
 * - Fires at most once per install. The flag is only set after a successful
 *   ping, so an offline first run retries on the next run instead of being
 *   lost.
 * - Sends only the install fingerprint (deviceId, version, OS, node) — never
 *   any code. The backend already defines the `CLI-INSTALL` event.
 */
export function trackInstall(): void {
  if (hasInstallPinged()) return;

  trackEvent("CLI-INSTALL").then((ok) => {
    if (ok) markInstallPinged();
  });
}

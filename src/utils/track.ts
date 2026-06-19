import { createRequire } from "node:module";
import { getDeviceId } from "./config.js";
import { API_BASE } from "./api.js";

const require = createRequire(import.meta.url);
// dist/utils/track.js → ../../package.json (repo root, both local and published)
const { version } = require("../../package.json") as { version: string };

const PING_TIMEOUT_MS = 5_000;

/**
 * Fire a fire-and-forget analytics event to the backend.
 *
 * - Never blocks, never throws, never delays a command.
 * - Sends only the install fingerprint (deviceId, version, OS, node) plus the
 *   caller-supplied properties — never any code.
 * - Returns a promise that resolves to `true` only when the backend accepted
 *   the event, so callers that gate a "once" flag can set it on success and
 *   retry on the next run after an offline failure.
 */
export function trackEvent(
  eventCode: string,
  properties: Record<string, unknown> = {},
): Promise<boolean> {
  const deviceId = getDeviceId();

  return fetch(`${API_BASE}/api/v1/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventCode,
      deviceId,
      source: "cli",
      properties: {
        ...properties,
        // First-party telemetry dimensions win — a caller can't overwrite them.
        version,
        os: process.platform,
        node: process.version,
      },
    }),
    signal: AbortSignal.timeout(PING_TIMEOUT_MS),
  })
    .then((res) => res.ok)
    .catch(() => false);
}

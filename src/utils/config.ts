import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";

const CONFIG_DIR = join(homedir(), ".sally");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

interface SallyConfig {
  device_id?: string;
  email?: string;
  tools_hint_shown?: boolean;
  privacy_notice_shown?: boolean;
  roast_count?: number;
  star_hint_shown?: boolean;
  install_pinged?: boolean;
  first_roast_pinged?: boolean;
  verdict_hint_shown?: boolean;
  share_hint_shown?: boolean;
}

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
}

function readConfig(): SallyConfig {
  if (!existsSync(CONFIG_FILE)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function writeConfig(config: SallyConfig): void {
  ensureConfigDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
}

/** Get or create a persistent device ID */
export function getDeviceId(): string {
  const config = readConfig();
  if (config.device_id) return config.device_id;

  const id = randomUUID();
  config.device_id = id;
  writeConfig(config);
  return id;
}

/** Save email after successful login */
export function saveEmail(email: string): void {
  const config = readConfig();
  config.email = email;
  writeConfig(config);
}

/** Get stored email */
export function getEmail(): string | undefined {
  return readConfig().email;
}

/** Clear session (logout) */
export function clearSession(): void {
  const config = readConfig();
  delete config.email;
  writeConfig(config);
}

/** Check if user is logged in */
export function isLoggedIn(): boolean {
  return !!readConfig().email;
}

/** Show tools hint once, then never again. Returns true if this is the first time. */
export function showToolsHint(): boolean {
  const config = readConfig();
  if (config.tools_hint_shown) return false;
  config.tools_hint_shown = true;
  writeConfig(config);
  return true;
}

/** Show the privacy reassurance once, then never again. Returns true the first time. */
export function showPrivacyNotice(): boolean {
  const config = readConfig();
  if (config.privacy_notice_shown) return false;
  config.privacy_notice_shown = true;
  writeConfig(config);
  return true;
}

/** All-time completed roasts for this install (0 if none yet). */
export function getRoastCount(): number {
  return readConfig().roast_count ?? 0;
}

/** Count a completed roast. Returns the new all-time total for this install. */
export function bumpRoastCount(): number {
  const config = readConfig();
  config.roast_count = (config.roast_count ?? 0) + 1;
  writeConfig(config);
  return config.roast_count;
}

/** Whether the one-time install ping has already been sent for this install. */
export function hasInstallPinged(): boolean {
  return !!readConfig().install_pinged;
}

/** Mark the install ping as sent so it never fires again for this install. */
export function markInstallPinged(): void {
  const config = readConfig();
  config.install_pinged = true;
  writeConfig(config);
}

/** Show the star-the-repo nudge once, after the user has a few roasts in. */
export function showStarHint(roastCount: number): boolean {
  if (roastCount < 3) return false;
  const config = readConfig();
  if (config.star_hint_shown) return false;
  config.star_hint_shown = true;
  writeConfig(config);
  return true;
}

/** Whether the one-time "first roast" event has already been sent for this install. */
export function hasFirstRoastPinged(): boolean {
  return !!readConfig().first_roast_pinged;
}

/** Mark the first-roast event as sent so it never fires again for this install. */
export function markFirstRoastPinged(): void {
  const config = readConfig();
  config.first_roast_pinged = true;
  writeConfig(config);
}

/**
 * Show the "get a badge for your README" nudge once, after the user keeps
 * coming back — but only in a repo where a verdict badge actually makes sense.
 */
export function showVerdictHint(roastCount: number): boolean {
  if (roastCount < 2) return false;
  const config = readConfig();
  if (config.verdict_hint_shown) return false;
  config.verdict_hint_shown = true;
  writeConfig(config);
  return true;
}

/** Show the "this is shareable" nudge once, at a moment of peak delight. */
export function showShareHint(): boolean {
  const config = readConfig();
  if (config.share_hint_shown) return false;
  config.share_hint_shown = true;
  writeConfig(config);
  return true;
}

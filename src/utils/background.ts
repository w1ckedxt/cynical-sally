import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync, openSync, statSync, truncateSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { exec } from "node:child_process";

const RESULTS_DIR = join(homedir(), ".sally", "results");

/** Ensure results directory exists */
function ensureResultsDir(): void {
  if (!existsSync(RESULTS_DIR)) {
    mkdirSync(RESULTS_DIR, { recursive: true, mode: 0o700 });
  }
}

/** Save a background job result for `sally results` to pick up */
export function saveResult(result: object, source: string): string {
  ensureResultsDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `review-${timestamp}.json`;
  const filepath = join(RESULTS_DIR, filename);
  writeFileSync(filepath, JSON.stringify({ ...result, _source: source, _savedAt: new Date().toISOString() }, null, 2), { mode: 0o600 });
  return filepath;
}

/** Sanitize string for safe shell use */
function shellEscape(s: string): string {
  return s.replace(/[\\'"$`!]/g, "\\$&").slice(0, 200);
}

/** Send OS notification */
export function sendNotification(title: string, message: string): void {
  const safeTitle = shellEscape(title);
  const safeMessage = shellEscape(message);
  if (process.platform === "darwin") {
    exec(`osascript -e 'display notification "${safeMessage}" with title "${safeTitle}"'`);
  } else if (process.platform === "linux") {
    exec(`notify-send "${safeTitle}" "${safeMessage}"`);
  }
}

/** Spawn a detached background worker running sally roast with --bg-worker */
export function spawnBackgroundWorker(args: string[], cwd: string): void {
  ensureResultsDir();
  const sallyBin = process.argv[1];
  const logFile = join(homedir(), ".sally", "bg.log");

  // Cap the background log so it can't grow without bound across many runs.
  const MAX_LOG_BYTES = 256 * 1024;
  try {
    if (existsSync(logFile) && statSync(logFile).size > MAX_LOG_BYTES) {
      truncateSync(logFile, 0);
    }
  } catch {
    // Non-critical — worst case the log just keeps its previous size.
  }

  const out = openSync(logFile, "a", 0o600);

  const child = spawn(process.execPath, [sallyBin, "roast", ...args, "--bg-worker"], {
    detached: true,
    stdio: ["ignore", out, out],
    cwd,
  });
  child.unref();
}

/** Ask user if they want to background the Full Truth review (single keypress) */
export function askBackground(promptText: string): Promise<boolean> {
  return new Promise((resolve) => {
    console.log(promptText);

    if (!process.stdin.isTTY) {
      resolve(false);
      return;
    }

    let resolved = false;

    const finish = (result: boolean) => {
      if (resolved) return;
      resolved = true;
      try {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeAllListeners("data");
      } catch {
        // ignore cleanup errors
      }
      resolve(result);
    };

    try {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding("utf8");

      process.stdin.on("data", (key: string) => {
        if (key === "\x03") process.exit(0); // Ctrl+C
        finish(key.toLowerCase() === "b");
      });
    } catch {
      finish(false);
      return;
    }

    // Auto-continue after 8 seconds
    setTimeout(() => finish(false), 8000);
  });
}

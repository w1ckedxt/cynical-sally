import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { RoastResponse } from "./api.js";

const SALLY_DIR = join(homedir(), ".sally");
const HISTORY_FILE = join(SALLY_DIR, "history.json");

// Surface a recurring-sin line once a code has shown up this many times.
const RECUR_THRESHOLD = 3;
// Keep the history file bounded — only the most-seen sins are worth remembering.
const MAX_CODES = 100;

interface SinRecord {
  count: number;
  title: string;
}

type History = Record<string, SinRecord>;

function readHistory(): History {
  if (!existsSync(HISTORY_FILE)) return {};
  try {
    return JSON.parse(readFileSync(HISTORY_FILE, "utf-8")) as History;
  } catch {
    return {};
  }
}

function writeHistory(history: History): void {
  try {
    if (!existsSync(SALLY_DIR)) mkdirSync(SALLY_DIR, { recursive: true, mode: 0o700 });
    writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2) + "\n", { mode: 0o600 });
  } catch {
    // Non-critical — memory is a personality nicety, never load-bearing.
  }
}

/** Prune to the most-seen codes so the file can't grow without bound. */
function prune(history: History): History {
  const entries = Object.entries(history);
  if (entries.length <= MAX_CODES) return history;
  const kept = entries.sort((a, b) => b[1].count - a[1].count).slice(0, MAX_CODES);
  return Object.fromEntries(kept);
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Sally's line for a sin she's seen one too many times. */
function sinLine(code: string, count: number, title: string): string {
  const label = title?.trim() || code;
  if (count === RECUR_THRESHOLD) {
    return `Third time I've flagged "${label}". Coincidence, surely.`;
  }
  return `That's the ${ordinal(count)} time you've shipped "${label}". I'm starting to think it's on purpose.`;
}

/**
 * Record this review's issue codes locally and, if one has now recurred enough
 * times across runs, return a single Sally one-liner about it (else null).
 *
 * Only full_truth reviews carry `issue_code`s, so quick roasts are a no-op.
 * Entirely local: nothing is sent anywhere; it just makes Sally feel like she
 * remembers your habits.
 */
export function recordIssues(response: RoastResponse): string | null {
  const issues = response.data.issues;
  if (!issues || issues.length === 0) return null;

  const history = readHistory();

  // Codes unique to this review so a single run can't inflate a count.
  const seen = new Set<string>();
  let worst: { code: string; count: number; title: string } | null = null;

  for (const issue of issues) {
    const code = issue.issue_code;
    if (!code || seen.has(code)) continue;
    seen.add(code);

    const rec = history[code] ?? { count: 0, title: issue.title };
    rec.count += 1;
    rec.title = issue.title || rec.title;
    history[code] = rec;

    if (rec.count >= RECUR_THRESHOLD && (!worst || rec.count > worst.count)) {
      worst = { code, count: rec.count, title: rec.title };
    }
  }

  writeHistory(prune(history));

  return worst ? sinLine(worst.code, worst.count, worst.title) : null;
}

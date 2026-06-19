import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import { getGitHubRemote } from "./git.js";
import type { RoastResponse } from "./api.js";

const REPORT_DIR = ".sally";
const INNER = 54; // inner width between the box borders

/** Where the repo lives, for the card footer. */
function repoLine(): string {
  const remote = getGitHubRemote();
  if (remote) return `github.com/${remote.owner}/${remote.repo}`;
  return "cynicalsally.com";
}

/** A 10-segment score bar using block characters (all display width 1). */
function scoreBar(score: number): string {
  const filled = Math.max(0, Math.min(10, Math.round(score)));
  return "█".repeat(filled) + "░".repeat(10 - filled);
}

/** One savage line — the sneer if we have it, else the opening of the roast. */
export function savageLine(response: RoastResponse): string {
  const sneer = response.voice.hardest_sneer?.trim();
  if (sneer) return sneer;
  const firstSentence = response.voice.roast?.split(/(?<=[.!?])\s/)[0]?.trim();
  return firstSentence || "No notes. That's the scariest part.";
}

/** Receipt-style one-liner — frames the roast as competence (issues caught),
 *  which is far more shareable for a dev than a low score alone. */
export function receiptLine(response: RoastResponse): string {
  const n = response.data.issues?.length ?? response.data.actionable_fixes?.length ?? 0;
  const where = (() => {
    const remote = getGitHubRemote();
    return remote ? `${remote.owner}/${remote.repo}` : "my code";
  })();
  if (n > 0) {
    return `Sally found ${n} issue${n !== 1 ? "s" : ""} in ${where} · ${response.data.score.toFixed(1)}/10`;
  }
  return `Sally roasted ${where} · ${response.data.score.toFixed(1)}/10`;
}

/** Up to two short findings: real issues first, then fixes, then observations. */
function topFindings(response: RoastResponse): string[] {
  const { data, voice } = response;

  if (data.issues && data.issues.length > 0) {
    return data.issues.slice(0, 2).map((i) => i.title.trim());
  }
  if (data.actionable_fixes && data.actionable_fixes.length > 0) {
    return data.actionable_fixes.slice(0, 2).map((f) => f.trim());
  }
  // Quick roast: pull the middle observations from the roast body.
  const paragraphs = voice.roast.split("\n\n").map((p) => p.trim()).filter(Boolean);
  const observations = paragraphs.slice(1).slice(0, 2);
  return observations.map((o) => {
    const firstSentence = o.split(/(?<=[.!?])\s/)[0].trim();
    return firstSentence;
  });
}

/** Wrap plain text (no ANSI) to a width. */
function wrap(text: string, width: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current.length + word.length + 1 > width && current) {
      lines.push(current);
      current = word;
    } else {
      current = current ? current + " " + word : word;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

/**
 * Build the inner content lines of the card (no borders), each padded to INNER.
 * Plain strings only — alignment math depends on width-1 characters.
 */
function cardLines(response: RoastResponse): string[] {
  const pad = (s: string) => "  " + s.padEnd(INNER - 2);
  const lines: string[] = [];

  lines.push(pad("CYNICAL SALLY  ·  CODE ROAST"));
  lines.push(pad(""));
  lines.push(pad(`Score  ${response.data.score.toFixed(1)} / 10   ${scoreBar(response.data.score)}`));
  lines.push(pad(""));

  // Savage quote
  const quote = wrap(`"${savageLine(response)}"`, INNER - 4);
  for (const q of quote) lines.push(pad(q));
  lines.push(pad(""));

  // Two findings
  for (const finding of topFindings(response)) {
    const wrapped = wrap(`- ${finding}`, INNER - 4);
    wrapped.forEach((w, idx) => lines.push(pad(idx === 0 ? w : `  ${w}`)));
  }
  lines.push(pad(""));

  lines.push(pad("Roasted by Cynical Sally · cynicalsally.com"));
  lines.push(pad(repoLine()));

  return lines;
}

function topBorder(): string {
  return "╔" + "═".repeat(INNER) + "╗";
}
function bottomBorder(): string {
  return "╚" + "═".repeat(INNER) + "╝";
}

/** Plain (no-ANSI) card, for saving to a file or copy-pasting. */
function plainCard(response: RoastResponse): string {
  const out: string[] = [topBorder()];
  for (const line of cardLines(response)) {
    out.push("║" + line + "║");
  }
  out.push(bottomBorder());
  return out.join("\n");
}

/** Save the card as a screenshot/copy-friendly markdown file. Returns the path. */
function saveCard(response: RoastResponse): string | null {
  try {
    const dir = join(process.cwd(), REPORT_DIR);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });

    const now = new Date();
    const date = now.toISOString().split("T")[0];
    const time = now.toISOString().split("T")[1].slice(0, 8).replace(/:/g, "");
    const filename = `roast-card-${date}-${time}.md`;
    const filepath = join(dir, filename);

    const md: string[] = [];
    md.push(`**${receiptLine(response)}**`);
    md.push("");
    md.push("```");
    md.push(plainCard(response));
    md.push("```");
    md.push("");
    md.push(`> "${savageLine(response)}"`);
    md.push("");
    md.push(`**Score:** ${response.data.score.toFixed(1)}/10`);
    md.push("");
    for (const finding of topFindings(response)) {
      md.push(`- ${finding}`);
    }
    md.push("");
    md.push(`— Roasted by [Cynical Sally](https://cynicalsally.com) · \`${repoLine()}\``);
    md.push("");

    writeFileSync(filepath, md.join("\n"), { mode: 0o600 });
    return join(REPORT_DIR, filename);
  } catch {
    return null;
  }
}

/** Print the roast card to the terminal and save a shareable copy. */
export function printRoastCard(response: RoastResponse): void {
  const border = chalk.magenta;
  console.log();
  console.log("  " + border(topBorder()));
  for (const line of cardLines(response)) {
    console.log("  " + border("║") + chalk.white(line) + border("║"));
  }
  console.log("  " + border(bottomBorder()));
  console.log();

  const saved = saveCard(response);
  if (saved) {
    console.log(chalk.gray("  📇 Card saved to ") + chalk.cyan(saved) + chalk.gray(" — screenshot it, share it.\n"));
  }
}

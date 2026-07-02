import { Command } from "commander";
import chalk from "chalk";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { isGitRepo, getGitHubRemote, getRepoRoot } from "../utils/git.js";
import { trackEvent } from "../utils/track.js";

// The badge lives on the public domain, not the API host — it must keep
// working in READMEs even if the backend ever moves.
const BADGE_HOST = "https://cynicalsally.com";
const BADGE_PATH_MARKER = "/api/v1/badge/repo/";
const BADGE_CHECK_TIMEOUT_MS = 5_000;

interface VerdictState {
  reviewed: boolean;
  score?: number;
  label?: string;
}

/** Same construction as the backend's /v1/verdict response — keep in sync. */
function badgeSnippets(owner: string, repo: string) {
  const badgeUrl = `${BADGE_HOST}${BADGE_PATH_MARKER}${owner}/${repo}`;
  return {
    badgeUrl,
    markdown: `[![Cynical Sally](${badgeUrl})](https://cynicalsally.com)`,
    shieldsMarkdown: `[![Cynical Sally](https://img.shields.io/endpoint?url=${encodeURIComponent(`${badgeUrl}/shields`)})](https://cynicalsally.com)`,
  };
}

/**
 * The badge route's ETag encodes the verdict state:
 * `W/"none"` when unreviewed, `W/"<score>-<LABEL>-<timestamp>"` otherwise.
 * Cheaper than a verdict and burns zero quota.
 */
async function fetchVerdictState(badgeUrl: string): Promise<VerdictState | null> {
  try {
    const res = await fetch(badgeUrl, {
      method: "GET",
      signal: AbortSignal.timeout(BADGE_CHECK_TIMEOUT_MS),
    });
    const etag = res.headers.get("etag");
    if (!etag) return null;
    if (etag.includes('"none"')) return { reviewed: false };
    const match = etag.match(/^W\/"([0-9.]+)-(.+)-\d+"$/);
    if (!match) return { reviewed: true };
    return { reviewed: true, score: parseFloat(match[1]), label: match[2] };
  } catch {
    return null;
  }
}

/** Insert the badge right under the first H1, or at the very top. */
function insertBadge(readme: string, markdown: string): string {
  const lines = readme.split("\n");
  const h1Index = lines.findIndex((line) => /^#\s/.test(line));
  if (h1Index === -1) {
    return `${markdown}\n\n${readme}`;
  }
  lines.splice(h1Index + 1, 0, "", markdown);
  return lines.join("\n");
}

export const badgeCommand = new Command("badge")
  .description("Print your verdict badge for the README — or add it yourself with --add.")
  .option("--add", "Insert the badge into README.md (right under the title)")
  .action(async (options) => {
    // ── Same guards as verdict: git repo + GitHub remote ──
    if (!isGitRepo()) {
      console.log(chalk.red("\nThis isn't a git repo.") + chalk.gray(" sally badge needs git.\n"));
      process.exit(1);
    }
    const remote = getGitHubRemote();
    if (!remote) {
      console.log(chalk.red("\nNo GitHub remote detected."));
      console.log(chalk.gray("The badge is tied to a GitHub repo. Set a remote with: ") + chalk.cyan("git remote add origin https://github.com/you/repo.git\n"));
      process.exit(1);
    }

    const { badgeUrl, markdown, shieldsMarkdown } = badgeSnippets(remote.owner, remote.repo);
    const repoLabel = chalk.cyan(`${remote.owner}/${remote.repo}`);

    // ── Zero-quota verdict check via the badge ETag ──
    const state = await fetchVerdictState(badgeUrl);

    if (state && !state.reviewed) {
      console.log();
      console.log(chalk.yellow(`  I haven't judged ${remote.owner}/${remote.repo} yet.`) + chalk.gray(" A badge without a verdict is just a sticker."));
      console.log(chalk.gray("  Earn it first: ") + chalk.cyan("sally verdict") + "\n");
      process.exit(1);
    }

    console.log();
    if (state?.score != null && state.label) {
      console.log(chalk.gray("  Current verdict for ") + repoLabel + chalk.gray(": ") + chalk.yellow(`${state.score}/10 ${state.label}`));
    } else if (state === null) {
      console.log(chalk.gray(`  Couldn't reach the judge's chambers to check ${remote.owner}/${remote.repo} — the badge sorts itself out either way.`));
    }
    console.log(chalk.gray("  The badge updates itself every time you run ") + chalk.cyan("sally verdict") + chalk.gray(". No maintenance, just judgment."));
    console.log();

    // ── --add: write it into README.md ──
    if (options.add) {
      const root = getRepoRoot();
      const readmePath = root ? join(root, "README.md") : null;

      if (!readmePath || !existsSync(readmePath)) {
        console.log(chalk.yellow("  No README.md found.") + chalk.gray(" A badge needs a wall to hang on — write a README first."));
        console.log(chalk.gray("  Then paste this under the title:\n"));
        console.log(chalk.white(`  ${markdown}\n`));
        process.exit(1);
      }

      const readme = readFileSync(readmePath, "utf-8");
      if (readme.includes(BADGE_PATH_MARKER)) {
        console.log(chalk.green("  The badge is already in your README.") + chalk.gray(" Eager. I respect it.\n"));
        return;
      }

      writeFileSync(readmePath, insertBadge(readme, markdown));
      void trackEvent("CLI-BADGE-ADDED", { rated: state?.reviewed ?? null });

      console.log(chalk.green("  Badge added to README.md.") + chalk.gray(" Right under the title, where it belongs."));
      console.log(chalk.gray("  Now commit it before you change your mind:"));
      console.log(chalk.cyan('  git add README.md && git commit -m "docs: add Cynical Sally badge"') + "\n");
      return;
    }

    // ── Default: print the snippets ──
    console.log(chalk.magenta.bold("  Add this to your README:"));
    console.log();
    console.log(chalk.white(`  ${markdown}`));
    console.log();
    console.log(chalk.gray("  Or use shields.io:"));
    console.log(chalk.gray(`  ${shieldsMarkdown}`));
    console.log();
    console.log(chalk.gray("  Too much copy-pasting? ") + chalk.cyan("sally badge --add") + chalk.gray(" does it for you."));
    console.log();
  });

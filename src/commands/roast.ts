import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { resolve } from "node:path";
import { statSync } from "node:fs";
import { scanFileForReview, collectFilesDetailed } from "../utils/files.js";
import { submitRoast, createShareCard } from "../utils/api.js";
import { displayRoast, printSally, handleApiError } from "../utils/output.js";
import { saveReport } from "../utils/report.js";
import { printDryRun } from "../utils/dryrun.js";
import { printRoastCard, savageLine } from "../utils/card.js";
import { askBackground, spawnBackgroundWorker, saveResult, sendNotification } from "../utils/background.js";
import { getFlavor } from "../utils/flavor.js";
import {
  showToolsHint, showPrivacyNotice, getEmail, bumpRoastCount, showStarHint,
  hasFirstRoastPinged, markFirstRoastPinged, showVerdictHint, showShareHint,
} from "../utils/config.js";
import { trackEvent } from "../utils/track.js";
import { recordIssues } from "../utils/memory.js";
import { isGitRepo, getStagedChanges, getUnstagedChanges, getLastCommitDiff, getBranchDiff, parseDiffToFiles, getGitHubRemote } from "../utils/git.js";
import type { ReviewFile, SkippedFile } from "../utils/files.js";

/** Options accepted by a roast run — mirrors the command's flags so the guided
 *  first-run flow and the `roast` command can share one implementation. */
export interface RoastOptions {
  staged?: boolean;
  diff?: string;
  mode?: string;
  tone?: string;
  lang?: string;
  json?: boolean;
  failUnder?: number;
  ci?: boolean;
  bg?: boolean;
  dryRun?: boolean;
  card?: boolean;
  share?: boolean;
  bgWorker?: boolean;
}

/** Bucket a 0–10 score into a coarse band so analytics never carry exact code signal. */
function scoreBucket(score: number): string {
  if (score < 4) return "0-4";
  if (score < 7) return "4-7";
  return "7-10";
}

export const roastCommand = new Command("roast")
  .description("Roast your code. Files, directories, staged changes, or branch diffs.")
  .argument("[paths...]", "Files or directories to roast")
  .option("--staged", "Roast staged git changes")
  .option("--diff <branch>", "Roast diff against a branch (e.g. main)")
  .option("-m, --mode <mode>", "Review mode: quick (default) or full_truth", "quick")
  .option("--tone <tone>", "Tone: cynical, neutral, or professional", "cynical")
  .option("--lang <lang>", "Language for the roast", "en")
  .option("--json", "Output raw JSON (for piping/CI)")
  .option("--fail-under <score>", "Exit with code 1 if score is below threshold", parseFloat)
  .option("--ci", "CI mode: compact output + exit codes")
  .option("--bg", "Run Full Truth in the background — get notified when done")
  .option("--dry-run", "Show exactly what would be sent (files, sizes, tokens, SHA-256) and send NOTHING")
  .option("--card", "Print a shareable roast card after the review")
  .option("--share", "Create a public share link for this roast — only the score + sneer go public, never your code")
  .option("--bg-worker")
  .action(runRoast);

export async function runRoast(paths: string[], options: RoastOptions): Promise<void> {
    // ── Collect files ──────────────────────────────────────────────────
    let files: ReviewFile[] = [];
    let skipped: SkippedFile[] = [];
    let truncated = false;
    let source = "";

    try {
      if (options.staged) {
        if (!isGitRepo()) {
          console.log(chalk.red("\nThis isn't a git repo.") + chalk.gray(" I need git for --staged. I'm demanding like that.\n"));
          process.exit(1);
        }
        const diff = getStagedChanges();
        if (!diff.trim()) {
          console.log(chalk.yellow("\nNothing staged.") + " I can't roast air. " + chalk.cyan("git add <files>") + " first.\n");
          process.exit(1);
        }
        files = parseDiffToFiles(diff);
        source = "staged changes";
      } else if (options.diff) {
        if (!isGitRepo()) {
          console.log(chalk.red("\nThis isn't a git repo.") + chalk.gray(" --diff needs git. Obviously.\n"));
          process.exit(1);
        }
        const diff = getBranchDiff(options.diff);
        if (!diff.trim()) {
          console.log(chalk.yellow("\nNo diff against ") + chalk.cyan(options.diff) + chalk.yellow(". Either you haven't changed anything, or you're diffing against yourself. Both are concerning.\n"));
          process.exit(1);
        }
        files = parseDiffToFiles(diff);
        source = `diff vs ${options.diff}`;
      } else if (paths.length > 0) {
        for (const p of paths) {
          const resolved = resolve(p);
          let stat;
          try {
            stat = statSync(resolved);
          } catch {
            console.log(chalk.red(`\nCan't find ${p}.`) + chalk.gray(" Did you typo your own file path? Classic.\n"));
            process.exit(1);
          }

          if (stat.isDirectory()) {
            const collected = collectFilesDetailed(resolved);
            files.push(...collected.files);
            skipped.push(...collected.skipped);
            if (collected.truncated) truncated = true;
          } else if (stat.isFile()) {
            const scan = scanFileForReview(resolved, p);
            if (scan.ok) {
              files.push(scan.file);
            } else {
              skipped.push(scan.skip);
              if (!options.dryRun) {
                console.log(chalk.yellow(`Skipped: ${p}`) + chalk.gray(" — binary, too large, or something I refuse to read."));
              }
            }
          }
        }
        source = paths.join(", ");
      } else {
        // ── Smart auto-detect: no args = roast current directory ───────
        if (isGitRepo()) {
          // Try git-aware detection first
          const staged = getStagedChanges();
          if (staged.trim()) {
            files = parseDiffToFiles(staged);
            source = "staged changes";
            console.log(chalk.gray("\n  Found your staged changes. Let's see what you think is ready.\n"));
          }

          if (files.length === 0) {
            const unstaged = getUnstagedChanges();
            if (unstaged.trim()) {
              files = parseDiffToFiles(unstaged);
              source = "unstaged changes";
              console.log(chalk.gray("\n  Found uncommitted changes. Too scared to commit? Let me see why.\n"));
            }
          }

          if (files.length === 0) {
            try {
              const lastCommit = getLastCommitDiff();
              if (lastCommit.trim()) {
                files = parseDiffToFiles(lastCommit);
                source = "last commit";
                console.log(chalk.gray("\n  Nothing new? Fine, I'll roast your last commit.\n"));
              }
            } catch {
              // No commits yet — fall through to directory scan
            }
          }
        }

        // Fallback: just scan the current directory
        if (files.length === 0) {
          const cwd = resolve(".");
          const collected = collectFilesDetailed(cwd);
          if (collected.files.length > 0) {
            files = collected.files;
            skipped = collected.skipped;
            truncated = collected.truncated;
            source = ".";
            console.log(chalk.gray(`\n  Scanning this directory. Let's see what we're working with.\n`));
          }
        }

        if (files.length === 0) {
          console.log(
            chalk.yellow("\nThere's literally nothing here to roast.") +
              chalk.gray(" No code files found. Is this even a project?\n")
          );
          process.exit(1);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(chalk.red(`\nSomething broke: ${msg}`) + chalk.gray("\nNot my fault. Probably.\n"));
      process.exit(1);
    }

    // ── Dry run: show exactly what would be sent, then send NOTHING ──────
    if (options.dryRun && (files.length > 0 || skipped.length > 0)) {
      printSally();
      console.log();
      printDryRun({
        files,
        skipped,
        truncated,
        mode: options.mode === "quick" ? "quick" : "full_truth",
        source: source || ".",
      });
      return;
    }

    if (files.length === 0) {
      console.log(chalk.yellow("\nNo reviewable files found.") + chalk.gray(" Everything was binary, too large, or otherwise beneath me.\n"));
      process.exit(1);
    }

    // ── Call API ───────────────────────────────────────────────────────
    const mode = options.mode === "quick" ? "quick" : "full_truth";
    const fileCount = `${files.length} file${files.length !== 1 ? "s" : ""}`;

    const f = getFlavor();

    // Sally appears first — always
    if (!options.bgWorker) {
      printSally();
      console.log();
    }

    // Background mode for Full Truth
    if (mode === "full_truth" && !options.bgWorker) {
      const wantBg = options.bg || (!options.json && !options.ci && await askBackground(
        chalk.magenta(`  ${f.bg_prompt}`) + "\n"
      ));

      if (wantBg) {
        const bgArgs: string[] = [];
        for (const p of paths) bgArgs.push(p);
        if (options.staged) bgArgs.push("--staged");
        if (options.diff) bgArgs.push("--diff", options.diff);
        bgArgs.push("-m", "full_truth");
        if (options.tone && options.tone !== "cynical") bgArgs.push("--tone", options.tone);
        if (options.lang && options.lang !== "en") bgArgs.push("--lang", options.lang);

        console.log(chalk.magenta(`  ${f.bg_confirmed}`));
        console.log(chalk.gray(`\n  ${f.bg_results_hint}\n`));

        spawnBackgroundWorker(bgArgs, process.cwd());
        return;
      }
    }

    const spinnerText = mode === "full_truth"
      ? `${f.spinner_ft} (${source})`
      : `${f.spinner_quick} (${source})`;

    const spinner = ora({ text: options.bgWorker ? "Background review running..." : spinnerText, color: "magenta" }).start();

    try {
      const response = await submitRoast({
        type: "code",
        files,
        mode,
        tone: options.tone || "cynical",
        lang: options.lang || "en",
      });

      spinner.stop();

      if (options.bgWorker) {
        // Background worker: save result + send notification, no display
        const savedPath = saveReport(response, source);
        saveResult(response, source);
        sendNotification(
          "Sally's done.",
          `Score: ${response.data.score.toFixed(1)}/10 — run 'sally results' to see the verdict.`,
        );
        if (savedPath) {
          sendNotification("Report saved", savedPath);
        }
        process.exit(0);
      } else if (options.json) {
        console.log(JSON.stringify(response, null, 2));
      } else {
        displayRoast(response);

        const score = response.data.score;
        const remote = getGitHubRemote();

        // One-time "first roast happened" event — the activation signal that
        // tells us how many installs ever reach real value. Score is bucketed;
        // no code, paths, or content ever leave. Fire-and-forget.
        if (!hasFirstRoastPinged()) {
          trackEvent("CLI-FIRST-ROAST", { mode, score_bucket: scoreBucket(score) })
            .then((ok) => { if (ok) markFirstRoastPinged(); });
        }

        // Recurring-sin memory (full_truth): "4th time you've done this".
        const sinLine = recordIssues(response);
        if (sinLine) {
          console.log(chalk.gray("  " + sinLine));
          console.log();
        }

        // Shareable roast card (--card)
        if (options.card) {
          printRoastCard(response);
        }

        // Public share link (--share) — publishes only the score + sneer, never code
        if (options.share) {
          try {
            const shared = await createShareCard({
              sneer: savageLine(response),
              score,
              lang: response.meta.lang,
              subject: remote ? `${remote.owner}/${remote.repo}` : undefined,
              style: score >= 8 ? "brag" : "receipt",
            });
            console.log(chalk.gray("  🔗 Share your shame: ") + chalk.cyan(shared.url));
            console.log();
          } catch {
            console.log(chalk.yellow("  Couldn't create a share link right now.") + chalk.gray(" The roast still happened. You witnessed it.\n"));
          }
        }

        // First-run privacy reassurance (once per install)
        if (showPrivacyNotice()) {
          console.log();
          console.log(chalk.gray("  I won't remember your code, your secrets, or your next billion-dollar exit —"));
          console.log(chalk.gray("  your files are reviewed and discarded. We get that this matters: ") + chalk.cyan("cynicalsally.com/privacy"));
        }

        // Show premium tools hint (once per install, not for Full Suite users)
        if (mode === "quick" && !getEmail() && showToolsHint()) {
          console.log(chalk.gray("  " + "\u2500".repeat(56)));
          console.log();
          console.log(chalk.gray("  You also get ") + chalk.white("1 free trial") + chalk.gray(" of each premium tool:"));
          console.log(chalk.cyan("    sally explain") + chalk.gray("    sally refactor") + chalk.gray("    sally brainstorm"));
          console.log(chalk.cyan("    sally frontend") + chalk.gray("   sally marketing") + chalk.gray("    sally review-pr"));
          console.log();
        }

        // Auto-save Full Truth reviews as markdown report
        if (mode === "full_truth") {
          const savedPath = saveReport(response, source);
          if (savedPath) {
            console.log(chalk.gray("  💾 ") + chalk.gray("Saved this verdict to ") + chalk.cyan(savedPath));
            console.log();
          }
        }

        // ── One growth nudge per run, by priority: shareable win → badge → star ──
        const roastCount = bumpRoastCount();
        if (!options.share && !options.card && !!process.stdout.isTTY && score >= 8 && showShareHint()) {
          // Receipt framing — a flex, not a humiliation. Devs share competence.
          console.log(chalk.gray("  That's a ") + chalk.green(`${score.toFixed(1)}/10`) + chalk.gray(" — objectively shareable. Publish a card (score + one-liner only,"));
          console.log(chalk.gray("  never your code): ") + chalk.cyan("sally roast --share"));
          console.log();
        } else if (remote && roastCount >= 2 && showVerdictHint(roastCount)) {
          // Badge loop — every README that adds Sally's badge markets Sally.
          console.log(chalk.gray("  Want a verdict badge for ") + chalk.cyan(`${remote.owner}/${remote.repo}`) + chalk.gray("'s README?"));
          console.log(chalk.gray("  Run ") + chalk.cyan("sally verdict") + chalk.gray(" — slap my judgment on your repo."));
          console.log();
        } else if (showStarHint(roastCount)) {
          console.log(chalk.gray("  Three roasts in and you keep coming back. Sweet. Star the repo"));
          console.log(chalk.gray("  so I can pretend I'm popular: ") + chalk.cyan("github.com/w1ckedxt/cynical-sally"));
          console.log();
        }

        // Signature footer — subtle, screenshot-friendly. Spreads in pastes.
        console.log(chalk.gray(`  ─ Roasted by Cynical Sally · ${score.toFixed(1)}/10 · cynicalsally.com`));
        console.log();
      }

      if (options.failUnder !== undefined && response.data.score < options.failUnder) {
        if (!options.json) {
          console.log(
            chalk.red(`\n  ${response.data.score.toFixed(1)}/10 — below your threshold of ${options.failUnder.toFixed(1)}. Told you.\n`)
          );
        }
        process.exit(1);
      }
    } catch (err) {
      spinner.stop();
      handleApiError(err);
      process.exit(1);
    }
}

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { resolve } from "node:path";
import { statSync } from "node:fs";
import { readFileForReview, collectFiles } from "../utils/files.js";
import { submitVerdict } from "../utils/api.js";
import { displayRoast, printSally, handleApiError } from "../utils/output.js";
import { isGitRepo, getGitHubRemote, getStagedChanges, getUnstagedChanges, getLastCommitDiff, getBranchDiff, parseDiffToFiles } from "../utils/git.js";
import type { ReviewFile } from "../utils/files.js";

export const verdictCommand = new Command("verdict")
  .description("Judge your repo + get a badge for your README.")
  .argument("[paths...]", "Files or directories to judge (default: auto-detect)")
  .option("--staged", "Judge staged git changes")
  .option("--diff <branch>", "Judge diff against a branch (e.g. main)")
  .option("-m, --mode <mode>", "Review mode: quick (default) or full_truth", "quick")
  .option("--tone <tone>", "Tone: cynical, neutral, or professional", "cynical")
  .option("--lang <lang>", "Language for the verdict", "en")
  .option("--json", "Output raw JSON")
  .option("--fail-under <score>", "Exit with code 1 if score is below threshold", parseFloat)
  .option("--ci", "CI mode: compact output + exit codes")
  .action(async (paths: string[], options) => {
    // ── Must be a git repo ──
    if (!isGitRepo()) {
      console.log(chalk.red("\nThis isn't a git repo.") + chalk.gray(" sally verdict needs git.\n"));
      process.exit(1);
    }

    // ── Must have a GitHub remote ──
    const remote = getGitHubRemote();
    if (!remote) {
      console.log(chalk.red("\nNo GitHub remote detected."));
      console.log(chalk.gray("sally verdict needs a GitHub remote (origin) to generate your badge."));
      console.log(chalk.gray("Set one with: ") + chalk.cyan("git remote add origin https://github.com/you/repo.git\n"));
      process.exit(1);
    }

    // ── Collect files (same cascade as roast) ──
    let files: ReviewFile[] = [];
    let source = "";

    try {
      if (options.staged) {
        const diff = getStagedChanges();
        if (!diff.trim()) {
          console.log(chalk.yellow("\nNothing staged.") + " I can't judge air.\n");
          process.exit(1);
        }
        files = parseDiffToFiles(diff);
        source = "staged changes";
      } else if (options.diff) {
        const diff = getBranchDiff(options.diff);
        if (!diff.trim()) {
          console.log(chalk.yellow("\nNo diff against ") + chalk.cyan(options.diff) + ".\n");
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
            console.log(chalk.red(`\nCan't find ${p}.\n`));
            process.exit(1);
          }
          if (stat.isDirectory()) {
            files.push(...collectFiles(resolved));
          } else if (stat.isFile()) {
            const file = readFileForReview(resolved);
            if (file) files.push(file);
          }
        }
        source = paths.join(", ");
      } else {
        // Auto-detect cascade: staged → unstaged → last commit → directory scan
        // Each tier checked explicitly with clear feedback
        const staged = getStagedChanges();
        if (staged.trim()) {
          files = parseDiffToFiles(staged);
          source = "staged changes";
        }

        if (files.length === 0) {
          const unstaged = getUnstagedChanges();
          if (unstaged.trim()) {
            files = parseDiffToFiles(unstaged);
            source = "unstaged changes";
          }
        }

        if (files.length === 0) {
          try {
            const lastCommit = getLastCommitDiff();
            if (lastCommit.trim()) {
              files = parseDiffToFiles(lastCommit);
              source = "last commit";
            }
          } catch {
            // no commits yet — fall through to directory scan
          }
        }

        if (files.length === 0) {
          files = collectFiles(process.cwd());
          source = "directory scan";
        }
      }

      if (files.length === 0) {
        console.log(chalk.yellow("\nNo files found to judge.") + chalk.gray(" Is this repo empty?\n"));
        process.exit(1);
      }
    } catch (err) {
      console.log(chalk.red("\nFailed to collect files:"), (err as Error).message, "\n");
      process.exit(1);
    }

    // ── Submit verdict ──
    printSally();
    const repoLabel = chalk.cyan(`${remote.owner}/${remote.repo}`);
    const spinnerText = `Judging ${remote.owner}/${remote.repo}...`;
    const spinner = ora({ text: spinnerText, color: "magenta" }).start();

    try {
      const response = await submitVerdict({
        type: "code",
        files,
        mode: options.mode,
        tone: options.tone,
        lang: options.lang,
        repoOwner: remote.owner,
        repoName: remote.repo,
      });

      spinner.stop();

      // ── JSON output ──
      if (options.json) {
        console.log(JSON.stringify(response, null, 2));
      } else {
        // Show previous verdict if exists
        if (response.previous) {
          const prevDate = new Date(response.previous.created_at).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          });
          console.log();
          console.log(chalk.gray(`  Last verdict for ${repoLabel}: `) +
            chalk.yellow(`${response.previous.score}/10 ${response.previous.label}`) +
            chalk.gray(` on ${prevDate}`));
          console.log();
        }

        // Display the review (same format as roast)
        displayRoast(response);

        // ── Badge output ──
        console.log();
        const score = response.data?.score ?? 0;
        if (score >= 8) {
          console.log(chalk.green.bold("  That's a gold-tier flex. ") + chalk.gray("Wear it where people can see it:"));
        } else {
          console.log(chalk.magenta.bold("  Add this to your README:"));
        }
        console.log();
        console.log(chalk.white(`  ${response.verdict.badge_markdown}`));
        console.log();
        console.log(chalk.gray("  Or use shields.io:"));
        console.log(chalk.gray(`  ${response.verdict.shields_badge_markdown}`));
        console.log();
        console.log(chalk.gray("  Can't be bothered to copy-paste? ") + chalk.cyan("sally badge --add") + chalk.gray(" puts it in your README for you."));
        console.log();
      }

      // ── CI/fail-under ──
      const score = response.data?.score;
      if (options.failUnder != null) {
        if (score == null) {
          console.log(chalk.red("\n  No score returned. Failing as a precaution.\n"));
          process.exit(1);
        }
        if (score < options.failUnder) {
          process.exit(1);
        }
      }
    } catch (err) {
      spinner.stop();
      handleApiError(err);
    }
  });

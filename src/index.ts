#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { roastCommand } from "./commands/roast.js";
import { loginCommand } from "./commands/login.js";
import { logoutCommand } from "./commands/logout.js";
import { usageCommand } from "./commands/usage.js";
import { upgradeCommand } from "./commands/upgrade.js";
import { mcpCommand } from "./commands/mcp.js";
import { resultsCommand } from "./commands/results.js";
import {
  explainCommand,
  reviewPrCommand,
  refactorCommand,
  brainstormCommand,
  frontendCommand,
  marketingCommand,
} from "./commands/tools.js";
import { verdictCommand } from "./commands/verdict.js";
import { printSally } from "./utils/output.js";
import { trackInstall } from "./utils/install.js";
import { runRoast } from "./commands/roast.js";
import { askConfirm } from "./utils/prompt.js";
import { getRoastCount } from "./utils/config.js";

// One-time, fire-and-forget install ping (no-op after the first successful run).
trackInstall();

const program = new Command();

program
  .name("sally")
  .description(
    "Brutally honest code reviews.\nBecause 'You're absolutely right' is probably absolutely wrong."
  )
  .version("0.6.2")
  .action(async () => {
    // `sally` with no args → welcome message
    printSally();
    console.log();
    console.log(chalk.magenta.bold("  Cynical Sally") + chalk.gray(" — brutally honest code reviews"));
    console.log(chalk.gray("  The senior engineer your code hoped it'd never meet.\n"));

    console.log(chalk.white.bold("  Free (90 Quick Roasts/month):"));
    console.log(chalk.cyan("    sally roast") + chalk.gray("                    Roast your code"));
    console.log(chalk.cyan("    sally roast --staged") + chalk.gray("           Roast staged changes"));
    console.log(chalk.cyan("    sally roast src/") + chalk.gray("              Roast a directory"));
    console.log(chalk.cyan("    sally verdict") + chalk.gray("                  Score your repo + get a badge\n"));

    console.log(chalk.white.bold("  Premium Tools (1 free trial each):"));
    console.log(chalk.cyan("    sally explain") + chalk.gray(" file.ts          What does this code do?"));
    console.log(chalk.cyan("    sally refactor") + chalk.gray(" file.ts         How to improve this code"));
    console.log(chalk.cyan("    sally review-pr") + chalk.gray("               Review current PR diff"));
    console.log(chalk.cyan("    sally brainstorm") + chalk.gray(" \"idea\"        Feedback on your idea"));
    console.log(chalk.cyan("    sally frontend") + chalk.gray(" App.tsx         Roast your UI code"));
    console.log(chalk.cyan("    sally marketing") + chalk.gray(" \"copy\"         Review your copy\n"));

    console.log(chalk.white.bold("  Full Truth (Full Suite):"));
    console.log(chalk.cyan("    sally roast -m full_truth") + chalk.gray("      Deep dive with issues + fixes\n"));

    console.log(chalk.white.bold("  Account:"));
    console.log(chalk.cyan("    sally usage") + chalk.gray("                    Check your quota"));
    console.log(chalk.cyan("    sally upgrade") + chalk.gray("                  Get the Full Suite"));
    console.log(chalk.cyan("    sally login") + chalk.gray(" you@email.com      Link your account"));
    console.log(chalk.cyan("    sally results") + chalk.gray("                  View background reviews\n"));

    console.log(chalk.gray("  Works in your terminal AND as MCP tool in Claude Code / Cursor.\n"));

    // First run, interactive terminal → offer a roast right now instead of
    // leaving them at a wall of commands. Value in 20 seconds.
    if (getRoastCount() === 0 && process.stdout.isTTY && process.stdin.isTTY) {
      const yes = await askConfirm(
        chalk.magenta("  Want me to roast this directory right now? ") + chalk.gray("(Y/n) "),
        true,
      );
      if (yes) {
        console.log();
        await runRoast(["."], { mode: "quick", tone: "cynical", lang: "en" });
        return;
      }
      console.log(chalk.gray("\n  Suit yourself. Run ") + chalk.cyan("sally roast") + chalk.gray(" when you're brave.\n"));
      return;
    }

    console.log(chalk.gray("  Run ") + chalk.cyan("sally roast") + chalk.gray(" to get started.\n"));
  });

program.addCommand(roastCommand);
program.addCommand(verdictCommand);
program.addCommand(loginCommand);
program.addCommand(logoutCommand);
program.addCommand(usageCommand);
program.addCommand(upgradeCommand);
program.addCommand(mcpCommand);
program.addCommand(resultsCommand);

// Premium tools
program.addCommand(explainCommand);
program.addCommand(reviewPrCommand);
program.addCommand(refactorCommand);
program.addCommand(brainstormCommand);
program.addCommand(frontendCommand);
program.addCommand(marketingCommand);

program.parse();

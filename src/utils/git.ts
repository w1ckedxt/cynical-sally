import { execSync } from "node:child_process";
import type { ReviewFile } from "./files.js";

/**
 * Check if we're inside a git repository.
 */
export function isGitRepo(): boolean {
  try {
    execSync("git rev-parse --is-inside-work-tree", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get staged changes as a unified diff.
 */
export function getStagedChanges(): string {
  return execSync("git diff --cached", { encoding: "utf-8", maxBuffer: 5_000_000 });
}

/**
 * Get unstaged (working directory) changes as a unified diff.
 */
export function getUnstagedChanges(): string {
  return execSync("git diff", { encoding: "utf-8", maxBuffer: 5_000_000 });
}

/**
 * Get the last commit as a unified diff.
 */
export function getLastCommitDiff(): string {
  return execSync("git diff HEAD~1..HEAD", { encoding: "utf-8", maxBuffer: 5_000_000 });
}

/**
 * Get branch diff (current branch vs target branch).
 */
export function getBranchDiff(branch: string): string {
  // Sanitize branch name to prevent command injection
  const safeBranch = branch.replace(/[^a-zA-Z0-9_.\-/]/g, "");
  return execSync(`git diff ${safeBranch}...HEAD`, {
    encoding: "utf-8",
    maxBuffer: 5_000_000,
  });
}

/**
 * Absolute path of the repository root (where README.md lives).
 */
export function getRepoRoot(): string | null {
  try {
    return execSync("git rev-parse --show-toplevel", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Detect GitHub remote from git config.
 * Handles: https://github.com/owner/repo.git, git@github.com:owner/repo.git
 *
 * Owner/repo are lowercased because GitHub repos are case-insensitive
 * and our badge DB normalizes to lowercase for consistent lookups.
 */
export function getGitHubRemote(): { owner: string; repo: string } | null {
  try {
    const url = execSync("git remote get-url origin", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    // SSH: git@github.com:owner/repo.git
    const sshMatch = url.match(/github\.com[:/]([^/]+)\/([^/.]+?)(?:\.git)?$/);
    if (sshMatch) return { owner: sshMatch[1].toLowerCase(), repo: sshMatch[2].toLowerCase() };

    // HTTPS: https://github.com/owner/repo.git (strip trailing paths/slashes)
    const httpsMatch = url.match(/github\.com\/([^/]+)\/([^/.]+?)(?:\.git)?(?:\/[^\s]*)?$/);
    if (httpsMatch) return { owner: httpsMatch[1].toLowerCase(), repo: httpsMatch[2].toLowerCase() };

    return null;
  } catch {
    return null;
  }
}

/**
 * Parse a unified diff into a files array for the API.
 *
 * Extracts the changed files and their full content from the diff.
 * For new/modified files, includes the "after" state.
 */
export function parseDiffToFiles(diff: string): ReviewFile[] {
  if (!diff.trim()) return [];

  const files: ReviewFile[] = [];
  const chunks = diff.split(/^diff --git /m).filter(Boolean);

  for (const chunk of chunks) {
    try {
      const headerMatch = chunk.match(/^a\/(.+?) b\/(.+)/m);
      if (!headerMatch || !headerMatch[2]) continue;

      const filePath = headerMatch[2].trim();
      if (!filePath) continue;

      // Skip deleted files and binary files
      if (chunk.includes("deleted file mode")) continue;
      if (chunk.includes("Binary files")) continue;

      const lines = chunk.split("\n");
      const contentLines: string[] = [];

      for (const line of lines) {
        if (line.startsWith("+++")) continue;
        if (line.startsWith("+")) {
          contentLines.push(line.slice(1));
        }
      }

      if (contentLines.length > 0) {
        files.push({
          path: filePath,
          content: contentLines.join("\n"),
        });
      }
    } catch {
      // Skip malformed chunks silently
      continue;
    }
  }

  return files;
}

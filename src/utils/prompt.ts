/**
 * Single-keypress Y/n confirm. Resolves true/false.
 *
 * - Non-TTY (CI, pipes) resolves to `defaultYes` without blocking.
 * - Enter accepts the default; y/n choose explicitly; Ctrl+C exits.
 */
export function askConfirm(promptText: string, defaultYes = true): Promise<boolean> {
  return new Promise((resolve) => {
    process.stdout.write(promptText);

    if (!process.stdin.isTTY) {
      process.stdout.write("\n");
      resolve(defaultYes);
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
      process.stdout.write("\n");
      resolve(result);
    };

    try {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (key: string) => {
        if (key === "\x03") process.exit(0); // Ctrl+C
        const k = key.toLowerCase();
        if (k === "\r" || k === "\n") return finish(defaultYes);
        if (k === "y") return finish(true);
        if (k === "n") return finish(false);
        // any other key: keep waiting
      });
    } catch {
      finish(defaultYes);
    }
  });
}

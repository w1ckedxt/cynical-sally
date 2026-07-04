<!-- mcp-name: io.github.w1ckedxt/cynicalsally -->

<p align="center">
  <img src="assets/banner.png" alt="Cynical Sally" width="700" />
</p>

<h1 align="center">Cynical Sally</h1>

<p align="center">
  <strong>Brutally honest code reviews. In your terminal and your AI editor.</strong><br/>
  <em>Because "You're absolutely right" is probably absolutely wrong.</em><br/>
  <code>npm i -g @cynicalsally/cli</code> · MCP server for Claude Code, Cursor &amp; Windsurf
</p>

<p align="center">
  <a href="https://cynicalsally.com"><img src="https://cynicalsally.com/api/v1/badge/repo/w1ckedxt/cynicalsally-cli" alt="Cynical Sally Verdict" /></a>
  <a href="https://cynicalsally.com"><img src="https://img.shields.io/endpoint?url=https%3A%2F%2Fcynicalsally.com%2Fapi%2Fv1%2Fbadge%2Frepo%2Fw1ckedxt%2Fcynicalsally-cli%2Fshields" alt="Sally Score" /></a>
  <a href="https://www.npmjs.com/package/@cynicalsally/cli"><img src="https://img.shields.io/npm/v/@cynicalsally/cli.svg" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@cynicalsally/cli"><img src="https://img.shields.io/npm/dm/@cynicalsally/cli.svg" alt="npm downloads" /></a>
  <a href="https://registry.modelcontextprotocol.io/?search=cynicalsally"><img src="https://img.shields.io/badge/MCP-Registry-8a2be2.svg" alt="MCP Registry" /></a>
  <a href="https://cursor.directory/plugins/cynical-sally"><img src="https://img.shields.io/badge/Cursor-Directory-000000.svg" alt="Cursor Directory" /></a>
  <a href="https://glama.ai/mcp/servers/w1ckedxt/cynical-sally"><img src="https://glama.ai/mcp/servers/w1ckedxt/cynical-sally/badges/score.svg" alt="Glama score" /></a>
  <a href="https://github.com/w1ckedxt/cynical-sally/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg" alt="license" /></a>
</p>

---

Your AI pair programmer is lying to you. Sally isn't.

<p align="center">
  <img src="assets/demo.gif" alt="sally roast — a real review, live in the terminal" width="800" />
</p>

She's the senior engineer your code hoped it'd never meet. Scores from 0 to 10, real issues backed by evidence, and fixes you can actually use.

Works as a CLI tool and as an MCP server in [Claude Code](https://claude.ai/claude-code), [Cursor](https://cursor.com), and [Windsurf](https://windsurf.com).

<p align="center">
  <img src="assets/SallyRoast1.png" alt="Sally code review with score and issues" width="500" />
  <img src="assets/SallyRoast2.png" alt="Sally actionable fixes and verdict" width="500" />
</p>

## Install

```bash
npm install -g @cynicalsally/cli
```

Or run without installing:

```bash
npx @cynicalsally/cli roast ./src/
```

**Requirements:** Node.js 18+

## See exactly what leaves your machine

Sending code to a server you don't control deserves more than "trust me." So Sally lets you **verify it instead**:

```bash
sally roast --dry-run ./src/
```

`--dry-run` collects everything *as if* it were about to roast — then sends **nothing**. Instead it prints the exact payload: every file path, byte size, and token estimate; which files were held back and **why** (`.env`, keys, certs, binaries, `.gitignore` matches, size limits); and writes a local **SHA-256 receipt** to `.sally/` so you can verify byte-for-byte what *would* have been uploaded.

```text
WOULD SEND 3 files · 91 B · ~24 tokens (est.)
  src/app.ts        36 B   ~9 tok   68a3be428746…

HELD BACK 2 items — kept on your machine
  ✖ secret (2) — looks like a secret — never leaves your machine
      .env
      server.key
```

Secret files (`.env`, SSH keys, certs, credential files) are skipped **on your machine before anything is sent** — verify it yourself with `--dry-run`. Only review code you're allowed to upload. Local reports land in `.sally/` — add it to your `.gitignore`:

```gitignore
.sally/
```

See [Privacy & Security](#privacy--security) below for the full data-flow.

## Quick Start

```bash
# Sally auto-detects what to review
sally roast
# → staged changes? reviews those
# → unstaged changes? reviews those
# → recent commit? reviews that
# → nothing? scans the directory

# Roast a file or directory
sally roast src/utils/auth.ts
sally roast ./src/

# Roast staged changes before you commit
sally roast --staged

# Compare your branch against main
sally roast --diff main

# Deep analysis with issues + actionable fixes
sally roast ./src/ -m full_truth

# Run deep analysis in the background (OS notification when done)
sally roast ./src/ -m full_truth --bg

# See exactly what would be sent — and send nothing
sally roast --dry-run ./src/

# Get a shareable roast card (saved to .sally/)
sally roast ./src/ --card

# Publish a share link — only the score + sneer go public, never your code
sally roast ./src/ --share
```

## Roast Options

```
sally roast [paths...] [options]

  --staged              Review only staged git changes
  --diff <branch>       Compare against another branch (e.g., main)
  -m, --mode <mode>     "quick" (default) or "full_truth" (deep dive)
  --tone <tone>         "cynical" (default), "neutral", or "professional"
  --lang <lang>         Response language code (default: "en")
  --json                Output raw JSON (for piping or scripting)
  --fail-under <score>  Exit code 1 if quality score is below threshold
  --ci                  CI mode: compact output, exit codes
  --bg                  Run Full Truth in background, get OS notification when done
  --dry-run             Print the exact payload (files, sizes, tokens, SHA-256) and send NOTHING
  --card                Print + save a shareable roast card after the review
  --share               Create a public share link (cynicalsally.com/card/…) — score + sneer only, never code
```

## Get your repo's verdict — and a badge to prove it

Let Sally judge your whole repo and hand you a README badge with the score baked in:

```bash
sally verdict
```

She scores the repo, then prints ready-to-paste badge markdown:

```markdown
[![Cynical Sally Verdict](https://cynicalsally.com/api/v1/badge/repo/you/repo)](https://cynicalsally.com)
```

Score an 8 or higher and the badge is a flex worth wearing. Score lower and, well —
it's an honest signal that you're shipping anyway. Either way the badge links back,
so every README that wears it does the bragging for you.

Too lazy to copy-paste? Sally will hang it up herself:

```bash
sally badge --add   # inserts the badge into README.md, right under the title
sally badge         # just prints the markdown (and your current score)
```

The badge image updates automatically on every new `sally verdict` — add it once,
judged forever.

---

<h2 align="center">Sally's Full Suite</h2>

<p align="center">
  <em>Six tools, three jobs. The most honest code reviewer you'll ever work with — in your terminal and your AI editor.</em>
</p>

<p align="center">
  <img src="assets/full-suite.png" alt="Sally's Full Suite" width="600" />
</p>

<p align="center">
  <strong>Ship faster</strong> — <code>review-pr</code> + <code>refactor</code>  ·  
  <strong>Be less embarrassing</strong> — <code>explain</code> + <code>brainstorm</code>  ·  
  <strong>Polish for humans</strong> — <code>frontend</code> + <code>marketing</code>
</p>

---

### Explain

<img src="assets/tool-explain.png" alt="sally explain" width="280" align="right" />

Sally reads the spaghetti someone left in your codebase and translates it into plain English. Just the cold, clear truth of what it actually does.

```bash
sally explain src/utils/auth.ts

# Pipe code directly
cat legacy-module.js | sally explain

# Explain the current directory
sally explain
```

<br clear="right"/>

---

### Refactor

<img src="assets/tool-refactor.png" alt="sally refactor" width="280" align="right" />

Before and after, side by side. Sally explains why one of them is going to haunt your 3am on-call rotation.

```bash
sally refactor src/components/Dashboard.tsx

# Refactor current directory
sally refactor
```

<br clear="right"/>

---

### PR Review

<img src="assets/tool-pr-review.png" alt="sally review-pr" width="280" align="right" />

Sally reviews your PR like a senior engineer who has time, opinions, and absolutely no reason to be polite.

```bash
# Review PR #42 (requires GitHub CLI)
sally review-pr 42

# Review current branch vs main
sally review-pr

# Pipe a diff
git diff main | sally review-pr
```

<br clear="right"/>

---

### Brainstorm

<img src="assets/tool-brainstorm.png" alt="sally brainstorm" width="280" align="right" />

Pitch your architecture idea and Sally tells you the three ways it falls apart at scale. Cheaper than a post-mortem.

```bash
sally brainstorm "Microservices for a 2-person team?"

# Brainstorm about the current project
sally brainstorm
```

<br clear="right"/>

---

### Frontend Review

<img src="assets/tool-frontend.png" alt="sally frontend" width="280" align="right" />

Sally tells you why your component re-renders on every keystroke and why your z-index is load-bearing.

```bash
sally frontend src/components/Header.tsx

# Review all frontend code in a directory
sally frontend ./src/
```

<br clear="right"/>

---

### Marketing Review

<img src="assets/tool-marketing.png" alt="sally marketing" width="280" align="right" />

Run your copy by Sally before your customers do. They won't be this constructive about it.

```bash
sally marketing "Ship faster with AI-powered code reviews"

# Review your README and landing page copy
sally marketing README.md
```

<br clear="right"/>

---

Every tool accepts **file paths**, **raw text**, or **piped stdin**. Each includes **1 free trial**, no account needed.

## CI/CD Integration

Gate your pipeline on code quality:

```yaml
# GitHub Actions
- name: Sally Code Review
  run: npx @cynicalsally/cli roast ./src/ --fail-under=5 --ci
```

`--ci` gives compact output with exit codes. `--fail-under` fails the build when the score drops below your threshold. Add `--json` for machine-readable output.

## MCP Server

Sally works as an MCP server inside **Claude Code**, **Cursor**, and **Windsurf**.

<a href="https://glama.ai/mcp/servers/w1ckedxt/cynical-sally"><img src="https://glama.ai/mcp/servers/w1ckedxt/cynical-sally/badges/card.svg" alt="Cynical Sally MCP server on Glama" width="380" /></a>

### Claude Code

```bash
claude mcp add cynical-sally -- npx @cynicalsally/cli mcp
```

### Cursor

Add to `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (per project):

```json
{
  "mcpServers": {
    "cynical-sally": {
      "command": "npx",
      "args": ["@cynicalsally/cli", "mcp"]
    }
  }
}
```

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "cynical-sally": {
      "command": "npx",
      "args": ["@cynicalsally/cli", "mcp"]
    }
  }
}
```

### Available tools

| MCP Tool | What it does |
|----------|-------------|
| `sally_roast` | Code review with score, issues, and fixes |
| `sally_explain` | Explain code with Sally's personality |
| `sally_review_pr` | Review PR diffs |
| `sally_refactor` | Refactoring suggestions with before/after |
| `sally_brainstorm` | Feedback on ideas and approaches |
| `sally_frontend` | Frontend/UI code review |
| `sally_marketing` | Marketing copy review |
| `sally_usage` | Check quota and account status |

**Roast by path** — the agent can call `sally_roast` with just `paths` (files or directories); Sally reads them locally and skips binaries and secret files, so the agent doesn't have to read and pass content itself.

**Prompts** — Sally also exposes ready-made slash-command intents (`roast`, `review-pr`, `explain`) in clients that surface MCP prompts.

Run `sally mcp` in your terminal to see setup instructions.

## All Commands

| Command | Description |
|---------|-------------|
| `sally roast [paths...]` | Review files, directories, or git changes |
| `sally verdict` | Score your repo + get a README badge |
| `sally badge [--add]` | Print your badge markdown, or add it to README.md |
| `sally explain [file]` | Explain what code actually does |
| `sally refactor [file]` | Refactoring with before/after code |
| `sally review-pr [pr]` | Review a PR diff |
| `sally brainstorm "idea"` | Feedback on ideas and approaches |
| `sally frontend [file]` | Frontend/UI code review |
| `sally marketing "copy"` | Marketing copy review |
| `sally login <email>` | Log in via magic link |
| `sally logout` | Clear stored session |
| `sally usage` | Check your quota and account status |
| `sally upgrade` | Upgrade to Sally's Full Suite |
| `sally results` | View background review results |
| `sally mcp` | MCP server setup instructions |

## Free to Use

90 free roasts per month, no account needed. Every premium tool includes a free trial.

```bash
sally usage     # Check your quota
sally upgrade   # Unlock the Full Suite
```

## Privacy & Security

Your code is yours. Don't take our word for it — run `sally roast --dry-run` and see the exact payload before anything is sent. Here's what happens to it:

- **Verify before you send.** `--dry-run` prints every file, size, token estimate, and a SHA-256 receipt of exactly what *would* be uploaded — and sends nothing. The MCP `sally_roast` tool has the same `preview` mode.
- **Sent only to be reviewed.** The files you choose are transmitted over HTTPS and processed in real-time to generate the review — that's the only reason they leave your machine.
- **Never written to disk, logs, or analytics.** Your source code is processed in memory and discarded after analysis. It is never persisted to a database, never written to application logs or error traces, and never sent to any third-party APM or analytics. We keep the review (score, issues), not your source.
- **Never trained on, sold, or shared.** Analysis runs through Anthropic's API, which doesn't train on submitted content.
- **Only what you point at.** Sally doesn't browse your repo, read files you didn't give her, or scan your projects or plans. Secret files (`.env`, keys, certs, credential files) are skipped on your machine *before anything is sent* — and `--dry-run` shows you exactly which ones.
- **Sharing is opt-in, and never includes code.** Nothing is ever published unless you pass `--share` — and even then the public card contains only the score and Sally's one-liner.
- **Anonymous by default.** Reviews are tied to a random device ID, not your identity — until you link an email for Full Suite. Config stored locally at `~/.sally/config.json`.
- **Signed releases.** npm packages are published with [provenance](https://docs.npmjs.com/generating-provenance-statements) — a cryptographic, public attestation linking each release to the exact source commit and CI build that produced it.

Full engineering detail — data-flow diagram, what's retained, subprocessors, and log policy — is in [docs/PRIVACY.md](docs/PRIVACY.md). User-facing summary: [cynicalsally.com/privacy](https://cynicalsally.com/privacy).

## Contributing

Found a bug or have a feature idea? [Open an issue](https://github.com/w1ckedxt/cynical-sally/issues). Sally promises to only judge your issue title a little.

## License

[MIT](LICENSE)

---

<p align="center">
  <a href="https://cynicalsally.com">cynicalsally.com</a> · <a href="https://www.npmjs.com/package/@cynicalsally/cli">npm</a> · <a href="https://github.com/w1ckedxt/cynical-sally/issues">issues</a>
</p>

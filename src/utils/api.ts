import type { ReviewFile } from "./files.js";
import { getDeviceId, saveEmail } from "./config.js";
import { cacheFlavor, type Flavor } from "./flavor.js";

export const API_BASE = process.env.SALLY_API_URL || "https://cynicalsally-web.onrender.com";
const FETCH_TIMEOUT_MS = 120_000; // 2 minutes (Sonnet FT can take a while)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RoastRequest {
  type: "code";
  files: ReviewFile[];
  mode: "quick" | "full_truth";
  tone: string;
  lang: string;
}

export interface RoastIssue {
  issue_code: string;
  severity: "critical" | "major" | "minor";
  title: string;
  description: string;
  evidence?: string[];
  fix?: string;
}

export interface RoastResponse {
  id: string;
  status: string;
  data: {
    score: number;
    issues?: RoastIssue[];
    receipts?: string[];
    actionable_fixes?: string[];
  };
  voice: {
    roast: string;
    bright_side: string;
    hardest_sneer: string;
  };
  meta: {
    lang: string;
    mode: string;
    persona?: string;
    files_reviewed: number;
    model: string;
  };
}

export type ToolName = "explain" | "review_pr" | "refactor" | "brainstorm" | "frontend_review" | "marketing_review";

export interface ToolRequest {
  tool: ToolName;
  content: string;
  lang?: string;
}

export interface ToolMessage {
  type: string;
  text: string;
}

export interface ToolResponse {
  tool: ToolName;
  data: Record<string, unknown>;
  voice: {
    roast: string;
    bright_side: string;
    hardest_sneer: string;
  };
  messages: ToolMessage[];
  meta: {
    tool: string;
    model: string;
    locale: string;
  };
  quota?: { remaining: number; limit: number };
}

export interface EntitlementsResponse {
  isSuperClub: boolean;
  tier: string | null;
  quotaRemaining: number;
  hasPrepaidGrant: boolean;
  email?: string;
  cliTier?: "lite" | "sc";
  cliQuota?: {
    qr: { remaining: number; limit: number };
    ft: { remaining: number; limit: number };
  };
  toolQuota?: Record<string, { remaining: number; limit: number }>;
  flavor?: Flavor;
}

interface BasicApiResponse {
  ok?: boolean;
  message?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// API Client
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Submit code for roasting via the Render backend */
export async function submitRoast(params: RoastRequest): Promise<RoastResponse> {
  const deviceId = getDeviceId();
  const url = `${API_BASE}/api/v1/review`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...params, deviceId }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    const message = (body as { error?: string }).error || `HTTP ${res.status}`;

    // Use backend's Sally-voiced message when available
    throw new ApiError(res.status, message);
  }

  return (await res.json()) as RoastResponse;
}

/** Submit a premium tool request via the Render backend */
export async function submitTool(params: ToolRequest): Promise<ToolResponse> {
  const deviceId = getDeviceId();
  const url = `${API_BASE}/api/v1/tool`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...params, deviceId }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    const message = (body as { error?: string }).error || `HTTP ${res.status}`;
    throw new ApiError(res.status, message);
  }

  return (await res.json()) as ToolResponse;
}

// ---------------------------------------------------------------------------
// Verdict
// ---------------------------------------------------------------------------

export interface VerdictRequest {
  type: "code";
  files: ReviewFile[];
  mode: "quick" | "full_truth";
  tone: string;
  lang: string;
  repoOwner: string;
  repoName: string;
}

export interface VerdictResponse extends RoastResponse {
  verdict: {
    label: string;
    badge_url: string;
    badge_markdown: string;
    shields_badge_markdown: string;
  };
  previous: {
    score: number;
    label: string;
    created_at: string;
  } | null;
}

/** Submit a repo verdict via the Render backend */
export async function submitVerdict(params: VerdictRequest): Promise<VerdictResponse> {
  const deviceId = getDeviceId();
  const url = `${API_BASE}/api/v1/verdict`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...params, deviceId }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    const message = (body as { error?: string }).error || `HTTP ${res.status}`;
    throw new ApiError(res.status, message);
  }

  return (await res.json()) as VerdictResponse;
}

// ---------------------------------------------------------------------------
// Share card
// ---------------------------------------------------------------------------

export interface ShareCardRequest {
  sneer: string;
  score?: number;
  lang?: string;
  subject?: string;
  /** Optional framing hint for the public card. "brag" celebrates a high score,
   *  "receipt" frames it as competence (issues caught). Backend may honor or ignore. */
  style?: "brag" | "receipt";
}

export interface ShareCardResponse {
  id: string;
  url: string;
  imageUrl?: string;
}

/** Create a public share card (cynicalsally.com/card/<id>). Sends only the sneer + score — never code. */
export async function createShareCard(params: ShareCardRequest): Promise<ShareCardResponse> {
  const deviceId = getDeviceId();
  const url = `${API_BASE}/api/v1/card`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...params, inputType: "code", source: "cli", deviceId }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    const message = (body as { error?: string }).error || `HTTP ${res.status}`;
    throw new ApiError(res.status, message);
  }

  return (await res.json()) as ShareCardResponse;
}

/** Request magic link login */
export async function requestMagicLink(email: string): Promise<{ sent: boolean; message?: string; error?: string }> {
  const deviceId = getDeviceId();
  const maxAttempts = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/magic-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, deviceId }),
        signal: AbortSignal.timeout(30_000),
      });

      // A 5xx is a transient server hiccup (cold DB/queue connection). Retry it —
      // but only the server fault, never a 4xx like rate-limit (429) or bad email.
      if (res.status >= 500 && attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
        continue;
      }

      return (await res.json()) as { sent: boolean; message?: string; error?: string };
    } catch (err) {
      // Network error or timeout — worth another try.
      lastError = err;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
        continue;
      }
    }
  }

  throw lastError ?? new Error("Failed to request magic link");
}

/** Unlink the current device from any server-side account/session mapping */
export async function unlinkDeviceSession(): Promise<BasicApiResponse> {
  const deviceId = getDeviceId();
  const res = await fetch(`${API_BASE}/api/v1/auth/session?deviceId=${encodeURIComponent(deviceId)}`, {
    method: "DELETE",
    signal: AbortSignal.timeout(30_000),
  });

  const body = await res.json().catch(() => ({ error: res.statusText })) as BasicApiResponse;
  if (!res.ok) {
    throw new ApiError(res.status, body.error || body.message || `HTTP ${res.status}`);
  }

  return body;
}

/** Check entitlements (quota, SuperClub status) + cache flavor */
export async function checkEntitlements(): Promise<EntitlementsResponse> {
  const deviceId = getDeviceId();
  const res = await fetch(`${API_BASE}/api/v1/entitlements?deviceId=${deviceId}`);
  if (!res.ok) {
    return { isSuperClub: false, tier: null, quotaRemaining: 3, hasPrepaidGrant: false };
  }
  const data = (await res.json()) as EntitlementsResponse;

  // Cache Sally's flavor text from backend
  if (data.flavor) {
    cacheFlavor(data.flavor);
  }

  // Auto-save email if returned by backend (SC users via Stripe)
  if (data.email) {
    saveEmail(data.email);
  }

  return data;
}

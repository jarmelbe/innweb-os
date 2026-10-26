import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCrmUser } from "@/lib/crm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Input = z.object({
  prompt: z.string().trim().min(2).max(4000),
});

const Interaction = z.object({
  status: z.literal("completed"),
  steps: z.array(z.object({
    type: z.string(),
    content: z.array(z.object({
      type: z.string(),
      text: z.string().optional(),
    })).optional(),
  })),
});

// Best-effort private MVP limiter. Replace with durable limits before broad usage.
const usage = new Map<string, { count: number; until: number }>();
const WINDOW_MS = 60_000;
const LIMIT = 5;
const MAX_USERS = 5_000;

function allowRequest(agencyId: string, userId: string): boolean {
  const now = Date.now();
  const key = `${agencyId}:${userId}`;
  const record = usage.get(key);
  if (!record || record.until <= now) {
    if (usage.size >= MAX_USERS) {
      for (const [k, value] of usage) {
        if (value.until <= now) usage.delete(k);
      }
      if (!usage.has(key) && usage.size >= MAX_USERS) return false;
    }
    usage.set(key, { count: 1, until: now + WINDOW_MS });
    return true;
  }
  if (record.count >= LIMIT) return false;
  record.count++;
  return true;
}

function privateJson(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) {
    return privateJson({ error: "CRM database is not configured." }, 503);
  }

  // Reject cross-origin browser POSTs before invoking a billable AI provider.
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return privateJson({ error: "Origin not allowed." }, 403);
  }

  let auth;
  try {
    const result = await requireCrmUser();
    if (result.response) {
      result.response.headers.set("Cache-Control", "no-store");
      return result.response;
    }
    auth = result.auth;
  } catch {
    return privateJson({ error: "Could not verify CRM session." }, 503);
  }
  if (!auth) return privateJson({ error: "Authentication required." }, 401);

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return privateJson({ error: "Gemini has not been configured on the server." }, 503);
  }

  const input = Input.safeParse(await request.json().catch(() => null));
  if (!input.success) {
    return privateJson({ error: "Enter a prompt between 2 and 4000 characters." }, 400);
  }
  if (!allowRequest(auth.agencyId, auth.userId)) {
    return privateJson({ error: "Rate limit reached. Try again in one minute." }, 429);
  }

  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  try {
    const upstream = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        model,
        input: input.data.prompt,
        store: false,
        generation_config: { max_output_tokens: 2048 },
      }),
      signal: AbortSignal.timeout(25_000),
      cache: "no-store",
    });

    if (!upstream.ok) {
      // Do not forward upstream error details or provider account identifiers.
      console.error("Gemini request failed with status", upstream.status);
      return privateJson({ error: "Gemini is unavailable or the key/model is invalid." }, 502);
    }

    const result = Interaction.safeParse(await upstream.json());
    if (!result.success) {
      return privateJson({ error: "Gemini did not return a completed text answer." }, 502);
    }
    const answer = result.data.steps
      .filter((step) => step.type === "model_output")
      .flatMap((step) => step.content || [])
      .filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text)
      .join("\n")
      .trim();

    if (!answer) return privateJson({ error: "Gemini did not return a text answer." }, 502);
    return privateJson({ answer, model });
  } catch (error) {
    const timeout = error instanceof Error && error.name === "TimeoutError";
    return privateJson({
      error: timeout ? "Gemini timed out." : "Gemini connection failed.",
    }, timeout ? 504 : 502);
  }
}

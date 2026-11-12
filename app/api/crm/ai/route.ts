import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCrmUser } from "@/lib/crm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Input = z.object({
  prompt: z.string().trim().min(2).max(4000),
});

// Best-effort private MVP limiter. Replace with durable limits before broad usage.
const usage = new Map<string, { count: number; until: number }>();
const WINDOW_MS = 60_000;
const LIMIT = 5;

function allowRequest(agencyId: string, userId: string): boolean {
  const now = Date.now();
  const key = `${agencyId}:${userId}`;
  const record = usage.get(key);
  if (!record || record.until <= now) {
    usage.set(key, { count: 1, until: now + WINDOW_MS });
    return true;
  }
  if (record.count >= LIMIT) return false;
  record.count++;
  if (usage.size > 5_000) {
    for (const [k, value] of usage) {
      if (value.until <= now) usage.delete(k);
    }
  }
  return true;
}

function privateJson(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

type GeminiStep = {
  type?: string;
  content?: Array<{ type?: string; text?: string }>;
};

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
    const result = await requireCrmUser(["OWNER", "ADMIN"]);
    if (result.response) return result.response;
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

  // Google models are configured server-side. See ai.google.dev/gemini-api/docs/models.
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
      }),
      signal: AbortSignal.timeout(45_000),
      cache: "no-store",
    });

    if (!upstream.ok) {
      // Never log requests, user prompts, tokens, secrets or raw provider responses.
      console.error("InnWeb OS Gemini upstream HTTP status", upstream.status);
      if (upstream.status === 401 || upstream.status === 403) {
        return privateJson({ error: "La clave de Google Gemini no está autorizada. Revisa las restricciones de API y la configuración del servidor.", code: "GEMINI_AUTH" }, 502);
      }
      if (upstream.status === 404 || upstream.status === 400) {
        return privateJson({ error: "El modelo de Gemini no está disponible para este proyecto. Comprueba GEMINI_MODEL en el servidor.", code: "GEMINI_MODEL" }, 502);
      }
      if (upstream.status === 429) {
        return privateJson({ error: "Google Gemini alcanzó su límite de uso. Intenta más tarde o revisa la cuota del proyecto.", code: "GEMINI_QUOTA" }, 429);
      }
      return privateJson({ error: "Google Gemini no responde en este momento.", code: "GEMINI_PROVIDER" }, 502);
    }

    const result: { status?: string; steps?: GeminiStep[] } = await upstream.json();
    const answer = (result.steps || [])
      .filter((step) => step.type === "model_output")
      .flatMap((step) => step.content || [])
      .filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text)
      .join("\n")
      .trim();

    if (!answer) return privateJson({ error: "Google Gemini no devolvió texto. Intenta con una consulta más breve.", code: "GEMINI_EMPTY" }, 502);
    return privateJson({ answer, model });
  } catch (error) {
    const timeout = error instanceof Error && error.name === "TimeoutError";
    return privateJson({
      error: timeout ? "Google Gemini tardó demasiado en responder. Intenta otra vez." : "No se pudo establecer conexión con Google Gemini.",
    }, timeout ? 504 : 502);
  }
}

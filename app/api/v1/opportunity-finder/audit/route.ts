import { NextResponse } from "next/server";
import { load } from "cheerio";
import { lookup as dnsLookup, resolveMx, resolveTxt } from "node:dns/promises";
import type { LookupAddress } from "node:dns";
import { request as httpRequest, type IncomingMessage } from "node:http";
import { isIP, type LookupFunction } from "node:net";
import { request as httpsRequest } from "node:https";
import { z } from "zod";

const Input = z.object({
  url: z.string().min(3).max(2048),
  language: z.enum(["en", "es"]).default("en"),
});

const MAX_HTML_BYTES = 3_000_000;
const MAX_REDIRECTS = 5;
const REQUEST_TIMEOUT_MS = Number(process.env.AUDIT_TIMEOUT_MS || 12_000);
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_REQUESTS = 20;
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function isPublicIpv4(ip: string): boolean {
  const octets = ip.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [first, second, third] = octets;
  return !(
    first === 0 ||
    first === 10 ||
    first === 127 ||
    first >= 224 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0 && third === 0) ||
    (first === 192 && second === 0 && third === 2) ||
    (first === 192 && second === 88 && third === 99) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 198 && second === 51 && third === 100) ||
    (first === 203 && second === 0 && third === 113) ||
    (first === 255 && second === 255 && third === 255)
  );
}

function mappedIpv4(ip: string): string | null {
  const normalized = ip.toLowerCase();
  if (!normalized.startsWith("::ffff:")) return null;

  const suffix = normalized.slice(7);
  if (isIP(suffix) === 4) return suffix;

  const groups = suffix.split(":");
  if (groups.length !== 2 || groups.some((group) => !/^[\da-f]{1,4}$/.test(group))) return null;
  const high = Number.parseInt(groups[0], 16);
  const low = Number.parseInt(groups[1], 16);
  return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
}

function isPublicIp(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return isPublicIpv4(ip);
  if (family !== 6) return false;

  const mapped = mappedIpv4(ip);
  if (mapped) return isPublicIpv4(mapped);

  const groups = ip.toLowerCase().split(":");
  const first = Number.parseInt(groups[0] || "0", 16);
  const second = Number.parseInt(groups[1] || "0", 16);
  if (first < 0x2000 || first > 0x3fff) return false;
  if (first === 0x2001 && (second <= 0x01ff || second === 0x0db8)) return false;
  if (first === 0x2002 || (first === 0x3fff && (second & 0xfff0) === 0)) return false;
  return true;
}

async function resolvePublicTarget(url: URL): Promise<LookupAddress[]> {
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new Error("Private targets are not allowed");
  }

  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) as 4 | 6 }]
    : await dnsLookup(hostname, { all: true, verbatim: true });

  if (!addresses.length || addresses.some(({ address }) => !isPublicIp(address))) {
    throw new Error("Private targets are not allowed");
  }

  return addresses;
}

async function validateTarget(raw: string): Promise<{ url: URL; addresses: LookupAddress[] }> {
  const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const url = new URL(normalized);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("Unsupported URL");
  }
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new Error("Only standard HTTP and HTTPS ports are allowed");
  }

  return { url, addresses: await resolvePublicTarget(url) };
}

function collectHtml(response: IncomingMessage): Promise<{ html: string; bytes: number }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let bytes = 0;
    let truncated = false;
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      resolve({ html: Buffer.concat(chunks).toString("utf8"), bytes: Math.min(bytes, MAX_HTML_BYTES) });
    };

    response.on("data", (value: Buffer | string) => {
      const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
      const available = MAX_HTML_BYTES - bytes;
      if (available > 0) chunks.push(chunk.subarray(0, available));
      bytes += chunk.length;
      if (bytes > MAX_HTML_BYTES) {
        truncated = true;
        response.destroy();
        finish();
      }
    });
    response.once("end", finish);
    response.once("close", () => {
      if (truncated) finish();
    });
    response.once("error", (error) => {
      if (truncated) finish();
      else if (!settled) {
        settled = true;
        reject(error);
      }
    });
  });
}

type PageResponse = {
  url: string;
  status: number;
  headers: IncomingMessage["headers"];
  html: string;
  htmlBytes: number;
  responseTimeMs: number;
};

async function fetchPublicPage(
  target: string | URL,
  deadline: number,
  redirects = 0,
  visited = new Set<string>(),
): Promise<PageResponse> {
  const { url, addresses } = await validateTarget(target.toString());
  const normalizedUrl = url.toString();
  if (visited.has(normalizedUrl)) throw new Error("Redirect loop detected");
  visited.add(normalizedUrl);

  const remainingMs = deadline - Date.now();
  if (remainingMs <= 0) throw new Error("Website request timed out");

  const startedAt = Date.now();
  const pinnedAddress = addresses[0];
  const pinnedLookup: LookupFunction = (_hostname, _options, callback) => {
    if (typeof _options === "object" && _options.all) {
      callback(null, [pinnedAddress]);
    } else {
      callback(null, pinnedAddress.address, pinnedAddress.family);
    }
  };
  const requester = url.protocol === "https:" ? httpsRequest : httpRequest;

  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    const request = requester(
      url,
      {
        headers: {
          "user-agent": process.env.AUDIT_USER_AGENT || "INNweb Opportunity Finder/0.1",
          accept: "text/html,application/xhtml+xml",
        },
        lookup: pinnedLookup,
        timeout: remainingMs,
      },
      (response) => {
        const status = response.statusCode || 0;
        const location = response.headers.location;
        if ([301, 302, 303, 307, 308].includes(status) && location) {
          response.resume();
          if (redirects >= MAX_REDIRECTS) {
            fail(new Error("Too many redirects"));
            return;
          }
          let nextUrl: URL;
          try {
            nextUrl = new URL(location, url);
          } catch {
            fail(new Error("Invalid redirect URL"));
            return;
          }
          void fetchPublicPage(nextUrl, deadline, redirects + 1, visited).then(resolve, reject);
          return;
        }

        void collectHtml(response)
          .then(({ html, bytes }) => {
            if (settled) return;
            settled = true;
            resolve({
              url: normalizedUrl,
              status,
              headers: response.headers,
              html,
              htmlBytes: bytes,
              responseTimeMs: Date.now() - startedAt,
            });
          })
          .catch(fail);
      },
    );

    request.once("timeout", () => request.destroy(new Error("Website request timed out")));
    request.once("error", fail);
    request.end();
  });
}

function allowRequest(request: Request): boolean {
  const now = Date.now();
  const address =
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  const current = rateLimits.get(address);

  if (!current || current.resetAt <= now) {
    rateLimits.set(address, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (current.count >= RATE_LIMIT_REQUESTS) return false;

  current.count += 1;
  if (rateLimits.size > 10_000) {
    for (const [key, value] of rateLimits) {
      if (value.resetAt <= now) rateLimits.delete(key);
    }
  }
  return true;
}

const text = {
  en: {
    title: "Add a clear page title",
    titleRec: "Use a unique, descriptive title of roughly 30–60 characters.",
    desc: "Add a compelling meta description",
    descRec: "Summarize the offer and intent of the page in plain language.",
    h1: "Use one clear primary heading",
    h1Rec: "Give the page a single, descriptive H1 that matches visitor intent.",
    alt: "Improve image alternative text",
    altRec: "Add useful alt text to meaningful images and leave decorative images empty.",
    cta: "Strengthen the conversion path",
    ctaRec: "Add a prominent, specific action such as booking, requesting a quote, or calling.",
    https: "Enforce HTTPS",
    httpsRec: "Redirect all traffic to HTTPS and maintain a valid certificate.",
    headers: "Add modern security headers",
    headersRec: "Configure HSTS, CSP, frame protection, Referrer-Policy, and Permissions-Policy carefully.",
    dmarc: "Protect business email with DMARC",
    dmarcRec: "Publish and monitor SPF, DKIM, and DMARC before enforcing a strict policy.",
    mobile: "Add a mobile viewport",
    mobileRec: "Declare a responsive viewport and verify the layout on small screens.",
    excellent: "Low immediate opportunity",
    medium: "Qualified opportunity",
    high: "High-priority opportunity",
  },
  es: {
    title: "Agrega un título claro",
    titleRec: "Usa un título único y descriptivo de aproximadamente 30–60 caracteres.",
    desc: "Agrega una meta descripción convincente",
    descRec: "Resume la oferta y la intención de la página en lenguaje claro.",
    h1: "Usa un encabezado principal claro",
    h1Rec: "Dale a la página un solo H1 descriptivo que coincida con la intención del visitante.",
    alt: "Mejora el texto alternativo de las imágenes",
    altRec: "Agrega texto alternativo útil a las imágenes relevantes y deja vacías las decorativas.",
    cta: "Fortalece la ruta de conversión",
    ctaRec: "Agrega una acción visible y específica, como reservar, cotizar o llamar.",
    https: "Fuerza HTTPS",
    httpsRec: "Redirige todo el tráfico a HTTPS y mantén un certificado válido.",
    headers: "Agrega encabezados de seguridad modernos",
    headersRec: "Configura cuidadosamente HSTS, CSP, protección de marcos, Referrer-Policy y Permissions-Policy.",
    dmarc: "Protege el correo empresarial con DMARC",
    dmarcRec: "Publica y monitorea SPF, DKIM y DMARC antes de aplicar una política estricta.",
    mobile: "Agrega una vista móvil",
    mobileRec: "Declara un viewport responsivo y verifica el diseño en pantallas pequeñas.",
    excellent: "Oportunidad inmediata baja",
    medium: "Oportunidad calificada",
    high: "Oportunidad de alta prioridad",
  },
};

export async function POST(request: Request) {
  if (!allowRequest(request)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again in a minute." },
      { status: 429, headers: { "retry-after": "60" } },
    );
  }

  try {
    const input = Input.parse(await request.json());
    const startedAt = Date.now();
    const response = await fetchPublicPage(
      input.url,
      startedAt + REQUEST_TIMEOUT_MS,
    );
    const $ = load(response.html);
    const tr = text[input.language];
    const findings: { severity: string; category: string; title: string; recommendation: string }[] = [];
    const add = (severity: string, category: string, title: string, recommendation: string) =>
      findings.push({ severity, category, title, recommendation });
    let seo = 100;
    let accessibility = 100;
    let conversion = 100;
    let security = 100;
    let performance = 100;
    let infrastructure = 100;

    const pageTitle = $("title").first().text().trim();
    if (pageTitle.length < 10 || pageTitle.length > 70) {
      seo -= 20;
      add("medium", "seo", tr.title, tr.titleRec);
    }
    if (!$('meta[name="description"]').attr("content")) {
      seo -= 20;
      add("medium", "seo", tr.desc, tr.descRec);
    }
    if ($("h1").length !== 1) {
      seo -= 15;
      add("medium", "seo", tr.h1, tr.h1Rec);
    }
    if (!$('meta[name="viewport"]').length) {
      performance -= 15;
      accessibility -= 10;
      add("high", "performance", tr.mobile, tr.mobileRec);
    }

    const images = $("img");
    const missingAlt = images.filter((_, element) => $(element).attr("alt") === undefined).length;
    if (missingAlt) {
      accessibility -= Math.min(35, missingAlt * 5);
      add("medium", "accessibility", tr.alt, tr.altRec);
    }

    const bodyText = $("body").text().toLowerCase();
    if (!/(contact|quote|book|call|consulta|cotiza|reserv|llama)/i.test(bodyText)) {
      conversion -= 30;
      add("high", "conversion", tr.cta, tr.ctaRec);
    }
    if (new URL(response.url).protocol !== "https:") {
      security -= 40;
      infrastructure -= 25;
      add("critical", "security", tr.https, tr.httpsRec);
    }

    const requiredHeaders = [
      "strict-transport-security",
      "content-security-policy",
      "x-content-type-options",
      "referrer-policy",
    ];
    const missingHeaders = requiredHeaders.filter((header) => !response.headers[header]);
    if (missingHeaders.length) {
      security -= missingHeaders.length * 10;
      add("medium", "security", tr.headers, tr.headersRec);
    }

    if (response.responseTimeMs > 2500) performance -= 25;
    else if (response.responseTimeMs > 1200) performance -= 10;
    if (response.htmlBytes > 1_500_000) performance -= 20;
    else if (response.htmlBytes > 700_000) performance -= 10;

    let hasDmarc = false;
    let hasSpf = false;
    let hasMail = false;
    const hostname = new URL(response.url).hostname.replace(/^\[|\]$/g, "");
    const [txtRecords, mailRecords] = await Promise.all([
      dnsLookupTxt(hostname),
      dnsLookupMx(hostname),
    ]);
    hasSpf = txtRecords.flat().some((value) => value.toLowerCase().startsWith("v=spf1"));
    hasMail = mailRecords.length > 0;
    const dmarcRecords = await dnsLookupTxt(`_dmarc.${hostname}`);
    hasDmarc = dmarcRecords.flat().some((value) => value.toLowerCase().startsWith("v=dmarc1"));
    if (hasMail && !hasSpf) infrastructure -= 10;
    if (hasMail && !hasDmarc) {
      infrastructure -= 15;
      add("medium", "infrastructure", tr.dmarc, tr.dmarcRec);
    }

    const clamp = (score: number) => Math.max(0, Math.min(100, Math.round(score)));
    const scores = {
      performance: clamp(performance),
      seo: clamp(seo),
      security: clamp(security),
      accessibility: clamp(accessibility),
      conversion: clamp(conversion),
      infrastructure: clamp(infrastructure),
    };
    const overall = clamp(
      scores.performance * 0.2 +
        scores.seo * 0.2 +
        scores.security * 0.15 +
        scores.accessibility * 0.1 +
        scores.conversion * 0.15 +
        scores.infrastructure * 0.2,
    );
    const opportunity = clamp(100 - overall + 20);
    const orderedFindings = findings.sort(
      (a, b) =>
        ["critical", "high", "medium", "low"].indexOf(a.severity) -
        ["critical", "high", "medium", "low"].indexOf(b.severity),
    );
    const quickWins = orderedFindings.slice(0, 3).map((item) => ({
      title: item.title,
      impact: item.severity.toUpperCase(),
      category: item.category,
      recommendation: item.recommendation,
    }));
    const categoryCounts = orderedFindings.reduce<Record<string, number>>((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    }, {});
    const focusAreas = Object.entries(categoryCounts)
      .map(([category, issues]) => ({ category, score: clamp(100 - issues * 12), issues }))
      .sort((a, b) => b.issues - a.issues || a.category.localeCompare(b.category))
      .slice(0, 4);
    const summary =
      input.language === "es"
        ? overall >= 75
          ? `Este sitio presenta una base sólida, aunque todavía hay ${orderedFindings.length} oportunidades útiles para ganar más confianza, conversión y rendimiento.`
          : overall >= 50
            ? "El sitio tiene una base razonable, pero hay varios puntos técnicos y de conversión que pueden mejorar el retorno real del tráfico."
            : "El sitio muestra varios riesgos visibles y oportunidades de mejora prioritarias para aumentar la calidad, la seguridad y la conversión."
        : overall >= 75
          ? `This site has a solid foundation, though there are still ${orderedFindings.length} useful opportunities to gain trust, conversion, and performance.`
          : overall >= 50
            ? "The site is workable but has several technical and conversion gaps that could improve actual return from traffic."
            : "The site shows multiple visible risks and high-value improvement opportunities across quality, security, and conversion.";

    return NextResponse.json({
      url: response.url,
      scannedAt: new Date().toISOString(),
      summary,
      quickWins,
      focusAreas,
      scores: { overall, ...scores },
      opportunityScore: opportunity,
      classification: opportunity >= 70 ? tr.high : opportunity >= 45 ? tr.medium : tr.excellent,
      signals: {
        httpStatus: response.status,
        responseTimeMs: response.responseTimeMs,
        htmlBytes: response.htmlBytes,
        images: images.length,
        missingAlt,
        hasSpf,
        hasDmarc,
        hasMail,
      },
      findings: orderedFindings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Audit failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

async function dnsLookupTxt(hostname: string): Promise<string[][]> {
  try {
    return await resolveTxt(hostname);
  } catch {
    return [];
  }
}

async function dnsLookupMx(hostname: string): Promise<{ exchange: string; priority: number }[]> {
  try {
    return await resolveMx(hostname);
  } catch {
    return [];
  }
}

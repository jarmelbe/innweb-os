import { AgencyRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCrmUser, unavailable } from "@/lib/crm";
import { prisma } from "@/lib/prisma";

const searchCooldowns = new Map<string, number>();
const SEARCH_COOLDOWN_MS = 10_000;

const SearchInput = z.object({
  city: z.string().trim().min(2).max(80).regex(/^[\p{L}\p{M} .'-]+$/u),
  category: z.enum(["all", "health", "food", "hospitality", "professional", "retail"]).default("all"),
});

type OsmElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

const categoryQueries: Record<z.infer<typeof SearchInput>["category"], string> = {
  all: `
    nwr["name"]["shop"](area.city);
    nwr["name"]["office"](area.city);
    nwr["name"]["craft"](area.city);
    nwr["name"]["amenity"~"restaurant|cafe|fast_food|bar|dentist|doctors|clinic|hospital|pharmacy"](area.city);
    nwr["name"]["tourism"~"hotel|motel|guest_house|hostel"](area.city);`,
  health: `
    nwr["name"]["healthcare"](area.city);
    nwr["name"]["amenity"~"dentist|doctors|clinic|hospital|pharmacy"](area.city);
    nwr["name"]["shop"~"medical|optician"](area.city);`,
  food: `nwr["name"]["amenity"~"restaurant|cafe|fast_food|bar"](area.city);`,
  hospitality: `nwr["name"]["tourism"~"hotel|motel|guest_house|hostel"](area.city);`,
  professional: `
    nwr["name"]["office"](area.city);
    nwr["name"]["craft"](area.city);`,
  retail: `nwr["name"]["shop"](area.city);`,
};

function firstTag(tags: Record<string, string>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = tags[key]?.trim();
    if (value) return value.slice(0, 254);
  }
  return null;
}

function publicWebsite(tags: Record<string, string>): string | null {
  const raw = firstTag(tags, "website", "contact:website", "url");
  if (!raw) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function categoryLabel(tags: Record<string, string>): string {
  for (const key of ["shop", "office", "craft", "healthcare", "amenity", "tourism"]) {
    if (tags[key]) return `${key}: ${tags[key]}`.slice(0, 120);
  }
  return "business";
}

function sourceUrl(type: OsmElement["type"], id: number): string {
  return `https://www.openstreetmap.org/${type}/${id}`;
}

function externalId(item: Pick<OsmElement, "type" | "id">): string {
  return `osm:${item.type}:${item.id}`;
}

async function queryOverpass(query: string): Promise<OsmElement[]> {
  const response = await fetch(process.env.OSM_OVERPASS_URL || "https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": "InnWeb OS Prospect Discovery/1.0 (https://os.innweb.co)",
      accept: "application/json",
    },
    body: new URLSearchParams({ data: query }),
    signal: AbortSignal.timeout(25_000),
    cache: "no-store",
  });
  if (!response.ok) {
    console.error("OpenStreetMap prospect query failed", response.status);
    throw new Error("OpenStreetMap is temporarily unavailable.");
  }
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { elements?: unknown }).elements)) {
    throw new Error("OpenStreetMap returned an invalid response.");
  }
  return (payload as { elements: OsmElement[] }).elements;
}

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "CRM database is not configured." }, { status: 503 });
  try {
    const { auth, response } = await requireCrmUser([AgencyRole.OWNER, AgencyRole.ADMIN, AgencyRole.SALES]);
    if (response) return response;

    const parsed = SearchInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Enter a valid Colombian city and business category." }, { status: 400 });

    const now = Date.now();
    const cooldownUntil = searchCooldowns.get(auth!.agencyId) || 0;
    if (cooldownUntil > now) {
      return NextResponse.json({ error: "Please wait before searching again." }, {
        status: 429,
        headers: { "retry-after": String(Math.ceil((cooldownUntil - now) / 1000)) },
      });
    }
    searchCooldowns.set(auth!.agencyId, now + SEARCH_COOLDOWN_MS);
    for (const [agencyId, expiry] of searchCooldowns) {
      if (expiry <= now) searchCooldowns.delete(agencyId);
    }

    const city = parsed.data.city.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
    const query = `[out:json][timeout:20];
      area["ISO3166-1"="CO"][admin_level=2]->.country;
      area["boundary"="administrative"]["name"="${city}"](area.country)->.city;
      (${categoryQueries[parsed.data.category]});
      out center tags 80;`;

    const elements = (await queryOverpass(query)).filter((item) => item.tags?.name).slice(0, 80);
    const externalIds = elements.map(externalId);
    const existing = await prisma.account.findMany({
      where: { agencyId: auth!.agencyId, externalId: { in: externalIds } },
      select: { externalId: true },
    });
    const existingIds = new Set(existing.map((item) => item.externalId));

    const candidates = elements.map((item) => {
      const tags = item.tags || {};
      const point = item.center || (item.lat !== undefined && item.lon !== undefined ? { lat: item.lat, lon: item.lon } : null);
      return {
        externalId: externalId(item),
        name: firstTag(tags, "name") || "Unnamed business",
        category: categoryLabel(tags),
        city: parsed.data.city.trim(),
        website: publicWebsite(tags),
        email: firstTag(tags, "contact:email", "email"),
        phone: firstTag(tags, "contact:phone", "phone", "contact:mobile", "mobile"),
        address: firstTag(tags, "addr:full") || [
          firstTag(tags, "addr:street"),
          firstTag(tags, "addr:housenumber"),
          firstTag(tags, "addr:suburb"),
        ].filter(Boolean).join(" ") || null,
        latitude: point?.lat ?? null,
        longitude: point?.lon ?? null,
        sourceUrl: sourceUrl(item.type, item.id),
        alreadyImported: existingIds.has(externalId(item)),
      };
    });

    return NextResponse.json({
      city: parsed.data.city.trim(),
      source: "OpenStreetMap",
      candidates,
      attributionUrl: "https://www.openstreetmap.org/copyright",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return NextResponse.json({ error: "Business search took too long. Try again shortly." }, { status: 504 });
    }
    if (error instanceof Error && error.message.includes("OpenStreetMap")) {
      return NextResponse.json({ error: "Business search is temporarily unavailable. Please try again later." }, { status: 502 });
    }
    return unavailable(error);
  }
}

export async function PUT(request: Request) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "CRM database is not configured." }, { status: 503 });
  try {
    const { auth, response } = await requireCrmUser([AgencyRole.OWNER, AgencyRole.ADMIN, AgencyRole.SALES]);
    if (response) return response;

    const Input = z.object({
      city: SearchInput.shape.city,
      externalIds: z.array(z.string().regex(/^osm:(node|way|relation):\d+$/)).min(1).max(20),
    });
    const parsed = Input.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Select up to 20 valid business listings to import." }, { status: 400 });

    const candidateIds = parsed.data.externalIds;
    if (new Set(candidateIds).size !== candidateIds.length) {
      return NextResponse.json({ error: "The selection contains duplicate listings." }, { status: 400 });
    }

    const groupedIds = new Map<OsmElement["type"], number[]>([["node", []], ["way", []], ["relation", []]]);
    for (const id of candidateIds) {
      const [, type, rawId] = id.split(":");
      const parsedId = Number(rawId);
      if ((type !== "node" && type !== "way" && type !== "relation") || !Number.isSafeInteger(parsedId)) {
        return NextResponse.json({ error: "The selection contains an invalid listing ID." }, { status: 400 });
      }
      groupedIds.get(type)!.push(parsedId);
    }
    const lookup = [...groupedIds].filter(([, ids]) => ids.length > 0)
      .map(([type, ids]) => `${type}(id:${ids.join(",")})(area.country);`).join("\n");
    const query = `[out:json][timeout:20];\narea["ISO3166-1"="CO"][admin_level=2]->.country;\n(${lookup});\nout center tags;`;
    const sourceElements = await queryOverpass(query);
    const sourceById = new Map(sourceElements.map((item) => [externalId(item), item]));
    if (candidateIds.some((id) => !sourceById.get(id)?.tags?.name?.trim())) {
      return NextResponse.json({ error: "Some listings are no longer available from OpenStreetMap. Search again and retry." }, { status: 409 });
    }
    const candidates = candidateIds.map((id) => {
      const item = sourceById.get(id)!;
      const tags = item.tags || {};
      const email = firstTag(tags, "contact:email", "email");
      const address = firstTag(tags, "addr:full") || [
        firstTag(tags, "addr:street"),
        firstTag(tags, "addr:housenumber"),
        firstTag(tags, "addr:suburb"),
      ].filter(Boolean).join(" ") || null;
      return {
        externalId: id,
        name: firstTag(tags, "name")!,
        category: categoryLabel(tags),
        city: firstTag(tags, "addr:city", "addr:municipality", "addr:town", "addr:village") || parsed.data.city.trim(),
        website: publicWebsite(tags),
        email: email && z.string().email().safeParse(email).success ? email : null,
        phone: firstTag(tags, "contact:phone", "phone", "contact:mobile", "mobile"),
        address,
        sourceUrl: sourceUrl(item.type, item.id),
      };
    });

    const result = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.account.findMany({
        where: { agencyId: auth!.agencyId, externalId: { in: candidateIds } },
        select: { externalId: true },
      });
      const existingIds = new Set(existing.map((item) => item.externalId));
      let imported = 0;

      for (const candidate of candidates) {
        if (existingIds.has(candidate.externalId)) continue;
        const account = await transaction.account.create({
          data: {
            agencyId: auth!.agencyId,
            ownerId: auth!.userId,
            externalId: candidate.externalId,
            name: candidate.name,
            website: candidate.website,
            industry: candidate.category,
            city: candidate.city,
            country: "CO",
            type: "LEAD",
            priority: "NORMAL",
            source: "OpenStreetMap",
            serviceInterest: "Website / SEO assessment",
            notes: [
              candidate.address ? `Listed address: ${candidate.address}` : null,
              `Public business listing: ${candidate.sourceUrl}`,
              "Potential customer identified from a public business directory. Website need and service fit have not yet been verified.",
            ].filter(Boolean).join("\n"),
            contacts: candidate.email || candidate.phone ? {
              create: {
                agencyId: auth!.agencyId,
                firstName: "Public listing",
                email: candidate.email?.toLowerCase() || null,
                phone: candidate.phone,
                notes: "Contact details copied from the public OpenStreetMap listing.",
                isPrimary: true,
              },
            } : undefined,
          },
        });
        const opportunity = await transaction.opportunity.create({
          data: {
            agencyId: auth!.agencyId,
            externalId: `opportunity:${candidate.externalId}`,
            accountId: account.id,
            ownerId: auth!.userId,
            name: `Website / SEO assessment · ${account.name}`,
            serviceName: "Website / SEO assessment",
            stage: "DISCOVERED",
            currency: "COP",
            amount: null,
            probability: null,
            notes: "Discovery lead; verify the website and business fit before qualification. No revenue or ranking is inferred.",
          },
        });
        await transaction.auditEvent.create({
          data: {
            agencyId: auth!.agencyId,
            actorId: auth!.userId,
            action: "prospect.discovered",
            entityType: "Account",
            entityId: account.id,
            metadata: { opportunityId: opportunity.id, source: "OpenStreetMap", externalId: candidate.externalId },
          },
        });
        existingIds.add(candidate.externalId);
        imported += 1;
      }

      return { imported, duplicates: candidates.length - imported };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return NextResponse.json({ error: "Business search took too long. Try again shortly." }, { status: 504 });
    }
    if (error instanceof Error && error.message.includes("OpenStreetMap")) {
      return NextResponse.json({ error: "Business search is temporarily unavailable. Please try again later." }, { status: 502 });
    }
    return unavailable(error);
  }
}

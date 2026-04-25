import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { ScoredResource } from "../matching/types";
import type { StudentProfile } from "../../types/profile";
import type { PersonalizedGuide, TierEntry } from "../../types/recommendation";
import {
  generatePersonalizedGuideDraft,
  type AnthropicClientLike,
  type PersonalizedGuideDraft,
  type PersonalizedGuideDraftEntry,
} from "./client";

const DEFAULT_CACHE_DIR = path.resolve(
  process.cwd(),
  ".cache",
  "personalized-guides",
);

export type PersonalizeResourcesOptions = {
  anthropicClient?: AnthropicClientLike;
  apiKey?: string;
  cacheDir?: string;
  forceRefresh?: boolean;
  now?: Date;
};

type TierBucket = {
  tier_1_start_this_week: TierEntry[];
  tier_2_explore_this_month: TierEntry[];
  tier_3_bookmark_for_later: TierEntry[];
};

export async function personalizeResources(
  profile: StudentProfile,
  scoredResources: ScoredResource[],
  options: PersonalizeResourcesOptions = {},
): Promise<PersonalizedGuide> {
  const cacheDir = options.cacheDir ?? DEFAULT_CACHE_DIR;
  const profileHash = hashStudentProfile(profile);

  if (!options.forceRefresh) {
    const cachedGuide = await loadGuideFromCache(profileHash, cacheDir);
    if (cachedGuide) {
      return cachedGuide;
    }
  }

  const topResources = scoredResources.slice(0, 25);
  const generatedAt = (options.now ?? new Date()).toISOString();

  const guide =
    topResources.length === 0
      ? buildEmptyGuide(profile, generatedAt)
      : hydratePersonalizedGuideDraft(
          profile,
          topResources,
          await generatePersonalizedGuideDraft({
            profile,
            scoredResources: topResources,
            anthropicClient: options.anthropicClient,
            apiKey: options.apiKey,
          }),
          generatedAt,
        );

  await saveGuideToCache(profileHash, cacheDir, guide);
  return guide;
}

export function hydratePersonalizedGuideDraft(
  profile: StudentProfile,
  scoredResources: ScoredResource[],
  draft: PersonalizedGuideDraft,
  generatedAt: string = new Date().toISOString(),
): PersonalizedGuide {
  const topResources = scoredResources.slice(0, 25);
  const resourceMap = new Map(
    topResources.map((scored) => [scored.resource.id, scored] as const),
  );
  const usedResourceIds = new Set<string>();

  const tiers: TierBucket = {
    tier_1_start_this_week: consumeTier(
      draft.tier_1_start_this_week,
      topResources,
      resourceMap,
      usedResourceIds,
      profile,
    ),
    tier_2_explore_this_month: consumeTier(
      draft.tier_2_explore_this_month,
      topResources,
      resourceMap,
      usedResourceIds,
      profile,
    ),
    tier_3_bookmark_for_later: consumeTier(
      draft.tier_3_bookmark_for_later,
      topResources,
      resourceMap,
      usedResourceIds,
      profile,
    ),
  };

  for (const scored of topResources) {
    if (usedResourceIds.has(scored.resource.id)) continue;
    usedResourceIds.add(scored.resource.id);
    tiers.tier_3_bookmark_for_later.push(
      buildTierEntry(
        scored,
        buildFallbackReason(profile, scored.resource.name, true),
      ),
    );
  }

  rebalanceTiers(tiers);

  return {
    profile_snapshot: profile,
    generated_at: generatedAt,
    opening_note: sanitizeOpeningNote(draft.opening_note, profile, tiers),
    tier_1_start_this_week: tiers.tier_1_start_this_week,
    tier_2_explore_this_month: tiers.tier_2_explore_this_month,
    tier_3_bookmark_for_later: tiers.tier_3_bookmark_for_later,
  };
}

export function hashStudentProfile(profile: StudentProfile): string {
  const normalizedProfile = normalizeProfileForHash(profile);
  const serialized = stableStringify(normalizedProfile);
  return createHash("sha256").update(serialized).digest("hex");
}

export function getGuideCachePath(
  profileHash: string,
  cacheDir: string = DEFAULT_CACHE_DIR,
): string {
  return path.join(cacheDir, `${profileHash}.json`);
}

function consumeTier(
  draftEntries: PersonalizedGuideDraftEntry[],
  scoredResources: ScoredResource[],
  resourceMap: Map<string, ScoredResource>,
  usedResourceIds: Set<string>,
  profile: StudentProfile,
): TierEntry[] {
  const tierEntries: TierEntry[] = [];
  const allowedIds = new Set(scoredResources.map(({ resource }) => resource.id));

  for (const draftEntry of draftEntries) {
    if (!allowedIds.has(draftEntry.resource_id)) continue;
    if (usedResourceIds.has(draftEntry.resource_id)) continue;

    const scored = resourceMap.get(draftEntry.resource_id);
    if (!scored) continue;

    usedResourceIds.add(draftEntry.resource_id);
    tierEntries.push(
      buildTierEntry(
        scored,
        sanitizeReason(draftEntry.reason, profile, scored.resource.name, false),
      ),
    );
  }

  return tierEntries;
}

function buildTierEntry(scored: ScoredResource, reason: string): TierEntry {
  return {
    resource_id: scored.resource.id,
    resource: scored.resource,
    reason,
    score: scored.score,
  };
}

function rebalanceTiers(tiers: TierBucket) {
  while (tiers.tier_1_start_this_week.length > 5) {
    const moved = tiers.tier_1_start_this_week.pop();
    if (!moved) break;
    tiers.tier_2_explore_this_month.unshift(moved);
  }

  while (tiers.tier_1_start_this_week.length < 3) {
    const promoted =
      tiers.tier_2_explore_this_month.shift() ??
      tiers.tier_3_bookmark_for_later.shift();
    if (!promoted) break;
    tiers.tier_1_start_this_week.push(promoted);
  }

  while (tiers.tier_2_explore_this_month.length > 10) {
    const moved = tiers.tier_2_explore_this_month.pop();
    if (!moved) break;
    tiers.tier_3_bookmark_for_later.unshift(moved);
  }

  while (tiers.tier_2_explore_this_month.length < 6) {
    const promoted = tiers.tier_3_bookmark_for_later.shift();
    if (!promoted) break;
    tiers.tier_2_explore_this_month.push(promoted);
  }
}

function sanitizeReason(
  reason: string,
  profile: StudentProfile,
  resourceName: string,
  isFallbackTier: boolean,
): string {
  const normalized = reason.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return buildFallbackReason(profile, resourceName, isFallbackTier);
  }

  const singleSentence = takeFirstSentence(normalized);
  const trimmedToWords = trimToWordCount(singleSentence, 25);

  if (!trimmedToWords) {
    return buildFallbackReason(profile, resourceName, isFallbackTier);
  }

  return ensureSentencePunctuation(trimmedToWords);
}

function sanitizeOpeningNote(
  openingNote: string,
  profile: StudentProfile,
  tiers: TierBucket,
): string {
  const normalized = openingNote.replace(/\s+/g, " ").trim();
  if (normalized) return normalized;

  const firstChoice = tiers.tier_1_start_this_week[0]?.resource.name;
  const secondChoice = tiers.tier_1_start_this_week[1]?.resource.name;
  const industry = labelForCopy(profile.industries[0] ?? "generalist");
  const stage = labelForCopy(profile.stage);
  const bottleneck = labelForCopy(profile.primary_bottleneck);

  if (firstChoice && secondChoice) {
    return `You're building a ${industry} startup at the ${stage} stage, with ${bottleneck} as the biggest constraint. Start with ${firstChoice} and ${secondChoice} to unlock the fastest next steps.`;
  }

  if (firstChoice) {
    return `You're building a ${industry} startup at the ${stage} stage, with ${bottleneck} as the biggest constraint. ${firstChoice} is the strongest next step in this guide.`;
  }

  return `You're building a ${industry} startup at the ${stage} stage, and this guide prioritizes resources that best match your current ${bottleneck} bottleneck.`;
}

function buildFallbackReason(
  profile: StudentProfile,
  resourceName: string,
  isForLater: boolean,
): string {
  const stage = labelForCopy(profile.stage);
  const bottleneck = labelForCopy(profile.primary_bottleneck);
  const industry = labelForCopy(profile.industries[0] ?? "generalist");

  if (isForLater) {
    return `Because you're at the ${stage} stage in ${industry} with ${bottleneck} as the main bottleneck, ${resourceName} looks more useful after the urgent next steps.`;
  }

  return `Because you're at the ${stage} stage in ${industry} and tackling ${bottleneck}, ${resourceName} supports the next step for this startup.`;
}

function takeFirstSentence(text: string): string {
  const match = text.match(/[^.!?]+[.!?]?/);
  return match ? match[0].trim() : text.trim();
}

function trimToWordCount(text: string, maxWords: number): string {
  const words = text.match(/\S+/g) ?? [];
  if (words.length <= maxWords) {
    return text.trim();
  }
  return words.slice(0, maxWords).join(" ").trim();
}

function ensureSentencePunctuation(text: string): string {
  const cleaned = text.replace(/\s+([,.;!?])/g, "$1").trim();
  if (!cleaned) return cleaned;
  return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
}

function buildEmptyGuide(
  profile: StudentProfile,
  generatedAt: string,
): PersonalizedGuide {
  const stage = labelForCopy(profile.stage);
  const bottleneck = labelForCopy(profile.primary_bottleneck);

  return {
    profile_snapshot: profile,
    generated_at: generatedAt,
    opening_note: `No eligible resources were available for your current ${stage} profile, so there isn't a personalized guide yet. Re-run matching after updating the dataset or your ${bottleneck} inputs.`,
    tier_1_start_this_week: [],
    tier_2_explore_this_month: [],
    tier_3_bookmark_for_later: [],
  };
}

function normalizeProfileForHash(profile: StudentProfile) {
  return {
    ...profile,
    additional_context: profile.additional_context?.trim() || undefined,
    industries: [...profile.industries].sort(),
    secondary_bottlenecks: [...profile.secondary_bottlenecks].sort(),
    already_engaged_with: [...profile.already_engaged_with].sort(),
  };
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

async function loadGuideFromCache(
  profileHash: string,
  cacheDir: string,
): Promise<PersonalizedGuide | null> {
  try {
    const raw = await fs.readFile(getGuideCachePath(profileHash, cacheDir), "utf-8");
    return JSON.parse(raw) as PersonalizedGuide;
  } catch (error) {
    if (isFileMissingError(error)) return null;
    throw error;
  }
}

async function saveGuideToCache(
  profileHash: string,
  cacheDir: string,
  guide: PersonalizedGuide,
) {
  await fs.mkdir(cacheDir, { recursive: true });
  await fs.writeFile(
    getGuideCachePath(profileHash, cacheDir),
    JSON.stringify(guide, null, 2),
    "utf-8",
  );
}

function isFileMissingError(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}

function labelForCopy(value: string): string {
  return value
    .split("_")
    .map((segment) => {
      if (segment === "ai") return "AI";
      if (segment === "ml") return "ML";
      if (segment === "d2c") return "D2C";
      if (segment === "cdis") return "CDIS";
      if (segment === "vc") return "VC";
      return segment;
    })
    .join(" ");
}

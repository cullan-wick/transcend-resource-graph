import { filterResources } from "@/lib/matching/filter";
import { rankResources, type ScoredResource } from "@/lib/matching/score";
import { loadResources } from "@/lib/resources";
import type { StudentProfile } from "@/types/profile";
import type { PersonalizedGuide, TierEntry } from "@/types/recommendation";
import type { Resource } from "@/types/resource";
import { BOTTLENECK_LABELS, INDUSTRY_LABELS, STAGE_LABELS } from "./survey";

type GuidePipelineResult = {
  guide: PersonalizedGuide;
  filteredCount: number;
  rankedCount: number;
};

function buildReason(resource: Resource, profile: StudentProfile): string {
  const reasonParts: string[] = [];

  if (resource.bottleneck_tags.includes(profile.primary_bottleneck)) {
    reasonParts.push(
      `directly addresses your ${BOTTLENECK_LABELS[profile.primary_bottleneck].toLowerCase()}`,
    );
  }

  if (resource.stages.includes(profile.stage)) {
    reasonParts.push(
      `fits teams at the ${STAGE_LABELS[profile.stage].toLowerCase()} stage`,
    );
  }

  const industryHit = resource.industries.find((industry) =>
    profile.industries.includes(industry),
  );
  if (industryHit && industryHit !== "generalist") {
    reasonParts.push(
      `shows up as a strong match for ${INDUSTRY_LABELS[industryHit]}`,
    );
  }

  if (resource.affiliation === "uw_madison") {
    reasonParts.push("is a UW-specific path you can access quickly");
  } else if (resource.affiliation === "wisconsin_state") {
    reasonParts.push("keeps you in the Wisconsin founder ecosystem");
  }

  if (reasonParts.length === 0 && resource.is_high_leverage_pick) {
    reasonParts.push("is a strong high-leverage option for many UW founders");
  }

  return reasonParts.length > 0
    ? `This resource ${reasonParts.slice(0, 2).join(" and ")}.`
    : "This resource survived the eligibility filters and ranked well across your profile.";
}

function buildOpeningNote(
  profile: StudentProfile,
  rankedResources: ScoredResource[],
): string {
  if (rankedResources.length === 0) {
    return `We couldn't find strong matches for your current profile yet. Try broadening your industry selection or removing already-engaged resources to surface more options.`;
  }

  const topAffiliation = rankedResources[0]?.resource.affiliation;
  const uwBias =
    topAffiliation === "uw_madison"
      ? "with a bias toward UW-native opportunities you can act on quickly"
      : "with a mix of UW, Wisconsin, and national opportunities";

  return `We prioritized resources that fit your ${STAGE_LABELS[profile.stage].toLowerCase()} stage, help with ${BOTTLENECK_LABELS[profile.primary_bottleneck].toLowerCase()}, and align with your stated funding preferences ${uwBias}.`;
}

function buildTierEntries(
  profile: StudentProfile,
  resources: ScoredResource[],
): TierEntry[] {
  return resources.map(({ resource, score }) => ({
    resource_id: resource.id,
    resource,
    reason: buildReason(resource, profile),
    score,
  }));
}

function buildFallbackGuide(
  profile: StudentProfile,
  rankedResources: ScoredResource[],
): PersonalizedGuide {
  const tierOne = buildTierEntries(profile, rankedResources.slice(0, 5));
  const tierTwo = buildTierEntries(profile, rankedResources.slice(5, 13));
  const tierThree = buildTierEntries(profile, rankedResources.slice(13, 25));

  return {
    profile_snapshot: profile,
    generated_at: new Date().toISOString(),
    opening_note: buildOpeningNote(profile, rankedResources),
    tier_1_start_this_week: tierOne,
    tier_2_explore_this_month: tierTwo,
    tier_3_bookmark_for_later: tierThree,
  };
}

async function personalizeGuide(
  profile: StudentProfile,
  rankedResources: ScoredResource[],
): Promise<PersonalizedGuide> {
  // This keeps the app flow functional until the dedicated LLM module lands.
  return buildFallbackGuide(profile, rankedResources);
}

export async function runGuidePipeline(
  profile: StudentProfile,
): Promise<GuidePipelineResult> {
  const resources = loadResources();
  const filtered = filterResources(resources, profile);
  const ranked = rankResources(filtered, profile);
  const guide = await personalizeGuide(profile, ranked);

  return {
    guide,
    filteredCount: filtered.length,
    rankedCount: ranked.length,
  };
}

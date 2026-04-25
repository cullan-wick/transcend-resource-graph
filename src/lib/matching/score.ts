import type { Resource, Stage, Category } from "../../types/resource";
import type { StudentProfile } from "../../types/profile";
import { ALL_STAGES } from "../../types/resource";

const STAGE_INDEX: Record<Stage, number> = ALL_STAGES.reduce(
  (acc, s, i) => {
    acc[s] = i;
    return acc;
  },
  {} as Record<Stage, number>,
);

export function stagesAdjacent(
  resourceStages: Stage[],
  profileStage: Stage,
): boolean {
  const pIdx = STAGE_INDEX[profileStage];
  return resourceStages.some((s) => {
    const rIdx = STAGE_INDEX[s];
    return Math.abs(rIdx - pIdx) === 1;
  });
}

export function scoreResource(
  resource: Resource,
  profile: StudentProfile,
): number {
  let score = 0;

  // Stage (max 25)
  if (resource.stages.includes(profile.stage)) {
    score += 25;
  } else if (stagesAdjacent(resource.stages, profile.stage)) {
    score += 10;
  }

  // Industry (max 20)
  const industryOverlap = resource.industries.filter((i) =>
    profile.industries.includes(i),
  );
  if (industryOverlap.length > 0) {
    score += 20;
  } else if (
    resource.industries.includes("generalist") ||
    resource.industries.length === 0
  ) {
    score += 10;
  }

  // Bottleneck (max 20)
  if (resource.bottleneck_tags.includes(profile.primary_bottleneck)) {
    score += 20;
  } else if (
    resource.bottleneck_tags.some((t) =>
      profile.secondary_bottlenecks.includes(t),
    )
  ) {
    score += 8;
  }

  // Affiliation (max 10)
  if (resource.affiliation === "uw_madison") score += 10;
  else if (resource.affiliation === "wisconsin_state") score += 5;

  // High-leverage pick (max 10)
  if (resource.is_high_leverage_pick) score += 10;

  // Capital alignment (max 10)
  if (
    profile.capital_preference === "want_vc" &&
    resource.capital_type.includes("dilutive")
  ) {
    score += 10;
  }
  if (
    profile.capital_preference === "prefer_non_dilutive" &&
    resource.capital_type.includes("non_dilutive")
  ) {
    score += 10;
  }
  if (
    profile.capital_preference === "bootstrapping" &&
    resource.capital_type.includes("credits")
  ) {
    score += 10;
  }

  // Business model (max 5)
  if (
    resource.business_models.includes(profile.business_model) ||
    resource.business_models.includes("agnostic") ||
    resource.business_models.length === 0
  ) {
    score += 5;
  }

  return score;
}

export type ScoredResource = { resource: Resource; score: number };

const MAX_PER_CATEGORY = 6;
const TOP_K = 25;

export function applyCategoryBalance(
  scored: ScoredResource[],
  topK: number = TOP_K,
  maxPerCategory: number = MAX_PER_CATEGORY,
): ScoredResource[] {
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const counts: Partial<Record<Category, number>> = {};
  const selected: ScoredResource[] = [];

  for (const item of sorted) {
    const cat = item.resource.category;
    const c = counts[cat] ?? 0;
    if (c < maxPerCategory) {
      selected.push(item);
      counts[cat] = c + 1;
      if (selected.length >= topK) break;
    }
  }

  return selected;
}

export function rankResources(
  resources: Resource[],
  profile: StudentProfile,
  topK: number = TOP_K,
): ScoredResource[] {
  const scored: ScoredResource[] = resources.map((r) => ({
    resource: r,
    score: scoreResource(r, profile),
  }));
  return applyCategoryBalance(scored, topK);
}

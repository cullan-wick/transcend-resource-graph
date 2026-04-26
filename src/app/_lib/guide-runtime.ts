import { filterResources } from "@/lib/matching/filter";
import { scoreResource } from "@/lib/matching/score";
import { loadResources } from "@/lib/resources";
import type { StudentProfile } from "@/types/profile";
import {
  GROUP_DEFINITIONS,
  type GuideEntry,
  type PersonalizedGuide,
  type ResourceGroup,
} from "@/types/recommendation";
import type { Resource, ResourceType } from "@/types/resource";
import { BOTTLENECK_LABELS, INDUSTRY_LABELS, STAGE_LABELS } from "./survey";

type GuidePipelineResult = {
  guide: PersonalizedGuide;
  filteredCount: number;
  totalEntries: number;
};

const RESOURCE_TYPE_TO_GROUP = new Map<ResourceType, (typeof GROUP_DEFINITIONS)[number]["key"]>();
for (const def of GROUP_DEFINITIONS) {
  for (const rt of def.resource_types) {
    RESOURCE_TYPE_TO_GROUP.set(rt, def.key);
  }
}

function buildReason(resource: Resource, profile: StudentProfile): string {
  const parts: string[] = [];

  if (resource.bottleneck_tags.includes(profile.primary_bottleneck)) {
    parts.push(
      `directly addresses your ${BOTTLENECK_LABELS[profile.primary_bottleneck].toLowerCase()}`,
    );
  }

  if (resource.stages.includes(profile.stage)) {
    parts.push(`fits the ${STAGE_LABELS[profile.stage].toLowerCase()} stage`);
  }

  const industryHit = resource.industries.find((industry) =>
    profile.industries.includes(industry),
  );
  if (industryHit && industryHit !== "generalist") {
    parts.push(`strong match for ${INDUSTRY_LABELS[industryHit]}`);
  }

  if (resource.affiliation === "uw_madison") {
    parts.push("UW-specific path you can access quickly");
  } else if (resource.affiliation === "wisconsin_state") {
    parts.push("part of the Wisconsin founder ecosystem");
  }

  if (parts.length === 0 && resource.is_high_leverage_pick) {
    parts.push("a high-leverage pick for many UW founders");
  }

  return parts.length > 0
    ? `This resource ${parts.slice(0, 2).join(" and ")}.`
    : "Survived the eligibility filters and aligns with your profile.";
}

function buildOpeningNote(profile: StudentProfile, totalCount: number): string {
  if (totalCount === 0) {
    return `We couldn't find strong matches for your current profile yet. Try broadening your industry selection or removing already-engaged resources to surface more options.`;
  }

  return `We pulled ${totalCount} resources that fit your ${STAGE_LABELS[profile.stage].toLowerCase()} stage and help with ${BOTTLENECK_LABELS[profile.primary_bottleneck].toLowerCase()}. They're grouped by type so you can jump to what you need right now.`;
}

function buildGroups(
  profile: StudentProfile,
  resources: Resource[],
): { groups: ResourceGroup[]; totalEntries: number } {
  const scored = resources.map((resource) => ({
    resource,
    score: scoreResource(resource, profile),
    reason: buildReason(resource, profile),
  }));

  const byGroupKey = new Map<string, GuideEntry[]>();
  for (const { resource, score, reason } of scored) {
    const key = RESOURCE_TYPE_TO_GROUP.get(resource.resource_type);
    if (!key) continue;
    const entry: GuideEntry = {
      resource_id: resource.id,
      resource,
      reason,
      score,
    };
    if (!byGroupKey.has(key)) byGroupKey.set(key, []);
    byGroupKey.get(key)!.push(entry);
  }

  const groups: ResourceGroup[] = GROUP_DEFINITIONS.map((def) => {
    const entries = (byGroupKey.get(def.key) ?? []).sort(
      (a, b) => b.score - a.score,
    );
    return {
      key: def.key,
      label: def.label,
      description: def.description,
      entries,
    };
  }).filter((group) => group.entries.length > 0);

  const totalEntries = groups.reduce((sum, g) => sum + g.entries.length, 0);
  return { groups, totalEntries };
}

export async function runGuidePipeline(
  profile: StudentProfile,
): Promise<GuidePipelineResult> {
  const resources = loadResources();
  const filtered = filterResources(resources, profile);
  const { groups, totalEntries } = buildGroups(profile, filtered);

  const guide: PersonalizedGuide = {
    profile_snapshot: profile,
    generated_at: new Date().toISOString(),
    opening_note: buildOpeningNote(profile, totalEntries),
    groups,
  };

  return {
    guide,
    filteredCount: filtered.length,
    totalEntries,
  };
}

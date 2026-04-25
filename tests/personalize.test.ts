import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  hashStudentProfile,
  hydratePersonalizedGuideDraft,
  personalizeResources,
} from "../src/lib/llm/personalize";
import type { AnthropicClientLike } from "../src/lib/llm/client";
import type { ScoredResource } from "../src/lib/matching/types";
import type { StudentProfile } from "../src/types/profile";
import type { Resource, ResourceEligibility } from "../src/types/resource";

const BASE_ELIG: ResourceEligibility = {
  undergrad_eligible: true,
  masters_eligible: true,
  phd_eligible: true,
  faculty_staff_eligible: true,
  recent_grad_eligible: true,
  stem_required: false,
  college_restrictions: [],
  us_citizenship_required: false,
  team_required: false,
  solo_founder_eligible: true,
};

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

function makeProfile(partial: Partial<StudentProfile> = {}): StudentProfile {
  return {
    user_id: "u",
    email: "u@wisc.edu",
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
    uw_status: "undergrad",
    college: "cdis",
    stage: "building_mvp",
    industries: ["ai_ml"],
    business_model: "saas",
    capital_preference: "open_to_both",
    team_status: "has_cofounder",
    technical_status: "technical_founder",
    time_commitment: "part_time",
    primary_bottleneck: "product_technical",
    secondary_bottlenecks: ["funding"],
    already_engaged_with: [],
    additional_context: "Working on an AI assistant for campus labs.",
    ...partial,
  };
}

function makeResource(index: number, partial: Partial<Resource> = {}): Resource {
  return {
    id: partial.id ?? `resource-${index}`,
    name: partial.name ?? `Resource ${index}`,
    category: partial.category ?? "software_credits",
    description: partial.description ?? `Description ${index}`,
    stages: partial.stages ?? ["building_mvp"],
    industries: partial.industries ?? ["ai_ml"],
    affiliation: partial.affiliation ?? "national",
    resource_type: partial.resource_type ?? "software_credit",
    business_models: partial.business_models ?? ["saas"],
    capital_type: partial.capital_type ?? ["credits"],
    eligibility: partial.eligibility ?? BASE_ELIG,
    what_you_get: partial.what_you_get ?? "Credits and support",
    how_to_access: partial.how_to_access ?? "Apply online",
    is_high_leverage_pick: partial.is_high_leverage_pick ?? false,
    bottleneck_tags: partial.bottleneck_tags ?? ["product_technical"],
    source_coverage: partial.source_coverage ?? [],
    verification_flags: partial.verification_flags ?? [],
    last_reviewed: partial.last_reviewed ?? "2026-04-01",
    ...partial,
  };
}

function makeScoredResources(count: number): ScoredResource[] {
  return Array.from({ length: count }, (_, index) => ({
    resource: makeResource(index + 1, {
      id: `resource-${index + 1}`,
      name: `Resource ${index + 1}`,
      category: index % 2 === 0 ? "software_credits" : "mentorship_communities",
      bottleneck_tags: index % 2 === 0 ? ["product_technical"] : ["funding"],
    }),
    score: 100 - index,
  }));
}

function makeAnthropicClient(result: unknown): AnthropicClientLike {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        stop_reason: "tool_use",
        content: [
          {
            type: "tool_use",
            name: "submit_personalized_guide",
            input: result,
          },
        ],
      }),
    },
  };
}

async function makeTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "guide-cache-"));
  tempDirs.push(dir);
  return dir;
}

describe("hashStudentProfile", () => {
  it("normalizes unordered list fields before hashing", () => {
    const a = makeProfile({
      industries: ["consumer_d2c", "ai_ml"],
      secondary_bottlenecks: ["team", "funding"],
      already_engaged_with: ["b", "a"],
    });
    const b = makeProfile({
      industries: ["ai_ml", "consumer_d2c"],
      secondary_bottlenecks: ["funding", "team"],
      already_engaged_with: ["a", "b"],
    });

    expect(hashStudentProfile(a)).toBe(hashStudentProfile(b));
  });
});

describe("hydratePersonalizedGuideDraft", () => {
  it("deduplicates invalid ids, rebalances tiers, and hydrates resource+score", () => {
    const profile = makeProfile();
    const scoredResources = makeScoredResources(25);

    const guide = hydratePersonalizedGuideDraft(
      profile,
      scoredResources,
      {
        opening_note: "",
        tier_1_start_this_week: [
          {
            resource_id: "resource-1",
            reason:
              "Because you are building an AI ML MVP for campus labs and need product technical momentum, these credits unlock immediate experimentation for your stack this week.",
          },
          { resource_id: "resource-2", reason: "Useful for the same reason." },
          { resource_id: "resource-3", reason: "Useful for the same reason." },
          { resource_id: "resource-4", reason: "Useful for the same reason." },
          { resource_id: "resource-5", reason: "Useful for the same reason." },
          { resource_id: "resource-6", reason: "Useful for the same reason." },
        ],
        tier_2_explore_this_month: [
          { resource_id: "resource-1", reason: "Duplicate should be ignored." },
          { resource_id: "not-a-resource", reason: "Invalid should be ignored." },
          { resource_id: "resource-7", reason: "Good monthly option." },
        ],
        tier_3_bookmark_for_later: [],
      },
      "2026-04-23T12:00:00.000Z",
    );

    expect(guide.tier_1_start_this_week.length).toBeGreaterThanOrEqual(3);
    expect(guide.tier_1_start_this_week.length).toBeLessThanOrEqual(5);
    expect(guide.tier_2_explore_this_month.length).toBeGreaterThanOrEqual(6);
    expect(guide.tier_2_explore_this_month.length).toBeLessThanOrEqual(10);
    expect(
      guide.tier_1_start_this_week.length +
        guide.tier_2_explore_this_month.length +
        guide.tier_3_bookmark_for_later.length,
    ).toBe(25);

    const allEntries = [
      ...guide.tier_1_start_this_week,
      ...guide.tier_2_explore_this_month,
      ...guide.tier_3_bookmark_for_later,
    ];
    expect(new Set(allEntries.map((entry) => entry.resource_id)).size).toBe(25);
    expect(allEntries[0]?.resource.id).toBe(allEntries[0]?.resource_id);
    expect(allEntries[0]?.score).toBeDefined();
    expect(allEntries[0]?.reason.split(/\s+/).length).toBeLessThanOrEqual(25);
    expect(guide.opening_note.length).toBeGreaterThan(0);
  });
});

describe("personalizeResources", () => {
  it("caches by normalized profile hash and avoids repeat LLM calls", async () => {
    const profile = makeProfile({
      industries: ["consumer_d2c", "ai_ml"],
      secondary_bottlenecks: ["team", "funding"],
    });
    const reorderedProfile = makeProfile({
      industries: ["ai_ml", "consumer_d2c"],
      secondary_bottlenecks: ["funding", "team"],
    });
    const scoredResources = makeScoredResources(25);
    const cacheDir = await makeTempDir();
    const anthropicClient = makeAnthropicClient({
      opening_note: "This is your personalized guide.",
      tier_1_start_this_week: scoredResources.slice(0, 3).map(({ resource }) => ({
        resource_id: resource.id,
        reason: "Great fit right now.",
      })),
      tier_2_explore_this_month: scoredResources.slice(3, 9).map(({ resource }) => ({
        resource_id: resource.id,
        reason: "Worth exploring this month.",
      })),
      tier_3_bookmark_for_later: scoredResources.slice(9).map(({ resource }) => ({
        resource_id: resource.id,
        reason: "Relevant later on.",
      })),
    });

    const firstGuide = await personalizeResources(profile, scoredResources, {
      anthropicClient,
      cacheDir,
      now: new Date("2026-04-23T12:00:00.000Z"),
    });
    const secondGuide = await personalizeResources(reorderedProfile, scoredResources, {
      anthropicClient,
      cacheDir,
    });

    expect(firstGuide).toEqual(secondGuide);
    expect(anthropicClient.messages.create).toHaveBeenCalledTimes(1);

    const cachedFiles = await fs.readdir(cacheDir);
    expect(cachedFiles).toHaveLength(1);
  });
});

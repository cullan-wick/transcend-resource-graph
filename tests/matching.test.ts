import { describe, it, expect } from "vitest";
import { filterResources } from "../src/lib/matching/filter";
import {
  scoreResource,
  stagesAdjacent,
  applyCategoryBalance,
  rankResources,
} from "../src/lib/matching/score";
import type { Resource, ResourceEligibility } from "../src/types/resource";
import type { StudentProfile } from "../src/types/profile";

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

function makeResource(partial: Partial<Resource> & { id: string }): Resource {
  return {
    id: partial.id,
    name: partial.name ?? partial.id,
    category: partial.category ?? "funding_fellowships",
    description: partial.description ?? "",
    stages: partial.stages ?? ["building_mvp"],
    industries: partial.industries ?? ["generalist"],
    affiliation: partial.affiliation ?? "national",
    resource_type: partial.resource_type ?? "funding_grant",
    business_models: partial.business_models ?? ["agnostic"],
    capital_type: partial.capital_type ?? ["non_dilutive"],
    eligibility: { ...BASE_ELIG, ...(partial.eligibility ?? {}) },
    what_you_get: partial.what_you_get ?? "",
    how_to_access: partial.how_to_access ?? "",
    is_high_leverage_pick: partial.is_high_leverage_pick ?? false,
    bottleneck_tags: partial.bottleneck_tags ?? ["funding"],
    source_coverage: partial.source_coverage ?? [],
    verification_flags: partial.verification_flags ?? [],
    last_reviewed: partial.last_reviewed ?? "2026-04-01",
    ...partial,
  };
}

function makeProfile(partial: Partial<StudentProfile> = {}): StudentProfile {
  return {
    user_id: "u",
    email: "u@wisc.edu",
    created_at: "2026-04-01",
    updated_at: "2026-04-01",
    uw_status: "undergrad",
    college: "engineering",
    stage: "building_mvp",
    industries: ["ai_ml"],
    business_model: "saas",
    capital_preference: "open_to_both",
    team_status: "has_cofounder",
    technical_status: "technical_founder",
    time_commitment: "full_time",
    primary_bottleneck: "funding",
    secondary_bottlenecks: [],
    already_engaged_with: [],
    ...partial,
  };
}

describe("filterResources — stage rule", () => {
  it("drops resources whose stages don't include profile stage", () => {
    const r = makeResource({ id: "a", stages: ["scaling"] });
    const out = filterResources([r], makeProfile({ stage: "idea" }));
    expect(out).toHaveLength(0);
  });
  it("keeps stage-agnostic resources (all 8 stages)", () => {
    const r = makeResource({
      id: "a",
      stages: [
        "idea",
        "customer_discovery",
        "building_mvp",
        "pre_revenue",
        "early_revenue",
        "scaling",
        "fundraising_seed",
        "fundraising_series_a",
      ],
    });
    const out = filterResources([r], makeProfile({ stage: "idea" }));
    expect(out).toHaveLength(1);
  });
  it("keeps resources including profile stage", () => {
    const r = makeResource({ id: "a", stages: ["building_mvp"] });
    const out = filterResources([r], makeProfile({ stage: "building_mvp" }));
    expect(out).toHaveLength(1);
  });
});

describe("filterResources — industry rule", () => {
  it("keeps empty industries (any)", () => {
    const r = makeResource({ id: "a", industries: [] });
    expect(filterResources([r], makeProfile())).toHaveLength(1);
  });
  it("keeps generalist", () => {
    const r = makeResource({ id: "a", industries: ["generalist"] });
    expect(filterResources([r], makeProfile())).toHaveLength(1);
  });
  it("keeps when intersects with profile.industries", () => {
    const r = makeResource({ id: "a", industries: ["ai_ml", "fintech"] });
    expect(
      filterResources([r], makeProfile({ industries: ["ai_ml"] })),
    ).toHaveLength(1);
  });
  it("drops when no overlap", () => {
    const r = makeResource({ id: "a", industries: ["biotech_health"] });
    expect(
      filterResources([r], makeProfile({ industries: ["ai_ml"] })),
    ).toHaveLength(0);
  });
});

describe("filterResources — eligibility", () => {
  it("drops grad-only for undergrad", () => {
    const r = makeResource({
      id: "a",
      eligibility: {
        ...BASE_ELIG,
        undergrad_eligible: false,
        phd_eligible: true,
        masters_eligible: true,
      },
    });
    expect(
      filterResources([r], makeProfile({ uw_status: "undergrad" })),
    ).toHaveLength(0);
  });
  it("drops stem_required when college is non-STEM", () => {
    const r = makeResource({
      id: "a",
      eligibility: { ...BASE_ELIG, stem_required: true },
    });
    expect(
      filterResources([r], makeProfile({ college: "business" })),
    ).toHaveLength(0);
  });
  it("keeps stem_required when college is STEM (engineering)", () => {
    const r = makeResource({
      id: "a",
      eligibility: { ...BASE_ELIG, stem_required: true },
    });
    expect(
      filterResources([r], makeProfile({ college: "engineering" })),
    ).toHaveLength(1);
  });
  it("honors college_restrictions", () => {
    const r = makeResource({
      id: "a",
      eligibility: { ...BASE_ELIG, college_restrictions: ["business"] },
    });
    expect(
      filterResources([r], makeProfile({ college: "engineering" })),
    ).toHaveLength(0);
    expect(
      filterResources([r], makeProfile({ college: "business" })),
    ).toHaveLength(1);
  });
  it("drops resources that exclude solo founders for solo profile", () => {
    const r = makeResource({
      id: "a",
      eligibility: { ...BASE_ELIG, solo_founder_eligible: false },
    });
    expect(
      filterResources([r], makeProfile({ team_status: "solo" })),
    ).toHaveLength(0);
    expect(
      filterResources([r], makeProfile({ team_status: "has_cofounder" })),
    ).toHaveLength(1);
  });
});

describe("filterResources — capital preference", () => {
  it("drops dilutive-only for prefer_non_dilutive", () => {
    const r = makeResource({
      id: "a",
      capital_type: ["dilutive"],
      resource_type: "funding_equity",
    });
    expect(
      filterResources(
        [r],
        makeProfile({ capital_preference: "prefer_non_dilutive" }),
      ),
    ).toHaveLength(0);
  });
  it("keeps pitch_competition dilutive-only for prefer_non_dilutive", () => {
    const r = makeResource({
      id: "a",
      capital_type: ["dilutive"],
      resource_type: "pitch_competition",
    });
    expect(
      filterResources(
        [r],
        makeProfile({ capital_preference: "prefer_non_dilutive" }),
      ),
    ).toHaveLength(1);
  });
  it("drops equity VC rounds for bootstrapping", () => {
    const r = makeResource({
      id: "a",
      capital_type: ["dilutive"],
      resource_type: "funding_equity",
    });
    expect(
      filterResources([r], makeProfile({ capital_preference: "bootstrapping" })),
    ).toHaveLength(0);
  });
});

describe("filterResources — already engaged", () => {
  it("drops resources the student already engaged with", () => {
    const r = makeResource({ id: "warf" });
    expect(
      filterResources([r], makeProfile({ already_engaged_with: ["warf"] })),
    ).toHaveLength(0);
  });
});

describe("stagesAdjacent", () => {
  it("true when resource has neighboring stage", () => {
    expect(stagesAdjacent(["customer_discovery"], "building_mvp")).toBe(true);
    expect(stagesAdjacent(["pre_revenue"], "building_mvp")).toBe(true);
  });
  it("false for same stage (only adjacency)", () => {
    expect(stagesAdjacent(["building_mvp"], "building_mvp")).toBe(false);
  });
  it("false for far stages", () => {
    expect(stagesAdjacent(["scaling"], "idea")).toBe(false);
  });
});

describe("scoreResource — monotonicity", () => {
  const profile = makeProfile({
    stage: "building_mvp",
    industries: ["ai_ml"],
    primary_bottleneck: "funding",
    capital_preference: "want_vc",
    business_model: "saas",
  });

  it("exact stage > adjacent stage > far stage", () => {
    const exact = scoreResource(
      makeResource({ id: "a", stages: ["building_mvp"] }),
      profile,
    );
    const adj = scoreResource(
      makeResource({ id: "b", stages: ["customer_discovery"] }),
      profile,
    );
    const far = scoreResource(
      makeResource({ id: "c", stages: ["scaling"] }),
      profile,
    );
    expect(exact).toBeGreaterThan(adj);
    expect(adj).toBeGreaterThan(far);
  });

  it("industry match > generalist > mismatch-only", () => {
    const match = scoreResource(
      makeResource({ id: "a", industries: ["ai_ml"] }),
      profile,
    );
    const generalist = scoreResource(
      makeResource({ id: "b", industries: ["generalist"] }),
      profile,
    );
    const mismatch = scoreResource(
      makeResource({ id: "c", industries: ["biotech_health"] }),
      profile,
    );
    expect(match).toBeGreaterThan(generalist);
    expect(generalist).toBeGreaterThan(mismatch);
  });

  it("primary bottleneck > secondary bottleneck > none", () => {
    const p = makeProfile({
      primary_bottleneck: "funding",
      secondary_bottlenecks: ["mentorship"],
    });
    const primary = scoreResource(
      makeResource({ id: "a", bottleneck_tags: ["funding"] }),
      p,
    );
    const secondary = scoreResource(
      makeResource({ id: "b", bottleneck_tags: ["mentorship"] }),
      p,
    );
    const none = scoreResource(
      makeResource({ id: "c", bottleneck_tags: ["legal"] }),
      p,
    );
    expect(primary).toBeGreaterThan(secondary);
    expect(secondary).toBeGreaterThan(none);
  });

  it("UW affiliation > wisconsin_state > national (all else equal)", () => {
    const uw = scoreResource(
      makeResource({ id: "a", affiliation: "uw_madison" }),
      profile,
    );
    const wi = scoreResource(
      makeResource({ id: "b", affiliation: "wisconsin_state" }),
      profile,
    );
    const nat = scoreResource(
      makeResource({ id: "c", affiliation: "national" }),
      profile,
    );
    expect(uw).toBeGreaterThan(wi);
    expect(wi).toBeGreaterThan(nat);
  });

  it("high-leverage pick adds bonus", () => {
    const base = scoreResource(makeResource({ id: "a" }), profile);
    const pick = scoreResource(
      makeResource({ id: "b", is_high_leverage_pick: true }),
      profile,
    );
    expect(pick).toBeGreaterThan(base);
  });

  it("capital alignment bonus for want_vc + dilutive", () => {
    const dilutive = scoreResource(
      makeResource({ id: "a", capital_type: ["dilutive"] }),
      profile,
    );
    const other = scoreResource(
      makeResource({ id: "b", capital_type: ["non_dilutive"] }),
      profile,
    );
    expect(dilutive).toBeGreaterThan(other);
  });

  it("is deterministic", () => {
    const r = makeResource({ id: "a" });
    expect(scoreResource(r, profile)).toBe(scoreResource(r, profile));
  });
});

describe("applyCategoryBalance", () => {
  it("caps any single category to max 6 in top 25", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      resource: makeResource({
        id: `x${i}`,
        category: "industry_specific",
      }),
      score: 100 - i,
    }));
    const others = Array.from({ length: 20 }, (_, i) => ({
      resource: makeResource({
        id: `y${i}`,
        category: "funding_fellowships",
      }),
      score: 50 - i,
    }));
    const balanced = applyCategoryBalance([...many, ...others], 25, 6);
    const cnt = balanced.filter(
      (b) => b.resource.category === "industry_specific",
    ).length;
    expect(cnt).toBeLessThanOrEqual(6);
    expect(balanced.length).toBeLessThanOrEqual(25);
  });

  it("strictly enforces cap even when no other categories are available", () => {
    const only = Array.from({ length: 10 }, (_, i) => ({
      resource: makeResource({ id: `z${i}`, category: "education" }),
      score: 100 - i,
    }));
    const out = applyCategoryBalance(only, 25, 6);
    expect(out).toHaveLength(6);
    expect(out[0].resource.id).toBe("z0");
    expect(out[5].resource.id).toBe("z5");
  });
});

describe("rankResources integration", () => {
  it("returns up to topK sorted by score desc", () => {
    const rs = [
      makeResource({ id: "a", stages: ["idea"], industries: ["ai_ml"] }),
      makeResource({
        id: "b",
        stages: ["building_mvp"],
        industries: ["ai_ml"],
      }),
      makeResource({
        id: "c",
        stages: ["building_mvp"],
        industries: ["biotech_health"],
      }),
    ];
    const p = makeProfile({
      stage: "building_mvp",
      industries: ["ai_ml"],
    });
    const ranked = rankResources(rs, p, 3);
    expect(ranked[0].resource.id).toBe("b");
  });
});

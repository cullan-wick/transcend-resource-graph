import type { Resource, Stage } from "../../types/resource";
import type { StudentProfile, College } from "../../types/profile";
import { ALL_STAGES } from "../../types/resource";

const STEM_COLLEGES: College[] = ["engineering", "cdis", "agriculture"];

function isStageAgnostic(stages: Stage[]): boolean {
  if (stages.length !== ALL_STAGES.length) return false;
  const set = new Set(stages);
  return ALL_STAGES.every((s) => set.has(s));
}

function passesStage(resource: Resource, profile: StudentProfile): boolean {
  if (resource.stages.includes(profile.stage)) return true;
  if (isStageAgnostic(resource.stages)) return true;
  return false;
}

function passesIndustry(resource: Resource, profile: StudentProfile): boolean {
  if (resource.industries.length === 0) return true;
  if (resource.industries.includes("generalist")) return true;
  return resource.industries.some((i) => profile.industries.includes(i));
}

function passesEligibility(resource: Resource, profile: StudentProfile): boolean {
  const elig = resource.eligibility;

  if (profile.uw_status === "undergrad") {
    const onlyGrad =
      !elig.undergrad_eligible &&
      (elig.masters_eligible || elig.phd_eligible);
    if (onlyGrad) return false;
  }

  if (profile.uw_status === "faculty_staff") {
    if (!elig.faculty_staff_eligible) {
      const studentOnly =
        elig.undergrad_eligible ||
        elig.masters_eligible ||
        elig.phd_eligible ||
        elig.recent_grad_eligible;
      if (studentOnly) return false;
    }
  }

  if (elig.stem_required && !STEM_COLLEGES.includes(profile.college)) {
    return false;
  }

  if (elig.college_restrictions.length > 0) {
    const match = elig.college_restrictions.some(
      (c) => c.toLowerCase() === profile.college.toLowerCase(),
    );
    if (!match) return false;
  }

  if (elig.solo_founder_eligible === false && profile.team_status === "solo") {
    return false;
  }

  return true;
}

function passesCapitalPreference(
  resource: Resource,
  profile: StudentProfile,
): boolean {
  if (profile.capital_preference === "prefer_non_dilutive") {
    const onlyDilutive =
      resource.capital_type.length === 1 &&
      resource.capital_type[0] === "dilutive";
    if (onlyDilutive && resource.resource_type !== "pitch_competition") {
      return false;
    }
  }

  if (profile.capital_preference === "bootstrapping") {
    const isVcPitch =
      resource.resource_type === "funding_equity" &&
      resource.capital_type.length === 1 &&
      resource.capital_type[0] === "dilutive";
    if (isVcPitch) return false;
  }

  return true;
}

function passesAlreadyEngaged(
  resource: Resource,
  profile: StudentProfile,
): boolean {
  return !profile.already_engaged_with.includes(resource.id);
}

export function filterResources(
  resources: Resource[],
  profile: StudentProfile,
): Resource[] {
  return resources.filter(
    (r) =>
      passesStage(r, profile) &&
      passesIndustry(r, profile) &&
      passesEligibility(r, profile) &&
      passesCapitalPreference(r, profile) &&
      passesAlreadyEngaged(r, profile),
  );
}

export const _internals = {
  passesStage,
  passesIndustry,
  passesEligibility,
  passesCapitalPreference,
  passesAlreadyEngaged,
  isStageAgnostic,
};

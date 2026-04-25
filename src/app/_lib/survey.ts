import type {
  BusinessModel,
  Bottleneck,
  Industry,
  Stage,
} from "@/types/resource";
import type {
  CapitalPreference,
  College,
  StudentProfile,
  TechnicalStatus,
  TeamStatus,
  TimeCommitment,
  UwStatus,
} from "@/types/profile";

type Option<T extends string> = {
  value: T;
  label: string;
  description?: string;
};

export type SurveyDraft = Pick<
  StudentProfile,
  | "uw_status"
  | "college"
  | "graduation_year"
  | "stage"
  | "industries"
  | "business_model"
  | "capital_preference"
  | "team_status"
  | "technical_status"
  | "time_commitment"
  | "primary_bottleneck"
  | "secondary_bottlenecks"
  | "already_engaged_with"
  | "additional_context"
>;

export type CommonResourceOption = {
  id: string;
  name: string;
};

export const SURVEY_STORAGE_KEY = "transcend-survey-draft-v1";

export const STAGE_OPTIONS: Option<Stage>[] = [
  { value: "idea", label: "Just an idea, no real product yet" },
  {
    value: "customer_discovery",
    label: "Talking to potential customers, validating the problem",
  },
  { value: "building_mvp", label: "Actively building an MVP" },
  { value: "pre_revenue", label: "Have a product, no revenue yet" },
  { value: "early_revenue", label: "Earning revenue" },
  { value: "fundraising_seed", label: "Raising a seed round" },
  { value: "fundraising_series_a", label: "Raising Series A" },
  { value: "scaling", label: "Scaling beyond early traction" },
];

export const INDUSTRY_OPTIONS: Option<Industry>[] = [
  { value: "ai_ml", label: "AI / ML" },
  { value: "climate_cleantech", label: "Climate / CleanTech" },
  { value: "biotech_health", label: "Biotech / Healthcare" },
  { value: "consumer_d2c", label: "Consumer / D2C" },
  { value: "fintech", label: "Fintech" },
  { value: "hardware_deep_tech", label: "Hardware / Deep Tech" },
  { value: "crypto_web3", label: "Crypto / Web3" },
  { value: "gaming", label: "Gaming" },
  { value: "social_impact", label: "Social Impact" },
  { value: "enterprise_saas", label: "Enterprise SaaS" },
  { value: "edtech", label: "EdTech" },
  { value: "generalist", label: "Not sure yet / exploring" },
];

export const BUSINESS_MODEL_OPTIONS: Option<BusinessModel>[] = [
  { value: "saas", label: "SaaS / subscription software" },
  {
    value: "consumer_d2c",
    label: "Consumer product (D2C, app, marketplace)",
  },
  { value: "hardware", label: "Hardware / physical product" },
  {
    value: "biotech_therapeutics",
    label: "Biotech therapeutic or medical device",
  },
  {
    value: "deep_tech_research",
    label: "Deep tech / research commercialization",
  },
  { value: "services", label: "Services" },
  { value: "agnostic", label: "Still figuring it out" },
];

export const UW_STATUS_OPTIONS: Option<UwStatus>[] = [
  { value: "undergrad", label: "Undergrad" },
  { value: "masters", label: "Master's" },
  { value: "phd", label: "PhD" },
  { value: "recent_grad", label: "Recent grad (< 2 years)" },
  { value: "faculty_staff", label: "Faculty / staff" },
];

export const COLLEGE_OPTIONS: Option<College>[] = [
  { value: "engineering", label: "Engineering" },
  { value: "business", label: "Business (WSB)" },
  { value: "letters_science", label: "Letters & Science" },
  {
    value: "cdis",
    label: "Computer, Data & Information Sciences (CDIS)",
  },
  { value: "agriculture", label: "Agricultural & Life Sciences (CALS)" },
  { value: "other", label: "Other" },
];

export const TEAM_STATUS_OPTIONS: Option<TeamStatus>[] = [
  { value: "solo", label: "Solo founder" },
  { value: "has_cofounder", label: "Have one or more co-founders" },
  {
    value: "looking_for_cofounder",
    label: "Actively looking for a co-founder",
  },
];

export const TECHNICAL_STATUS_OPTIONS: Option<TechnicalStatus>[] = [
  { value: "technical_founder", label: "I can build the product myself" },
  {
    value: "non_technical_seeking_cto",
    label: "I'm non-technical and need a technical co-founder",
  },
  { value: "hybrid_team", label: "Mixed / hybrid team" },
];

export const CAPITAL_PREFERENCE_OPTIONS: Option<CapitalPreference>[] = [
  { value: "want_vc", label: "I want to raise VC" },
  {
    value: "prefer_non_dilutive",
    label: "I prefer non-dilutive (grants, fellowships, revenue)",
  },
  { value: "bootstrapping", label: "I'm bootstrapping" },
  { value: "open_to_both", label: "Open to whatever fits" },
];

export const BOTTLENECK_OPTIONS: Option<Bottleneck>[] = [
  { value: "funding", label: "Funding / capital" },
  { value: "customers", label: "Finding customers / distribution" },
  { value: "team", label: "Team / hiring" },
  { value: "legal", label: "Legal / incorporation / IP" },
  { value: "product_technical", label: "Building the product itself" },
  { value: "mentorship", label: "Mentorship / advice" },
  { value: "space_facilities", label: "Physical space / lab access" },
  { value: "awareness", label: "Getting noticed / awareness" },
];

export const TIME_COMMITMENT_OPTIONS: Option<TimeCommitment>[] = [
  { value: "full_time", label: "Working on this full-time" },
  { value: "part_time", label: "Working on this part-time" },
  { value: "exploring", label: "Still exploring" },
];

export const STAGE_LABELS = Object.fromEntries(
  STAGE_OPTIONS.map((option) => [option.value, option.label]),
) as Record<Stage, string>;

export const INDUSTRY_LABELS = Object.fromEntries(
  INDUSTRY_OPTIONS.map((option) => [option.value, option.label]),
) as Record<Industry, string>;

export const BUSINESS_MODEL_LABELS = Object.fromEntries(
  BUSINESS_MODEL_OPTIONS.map((option) => [option.value, option.label]),
) as Record<BusinessModel, string>;

export const UW_STATUS_LABELS = Object.fromEntries(
  UW_STATUS_OPTIONS.map((option) => [option.value, option.label]),
) as Record<UwStatus, string>;

export const COLLEGE_LABELS = Object.fromEntries(
  COLLEGE_OPTIONS.map((option) => [option.value, option.label]),
) as Record<College, string>;

export const TEAM_STATUS_LABELS = Object.fromEntries(
  TEAM_STATUS_OPTIONS.map((option) => [option.value, option.label]),
) as Record<TeamStatus, string>;

export const TECHNICAL_STATUS_LABELS = Object.fromEntries(
  TECHNICAL_STATUS_OPTIONS.map((option) => [option.value, option.label]),
) as Record<TechnicalStatus, string>;

export const CAPITAL_PREFERENCE_LABELS = Object.fromEntries(
  CAPITAL_PREFERENCE_OPTIONS.map((option) => [option.value, option.label]),
) as Record<CapitalPreference, string>;

export const BOTTLENECK_LABELS = Object.fromEntries(
  BOTTLENECK_OPTIONS.map((option) => [option.value, option.label]),
) as Record<Bottleneck, string>;

export const TIME_COMMITMENT_LABELS = Object.fromEntries(
  TIME_COMMITMENT_OPTIONS.map((option) => [option.value, option.label]),
) as Record<TimeCommitment, string>;

export function getDefaultSurveyDraft(): SurveyDraft {
  return {
    uw_status: "undergrad",
    college: "engineering",
    graduation_year: undefined,
    stage: "idea",
    industries: [],
    business_model: "agnostic",
    capital_preference: "open_to_both",
    team_status: "solo",
    technical_status: "technical_founder",
    time_commitment: "exploring",
    primary_bottleneck: "funding",
    secondary_bottlenecks: [],
    already_engaged_with: [],
    additional_context: "",
  };
}

export function toSurveyDraft(
  profile?: Partial<StudentProfile> | null,
): SurveyDraft {
  const defaults = getDefaultSurveyDraft();

  if (!profile) return defaults;

  return {
    ...defaults,
    ...profile,
    industries: Array.isArray(profile.industries)
      ? profile.industries
      : defaults.industries,
    secondary_bottlenecks: Array.isArray(profile.secondary_bottlenecks)
      ? profile.secondary_bottlenecks
      : defaults.secondary_bottlenecks,
    already_engaged_with: Array.isArray(profile.already_engaged_with)
      ? profile.already_engaged_with
      : defaults.already_engaged_with,
    additional_context: profile.additional_context ?? "",
  };
}

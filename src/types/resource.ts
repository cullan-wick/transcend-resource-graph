export type Stage =
  | "idea"
  | "customer_discovery"
  | "building_mvp"
  | "pre_revenue"
  | "early_revenue"
  | "scaling"
  | "fundraising_seed"
  | "fundraising_series_a";

export const ALL_STAGES: Stage[] = [
  "idea",
  "customer_discovery",
  "building_mvp",
  "pre_revenue",
  "early_revenue",
  "scaling",
  "fundraising_seed",
  "fundraising_series_a",
];

export type Industry =
  | "ai_ml"
  | "climate_cleantech"
  | "biotech_health"
  | "consumer_d2c"
  | "fintech"
  | "hardware_deep_tech"
  | "crypto_web3"
  | "gaming"
  | "social_impact"
  | "enterprise_saas"
  | "edtech"
  | "generalist";

export type Affiliation = "uw_madison" | "wisconsin_state" | "national" | "global";

export type ResourceType =
  | "funding_equity"
  | "funding_grant"
  | "funding_loan"
  | "pitch_competition"
  | "accelerator"
  | "incubator"
  | "fellowship"
  | "software_credit"
  | "legal_service"
  | "mentorship"
  | "community"
  | "education_course"
  | "education_book"
  | "physical_space"
  | "talent_platform"
  | "event_recurring"
  | "media_newsletter";

export type BusinessModel =
  | "saas"
  | "consumer_d2c"
  | "marketplace"
  | "hardware"
  | "biotech_therapeutics"
  | "medical_device"
  | "deep_tech_research"
  | "services"
  | "content_media"
  | "agnostic";

export type CapitalType =
  | "dilutive"
  | "non_dilutive"
  | "credits"
  | "in_kind"
  | "not_applicable";

export type Bottleneck =
  | "funding"
  | "customers"
  | "team"
  | "legal"
  | "product_technical"
  | "mentorship"
  | "ip_patents"
  | "space_facilities"
  | "awareness";

export type Category =
  | "uw_institutional_hub"
  | "funding_fellowships"
  | "pitch_competitions"
  | "accelerators_incubators"
  | "software_credits"
  | "legal_services"
  | "mentorship_communities"
  | "non_dilutive_funding"
  | "physical_spaces"
  | "talent_hiring"
  | "education"
  | "events"
  | "industry_specific";

export type ResourceEligibility = {
  undergrad_eligible: boolean;
  masters_eligible: boolean;
  phd_eligible: boolean;
  faculty_staff_eligible: boolean;
  recent_grad_eligible: boolean;
  stem_required: boolean;
  college_restrictions: string[];
  us_citizenship_required: boolean;
  team_required: boolean;
  solo_founder_eligible: boolean;
};

export type ResourceContact = {
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
};

export type Resource = {
  id: string;
  name: string;
  category: Category;
  subcategory?: string;
  description: string;

  stages: Stage[];
  industries: Industry[];
  affiliation: Affiliation;
  resource_type: ResourceType;
  business_models: BusinessModel[];
  capital_type: CapitalType[];

  eligibility: ResourceEligibility;

  what_you_get: string;
  how_to_access: string;
  external_url?: string;
  contact?: ResourceContact;

  dollar_value_estimate?: number;
  deadline?: string | null;
  is_high_leverage_pick: boolean;
  bottleneck_tags: Bottleneck[];
  notes?: string;

  source_coverage: string[];
  verification_flags: string[];
  last_reviewed: string;
};

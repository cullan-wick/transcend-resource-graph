import type { Resource, ResourceType } from "./resource";
import type { StudentProfile } from "./profile";

export type GuideEntry = {
  resource_id: string;
  resource: Resource;
  reason: string;
  score: number;
};

export type GroupKey =
  | "accelerators_incubators"
  | "pitch_competitions"
  | "funding"
  | "fellowships"
  | "software_credits"
  | "mentorship_community"
  | "education"
  | "events"
  | "legal"
  | "physical_spaces"
  | "talent"
  | "newsletters";

export type ResourceGroup = {
  key: GroupKey;
  label: string;
  description: string;
  entries: GuideEntry[];
};

export type PersonalizedGuide = {
  profile_snapshot: StudentProfile;
  generated_at: string;
  opening_note: string;
  groups: ResourceGroup[];
};

export const GROUP_DEFINITIONS: {
  key: GroupKey;
  label: string;
  description: string;
  resource_types: ResourceType[];
}[] = [
  {
    key: "accelerators_incubators",
    label: "Accelerators & incubators",
    description: "Cohort-based programs that provide funding, mentorship, and structure.",
    resource_types: ["accelerator", "incubator"],
  },
  {
    key: "pitch_competitions",
    label: "Pitch competitions",
    description: "Competitions you can enter to win prize money, exposure, or mentorship.",
    resource_types: ["pitch_competition"],
  },
  {
    key: "funding",
    label: "Funding",
    description: "Equity, grant, and loan capital available to founders.",
    resource_types: ["funding_equity", "funding_grant", "funding_loan"],
  },
  {
    key: "fellowships",
    label: "Fellowships",
    description: "Paid programs for individual founders.",
    resource_types: ["fellowship"],
  },
  {
    key: "software_credits",
    label: "Software credits & discounts",
    description: "Free or discounted access to tools, infrastructure, and services.",
    resource_types: ["software_credit"],
  },
  {
    key: "mentorship_community",
    label: "Mentorship & community",
    description: "People and groups who can advise, connect, or accelerate you.",
    resource_types: ["mentorship", "community"],
  },
  {
    key: "education",
    label: "Courses & education",
    description: "Classes, workshops, and books to deepen your founder knowledge.",
    resource_types: ["education_course", "education_book"],
  },
  {
    key: "events",
    label: "Events",
    description: "Recurring meetups, summits, and conferences worth attending.",
    resource_types: ["event_recurring"],
  },
  {
    key: "legal",
    label: "Legal services",
    description: "Lawyers, clinics, and templates for incorporation, IP, and contracts.",
    resource_types: ["legal_service"],
  },
  {
    key: "physical_spaces",
    label: "Physical spaces",
    description: "Coworking, labs, and makerspaces you can use.",
    resource_types: ["physical_space"],
  },
  {
    key: "talent",
    label: "Talent & hiring",
    description: "Platforms and channels to find co-founders, contractors, and hires.",
    resource_types: ["talent_platform"],
  },
  {
    key: "newsletters",
    label: "Newsletters",
    description: "Media and reading lists to stay current.",
    resource_types: ["media_newsletter"],
  },
];

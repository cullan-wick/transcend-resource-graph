import type { Stage, Industry, BusinessModel, Bottleneck } from "./resource";

export type UwStatus =
  | "undergrad"
  | "masters"
  | "phd"
  | "recent_grad"
  | "faculty_staff";

export type College =
  | "engineering"
  | "business"
  | "letters_science"
  | "cdis"
  | "agriculture"
  | "other";

export type CapitalPreference =
  | "want_vc"
  | "prefer_non_dilutive"
  | "bootstrapping"
  | "open_to_both";

export type TeamStatus = "solo" | "has_cofounder" | "looking_for_cofounder";

export type TechnicalStatus =
  | "technical_founder"
  | "non_technical_seeking_cto"
  | "hybrid_team";

export type TimeCommitment = "full_time" | "part_time" | "exploring";

export type StudentProfile = {
  user_id: string;
  email: string;
  created_at: string;
  updated_at: string;

  uw_status: UwStatus;
  college: College;
  graduation_year?: number;

  stage: Stage;
  industries: Industry[];
  business_model: BusinessModel;
  capital_preference: CapitalPreference;

  team_status: TeamStatus;
  technical_status: TechnicalStatus;
  time_commitment: TimeCommitment;

  primary_bottleneck: Bottleneck;
  secondary_bottlenecks: Bottleneck[];

  already_engaged_with: string[];

  additional_context?: string;
};

import type { Resource } from "./resource";
import type { StudentProfile } from "./profile";

export type TierEntry = {
  resource_id: string;
  resource: Resource;
  reason: string;
  score: number;
};

export type PersonalizedGuide = {
  profile_snapshot: StudentProfile;
  generated_at: string;
  opening_note: string;
  tier_1_start_this_week: TierEntry[];
  tier_2_explore_this_month: TierEntry[];
  tier_3_bookmark_for_later: TierEntry[];
};

import type { StudentProfile } from "@/types/profile";
import type { PersonalizedGuide } from "@/types/recommendation";
import type { FeedbackRow, GuideRow, ProfileRow, TypedSupabaseClient } from "./client";

export type StoredGuide = {
  id: string;
  generated_at: string;
  guide: PersonalizedGuide;
};

function profileRowToProfile(row: ProfileRow): StudentProfile {
  return {
    user_id: row.user_id,
    email: row.email,
    created_at: row.created_at,
    updated_at: row.updated_at,
    uw_status: row.uw_status as StudentProfile["uw_status"],
    college: row.college as StudentProfile["college"],
    graduation_year: row.graduation_year ?? undefined,
    stage: row.stage as StudentProfile["stage"],
    industries: row.industries as StudentProfile["industries"],
    business_model: row.business_model as StudentProfile["business_model"],
    capital_preference:
      row.capital_preference as StudentProfile["capital_preference"],
    team_status: row.team_status as StudentProfile["team_status"],
    technical_status: row.technical_status as StudentProfile["technical_status"],
    time_commitment: row.time_commitment as StudentProfile["time_commitment"],
    primary_bottleneck:
      row.primary_bottleneck as StudentProfile["primary_bottleneck"],
    secondary_bottlenecks:
      row.secondary_bottlenecks as StudentProfile["secondary_bottlenecks"],
    already_engaged_with: row.already_engaged_with,
    additional_context: row.additional_context ?? undefined,
  };
}

function profileToRow(profile: StudentProfile): ProfileRow {
  return {
    user_id: profile.user_id,
    email: profile.email,
    uw_status: profile.uw_status,
    college: profile.college,
    graduation_year: profile.graduation_year ?? null,
    stage: profile.stage,
    industries: profile.industries,
    business_model: profile.business_model,
    capital_preference: profile.capital_preference,
    team_status: profile.team_status,
    technical_status: profile.technical_status,
    time_commitment: profile.time_commitment,
    primary_bottleneck: profile.primary_bottleneck,
    secondary_bottlenecks: profile.secondary_bottlenecks,
    already_engaged_with: profile.already_engaged_with,
    additional_context: profile.additional_context ?? null,
    created_at: profile.created_at,
    updated_at: profile.updated_at,
  };
}

function guideRowToStoredGuide(row: GuideRow): StoredGuide {
  return {
    id: row.id,
    generated_at: row.generated_at,
    guide: row.guide_json as PersonalizedGuide,
  };
}

export async function getProfileByUserId(
  supabase: TypedSupabaseClient,
  userId: string,
): Promise<StudentProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? profileRowToProfile(data) : null;
}

export async function upsertProfile(
  supabase: TypedSupabaseClient,
  profile: StudentProfile,
): Promise<StudentProfile> {
  const { data, error } = await supabase
    .from("profiles")
    .upsert(profileToRow(profile), { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return profileRowToProfile(data);
}

export async function insertGuide(
  supabase: TypedSupabaseClient,
  userId: string,
  profile: StudentProfile,
  guide: PersonalizedGuide,
): Promise<StoredGuide> {
  const { data, error } = await supabase
    .from("guides")
    .insert({
      user_id: userId,
      profile_snapshot: profile,
      guide_json: guide,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return guideRowToStoredGuide(data);
}

export async function getLatestGuideByUserId(
  supabase: TypedSupabaseClient,
  userId: string,
): Promise<StoredGuide | null> {
  const { data, error } = await supabase
    .from("guides")
    .select("*")
    .eq("user_id", userId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? guideRowToStoredGuide(data) : null;
}

export async function insertFeedback(
  supabase: TypedSupabaseClient,
  feedback: Pick<FeedbackRow, "user_id" | "guide_id" | "resource_id" | "reaction">,
): Promise<FeedbackRow> {
  const { data, error } = await supabase
    .from("feedback")
    .insert(feedback)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

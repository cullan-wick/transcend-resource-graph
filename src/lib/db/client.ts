import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type ProfileRow = {
  user_id: string;
  email: string;
  uw_status: string;
  college: string;
  graduation_year: number | null;
  stage: string;
  industries: string[];
  business_model: string;
  capital_preference: string;
  team_status: string;
  technical_status: string;
  time_commitment: string;
  primary_bottleneck: string;
  secondary_bottlenecks: string[];
  already_engaged_with: string[];
  additional_context: string | null;
  created_at: string;
  updated_at: string;
};

export type GuideRow = {
  id: string;
  user_id: string;
  profile_snapshot: unknown;
  guide_json: unknown;
  generated_at: string;
};

export type FeedbackRow = {
  id: string;
  user_id: string;
  guide_id: string;
  resource_id: string;
  reaction:
    | "thumbs_up"
    | "thumbs_down"
    | "pursuing"
    | "done"
    | "not_relevant";
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: { Row: ProfileRow; Insert: Partial<ProfileRow>; Update: Partial<ProfileRow> };
      guides: { Row: GuideRow; Insert: Partial<GuideRow>; Update: Partial<GuideRow> };
      feedback: { Row: FeedbackRow; Insert: Partial<FeedbackRow>; Update: Partial<FeedbackRow> };
    };
  };
};

export type TypedSupabaseClient = SupabaseClient<Database>;

export function getSupabaseBrowserClient(): TypedSupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }
  return createClient<Database>(url, anonKey);
}

export function getSupabaseServerClient(): TypedSupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

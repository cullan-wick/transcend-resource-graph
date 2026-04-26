import { NextResponse } from "next/server";
import { getRouteAppUser } from "@/app/_lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;
import { runGuidePipeline } from "@/app/_lib/guide-runtime";
import { type SurveyDraft, toSurveyDraft } from "@/app/_lib/survey";
import { getSupabaseServerClient } from "@/lib/db/client";
import {
  getProfileByUserId,
  insertGuide,
  upsertProfile,
} from "@/lib/db/queries";
import type { StudentProfile } from "@/types/profile";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(request: Request) {
  const authResult = await getRouteAppUser();
  if (!authResult.ok) {
    return NextResponse.json(
      {
        error:
          authResult.reason === "wisc_only"
            ? "Please use your @wisc.edu account."
            : "Unauthorized.",
      },
      { status: authResult.reason === "wisc_only" ? 403 : 401 },
    );
  }

  let payload: Partial<SurveyDraft> | null = null;

  try {
    payload = (await request.json()) as Partial<SurveyDraft>;
  } catch {
    return badRequest("Invalid JSON payload.");
  }

  const draft = toSurveyDraft(payload);

  if (!payload?.stage) return badRequest("Startup stage is required.");
  if (!Array.isArray(payload?.industries) || payload.industries.length === 0) {
    return badRequest("Pick at least one industry.");
  }
  if (payload.industries.length > 2) {
    return badRequest("Pick at most two industries.");
  }
  if (!payload?.primary_bottleneck) {
    return badRequest("Primary bottleneck is required.");
  }
  if ((draft.additional_context ?? "").length > 500) {
    return badRequest("Additional context must be 500 characters or less.");
  }

  try {
    const supabase = getSupabaseServerClient();
    const existingProfile = await getProfileByUserId(
      supabase,
      authResult.user.userId,
    );
    const now = new Date().toISOString();

    const profile: StudentProfile = {
      user_id: authResult.user.userId,
      email: authResult.user.email,
      created_at: existingProfile?.created_at ?? now,
      updated_at: now,
      ...draft,
      secondary_bottlenecks: draft.secondary_bottlenecks ?? [],
      already_engaged_with: draft.already_engaged_with ?? [],
      additional_context: draft.additional_context?.trim() || undefined,
    };

    const savedProfile = await upsertProfile(supabase, profile);
    const { guide } = await runGuidePipeline(savedProfile);
    const storedGuide = await insertGuide(
      supabase,
      savedProfile.user_id,
      savedProfile,
      guide,
    );

    return NextResponse.json({
      guide_id: storedGuide.id,
      guide: storedGuide.guide,
      profile: savedProfile,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to save survey and generate guide.",
      },
      { status: 500 },
    );
  }
}

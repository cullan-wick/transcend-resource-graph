import { NextResponse } from "next/server";
import { getRouteAppUser } from "@/app/_lib/auth";
import { runGuidePipeline } from "@/app/_lib/guide-runtime";
import { getSupabaseServerClient } from "@/lib/db/client";
import {
  getProfileByUserId,
  insertGuide,
} from "@/lib/db/queries";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  const authResult = await getRouteAppUser();
  if (!authResult.ok) {
    return NextResponse.json(
      { error: authResult.reason === "wisc_only" ? "Forbidden." : "Unauthorized." },
      { status: authResult.reason === "wisc_only" ? 403 : 401 },
    );
  }

  try {
    const supabase = getSupabaseServerClient();
    const profile = await getProfileByUserId(supabase, authResult.user.userId);

    if (!profile) {
      return NextResponse.json(
        { error: "No saved profile found. Complete the survey first." },
        { status: 404 },
      );
    }

    const { guide } = await runGuidePipeline(profile);
    const storedGuide = await insertGuide(
      supabase,
      profile.user_id,
      profile,
      guide,
    );

    return NextResponse.json({
      guide_id: storedGuide.id,
      guide: storedGuide.guide,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to regenerate guide.",
      },
      { status: 500 },
    );
  }
}

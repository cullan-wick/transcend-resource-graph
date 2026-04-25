import { NextResponse } from "next/server";
import { getRouteAppUser } from "@/app/_lib/auth";
import { getSupabaseServerClient } from "@/lib/db/client";
import { insertFeedback } from "@/lib/db/queries";

const VALID_REACTIONS = new Set(["thumbs_up", "thumbs_down"]);

export async function POST(request: Request) {
  const authResult = await getRouteAppUser();
  if (!authResult.ok) {
    return NextResponse.json(
      { error: authResult.reason === "wisc_only" ? "Forbidden." : "Unauthorized." },
      { status: authResult.reason === "wisc_only" ? 403 : 401 },
    );
  }

  let payload:
    | {
        guide_id?: string;
        resource_id?: string;
        reaction?: string;
      }
    | null = null;

  try {
    payload = (await request.json()) as {
      guide_id?: string;
      resource_id?: string;
      reaction?: string;
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  if (!payload?.guide_id || !payload.resource_id || !payload.reaction) {
    return NextResponse.json(
      { error: "guide_id, resource_id, and reaction are required." },
      { status: 400 },
    );
  }

  if (!VALID_REACTIONS.has(payload.reaction)) {
    return NextResponse.json(
      { error: "Only thumbs_up and thumbs_down are supported here." },
      { status: 400 },
    );
  }

  try {
    const supabase = getSupabaseServerClient();
    const { data: guide, error: guideError } = await supabase
      .from("guides")
      .select("id")
      .eq("id", payload.guide_id)
      .eq("user_id", authResult.user.userId)
      .maybeSingle();

    if (guideError) {
      throw new Error(guideError.message);
    }

    if (!guide) {
      return NextResponse.json(
        { error: "Guide not found for the current user." },
        { status: 404 },
      );
    }

    const feedback = await insertFeedback(supabase, {
      user_id: authResult.user.userId,
      guide_id: payload.guide_id,
      resource_id: payload.resource_id,
      reaction: payload.reaction as "thumbs_up" | "thumbs_down",
    });

    return NextResponse.json({ feedback });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to save feedback.",
      },
      { status: 500 },
    );
  }
}

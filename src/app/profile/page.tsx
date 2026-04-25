import Link from "next/link";
import { requireAppUser } from "@/app/_lib/auth";
import {
  BOTTLENECK_LABELS,
  BUSINESS_MODEL_LABELS,
  CAPITAL_PREFERENCE_LABELS,
  COLLEGE_LABELS,
  INDUSTRY_LABELS,
  STAGE_LABELS,
  TEAM_STATUS_LABELS,
  TECHNICAL_STATUS_LABELS,
  TIME_COMMITMENT_LABELS,
  UW_STATUS_LABELS,
} from "@/app/_lib/survey";
import ProfileRegenerateButton from "@/components/ProfileRegenerateButton";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSupabaseServerClient } from "@/lib/db/client";
import { getLatestGuideByUserId, getProfileByUserId } from "@/lib/db/queries";
import { loadResources } from "@/lib/resources";

function Field({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </p>
      <p className="text-sm leading-6 text-foreground">{value}</p>
    </div>
  );
}

export default async function ProfilePage() {
  const user = await requireAppUser();
  const supabase = getSupabaseServerClient();
  const [profile, latestGuide] = await Promise.all([
    getProfileByUserId(supabase, user.userId),
    getLatestGuideByUserId(supabase, user.userId),
  ]);

  if (!profile) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <Card>
          <CardHeader>
            <CardTitle>Your profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You haven&apos;t saved a profile yet. Complete the survey to unlock
              personalized recommendations.
            </p>
            <Button asChild>
              <Link href="/survey">Take the survey</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const resourceMap = new Map(
    loadResources().map((resource) => [resource.id, resource.name]),
  );

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
      <div className="mb-8 space-y-3">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">
          Saved profile
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">Your founder profile</h1>
        <p className="max-w-2xl text-base text-muted-foreground">
          Review the answers driving your recommendations, update them, or
          regenerate a fresh guide against the latest resource data.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Profile snapshot</CardTitle>
            <CardDescription>{profile.email}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2">
            <Field label="Stage" value={STAGE_LABELS[profile.stage]} />
            <Field
              label="Industry"
              value={profile.industries.map((item) => INDUSTRY_LABELS[item]).join(", ")}
            />
            <Field
              label="Business model"
              value={BUSINESS_MODEL_LABELS[profile.business_model]}
            />
            <Field label="UW status" value={UW_STATUS_LABELS[profile.uw_status]} />
            <Field label="College" value={COLLEGE_LABELS[profile.college]} />
            <Field
              label="Team"
              value={TEAM_STATUS_LABELS[profile.team_status]}
            />
            <Field
              label="Technical background"
              value={TECHNICAL_STATUS_LABELS[profile.technical_status]}
            />
            <Field
              label="Funding preference"
              value={CAPITAL_PREFERENCE_LABELS[profile.capital_preference]}
            />
            <Field
              label="Primary bottleneck"
              value={BOTTLENECK_LABELS[profile.primary_bottleneck]}
            />
            <Field
              label="Time commitment"
              value={TIME_COMMITMENT_LABELS[profile.time_commitment]}
            />
            <Field
              label="Already engaged"
              value={
                profile.already_engaged_with.length > 0
                  ? profile.already_engaged_with
                      .map((item) => resourceMap.get(item) ?? item)
                      .join(", ")
                  : "None selected"
              }
            />
            <Field
              label="Additional context"
              value={profile.additional_context?.trim() || "None provided"}
            />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Guide actions</CardTitle>
              <CardDescription>
                Regenerate from this profile or jump back into the survey to edit it.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ProfileRegenerateButton />
              <Button asChild variant="outline">
                <Link href="/survey">Update profile</Link>
              </Button>
              {latestGuide ? (
                <Button asChild variant="ghost">
                  <Link href="/results">View latest guide</Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Last generated guide</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {latestGuide
                ? new Date(latestGuide.generated_at).toLocaleString()
                : "No guide generated yet."}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

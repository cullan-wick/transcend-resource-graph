import { requireAppUser } from "@/app/_lib/auth";
import { toSurveyDraft } from "@/app/_lib/survey";
import SurveyForm from "@/components/SurveyForm";
import { Card, CardContent } from "@/components/ui/card";
import { getSupabaseServerClient } from "@/lib/db/client";
import { getProfileByUserId } from "@/lib/db/queries";
import { loadResources } from "@/lib/resources";

export default async function SurveyPage() {
  const user = await requireAppUser();
  const supabase = getSupabaseServerClient();
  const profile = await getProfileByUserId(supabase, user.userId);
  const commonResources = loadResources()
    .filter(
      (resource) =>
        resource.is_high_leverage_pick && resource.affiliation === "uw_madison",
    )
    .slice(0, 10)
    .map((resource) => ({
      id: resource.id,
      name: resource.name,
    }));

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 sm:py-14">
      <div className="mb-8 space-y-3">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">
          Founder survey
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">
          Build your personalized Transcend UW guide
        </h1>
        <p className="max-w-2xl text-base text-muted-foreground">
          We save your progress locally on every answer, so you can step away
          and come back without losing your place.
        </p>
      </div>

      {profile ? (
        <Card className="mb-6 border-primary/20 bg-primary/5">
          <CardContent className="p-5 text-sm text-foreground">
            You already have a saved profile. Updating and re-submitting this
            survey will refresh it and generate a new guide.
          </CardContent>
        </Card>
      ) : null}

      <SurveyForm
        email={user.email}
        initialProfile={toSurveyDraft(profile)}
        commonResources={commonResources}
      />
    </main>
  );
}

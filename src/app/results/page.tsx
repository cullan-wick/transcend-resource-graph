import Link from "next/link";
import { requireAppUser } from "@/app/_lib/auth";
import TieredGuide from "@/components/TieredGuide";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSupabaseServerClient } from "@/lib/db/client";
import { getLatestGuideByUserId } from "@/lib/db/queries";

export default async function ResultsPage() {
  const user = await requireAppUser();
  const supabase = getSupabaseServerClient();
  const storedGuide = await getLatestGuideByUserId(supabase, user.userId);

  if (!storedGuide) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <Card>
          <CardHeader>
            <CardTitle>Your personalized guide</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              No saved guide yet. Complete the survey first and we&apos;ll
              generate one for you.
            </p>
            <Button asChild>
              <Link href="/survey">Start the survey</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const generatedAt = new Date(storedGuide.generated_at).toLocaleString();

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 sm:py-14">
      <div className="mb-8 space-y-3">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">
          Personalized guide
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">
          Your founder resource shortlist
        </h1>
        <p className="text-sm text-muted-foreground">
          Generated on {generatedAt}
        </p>
      </div>

      <TieredGuide
        guide={storedGuide.guide}
        guideId={storedGuide.id}
        email={user.email}
      />
    </main>
  );
}

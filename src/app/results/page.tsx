import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ResultsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Your personalized guide</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Results placeholder. Tiered guide renders here once matching + LLM
            personalization are wired up (PLAN.md §7, §8).
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

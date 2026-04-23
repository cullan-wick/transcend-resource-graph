import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SurveyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Survey</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Survey form placeholder. The full ~10-question flow lands in a
            follow-up step (see PLAN.md §6).
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

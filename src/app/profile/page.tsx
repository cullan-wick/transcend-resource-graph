import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ProfilePage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Your profile</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Profile placeholder. Edit and regenerate-guide controls land here
            (PLAN.md §9.1).
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

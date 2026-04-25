"use client";

import Link from "next/link";
import type { PersonalizedGuide, TierEntry } from "@/types/recommendation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import ResourceCard from "./ResourceCard";

type TieredGuideProps = {
  guide: PersonalizedGuide;
  guideId: string;
  email: string;
};

function TierSection({
  title,
  description,
  entries,
  guideId,
  defaultOpen,
}: {
  title: string;
  description: string;
  entries: TierEntry[];
  guideId: string;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="rounded-2xl border border-border bg-card p-5"
    >
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          <div className="rounded-full bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground">
            {entries.length} resources
          </div>
        </div>
      </summary>
      <div className="mt-5 space-y-4">
        {entries.length > 0 ? (
          entries.map((entry) => (
            <ResourceCard
              key={entry.resource_id}
              entry={entry}
              guideId={guideId}
            />
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            No recommendations landed in this tier for the current run.
          </p>
        )}
      </div>
    </details>
  );
}

export default function TieredGuide({
  guide,
  guideId,
  email,
}: TieredGuideProps) {
  const pageUrl =
    typeof window === "undefined" ? "" : `${window.location.origin}/results`;
  const emailSubject = encodeURIComponent("My Transcend UW founder guide");
  const emailBody = encodeURIComponent(
    `Here is my current Transcend UW founder guide.${pageUrl ? ` ${pageUrl}` : ""}`,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => window.print()}>
          Export as PDF
        </Button>
        <Button asChild variant="outline">
          <a href={`mailto:${email}?subject=${emailSubject}&body=${emailBody}`}>
            Email to myself
          </a>
        </Button>
        <Button asChild variant="outline">
          <a href={`mailto:?subject=${emailSubject}&body=${emailBody}`}>
            Share with co-founder
          </a>
        </Button>
      </div>

      <Card className="border-primary/25 bg-primary/5">
        <CardContent className="p-6">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">
            Your match summary
          </p>
          <p className="mt-3 text-base leading-7">{guide.opening_note}</p>
        </CardContent>
      </Card>

      <TierSection
        title="Tier 1: Start this week"
        description="The highest-priority opportunities based on your current stage and bottleneck."
        entries={guide.tier_1_start_this_week}
        guideId={guideId}
        defaultOpen
      />
      <TierSection
        title="Tier 2: Explore this month"
        description="Strong follow-on options that become more valuable once Tier 1 is underway."
        entries={guide.tier_2_explore_this_month}
        guideId={guideId}
      />
      <TierSection
        title="Tier 3: Bookmark for later"
        description="Useful longer-horizon resources to keep on deck."
        entries={guide.tier_3_bookmark_for_later}
        guideId={guideId}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 py-4">
        <div>
          <p className="font-medium">Want to refine the recommendations?</p>
          <p className="text-sm text-muted-foreground">
            Update your survey answers or regenerate with your current profile.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/survey">Update my profile</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/profile">View profile</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

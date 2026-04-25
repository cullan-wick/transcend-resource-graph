"use client";

import { useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import type { TierEntry } from "@/types/recommendation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ResourceCardProps = {
  entry: TierEntry;
  guideId: string;
};

const AFFILIATION_LABELS = {
  uw_madison: "UW",
  wisconsin_state: "Wisconsin",
  national: "National",
  global: "Global",
} as const;

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

function getAccessHref(entry: TierEntry): string | null {
  const { resource } = entry;
  if (resource.external_url) return resource.external_url;

  const directLink = resource.how_to_access.match(/https?:\/\/\S+/i);
  if (directLink) return directLink[0];

  const email = resource.how_to_access.match(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  );
  if (email) return `mailto:${email[0]}`;

  return null;
}

export default function ResourceCard({ entry, guideId }: ResourceCardProps) {
  const [reaction, setReaction] = useState<"thumbs_up" | "thumbs_down" | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);

  async function sendReaction(nextReaction: "thumbs_up" | "thumbs_down") {
    setSubmitting(true);

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          guide_id: guideId,
          resource_id: entry.resource_id,
          reaction: nextReaction,
        }),
      });

      if (!response.ok) {
        throw new Error("Feedback failed");
      }

      setReaction(nextReaction);
    } catch {
      // Keep the UI quiet on transient feedback errors.
    } finally {
      setSubmitting(false);
    }
  }

  const href = getAccessHref(entry);

  return (
    <Card className="border-border/80">
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <CardTitle className="text-xl">{entry.resource.name}</CardTitle>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-secondary px-3 py-1 font-medium text-secondary-foreground">
                {AFFILIATION_LABELS[entry.resource.affiliation]}
              </span>
              {entry.resource.dollar_value_estimate ? (
                <span className="rounded-full bg-primary/10 px-3 py-1 font-medium text-primary">
                  {formatCurrency(entry.resource.dollar_value_estimate)}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => sendReaction("thumbs_up")}
              className={cn(
                "inline-flex h-10 w-10 items-center justify-center rounded-full border transition",
                reaction === "thumbs_up"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-primary/40 hover:bg-secondary/40",
              )}
              aria-label="Thumbs up"
            >
              <ThumbsUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => sendReaction("thumbs_down")}
              className={cn(
                "inline-flex h-10 w-10 items-center justify-center rounded-full border transition",
                reaction === "thumbs_down"
                  ? "border-destructive bg-destructive/10 text-destructive"
                  : "border-border hover:border-primary/40 hover:bg-secondary/40",
              )}
              aria-label="Thumbs down"
            >
              <ThumbsDown className="h-4 w-4" />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl bg-primary/5 px-4 py-3 text-sm leading-6 text-foreground">
          {entry.reason}
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-2">
            <p className="text-sm font-medium">What you'll get</p>
            <p className="text-sm leading-6 text-muted-foreground">
              {entry.resource.what_you_get || entry.resource.description}
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">How to access</p>
            <p className="text-sm leading-6 text-muted-foreground">
              {entry.resource.how_to_access}
            </p>
            {href ? (
              <Button asChild size="sm" variant="outline">
                <a href={href} target="_blank" rel="noreferrer">
                  Open resource
                </a>
              </Button>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

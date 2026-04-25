"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BOTTLENECK_OPTIONS,
  BUSINESS_MODEL_OPTIONS,
  CAPITAL_PREFERENCE_OPTIONS,
  COLLEGE_OPTIONS,
  type CommonResourceOption,
  getDefaultSurveyDraft,
  INDUSTRY_OPTIONS,
  STAGE_OPTIONS,
  SURVEY_STORAGE_KEY,
  TECHNICAL_STATUS_OPTIONS,
  TEAM_STATUS_OPTIONS,
  type SurveyDraft,
  toSurveyDraft,
  UW_STATUS_OPTIONS,
} from "@/app/_lib/survey";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type SurveyStepKey =
  | "stage"
  | "industries"
  | "business_model"
  | "uw_status"
  | "college"
  | "team_status"
  | "technical_status"
  | "capital_preference"
  | "primary_bottleneck"
  | "already_engaged_with"
  | "additional_context";

type SurveyFormProps = {
  email: string;
  initialProfile?: SurveyDraft | null;
  commonResources: CommonResourceOption[];
};

const SURVEY_STEPS: {
  key: SurveyStepKey;
  title: string;
  description: string;
  required?: boolean;
}[] = [
  {
    key: "stage",
    title: "What stage is your startup?",
    description: "This is one of the strongest filters in the recommendation pipeline.",
    required: true,
  },
  {
    key: "industries",
    title: "What industry or space are you building in?",
    description: "Pick up to two. We use these to keep the shortlist focused.",
    required: true,
  },
  {
    key: "business_model",
    title: "What's your business model?",
    description: "This helps us distinguish between software, hardware, biotech, and more.",
  },
  {
    key: "uw_status",
    title: "Your status at UW?",
    description: "Some programs are restricted by student, grad, or faculty eligibility.",
  },
  {
    key: "college",
    title: "Primary college?",
    description: "We use this only to gate college-specific opportunities.",
  },
  {
    key: "team_status",
    title: "Team situation?",
    description: "Some programs are better for solo founders, while others expect a team.",
  },
  {
    key: "technical_status",
    title: "Technical background?",
    description: "This helps surface co-founder, product, and support resources.",
  },
  {
    key: "capital_preference",
    title: "On funding, what's your preference?",
    description: "We'll bias away from clearly mismatched capital paths.",
  },
  {
    key: "primary_bottleneck",
    title: "Biggest bottleneck right now?",
    description: "This is a required signal and one of the most important ranking inputs.",
    required: true,
  },
  {
    key: "already_engaged_with",
    title: "Already engaged with any of these?",
    description: "Optional. We'll avoid sending you resources you're already using.",
  },
  {
    key: "additional_context",
    title: "Anything else we should know?",
    description: "Optional. Add details like IP, visa constraints, or timing needs.",
  },
];

const LOADING_MESSAGES = [
  "Saving your founder profile...",
  "Filtering the resource catalog...",
  "Scoring the best-fit opportunities...",
  "Writing your personalized guide...",
];

function ChoiceButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-xl border px-4 py-3 text-left text-sm transition",
        active
          ? "border-primary bg-primary/5 text-foreground shadow-sm"
          : "border-border bg-background hover:border-primary/40 hover:bg-secondary/40",
      )}
    >
      {children}
    </button>
  );
}

function MultiSelectHint({
  selectedCount,
  max,
}: {
  selectedCount: number;
  max: number;
}) {
  return (
    <p className="text-xs text-muted-foreground">
      {selectedCount}/{max} selected
    </p>
  );
}

export default function SurveyForm({
  email,
  initialProfile,
  commonResources,
}: SurveyFormProps) {
  const router = useRouter();
  const [draft, setDraft] = useState<SurveyDraft>(getDefaultSurveyDraft());
  const [currentStep, setCurrentStep] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [saveState, setSaveState] = useState<"idle" | "saved">("idle");

  useEffect(() => {
    const fallback = toSurveyDraft(initialProfile);

    try {
      const stored = window.localStorage.getItem(SURVEY_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as {
          draft?: Partial<SurveyDraft>;
          currentStep?: number;
        };
        setDraft(toSurveyDraft({ ...fallback, ...parsed.draft }));
        if (
          typeof parsed.currentStep === "number" &&
          parsed.currentStep >= 0 &&
          parsed.currentStep < SURVEY_STEPS.length
        ) {
          setCurrentStep(parsed.currentStep);
        }
      } else {
        setDraft(fallback);
      }
    } catch {
      setDraft(fallback);
    } finally {
      setHydrated(true);
    }
  }, [initialProfile]);

  useEffect(() => {
    if (!hydrated || submitting) return;

    window.localStorage.setItem(
      SURVEY_STORAGE_KEY,
      JSON.stringify({
        draft,
        currentStep,
      }),
    );
    setSaveState("saved");

    const timeout = window.setTimeout(() => {
      setSaveState("idle");
    }, 1200);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [currentStep, draft, hydrated, submitting]);

  useEffect(() => {
    if (!submitting) return;

    const interval = window.setInterval(() => {
      setLoadingMessageIndex((value) => (value + 1) % LOADING_MESSAGES.length);
    }, 1700);

    return () => {
      window.clearInterval(interval);
    };
  }, [submitting]);

  const step = SURVEY_STEPS[currentStep];
  const progress = Math.round(((currentStep + 1) / SURVEY_STEPS.length) * 100);

  function isStepValid(stepKey: SurveyStepKey): boolean {
    if (stepKey === "stage") return Boolean(draft.stage);
    if (stepKey === "industries") {
      return draft.industries.length > 0 && draft.industries.length <= 2;
    }
    if (stepKey === "primary_bottleneck") return Boolean(draft.primary_bottleneck);
    if (stepKey === "additional_context") {
      return (draft.additional_context ?? "").length <= 500;
    }
    return true;
  }

  function updateDraft<K extends keyof SurveyDraft>(
    key: K,
    value: SurveyDraft[K],
  ) {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function toggleIndustry(value: (typeof INDUSTRY_OPTIONS)[number]["value"]) {
    setDraft((current) => {
      const selected = current.industries;
      const exists = selected.includes(value);

      if (exists) {
        return {
          ...current,
          industries: selected.filter((industry) => industry !== value),
        };
      }

      if (selected.length >= 2) {
        return current;
      }

      return {
        ...current,
        industries: [...selected, value],
      };
    });
  }

  function toggleAlreadyEngaged(resourceId: string) {
    setDraft((current) => {
      const selected = current.already_engaged_with;
      const exists = selected.includes(resourceId);

      return {
        ...current,
        already_engaged_with: exists
          ? selected.filter((id) => id !== resourceId)
          : [...selected, resourceId],
      };
    });
  }

  async function submitSurvey() {
    setSubmitError(null);
    setSubmitting(true);
    setLoadingMessageIndex(0);

    try {
      const response = await fetch("/api/survey/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...draft,
          email,
          additional_context: draft.additional_context?.trim() || undefined,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "We couldn't generate your guide.");
      }

      window.localStorage.setItem(
        SURVEY_STORAGE_KEY,
        JSON.stringify({
          draft,
          currentStep: 0,
        }),
      );

      router.push("/results");
      router.refresh();
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "We couldn't generate your guide.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleNext() {
    if (!isStepValid(step.key)) return;

    if (currentStep === SURVEY_STEPS.length - 1) {
      await submitSurvey();
      return;
    }

    setCurrentStep((value) => Math.min(value + 1, SURVEY_STEPS.length - 1));
  }

  function renderCurrentStep() {
    if (step.key === "stage") {
      return (
        <div className="grid gap-3">
          {STAGE_OPTIONS.map((option) => (
            <ChoiceButton
              key={option.value}
              active={draft.stage === option.value}
              onClick={() => updateDraft("stage", option.value)}
            >
              {option.label}
            </ChoiceButton>
          ))}
        </div>
      );
    }

    if (step.key === "industries") {
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Pick up to two industries.
            </p>
            <MultiSelectHint selectedCount={draft.industries.length} max={2} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {INDUSTRY_OPTIONS.map((option) => (
              <ChoiceButton
                key={option.value}
                active={draft.industries.includes(option.value)}
                onClick={() => toggleIndustry(option.value)}
              >
                {option.label}
              </ChoiceButton>
            ))}
          </div>
          {draft.industries.length >= 2 ? (
            <p className="text-xs text-muted-foreground">
              Remove one selection to choose a different industry.
            </p>
          ) : null}
        </div>
      );
    }

    if (step.key === "business_model") {
      return (
        <div className="grid gap-3">
          {BUSINESS_MODEL_OPTIONS.map((option) => (
            <ChoiceButton
              key={option.value}
              active={draft.business_model === option.value}
              onClick={() => updateDraft("business_model", option.value)}
            >
              {option.label}
            </ChoiceButton>
          ))}
        </div>
      );
    }

    if (step.key === "uw_status") {
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {UW_STATUS_OPTIONS.map((option) => (
            <ChoiceButton
              key={option.value}
              active={draft.uw_status === option.value}
              onClick={() => updateDraft("uw_status", option.value)}
            >
              {option.label}
            </ChoiceButton>
          ))}
        </div>
      );
    }

    if (step.key === "college") {
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {COLLEGE_OPTIONS.map((option) => (
            <ChoiceButton
              key={option.value}
              active={draft.college === option.value}
              onClick={() => updateDraft("college", option.value)}
            >
              {option.label}
            </ChoiceButton>
          ))}
        </div>
      );
    }

    if (step.key === "team_status") {
      return (
        <div className="grid gap-3">
          {TEAM_STATUS_OPTIONS.map((option) => (
            <ChoiceButton
              key={option.value}
              active={draft.team_status === option.value}
              onClick={() => updateDraft("team_status", option.value)}
            >
              {option.label}
            </ChoiceButton>
          ))}
        </div>
      );
    }

    if (step.key === "technical_status") {
      return (
        <div className="grid gap-3">
          {TECHNICAL_STATUS_OPTIONS.map((option) => (
            <ChoiceButton
              key={option.value}
              active={draft.technical_status === option.value}
              onClick={() => updateDraft("technical_status", option.value)}
            >
              {option.label}
            </ChoiceButton>
          ))}
        </div>
      );
    }

    if (step.key === "capital_preference") {
      return (
        <div className="grid gap-3">
          {CAPITAL_PREFERENCE_OPTIONS.map((option) => (
            <ChoiceButton
              key={option.value}
              active={draft.capital_preference === option.value}
              onClick={() => updateDraft("capital_preference", option.value)}
            >
              {option.label}
            </ChoiceButton>
          ))}
        </div>
      );
    }

    if (step.key === "primary_bottleneck") {
      return (
        <div className="grid gap-3">
          {BOTTLENECK_OPTIONS.map((option) => (
            <ChoiceButton
              key={option.value}
              active={draft.primary_bottleneck === option.value}
              onClick={() => updateDraft("primary_bottleneck", option.value)}
            >
              {option.label}
            </ChoiceButton>
          ))}
        </div>
      );
    }

    if (step.key === "already_engaged_with") {
      return (
        <div className="space-y-3">
          {commonResources.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {commonResources.map((resource) => (
                <ChoiceButton
                  key={resource.id}
                  active={draft.already_engaged_with.includes(resource.id)}
                  onClick={() => toggleAlreadyEngaged(resource.id)}
                >
                  {resource.name}
                </ChoiceButton>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
              High-leverage UW resources haven't been loaded into
              <code className="mx-1">data/resources.json</code> yet, so this
              question is temporarily empty.
            </div>
          )}
          <button
            type="button"
            className="text-sm text-muted-foreground underline underline-offset-4"
            onClick={() => updateDraft("already_engaged_with", [])}
          >
            None of these yet
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <textarea
          value={draft.additional_context ?? ""}
          onChange={(event) =>
            updateDraft("additional_context", event.target.value.slice(0, 500))
          }
          rows={6}
          placeholder="I have IP from a research lab, need summer-only programs, am navigating visa constraints..."
          className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Optional context for the personalization step.</span>
          <span>{(draft.additional_context ?? "").length}/500</span>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <Card className="hidden h-fit lg:block">
        <CardHeader>
          <CardTitle className="text-xl">Survey progress</CardTitle>
          <CardDescription>
            Your answers save locally on every step.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {SURVEY_STEPS.map((item, index) => (
            <div
              key={item.key}
              className={cn(
                "rounded-lg px-3 py-2 text-sm",
                index === currentStep
                  ? "bg-primary/10 font-medium text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {index + 1}. {item.title}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              <span>
                Question {currentStep + 1} of {SURVEY_STEPS.length}
              </span>
              <span>{progress}% complete</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>{step.title}</CardTitle>
              <CardDescription className="mt-2">
                {step.description}
              </CardDescription>
            </div>
            <div className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
              {saveState === "saved" ? "Saved locally" : "Draft auto-saves"}
            </div>
          </div>
          {step.required ? (
            <div className="inline-flex w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              Required
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-6">
          {!hydrated ? (
            <p className="text-sm text-muted-foreground">
              Loading your saved survey draft...
            </p>
          ) : submitting ? (
            <div className="space-y-4 rounded-2xl border border-primary/20 bg-primary/5 px-5 py-8">
              <p className="text-lg font-semibold">Generating your personalized guide...</p>
              <p className="text-sm text-muted-foreground">
                {LOADING_MESSAGES[loadingMessageIndex]}
              </p>
            </div>
          ) : (
            renderCurrentStep()
          )}

          {submitError ? (
            <p className="text-sm text-destructive">{submitError}</p>
          ) : null}

          {!submitting ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep((value) => Math.max(value - 1, 0))}
                  disabled={currentStep === 0}
                >
                  Back
                </Button>
                {!step.required ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      setCurrentStep((value) =>
                        Math.min(value + 1, SURVEY_STEPS.length - 1),
                      )
                    }
                    disabled={currentStep === SURVEY_STEPS.length - 1}
                  >
                    Skip
                  </Button>
                ) : null}
              </div>

              <Button type="button" onClick={handleNext} disabled={!isStepValid(step.key)}>
                {currentStep === SURVEY_STEPS.length - 1
                  ? "Generate guide"
                  : "Continue"}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

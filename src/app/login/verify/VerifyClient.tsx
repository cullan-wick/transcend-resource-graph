"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useClerk } from "@clerk/nextjs";

export default function VerifyClient() {
  const clerk = useClerk();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      try {
        await clerk.handleEmailLinkVerification(
          {
            redirectUrlComplete:
              searchParams.get("redirect_url_complete") ?? "/survey",
            redirectUrl: "/login",
            onVerifiedOnOtherDevice: () => {
              if (!cancelled) {
                router.replace("/login");
              }
            },
          },
          async (to) => {
            if (!cancelled) {
              router.replace(String(to));
            }
          },
        );
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "We couldn't verify your magic link.",
          );
        }
      }
    }

    verify();

    return () => {
      cancelled = true;
    };
  }, [clerk, router, searchParams]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Finishing sign in</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        We&apos;re verifying your magic link and will send you to the survey as
        soon as Clerk finishes the session.
      </p>
      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
    </main>
  );
}

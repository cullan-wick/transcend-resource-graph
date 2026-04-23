"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSignIn, useSignUp } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isWiscEmail } from "@/lib/utils";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded: signInLoaded, signIn, setActive: setSignInActive } = useSignIn();
  const { isLoaded: signUpLoaded, signUp } = useSignUp();

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingMode, setPendingMode] = useState<"signIn" | "signUp" | null>(
    null,
  );

  const clerkConfigured = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  );
  const loaded = clerkConfigured && signInLoaded && signUpLoaded;
  const verifyUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const url = new URL("/login/verify", window.location.origin);
    url.searchParams.set("redirect_url_complete", "/survey");
    return url.toString();
  }, []);

  useEffect(() => {
    if (searchParams.get("error") === "wisc_only") {
      setError("This app is restricted to @wisc.edu accounts. Please sign in with a UW email.");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!clerkConfigured) {
      setError(
        "Clerk is not configured yet. Add your Clerk keys in .env.local to test login.",
      );
    }
  }, [clerkConfigured]);

  async function startSignInFlow(address: string) {
    if (!signIn || !setSignInActive) {
      throw new Error("Clerk sign-in is not ready yet.");
    }

    const attempt = await signIn.create({
      strategy: "email_link",
      identifier: address,
    });
    const factor = attempt.supportedFirstFactors?.find(
      (item) => item.strategy === "email_link",
    );

    if (!factor || !("emailAddressId" in factor)) {
      throw new Error("Email link sign-in is not enabled in Clerk.");
    }

    const { startEmailLinkFlow } = signIn.createEmailLinkFlow();
    const result = await startEmailLinkFlow({
      emailAddressId: factor.emailAddressId,
      redirectUrl: verifyUrl,
    });

    if (result.status === "complete" && result.createdSessionId) {
      await setSignInActive({ session: result.createdSessionId });
      router.push("/survey");
    }
  }

  async function startSignUpFlow(address: string) {
    if (!signUp) {
      throw new Error("Clerk sign-up is not ready yet.");
    }

    await signUp.create({
      emailAddress: address,
    });
    const { startEmailLinkFlow } = signUp.createEmailLinkFlow();
    await startEmailLinkFlow({
      redirectUrl: verifyUrl,
    });
  }

  async function handleSendLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPendingMode(null);
    setSentTo(null);

    if (!isWiscEmail(email)) {
      setError("Please use your @wisc.edu email.");
      return;
    }
    if (!loaded || !signIn || !signUp) return;

    setSubmitting(true);
    try {
      try {
        await startSignInFlow(email);
        setPendingMode("signIn");
      } catch {
        await startSignUpFlow(email);
        setPendingMode("signUp");
      }
      setSentTo(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send magic link.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSendLink} className="mt-6 space-y-4">
      <Input
        type="email"
        placeholder="yournetid@wisc.edu"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        required
      />
      {sentTo ? (
        <p className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          Check <strong>{sentTo}</strong> for a Clerk magic link. Once it’s
          opened, we&apos;ll finish {pendingMode === "signUp" ? "creating" : "signing into"} your
          account and send you to the survey.
        </p>
      ) : null}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button
        type="submit"
        disabled={submitting || !loaded}
        className="w-full"
      >
        {submitting ? "Sending..." : "Send magic link"}
      </Button>
    </form>
  );
}

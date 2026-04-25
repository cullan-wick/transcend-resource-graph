"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSignIn, useSignUp, useUser, useClerk } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isWiscEmail } from "@/lib/utils";

type Step = "email" | "code";
type Mode = "signIn" | "signUp";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded: signInLoaded, signIn, setActive: setSignInActive } = useSignIn();
  const { isLoaded: signUpLoaded, signUp, setActive: setSignUpActive } = useSignUp();
  const { isSignedIn, user } = useUser();
  const { signOut } = useClerk();

  const [step, setStep] = useState<Step>("email");
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const clerkConfigured = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  );
  const loaded = clerkConfigured && signInLoaded && signUpLoaded;

  useEffect(() => {
    if (searchParams.get("error") === "wisc_only") {
      setError(
        "This app is restricted to @wisc.edu accounts. Please sign in with a UW email.",
      );
    }
  }, [searchParams]);

  useEffect(() => {
    if (!clerkConfigured) {
      setError(
        "Clerk is not configured yet. Add your Clerk keys in .env.local to test login.",
      );
    }
  }, [clerkConfigured]);

  async function startSignIn(address: string) {
    if (!signIn) throw new Error("Clerk sign-in is not ready yet.");

    const attempt = await signIn.create({ identifier: address });
    const factor = attempt.supportedFirstFactors?.find(
      (item) => item.strategy === "email_code",
    );
    if (!factor || !("emailAddressId" in factor)) {
      throw new Error("Email code sign-in is not enabled in Clerk.");
    }
    await signIn.prepareFirstFactor({
      strategy: "email_code",
      emailAddressId: factor.emailAddressId,
    });
  }

  async function startSignUp(address: string) {
    if (!signUp) throw new Error("Clerk sign-up is not ready yet.");

    await signUp.create({ emailAddress: address });
    await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isWiscEmail(email)) {
      setError("Please use your @wisc.edu email.");
      return;
    }
    if (!loaded) return;

    setSubmitting(true);
    try {
      try {
        await startSignIn(email);
        setMode("signIn");
      } catch {
        await startSignUp(email);
        setMode("signUp");
      }
      setStep("code");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not send verification code.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!loaded) return;

    setSubmitting(true);
    try {
      if (mode === "signIn") {
        if (!signIn || !setSignInActive) throw new Error("Clerk not ready.");
        const result = await signIn.attemptFirstFactor({
          strategy: "email_code",
          code,
        });
        if (result.status === "complete" && result.createdSessionId) {
          await setSignInActive({ session: result.createdSessionId });
          router.push("/survey");
        } else {
          console.error("Sign-in incomplete:", result);
          setError(`Sign-in incomplete (status: ${result.status}).`);
        }
      } else {
        if (!signUp || !setSignUpActive) throw new Error("Clerk not ready.");
        const result = await signUp.attemptEmailAddressVerification({ code });
        if (result.status === "complete" && result.createdSessionId) {
          await setSignUpActive({ session: result.createdSessionId });
          router.push("/survey");
        } else {
          console.error("Sign-up incomplete:", result);
          const missing = [
            ...(result.missingFields ?? []),
            ...(result.unverifiedFields ?? []),
          ];
          setError(
            missing.length > 0
              ? `Sign-up incomplete. Clerk requires: ${missing.join(", ")}. Disable these in the Clerk dashboard.`
              : `Sign-up incomplete (status: ${result.status}).`,
          );
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "That code didn't work. Try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function resetToEmail() {
    setStep("email");
    setCode("");
    setError(null);
  }

  if (isSignedIn) {
    const currentEmail = user?.primaryEmailAddress?.emailAddress ?? "your account";
    return (
      <div className="mt-6 space-y-4">
        <p className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          You&apos;re already signed in as <strong>{currentEmail}</strong>.
        </p>
        <Button onClick={() => router.push("/survey")} className="w-full">
          Continue to survey
        </Button>
        <button
          type="button"
          onClick={async () => {
            await signOut();
            router.refresh();
          }}
          className="text-sm text-muted-foreground underline"
        >
          Sign out and use a different email
        </button>
      </div>
    );
  }

  if (step === "code") {
    return (
      <form onSubmit={handleVerifyCode} className="mt-6 space-y-4">
        <p className="text-sm text-muted-foreground">
          We sent a 6-digit code to <strong>{email}</strong>. Enter it below to
          finish signing in.
        </p>
        <Input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          autoComplete="one-time-code"
          maxLength={6}
          required
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={submitting || !loaded} className="w-full">
          {submitting ? "Verifying..." : "Verify code"}
        </Button>
        <button
          type="button"
          onClick={resetToEmail}
          className="text-sm text-muted-foreground underline"
        >
          Use a different email
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSendCode} className="mt-6 space-y-4">
      <Input
        type="email"
        placeholder="yournetid@wisc.edu"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        required
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={submitting || !loaded} className="w-full">
        {submitting ? "Sending..." : "Send verification code"}
      </Button>
    </form>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSignIn, useSignUp } from "@clerk/nextjs";
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
          setError("Verification incomplete. Please try again.");
        }
      } else {
        if (!signUp || !setSignUpActive) throw new Error("Clerk not ready.");
        const result = await signUp.attemptEmailAddressVerification({ code });
        if (result.status === "complete" && result.createdSessionId) {
          await setSignUpActive({ session: result.createdSessionId });
          router.push("/survey");
        } else {
          setError("Verification incomplete. Please try again.");
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

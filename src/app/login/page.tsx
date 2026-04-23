import { Suspense } from "react";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Sign in</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Use your <code>@wisc.edu</code> email. We&apos;ll send a one-time magic
        link.
      </p>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}

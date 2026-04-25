import { Suspense } from "react";
import VerifyClient from "./VerifyClient";

export default function LoginVerifyPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
          <h1 className="text-3xl font-bold tracking-tight">Finishing sign in</h1>
        </main>
      }
    >
      <VerifyClient />
    </Suspense>
  );
}

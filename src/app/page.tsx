import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <p className="mb-3 text-sm font-medium uppercase tracking-widest text-primary">
        Transcend UW
      </p>
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        Find the 10 founder resources that actually fit you.
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">
        UW–Madison has hundreds of funding, mentorship, and accelerator
        programs. Take a five-minute survey and get a personalized, tiered
        shortlist — with one sentence per resource explaining the match.
      </p>
      <div className="mt-8 flex gap-3">
        <Button asChild size="lg">
          <Link href="/login">Get started</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/login">I already have an account</Link>
        </Button>
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        Open to current UW–Madison students, recent grads, faculty, and staff
        with a <code>@wisc.edu</code> email.
      </p>
    </main>
  );
}

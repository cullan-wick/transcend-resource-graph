import { clerkClient, clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isWiscEmail } from "@/lib/utils";

const isPublicRoute = createRouteMatcher([
  "/",
  "/login(.*)",
  "/api/webhooks(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;

  const { userId, sessionClaims, redirectToSignIn } = await auth();

  if (!userId) {
    return redirectToSignIn({ returnBackUrl: req.url });
  }

  let email =
    (sessionClaims?.email as string | undefined) ??
    (sessionClaims?.primary_email as string | undefined) ??
    ((sessionClaims as Record<string, unknown> | undefined)?.[
      "email_address"
    ] as string | undefined);

  if (!email) {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    email = user.primaryEmailAddress?.emailAddress;
  }

  if (!isWiscEmail(email)) {
    const url = new URL("/login", req.url);
    url.searchParams.set("error", "wisc_only");
    return NextResponse.redirect(url);
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};

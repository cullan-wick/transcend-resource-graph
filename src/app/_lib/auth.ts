import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { isWiscEmail } from "@/lib/utils";

export type AppUser = {
  userId: string;
  email: string;
};

type RouteAuthResult =
  | { ok: true; user: AppUser }
  | { ok: false; reason: "unauthorized" | "wisc_only" };

export function getSessionEmail(
  sessionClaims: Record<string, unknown> | null | undefined,
): string | null {
  const email =
    (sessionClaims?.email as string | undefined) ??
    (sessionClaims?.primary_email as string | undefined) ??
    (sessionClaims?.email_address as string | undefined);

  return email ?? null;
}

export async function getRouteAppUser(): Promise<RouteAuthResult> {
  const { userId, sessionClaims } = await auth();
  if (!userId) {
    return { ok: false, reason: "unauthorized" };
  }

  let email = getSessionEmail(
    (sessionClaims as Record<string, unknown> | undefined) ?? null,
  );

  if (!email) {
    try {
      const client = await clerkClient();
      const user = await client.users.getUser(userId);
      email = user.primaryEmailAddress?.emailAddress ?? null;
    } catch (err) {
      console.error("[auth] clerkClient lookup failed", err);
    }
  }

  return {
    ok: true,
    user: {
      userId,
      email: email ?? "",
    },
  };
}

export async function requireAppUser(): Promise<AppUser> {
  const result = await getRouteAppUser();

  if (result.ok) {
    return result.user;
  }

  if (result.reason === "wisc_only") {
    redirect("/login?error=wisc_only");
  }

  redirect("/login");
}

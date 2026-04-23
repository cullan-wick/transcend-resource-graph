import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const WISC_EMAIL_DOMAIN = "@wisc.edu";

export function isWiscEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase().trim().endsWith(WISC_EMAIL_DOMAIN);
}

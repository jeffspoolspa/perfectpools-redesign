// Resume-token cookie helpers. HttpOnly + Secure + SameSite=Lax — never readable
// from JS, always sent on same-site requests, never on cross-site POSTs.

import type { AstroCookies } from "astro";
import { RESUME_TOKEN_TTL_DAYS } from "../constants";

export const RESUME_COOKIE_NAME = "pp_lead_resume_token";

export function setResumeCookie(cookies: AstroCookies, token: string): void {
  cookies.set(RESUME_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: RESUME_TOKEN_TTL_DAYS * 24 * 60 * 60,
  });
}

export function getResumeToken(cookies: AstroCookies): string | undefined {
  return cookies.get(RESUME_COOKIE_NAME)?.value;
}

export function clearResumeCookie(cookies: AstroCookies): void {
  cookies.delete(RESUME_COOKIE_NAME, { path: "/" });
}

import { randomBytes } from "crypto";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

const slackOAuthStateCookie = "slack_oauth_state";
const slackOAuthUserCookie = "slack_oauth_user";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", process.env.NEXTAUTH_URL ?? "http://localhost:3000"));
  }

  const clientId = process.env.SLACK_CLIENT_ID?.trim();
  const redirectUri = process.env.SLACK_REDIRECT_URI?.trim();

  if (!clientId || !redirectUri) {
    return NextResponse.redirect(new URL("/settings/notifcation?slack=missing_config", process.env.NEXTAUTH_URL ?? "http://localhost:3000"));
  }

  const state = randomBytes(32).toString("hex");
  const cookieStore = await cookies();

  cookieStore.set(slackOAuthStateCookie, state, {
    httpOnly: true,
    maxAge: 60 * 10,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  cookieStore.set(slackOAuthUserCookie, session.user.id, {
    httpOnly: true,
    maxAge: 60 * 10,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  const authorizeUrl = new URL("https://slack.com/oauth/v2/authorize");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("scope", "incoming-webhook");
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("state", state);

  return NextResponse.redirect(authorizeUrl);
}

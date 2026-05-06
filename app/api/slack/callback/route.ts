import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const slackOAuthStateCookie = "slack_oauth_state";
const slackOAuthUserCookie = "slack_oauth_user";

type SlackOAuthAccessResponse =
  | {
      ok: true;
      access_token?: string;
      authed_user?: {
        id?: string;
      };
      incoming_webhook?: {
        channel?: string;
        channel_id?: string;
        configuration_url?: string;
        url?: string;
      };
      team?: {
        id?: string;
        name?: string;
      };
    }
  | {
      ok: false;
      error?: string;
    };

export async function GET(request: NextRequest) {
  const settingsUrl = new URL("/settings/notifcation", request.url);
  const error = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (error) {
    settingsUrl.searchParams.set("slack", "denied");
    return NextResponse.redirect(settingsUrl);
  }

  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get(slackOAuthStateCookie)?.value;
  const savedUserId = cookieStore.get(slackOAuthUserCookie)?.value;

  if (!code || !state || !savedState || state !== savedState || savedUserId !== session.user.id) {
    settingsUrl.searchParams.set("slack", "invalid_state");
    return clearSlackOAuthCookies(NextResponse.redirect(settingsUrl));
  }

  const clientId = process.env.SLACK_CLIENT_ID?.trim();
  const clientSecret = process.env.SLACK_CLIENT_SECRET?.trim();
  const redirectUri = process.env.SLACK_REDIRECT_URI?.trim();

  if (!clientId || !clientSecret || !redirectUri) {
    settingsUrl.searchParams.set("slack", "missing_config");
    return clearSlackOAuthCookies(NextResponse.redirect(settingsUrl));
  }

  const response = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
    cache: "no-store",
  });
  const payload = (await response.json()) as SlackOAuthAccessResponse;

  if (!payload.ok) {
    settingsUrl.searchParams.set("slack", payload.error ?? "oauth_failed");
    return clearSlackOAuthCookies(NextResponse.redirect(settingsUrl));
  }

  const webhookUrl = payload.incoming_webhook?.url?.trim();

  if (!webhookUrl) {
    settingsUrl.searchParams.set("slack", "missing_webhook");
    return clearSlackOAuthCookies(NextResponse.redirect(settingsUrl));
  }

  await prisma.user.update({
    where: {
      id: session.user.id,
    },
    data: {
      slackAuthedUserId: payload.authed_user?.id ?? null,
      slackChannelId: payload.incoming_webhook?.channel_id ?? null,
      slackChannelName: payload.incoming_webhook?.channel ?? null,
      slackConfigurationUrl: payload.incoming_webhook?.configuration_url ?? null,
      slackTeamId: payload.team?.id ?? null,
      slackTeamName: payload.team?.name ?? null,
      slackWebhookUrl: webhookUrl,
    },
  });

  settingsUrl.searchParams.set("slack", "connected");
  return clearSlackOAuthCookies(NextResponse.redirect(settingsUrl));
}

function clearSlackOAuthCookies(response: NextResponse) {
  response.cookies.set(slackOAuthStateCookie, "", {
    maxAge: 0,
    path: "/",
  });
  response.cookies.set(slackOAuthUserCookie, "", {
    maxAge: 0,
    path: "/",
  });

  return response;
}

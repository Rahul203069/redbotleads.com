import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { lookup as dnsLookup } from "node:dns";
import type { LookupFunction } from "node:net";

import { normalizeEmail } from "@/lib/auth-input";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

const googleOauthDnsFallbackHost =
  process.env.NODE_ENV === "development" ? process.env.GOOGLE_OAUTH_DNS_FALLBACK_HOST?.trim() : undefined;
const googleOauthDnsFallbackTargets = new Set(["accounts.google.com", "oauth2.googleapis.com"]);

const googleOauthLookup: LookupFunction = (hostname, options, callback) => {
  const lookupHostname =
    googleOauthDnsFallbackHost && googleOauthDnsFallbackTargets.has(hostname)
      ? googleOauthDnsFallbackHost
      : hostname;

  dnsLookup(lookupHostname, options, callback);
};

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "Email and password",
      credentials: {
        email: {
          label: "Email",
          type: "email",
        },
        password: {
          label: "Password",
          type: "password",
        },
      },
      authorize: async (credentials) => {
        const email = normalizeEmail(credentials?.email);
        const password = typeof credentials?.password === "string" ? credentials.password : "";

        if (!email || !password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: {
            email,
          },
          include: {
            password: true,
          },
        });

        if (!user?.password?.hash) {
          return null;
        }

        const passwordIsValid = await verifyPassword(password, user.password.hash);

        if (!passwordIsValid) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          plan: user.plan,
          emailAlertsEnabled: user.emailAlertsEnabled,
          slackWebhookUrl: user.slackWebhookUrl,
        };
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      ...(googleOauthDnsFallbackHost
        ? {
            httpOptions: {
              lookup: googleOauthLookup,
            },
          }
        : {}),
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id;
        token.plan = user.plan;
        token.emailAlertsEnabled = user.emailAlertsEnabled;
        token.slackWebhookUrl = user.slackWebhookUrl;
      }

      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.id ?? "";
        session.user.plan = token.plan ?? "free";
        session.user.emailAlertsEnabled = token.emailAlertsEnabled ?? true;
        session.user.slackWebhookUrl = token.slackWebhookUrl ?? null;
      }

      return session;
    },
  },
  events: {
    signIn: async ({ user }) => {
      const normalizedEmail = normalizeEmail(user.email);

      if (!normalizedEmail || !user.id) {
        return;
      }

      await prisma.campaignClientAccess.updateMany({
        where: {
          normalizedEmail,
          OR: [
            {
              userId: null,
            },
            {
              userId: {
                not: user.id,
              },
            },
          ],
        },
        data: {
          userId: user.id,
        },
      });
    },
  },
};

export default NextAuth(authOptions);

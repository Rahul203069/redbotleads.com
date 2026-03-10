import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";

import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
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
};

export default NextAuth(authOptions);

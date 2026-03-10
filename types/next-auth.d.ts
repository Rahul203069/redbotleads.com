import { DefaultSession } from "next-auth";
import { DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface User {
    plan: string;
    emailAlertsEnabled: boolean;
    slackWebhookUrl: string | null;
  }

  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      plan: string;
      emailAlertsEnabled: boolean;
      slackWebhookUrl: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id?: string;
    plan?: string;
    emailAlertsEnabled?: boolean;
    slackWebhookUrl?: string | null;
  }
}

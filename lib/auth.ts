import { getServerSession } from "next-auth";

import { authOptions } from "@/auth";

export function auth() {
  return getServerSession(authOptions);
}

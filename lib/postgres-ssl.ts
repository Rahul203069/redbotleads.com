import { isIP } from "node:net";
import tls from "node:tls";

type PgConnectionConfig = {
  connectionString: string;
  ssl?: unknown;
};

export function withPostgresSslIdentity<TConfig extends PgConnectionConfig>(config: TConfig): TConfig {
  const url = new URL(config.connectionString);
  const sslMode = url.searchParams.get("sslmode");
  const host = url.hostname;

  if (sslMode !== "verify-full" || !isIP(host)) {
    return config;
  }

  url.searchParams.delete("sslmode");

  return {
    ...config,
    connectionString: url.toString(),
    ssl: {
      rejectUnauthorized: true,
      checkServerIdentity: (_hostname: string, cert: tls.PeerCertificate) =>
        tls.checkServerIdentity(host, cert),
    },
  };
}

import pino from "pino";

export const workerLogger = pino({
  name: "worker",
  level: process.env.LOG_LEVEL ?? "info",
});

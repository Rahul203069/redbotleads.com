import "dotenv/config";

import { redditRssMaxRetries, redditRssRequestIntervalMs, redditRssRetryBackoffMs } from "./config";
import { workerLogger } from "./logger";

import "./classification";
import "./embedding";
import "./ingestion";
import "./notifications";
import "./rss-polling";
import "./semantic";

workerLogger.info(
  {
    redditRssRequestIntervalMs,
    redditRssMaxRetries,
    redditRssRetryBackoffMs,
  },
  "All worker processes started in single-process dev mode",
);

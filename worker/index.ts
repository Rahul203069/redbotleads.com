import "dotenv/config";

import {
  redditRssMaxRetries,
  redditRssRequestIntervalMs,
  redditRssRequestJitterMs,
  redditRssRetryBackoffMs,
} from "./config";
import { workerLogger } from "./logger";
import "./rss-poll-refiller";
import "./classification";
import "./daily-semantic";
import "./embedding";
import "./ingestion";
import "./notifications";
import "./rss-polling";
import "./semantic";
import "./semantic-playground";

workerLogger.info(
  {
    redditRssRequestIntervalMs,
    redditRssRequestJitterMs,
    redditRssMaxRetries,
    redditRssRetryBackoffMs,
  },
  "All worker processes started in single-process dev mode",
);

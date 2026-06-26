import "dotenv/config";

import {
  redditRssMaxRetries,
  redditRssRequestIntervalMs,
  redditRssRequestJitterMs,
  redditRssRetryBackoffMs,
} from "./config";
import { workerLogger } from "./logger";

import "./classification";
import "./daily-semantic";
import "./embedding";
import "./ingestion";
import "./notifications";
import "./rss-polling";
import "./semantic";
import "./subreddit-daily-scheduler";

workerLogger.info(
  {
    redditRssRequestIntervalMs,
    redditRssRequestJitterMs,
    redditRssMaxRetries,
    redditRssRetryBackoffMs,
  },
  "All worker processes started in single-process dev mode",
);

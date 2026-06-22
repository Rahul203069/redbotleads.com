import "dotenv/config";

import { workerLogger } from "./logger";

import "./classification";
import "./embedding";
import "./ingestion";
import "./notifications";
import "./rss-polling";
import "./semantic";

workerLogger.info("All worker processes started in single-process dev mode");

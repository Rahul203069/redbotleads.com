import { workerLogger } from "./logger";

import "./classification";
import "./ingestion";
import "./notifications";

workerLogger.info("All worker processes started in single-process dev mode");

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { config } from "../config.js";
import { AuthStateRepository } from "../db/authStateRepository.js";
import { openDatabase } from "../db/connection.js";
import { logger } from "../logger.js";
import { authenticate } from "../peloton/auth.js";
import { PelotonClient } from "../peloton/client.js";
import { queryFavorites } from "./queryFavorites.js";
import { rankFavorites } from "./rankFavorites.js";
import { renderReport } from "./renderReport.js";

const PORT = 4173;

// One long-lived connection for auth/token persistence across requests. authenticate()
// reuses the cached token and only hits the network when it needs refreshing.
const db = openDatabase();
const authStateRepository = new AuthStateRepository(db);

async function getClient(): Promise<PelotonClient> {
  const auth = await authenticate(config.PELOTON_USERNAME, config.PELOTON_PASSWORD, authStateRepository.get());
  authStateRepository.save(auth);
  return new PelotonClient(auth);
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(payload);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) reject(new Error("Request body too large"));
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  try {
    const url = req.url ?? "/";

    if (req.method === "GET" && (url === "/" || url.startsWith("/?"))) {
      const buckets = rankFavorites(queryFavorites());
      const html = renderReport(buckets, new Date());
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    if (req.method === "GET" && url === "/api/stack") {
      const client = await getClient();
      const stack = await client.getStack();
      sendJson(res, 200, stack);
      return;
    }

    if (req.method === "POST" && url === "/api/stack") {
      const body = await readBody(req);
      const { joinToken } = JSON.parse(body || "{}") as { joinToken?: string };
      if (!joinToken) {
        sendJson(res, 400, { error: "joinToken is required" });
        return;
      }
      const client = await getClient();
      const stack = await client.addToStack(joinToken);
      logger.info({ numClasses: stack.numClasses }, "Added class to stack");
      sendJson(res, 200, stack);
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    // Loud failure: log with context and surface the message to the client.
    logger.error({ err: error, method: req.method, url: req.url }, "Report server request failed");
    sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(PORT, () => {
  logger.info(`Report server running — open http://localhost:${PORT}`);
});

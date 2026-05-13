import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 4000);
const demoPath = path.join(root, "phase2-ui", "public", "data", "erp-all-parse-result.json");

function sendJson(response, status, data) {
  const body = JSON.stringify(data);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  response.end(body);
}

function route(request, response) {
  const url = new URL(request.url || "/", `http://${request.headers.host || `localhost:${port}`}`);

  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    response.end();
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/health") {
    sendJson(response, 200, {
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/parse-demo") {
    try {
      const demo = JSON.parse(fs.readFileSync(demoPath, "utf8"));
      sendJson(response, 200, {
        source: "api-demo",
        generatedAt: new Date().toISOString(),
        ...demo,
      });
    } catch (error) {
      sendJson(response, 500, {
        error: "parse-demo failed",
        message: error.message,
      });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/parse-upload") {
    sendJson(response, 501, {
      message: "POST /api/parse-upload is not implemented yet",
    });
    return;
  }

  sendJson(response, 404, { error: "Not found" });
}

const server = http.createServer(route);

server.listen(port, () => {
  console.log(`Node API server running at http://localhost:${port}`);
});

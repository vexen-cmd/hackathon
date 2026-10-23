const express = require("express");
const path = require("node:path");
const fs = require("node:fs");
const { spawn } = require("node:child_process");

const app = express();
const PORT = Number(process.env.PORT || 8000);
const PYTHON_PORT = Number(process.env.PYTHON_PORT || 8001);
const root = path.resolve(__dirname, "..");
const frontend = path.join(root, "frontend");
const frontendDist = path.join(frontend, "dist");
const python = path.join(root, ".venv", "Scripts", "python.exe");

app.use(express.json({ limit: "1mb" }));
app.use(express.static(frontendDist, { etag: false, cacheControl: false }));
app.use(express.static(frontend, { etag: false, cacheControl: false }));

// The deterministic workflow remains in the existing Python harness. Express
// owns the browser-facing server and forwards only the API requests to it.
const worker = spawn(python, ["-m", "uvicorn", "apps.api.main:app", "--host", "127.0.0.1", "--port", String(PYTHON_PORT)], {
  cwd: root,
  env: { ...process.env, PYTHONPATH: root },
  stdio: "inherit",
});

async function proxy(req, res) {
  try {
    if (req.body && typeof req.body === "object" && !req.body.source_id && req.originalUrl.includes("/analyze")) {
      req.body.source_id = "snippet-" + Date.now();
    }
    const hasBody = !["GET", "HEAD"].includes(req.method) && req.body && Object.keys(req.body).length > 0;
    const headers = hasBody ? { "content-type": "application/json" } : {};
    const body = hasBody ? JSON.stringify(req.body) : undefined;

    const response = await fetch(`http://127.0.0.1:${PYTHON_PORT}${req.originalUrl}`, {
      method: req.method,
      headers,
      body,
    });
    const text = await response.text();
    const contentType = response.headers.get("content-type") || "application/json";
    res.status(response.status).type(contentType).send(text || "{}");
  } catch (error) {
    res.status(502).json({ error: "Python workflow service is unavailable.", detail: error.message });
  }
}

// Express 5 does not accept the old `/api/*` wildcard syntax.
app.use("/api", proxy);
app.use((req, res, next) => {
  if (req.method === "GET" && !req.path.startsWith("/api/")) {
    const distIndex = path.join(frontendDist, "index.html");
    if (fs.existsSync(distIndex)) {
      return res.sendFile(distIndex);
    }
    const rootIndex = path.join(frontend, "index.html");
    if (fs.existsSync(rootIndex)) {
      return res.sendFile(rootIndex);
    }
  }
  next();
});

const server = app.listen(PORT, "127.0.0.1", () => {
  console.log(`Express Snippet Studio ready at http://127.0.0.1:${PORT}`);
});

function shutdown() {
  server.close();
  worker.kill();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
worker.on("exit", (code) => {
  if (code && code !== 0) console.error(`Python workflow service exited with code ${code}`);
});

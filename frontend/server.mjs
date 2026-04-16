import { createServer as createHttpsServer } from "https";
import { request as httpRequest } from "http";
import { readFileSync } from "fs";
import { parse } from "url";
import next from "next";

const dev = false;
const hostname = "0.0.0.0";
const port = 3000;
const BACKEND = "http://localhost:8000";

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const httpsOptions = {
  key: readFileSync("../certs/key.pem"),
  cert: readFileSync("../certs/cert.pem"),
};

app.prepare().then(() => {
  createHttpsServer(httpsOptions, async (req, res) => {
    const parsedUrl = parse(req.url, true);

    // Proxy /api/* requests to FastAPI backend
    if (parsedUrl.pathname?.startsWith("/api/")) {
      const backendUrl = new URL(req.url, BACKEND);

      const proxyReq = httpRequest(
        {
          hostname: "localhost",
          port: 8000,
          path: req.url,
          method: req.method,
          headers: {
            ...req.headers,
            host: "localhost:8000",
          },
        },
        (proxyRes) => {
          res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
          proxyRes.pipe(res);
        }
      );

      proxyReq.on("error", (err) => {
        console.error("Proxy error:", err.message);
        res.writeHead(502);
        res.end(JSON.stringify({ error: "Backend not reachable" }));
      });

      req.pipe(proxyReq);
      return;
    }

    // Everything else → Next.js
    await handle(req, res, parsedUrl);
  }).listen(port, hostname, () => {
    console.log(`> RetroScan AI running on https://0.0.0.0:${port}`);
    console.log(`> Backend proxy: /api/* → ${BACKEND}`);
  });
});

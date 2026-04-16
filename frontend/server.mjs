// Local HTTPS dev server with proxy to FastAPI backend.
// In production (Vercel), Next.js handles routing via next.config.ts rewrites.
import { createServer as createHttpsServer } from "https";
import { request as httpRequest, request as httpsRequest } from "http";
import { request as httpsRequestSecure } from "https";
import { readFileSync } from "fs";
import { parse } from "url";
import next from "next";

const dev = false;
const hostname = "0.0.0.0";
const port = Number(process.env.PORT) || 3000;
const BACKEND = process.env.BACKEND_URL || "http://localhost:8000";
const backendParsed = new URL(BACKEND);
const isHttps = backendParsed.protocol === "https:";

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
      const reqFn = isHttps ? httpsRequestSecure : httpRequest;

      const proxyReq = reqFn(
        {
          hostname: backendParsed.hostname,
          port: backendParsed.port || (isHttps ? 443 : 80),
          path: req.url,
          method: req.method,
          headers: {
            ...req.headers,
            host: backendParsed.host,
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

    await handle(req, res, parsedUrl);
  }).listen(port, hostname, () => {
    console.log(`> RetroScan AI running on https://0.0.0.0:${port}`);
    console.log(`> Backend proxy: /api/* → ${BACKEND}`);
  });
});

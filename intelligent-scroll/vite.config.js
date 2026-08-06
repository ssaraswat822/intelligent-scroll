import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { generate, NoProviderError, resolveProvider } from "./shared/ai.js";

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) reject(new Error("Body too large"));
    });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });

const send = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
};

/**
 * Serves the same /api/generate contract as the Netlify function so the app can
 * run with plain `npm run dev`, no Netlify CLI required.
 */
const devApi = (env) => ({
  name: "intelligent-scroll-dev-api",
  configureServer(server) {
    const provider = resolveProvider(env);
    server.config.logger.info(
      provider
        ? `  ➜  AI provider: ${provider}`
        : "  ➜  AI provider: none — the app will run in demo mode (set GROQ_API_KEY in .env)"
    );

    server.middlewares.use("/api/generate", async (req, res) => {
      if (req.method === "OPTIONS") {
        res.statusCode = 204;
        return res.end();
      }
      if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });

      try {
        const body = JSON.parse((await readBody(req)) || "{}");
        if (!body.prompt) return send(res, 400, { error: "prompt is required" });

        const result = await generate({
          prompt: body.prompt,
          maxTokens: body.maxTokens,
          env,
          timeoutMs: 30000,
        });
        return send(res, 200, result);
      } catch (err) {
        if (err instanceof NoProviderError || err.code === "NO_PROVIDER") {
          return send(res, 200, { error: err.message, code: "NO_PROVIDER" });
        }
        server.config.logger.error(`/api/generate failed: ${err.message}`);
        return send(res, 502, { error: err.message || "Generation failed" });
      }
    });
  },
});

export default defineConfig(({ mode }) => {
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), "") };
  return {
    plugins: [react(), devApi(env)],
    build: { outDir: "dist", sourcemap: false },
    server: { port: 5173 },
  };
});

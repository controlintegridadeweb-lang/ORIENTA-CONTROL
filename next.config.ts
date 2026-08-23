import os from "node:os";
import type { NextConfig } from "next";

/** Origens locais extras para hidratação do React em desenvolvimento. */
function resolveAllowedDevOrigins(): string[] {
  const base = ["127.0.0.1", "localhost"];
  const fromEnv =
    process.env.ALLOWED_DEV_ORIGINS?.split(",")
      .map((value) => value.trim())
      .filter(Boolean) ?? [];

  if (process.env.NODE_ENV === "production") {
    return [...new Set([...base, ...fromEnv])];
  }

  const lanOrigins = new Set<string>();
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const net of interfaces ?? []) {
      if (net.family === "IPv4" && !net.internal) {
        lanOrigins.add(net.address);
      }
    }
  }

  return [...new Set([...base, ...fromEnv, ...lanOrigins])];
}

function positiveIntegerFromEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const availableCpus = Math.max(1, os.availableParallelism?.() ?? os.cpus().length);
const buildCpus = positiveIntegerFromEnv(
  "NEXT_BUILD_CPUS",
  Math.min(availableCpus, 2),
);
const staticGenerationConcurrency = positiveIntegerFromEnv(
  "NEXT_STATIC_GENERATION_CONCURRENCY",
  buildCpus,
);


/**
 * HTTPS estrito (HSTS + upgrade-insecure-requests) só quando o app de fato
 * roda em HTTPS. Em E2E/CI o Playwright usa `next start` (NODE_ENV=production)
 * em http://127.0.0.1 — forçar upgrade quebra Server Actions e navegação.
 */
function shouldEnforceHttps(): boolean {
  if (process.env.NODE_ENV !== "production") return false;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) return /^https:\/\//i.test(appUrl);
  // Deploy Vercel sem APP_URL explícita ainda é HTTPS.
  return Boolean(process.env.VERCEL);
}

function securityHeaders() {
  const enforceHttps = shouldEnforceHttps();
  const headers = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ];
  if (enforceHttps) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    });
  }
  return headers;
}

const nextConfig: NextConfig = {
  allowedDevOrigins: resolveAllowedDevOrigins(),
  serverExternalPackages: ["pdf-lib", "pg"],
  experimental: {
    // O limite continua previsível, mas deixa de serializar todo build em
    // ambientes com CPU e memória disponíveis. Hospedagens restritas podem
    // reduzir os valores explicitamente por variável de ambiente.
    cpus: buildCpus,
    staticGenerationMaxConcurrency: staticGenerationConcurrency,
  },
  images: {
    // Todos os assets visuais do ORIENTA são locais. Enquanto o libvips usado
    // pelo sharp não possui versão corrigida para o advisory vigente, não
    // expomos o otimizador nativo a entradas processáveis em runtime.
    unoptimized: true,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders() }];
  },
};

export default nextConfig;

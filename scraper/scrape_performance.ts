/**
 * scrape_performance.ts
 *
 * Fetches Apple Silicon LLM inference benchmarks from omlx.ai for all
 * available chip variants and produces summary JSON used by the LLMINI
 * frontend to compare Mac mini / Mac Studio models.
 *
 * Usage: bun run scrape_performance.ts
 */

import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Types ────────────────────────────────────────────────────────────────

interface BenchmarkResponse {
  total: number;
  by_context: Record<
    string,
    { pp_tps: number[]; tg_tps: number[] }
  >;
}

interface ChipVariantSummary {
  /** e.g. "M4" */
  family: string;
  /** e.g. "Max (40c)" */
  variant: string;
  /** API value, e.g. "M4|Max|40" */
  chipFull: string;
  contexts: Record<
    string,
    {
      sampleCount: number;
      pp_tps: Stats;
      tg_tps: Stats;
    }
  >;
}

interface Stats {
  mean: number;
  median: number;
  min: number;
  max: number;
  stddev: number;
  /** Top percentile (95th) */
  p95: number;
}

interface PerformanceOutput {
  source: string;
  url: string;
  description: string;
  scrapedAt: string;
  chips: ChipVariantSummary[];
}

// ── All chip variants from omlx.ai/compare <select> ──────────────────────

const CHIP_VARIANTS: { family: string; variant: string; chipFull: string }[] =
  [
    // M1
    { family: "M1", variant: "Base", chipFull: "M1||" },
    { family: "M1", variant: "Max", chipFull: "M1|Max|" },
    { family: "M1", variant: "Max (24c)", chipFull: "M1|Max|24" },
    { family: "M1", variant: "Max (32c)", chipFull: "M1|Max|32" },
    { family: "M1", variant: "Pro (14c)", chipFull: "M1|Pro|14" },
    { family: "M1", variant: "Pro (16c)", chipFull: "M1|Pro|16" },
    { family: "M1", variant: "Ultra (48c)", chipFull: "M1|Ultra|48" },
    { family: "M1", variant: "Ultra (64c)", chipFull: "M1|Ultra|64" },
    // M2
    { family: "M2", variant: "Base", chipFull: "M2||" },
    { family: "M2", variant: "Max", chipFull: "M2|Max|" },
    { family: "M2", variant: "Max (30c)", chipFull: "M2|Max|30" },
    { family: "M2", variant: "Max (38c)", chipFull: "M2|Max|38" },
    { family: "M2", variant: "Pro (16c)", chipFull: "M2|Pro|16" },
    { family: "M2", variant: "Pro (19c)", chipFull: "M2|Pro|19" },
    { family: "M2", variant: "Ultra (60c)", chipFull: "M2|Ultra|60" },
    { family: "M2", variant: "Ultra (76c)", chipFull: "M2|Ultra|76" },
    // M3
    { family: "M3", variant: "Base", chipFull: "M3||" },
    { family: "M3", variant: "Max", chipFull: "M3|Max|" },
    { family: "M3", variant: "Max (30c)", chipFull: "M3|Max|30" },
    { family: "M3", variant: "Max (40c)", chipFull: "M3|Max|40" },
    { family: "M3", variant: "Pro (14c)", chipFull: "M3|Pro|14" },
    { family: "M3", variant: "Pro (18c)", chipFull: "M3|Pro|18" },
    { family: "M3", variant: "Ultra (60c)", chipFull: "M3|Ultra|60" },
    { family: "M3", variant: "Ultra (80c)", chipFull: "M3|Ultra|80" },
    // M4
    { family: "M4", variant: "Base", chipFull: "M4||" },
    { family: "M4", variant: "Max", chipFull: "M4|Max|" },
    { family: "M4", variant: "Max (32c)", chipFull: "M4|Max|32" },
    { family: "M4", variant: "Max (40c)", chipFull: "M4|Max|40" },
    { family: "M4", variant: "Pro (16c)", chipFull: "M4|Pro|16" },
    { family: "M4", variant: "Pro (20c)", chipFull: "M4|Pro|20" },
    // M5
    { family: "M5", variant: "Base", chipFull: "M5||" },
    { family: "M5", variant: "Max", chipFull: "M5|Max|" },
    { family: "M5", variant: "Max (32c)", chipFull: "M5|Max|32" },
    { family: "M5", variant: "Max (40c)", chipFull: "M5|Max|40" },
    { family: "M5", variant: "Pro", chipFull: "M5|Pro|" },
    { family: "M5", variant: "Pro (16c)", chipFull: "M5|Pro|16" },
    { family: "M5", variant: "Pro (20c)", chipFull: "M5|Pro|20" },
  ];

// ── Statistics helpers ───────────────────────────────────────────────────

function computeStats(values: number[]): Stats {
  const n = values.length;
  if (n === 0) return { mean: 0, median: 0, min: 0, max: 0, stddev: 0, p95: 0 };

  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const variance =
    values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const stddev = Math.sqrt(variance);

  const mid = Math.floor(n / 2);
  const median = n % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;

  const p95idx = Math.ceil(n * 0.95) - 1;
  const p95 = sorted[Math.max(0, Math.min(p95idx, n - 1))]!;

  return {
    mean: Math.round(mean * 10) / 10,
    median: Math.round(median * 10) / 10,
    min: Math.round(sorted[0]! * 10) / 10,
    max: Math.round(sorted[n - 1]! * 10) / 10,
    stddev: Math.round(stddev * 10) / 10,
    p95: Math.round(p95 * 10) / 10,
  };
}

// ── API client ───────────────────────────────────────────────────────────

const BASE_URL = "https://omlx.ai/api/benchmarks/compare";
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.4 Safari/605.1.15",
  Accept: "application/json",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://omlx.ai/compare",
};

async function fetchChipBenchmarks(
  chipFull: string
): Promise<BenchmarkResponse | null> {
  const url = `${BASE_URL}?chip_full=${encodeURIComponent(chipFull)}`;
  console.log(`  → GET ${url}`);
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) {
      console.error(`    ✗ HTTP ${res.status}: ${res.statusText}`);
      return null;
    }
    const data = (await res.json()) as BenchmarkResponse;
    console.log(
      `    ✓ ${data.total} entries, contexts: ${Object.keys(data.by_context).join(", ")}`
    );
    return data;
  } catch (err) {
    console.error(`    ✗ Error: ${err}`);
    return null;
  }
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log("omlx.ai Apple Silicon Benchmark Scraper");
  console.log("=".repeat(55));
  console.log(`Scraping ${CHIP_VARIANTS.length} chip variants...\n`);

  const results: ChipVariantSummary[] = [];

  // Rate-limited sequential fetch to be polite
  for (let i = 0; i < CHIP_VARIANTS.length; i++) {
    const cv = CHIP_VARIANTS[i]!;
    console.log(`[${i + 1}/${CHIP_VARIANTS.length}] ${cv.family} ${cv.variant}`);

    const data = await fetchChipBenchmarks(cv.chipFull);

    const contexts: ChipVariantSummary["contexts"] = {};

    if (data?.by_context) {
      for (const [ctxSize, ctxData] of Object.entries(data.by_context)) {
        contexts[ctxSize] = {
          sampleCount: ctxData.pp_tps.length,
          pp_tps: computeStats(ctxData.pp_tps),
          tg_tps: computeStats(ctxData.tg_tps),
        };
      }
    }

    results.push({
      family: cv.family,
      variant: cv.variant,
      chipFull: cv.chipFull,
      contexts,
    });

    // Polite delay between requests
    if (i < CHIP_VARIANTS.length - 1) {
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  // ── Output ───────────────────────────────────────────────────────────

  const output: PerformanceOutput = {
    source: "omlx.ai",
    url: "https://omlx.ai/compare",
    description:
      "Apple Silicon LLM inference benchmarks from oMLX community. " +
      "pp_tps = prompt processing tokens/sec, tg_tps = text generation tokens/sec.",
    scrapedAt: new Date().toISOString(),
    chips: results,
  };

  // Write to scraper/ directory
  const scraperPath = resolve(__dirname, "products_performance.json");
  Bun.write(scraperPath, JSON.stringify(output, null, 2));
  console.log(`\n✅ Written ${results.length} chips to ${scraperPath}`);

  // Also write to src/data/ for frontend consumption
  const dataPath = resolve(__dirname, "..", "src", "data", "products_performance.json");
  Bun.write(dataPath, JSON.stringify(output, null, 2));
  console.log(`✅ Written to ${dataPath}`);

  // ── Quick summary table ─────────────────────────────────────────────

  console.log("\nSummary (1024 context, pp_tps mean):");
  console.log("-".repeat(50));
  for (const c of results) {
    const c1024 = c.contexts["1024"];
    const mean = c1024?.pp_tps.mean ?? 0;
    const bar = "█".repeat(Math.round(mean / 50));
    console.log(
      `${c.family.padEnd(4)} ${c.variant.padEnd(14)} ${String(mean).padStart(8)} ${bar}`
    );
  }
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});

/**
 * llm-stats.com Leaderboard Scraper
 *
 * Scrapes the full LLM leaderboard at https://llm-stats.com/leaderboards/llm-leaderboard
 * by extracting the Next.js RSC (React Server Components) payload from the page HTML.
 * No browser needed — the full 296-model dataset is embedded in the page source.
 *
 * Usage:
 *   bun run scrape_llmstats.ts
 *
 * Output:
 *   scraper/llmstats_leaderboard.json
 *   src/data/llmstats_leaderboard.json
 */

import * as path from "path";
import * as fs from "fs";

// ─── Config ───────────────────────────────────────────────────────────

const BASE_URL =
  "https://llm-stats.com/leaderboards/llm-leaderboard";
const OUTPUT_DIR = path.resolve(import.meta.dirname || __dirname, "..");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "scraper", "llmstats_leaderboard.json");
const SRC_OUTPUT_FILE = path.join(OUTPUT_DIR, "src", "data", "llmstats_leaderboard.json");

// ─── Types ────────────────────────────────────────────────────────────

interface ModelData {
  model_id: string;
  name: string;
  organization: string;
  organization_id: string;
  organization_country: string | null;
  params: number | null;
  training_tokens: number | null;
  context: number | null;
  canonical_model_id: string | null;
  release_date: string | null;
  announcement_date: string | null;
  multimodal: boolean | null;
  license: string | null;
  is_moe: boolean | null;
  knowledge_cutoff: string | null;
  input_price: number | null;
  output_price: number | null;
  throughput: number | null;
  latency: number | null;

  // Benchmark scores
  aime_2025_score: number | null;
  hle_score: number | null;
  gpqa_score: number | null;
  swe_bench_verified_score: number | null;
  mmmu_score: number | null;
  simpleqa_score: number | null;
  osworld_score: number | null;
  browsecomp_score: number | null;
  toolathlon_score: number | null;
  terminal_bench_score: number | null;
  tau_bench_retail_score: number | null;
  arc_agi_v2_score: number | null;
  mmmlu_score: number | null;
  charxiv_r_score: number | null;
  mmmu_pro_score: number | null;
  screenspot_pro_score: number | null;
  mcp_atlas_score: number | null;
  frontiermath_score: number | null;
  mrcr_v2_score: number | null;
  scicode_score: number | null;
  apex_agents_score: number | null;
  swe_bench_pro_score: number | null;

  // Arena / composite scores
  coding_arena_score: number | null;
  index_reasoning: number | null;
  index_math: number | null;
  index_code: number | null;
  index_search: number | null;
  index_communication: number | null;
  index_vision: number | null;
  index_tool_calling: number | null;
  index_long_context: number | null;
  index_finance: number | null;
  index_legal: number | null;
  index_healthcare: number | null;
}

interface OutputData {
  source: string;
  url: string;
  scraped_at: string;
  total_models: number;
  models: ModelData[];
}

// ─── RSC Payload Extraction ───────────────────────────────────────────

/**
 * Extract the initialData array from the Next.js RSC payload embedded
 * in the page HTML as self.__next_f.push([1, "..."]) calls.
 */
function extractModels(html: string): ModelData[] {
  // Find all RSC payload lines
  const pattern = /self\.__next_f\.push\(\[1,"(.*?)"\]\)/gs;
  const matches = [...html.matchAll(pattern)];

  let payload = "";
  for (const m of matches) {
    if (m[1]!.includes("initialData")) {
      payload = m[1]!;
      break;
    }
  }

  if (!payload) {
    throw new Error("Could not find RSC payload with initialData");
  }

  // The RSC payload has JSON-escaped content (\" for quotes, \\ for backslashes)
  // Decode by wrapping in quotes and parsing as JSON string
  const decoded = JSON.parse('"' + payload + '"') as string;

  // Find the initialData JSON array
  const idx = decoded.indexOf('initialData":[');
  if (idx === -1) {
    throw new Error("Could not find initialData array in decoded payload");
  }

  const start = decoded.indexOf("[", idx);
  if (start === -1) {
    throw new Error("Could not find opening bracket for initialData");
  }

  // Bracket matching to find the full JSON array
  let depth = 0;
  let end = start;
  for (let i = start; i < decoded.length; i++) {
    if (decoded[i] === "[") depth++;
    else if (decoded[i] === "]") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }

  const jsonStr = decoded.slice(start, end);
  return JSON.parse(jsonStr) as ModelData[];
}

// ─── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log("llm-stats.com Leaderboard Scraper");
  console.log("=".repeat(55));
  console.log("Extracting data from Next.js RSC payload...\n");

  const response = await fetch(BASE_URL);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();
  console.log(`  Page size: ${(html.length / 1024).toFixed(0)} KB`);

  const models = extractModels(html);
  console.log(`  Models extracted: ${models.length}`);

  // Some stats
  const orgs = new Set(models.map((m) => m.organization).filter(Boolean));
  const proprietary = models.filter((m) => m.license === "proprietary").length;
  const openSource = models.filter(
    (m) => m.license && m.license !== "proprietary"
  ).length;

  console.log(`  Organizations: ${orgs.size}`);
  console.log(`  Proprietary: ${proprietary}`);
  console.log(`  Open-source: ${openSource}`);
  console.log(`  Fields per model: ${Object.keys(models[0]!).length}`);

  // Build output
  const output: OutputData = {
    source: "llm-stats.com",
    url: BASE_URL,
    scraped_at: new Date().toISOString(),
    total_models: models.length,
    models,
  };

  const json = JSON.stringify(output, null, 2);

  // Write files
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.mkdirSync(path.dirname(SRC_OUTPUT_FILE), { recursive: true });

  fs.writeFileSync(OUTPUT_FILE, json);
  fs.writeFileSync(SRC_OUTPUT_FILE, json);

  console.log(`\n✅ Written ${models.length} models → ${OUTPUT_FILE}`);
  console.log(`✅ Also written to ${SRC_OUTPUT_FILE}`);
  console.log(`   Output size: ${(json.length / 1024).toFixed(0)} KB`);
}

main().catch((err) => {
  console.error("Scraping failed:", err);
  process.exit(1);
});

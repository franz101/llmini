/**
 * scrape_benchmarks.ts
 *
 * Scrapes the oMLX community benchmarks table from omlx.ai/benchmarks.
 * Each page lists 10 benchmark runs with chip, RAM, model, quant,
 * context, PP tok/s, TG tok/s, and date.
 *
 * Features:
 *  - Cheerio-based robust HTML parsing (uses actual table structure)
 *  - Free proxy auto-fetching from multiple public sources
 *  - Tor support via local SOCKS5 (127.0.0.1:9050)
 *  - Proxy rotation on rate limit with per-proxy cooldowns
 *  - Checkpoint/resume: survives crashes, can restart from last page
 *  - Batch output: incremental JSON per 500 pages + combined output
 *
 * Usage:
 *   bun run scrape_benchmarks.ts                          # all 17K pages, direct
 *   bun run scrape_benchmarks.ts -- --free-proxies        # auto-fetch free proxies
 *   bun run scrape_benchmarks.ts -- --tor                 # route through Tor
 *   bun run scrape_benchmarks.ts -- --proxies file.txt    # custom proxy list
 *   bun run scrape_benchmarks.ts -- --pages 500           # first 500 pages only
 *   bun run scrape_benchmarks.ts -- --pages 1000-2000     # range of pages
 *   bun run scrape_benchmarks.ts -- --resume              # continue from last checkpoint
 *   bun run scrape_benchmarks.ts -- --concurrency 8       # 8 parallel
 *   bun run scrape_benchmarks.ts -- --apple-only          # only Apple Silicon
 */

import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import * as cheerio from "cheerio";
import { SocksProxyAgent } from "socks-proxy-agent";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Types ────────────────────────────────────────────────────────────────

interface BenchmarkRow {
  chip: string;
  ram: string;
  model: string;
  quantization: string;
  contextLength: string;
  ppTps: number;
  tgTps: number;
  date: string;
  url: string;
}

interface ScraperConfig {
  startPage: number;
  endPage: number;
  concurrency: number;
  appleOnly: boolean;
  outDir: string;
  checkpointFile: string;
  useTor: boolean;
  useFreeProxies: boolean;
  proxyFile: string;
}

interface Checkpoint {
  lastCompletedPage: number;
  totalRows: number;
  timestamp: string;
}

// ── CLI args ─────────────────────────────────────────────────────────────

function parseArgs(): Partial<ScraperConfig> & { resume?: boolean } {
  const cfg: Partial<ScraperConfig> & { resume?: boolean } = {};
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--pages" && args[i + 1]) {
      const v = args[i + 1]!;
      if (v.includes("-")) {
        const [s, e] = v.split("-").map(Number);
        cfg.startPage = s!;
        cfg.endPage = e!;
      } else {
        cfg.startPage = 1;
        cfg.endPage = Number(v);
      }
      i++;
    } else if (args[i] === "--concurrency" && args[i + 1]) {
      cfg.concurrency = Number(args[i + 1]!);
      i++;
    } else if (args[i] === "--apple-only") {
      cfg.appleOnly = true;
    } else if (args[i] === "--resume") {
      cfg.resume = true;
    } else if (args[i] === "--proxies" && args[i + 1]) {
      cfg.proxyFile = args[i + 1]!;
      i++;
    } else if (args[i] === "--tor") {
      cfg.useTor = true;
    } else if (args[i] === "--free-proxies") {
      cfg.useFreeProxies = true;
    }
  }
  return cfg;
}

// ── Constants ────────────────────────────────────────────────────────────

const BASE = "https://omlx.ai/benchmarks";
const TOR_SOCKS = "socks5://127.0.0.1:9050";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
  Accept: "text/html,*/*",
  "Accept-Language": "en-US,en;q=0.9",
};

// ── Proxy pool ───────────────────────────────────────────────────────────

class ProxyPool {
  private proxies: string[] = [];
  private cooldowns = new Map<string, number>();
  private index = 0;
  private torAgent: SocksProxyAgent | null = null;

  constructor(opts: { useTor?: boolean; useFreeProxies?: boolean; proxyFile?: string }) {
    if (opts.useTor) {
      this.proxies = [TOR_SOCKS];
      this.torAgent = new SocksProxyAgent(TOR_SOCKS);
      this.torAgent.timeout = 15000;
    }
    // Free proxies and file-based are loaded async via loadFreeProxies()
    if (opts.proxyFile && existsSync(opts.proxyFile)) {
      this.loadFromFile(opts.proxyFile);
    }
  }

  get size(): number {
    return this.proxies.length;
  }

  getAgent(proxy: string): SocksProxyAgent | undefined {
    if (proxy === TOR_SOCKS && this.torAgent) return this.torAgent;
    return undefined;
  }

  /** Load proxies from a text file (one http://host:port per line) */
  private loadFromFile(path: string): void {
    const text = readFileSync(path, "utf-8");
    for (const line of text.split("\n")) {
      const p = line.trim();
      if (p && !p.startsWith("#") && /^(https?|socks[45]?):\/\//.test(p)) {
        this.proxies.push(p);
      }
    }
    this.proxies = [...new Set(this.proxies)];
  }

  /** Fetch free HTTP proxies from public sources */
  async fetchFreeProxies(): Promise<number> {
    const sources = [
      // proxyscrape.com — free HTTP proxies, fast
      "https://api.proxyscrape.com/v4/free-proxy-list/get?request=display_proxies&protocol=http&proxy_format=protocolipport&format=text&timeout=10000",
      // TheSpeedX/PROXY-List GitHub
      "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt",
      // proxy-list.download
      "https://www.proxy-list.download/api/v1/get?type=http",
      // openproxylist.xyz
      "https://api.openproxylist.xyz/http.txt",
    ];

    const fetched = new Set<string>();
    for (const src of sources) {
      try {
        const res = await fetch(src, {
          headers: { ...HEADERS },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) continue;
        const text = await res.text();
        for (const line of text.split("\n")) {
          const p = line.trim();
          if (p && /^https?:\/\/[^\s]+:\d+$/.test(p)) {
            fetched.add(p);
          }
        }
      } catch {
        // Source down, skip
      }
    }

    // Add to pool
    const before = this.proxies.length;
    for (const p of fetched) {
      if (!this.proxies.includes(p)) {
        this.proxies.push(p);
      }
    }
    return this.proxies.length - before;
  }

  /** Get the next available proxy (not on cooldown) */
  getNext(): string | null {
    if (this.proxies.length === 0) return null;
    const now = Date.now();
    for (let t = 0; t < this.proxies.length; t++) {
      const p = this.proxies[this.index % this.proxies.length]!;
      this.index++;
      const cd = this.cooldowns.get(p);
      if (!cd || now > cd) {
        this.cooldowns.delete(p);
        return p;
      }
    }
    // All on cooldown — force oldest
    const p = this.proxies[this.index % this.proxies.length]!;
    this.cooldowns.delete(p);
    return p;
  }

  /** Mark a proxy for cooldown (milliseconds) */
  cooldown(proxy: string, ms: number): void {
    this.cooldowns.set(proxy, Date.now() + ms);
  }

  cooldownCount(): number {
    const now = Date.now();
    let count = 0;
    for (const [, until] of this.cooldowns) {
      if (now < until) count++;
    }
    return count;
  }
}

// ── Checkpoint helpers ────────────────────────────────────────────────────

function loadCheckpoint(path: string): Checkpoint | null {
  try {
    if (existsSync(path)) {
      return JSON.parse(readFileSync(path, "utf-8"));
    }
  } catch {}
  return null;
}

function saveCheckpoint(path: string, cp: Checkpoint): void {
  writeFileSync(path, JSON.stringify(cp, null, 2));
}

// ── Fetch (with proxy rotation) ──────────────────────────────────────────

async function fetchPage(
  page: number,
  proxies: ProxyPool,
  retries = 3
): Promise<string | null> {
  const url = `${BASE}?page=${page}`;
  let lastErr: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const proxy = proxies.getNext();

    if (attempt > 0) {
      const delay = Math.min(2000 * 2 ** attempt, 30000);
      if (attempt > 1) {
        const via = proxy
          ? proxy === TOR_SOCKS
            ? "Tor"
            : proxy.replace(/\/\/.*@/, "//***@")
          : "direct";
        process.stderr.write(
          `  ⚠ Retry page ${page} #${attempt}/${retries} via ${via}, wait ${delay}ms\n`
        );
      }
      await new Promise((r) => setTimeout(r, delay));
    }

    try {
      const fetchOpts: RequestInit = { headers: { ...HEADERS } };

      // For Bun: use proxy option for HTTP proxies, agent for SOCKS
      if (proxy) {
        if (proxy === TOR_SOCKS) {
          // Use SocksProxyAgent
          (fetchOpts as any).agent = proxies.getAgent(proxy);
        } else if (proxy.startsWith("http")) {
          // Bun supports proxy: "http://host:port"
          (fetchOpts as any).proxy = proxy;
        }
      }

      const res = await fetch(url, fetchOpts);

      if (res.status === 429) {
        if (proxy) {
          // Rate-limited via this proxy — cooldown it
          const cdMs = proxy === TOR_SOCKS ? 30000 : 120000;
          proxies.cooldown(proxy, cdMs);
          process.stderr.write(
            `  ⚠ 429 on ${proxy === TOR_SOCKS ? "Tor" : proxy.replace(/\/\/.*@/, "//***@")} (page ${page}), cooldown ${cdMs / 1000}s [${proxies.cooldownCount()}/${proxies.size} on cd]\n`
          );
        } else {
          process.stderr.write(`  ⚠ 429 on page ${page} (direct), backing off\n`);
        }
        await new Promise((r) => setTimeout(r, 10000));
        continue;
      }

      if (!res.ok) {
        lastErr = `HTTP ${res.status}`;
        continue;
      }

      return await res.text();
    } catch (err: any) {
      lastErr = err;
      // Proxy connection error — cooldown this proxy
      if (proxy && err?.code === "ECONNREFUSED") {
        proxies.cooldown(proxy, 60000);
      }
      if (attempt === retries) {
        console.error(`  ✗ Failed page ${page}: ${err?.message || err}`);
        return null;
      }
    }
  }

  console.error(`  ✗ Failed page ${page} after ${retries} retries: ${lastErr}`);
  return null;
}

// ── Parse HTML ────────────────────────────────────────────────────────────

function parseRows(html: string, appleOnly: boolean): BenchmarkRow[] {
  const $ = cheerio.load(html);
  const rows: BenchmarkRow[] = [];

  const benchLinks = $('a[href^="/benchmarks/"]');

  benchLinks.each((_, el) => {
    const href = $(el).attr("href") || "";
    const idMatch = href.match(/^\/benchmarks\/([a-z0-9]+)$/i);
    if (!idMatch) return;
    const id = idMatch[1]!;

    const tr = $(el).closest("tr");
    if (!tr.length) return;

    const tds = tr.find("td");
    if (tds.length < 6) return;

    const texts = tds
      .map((_, td) => $(td).text().trim())
      .get()
      .filter(Boolean);

    if (texts.length < 8) return;

    const chip = texts[1] || "";
    if (!chip || chip === "Chip" || chip.includes("Page ") || chip === "→" || chip === "←") return;
    if (appleOnly && !/^M\d/i.test(chip) && !/^Apple/i.test(chip)) return;

    const model = texts[3] || "";
    if (!model) return;

    rows.push({
      chip,
      ram: texts[2] || "",
      model,
      quantization: texts[4] || "",
      contextLength: (texts[5] || "").toLowerCase(),
      ppTps: parseFloat((texts[6] || "0").replace(",", "")) || 0,
      tgTps: parseFloat((texts[7] || "0").replace(",", "")) || 0,
      date: texts[8] || "",
      url: `https://omlx.ai/benchmarks/${id}`,
    });
  });

  return rows;
}

function getTotalPages(html: string): number {
  const m = html.match(/Page \d+ of ([\d,]+)/);
  if (!m) return 0;
  return parseInt(m[1]!.replace(/,/g, ""), 10);
}

// ── Batch processor ──────────────────────────────────────────────────────

async function scrapeBatch(
  pages: number[],
  cfg: ScraperConfig,
  proxies: ProxyPool
): Promise<BenchmarkRow[]> {
  const all: BenchmarkRow[] = [];

  for (let i = 0; i < pages.length; i += cfg.concurrency) {
    const chunk = pages.slice(i, i + cfg.concurrency);
    const results = await Promise.allSettled(
      chunk.map(async (page) => {
        const html = await fetchPage(page, proxies);
        if (!html) return [] as BenchmarkRow[];
        return parseRows(html, cfg.appleOnly);
      })
    );

    for (const r of results) {
      if (r.status === "fulfilled") {
        all.push(...r.value);
      }
    }

    const done = Math.min(i + cfg.concurrency, pages.length);
    process.stdout.write(
      `\r  Pages ${pages[i]}–${pages[done - 1]!} | ${all.length} rows | ${Math.round((done / pages.length) * 100)}%`
    );

    if (done < pages.length) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  console.log("");
  return all;
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  const cliArgs = parseArgs();
  const outDir = resolve(__dirname);
  const checkpointFile = resolve(outDir, ".benchmark_checkpoint.json");

  const cfg: ScraperConfig = {
    startPage: cliArgs.startPage ?? 1,
    endPage: cliArgs.endPage ?? 0,
    concurrency: cliArgs.concurrency ?? 2,
    appleOnly: cliArgs.appleOnly ?? false,
    outDir,
    checkpointFile,
    useTor: cliArgs.useTor ?? false,
    useFreeProxies: cliArgs.useFreeProxies ?? false,
    proxyFile: cliArgs.proxyFile || "",
  };

  // ── Setup proxies ──
  const proxies = new ProxyPool({
    useTor: cfg.useTor,
    useFreeProxies: cfg.useFreeProxies,
    proxyFile: cfg.proxyFile,
  });

  if (cfg.useTor) {
    console.log("🌐 Routing through Tor (socks5://127.0.0.1:9050)");
  }

  if (cfg.useFreeProxies) {
    console.log("🔍 Fetching free proxy lists...");
    const added = await proxies.fetchFreeProxies();
    console.log(`   ${added} fresh HTTP proxies loaded`);
  }

  if (cfg.proxyFile) {
    console.log(`📁 Loaded proxies from ${cfg.proxyFile}`);
  }

  if (proxies.size === 0 && !cfg.useTor) {
    console.log("⚠ No proxies — using direct connection (will likely hit rate limits)");
  }

  // ── Resume? ──
  if (cliArgs.resume) {
    const cp = loadCheckpoint(checkpointFile);
    if (cp) {
      cfg.startPage = cp.lastCompletedPage + 1;
      console.log(`📌 Resume from page ${cfg.startPage} (${cp.totalRows.toLocaleString()} rows saved)`);
    } else {
      console.log("No checkpoint found, starting fresh.");
    }
  }

  // ── Determine scope ──
  console.log("\n📡 Fetching page 1 to determine total pages...");
  const firstPage = await fetchPage(1, proxies);
  if (!firstPage) {
    console.error("❌ Cannot reach omlx.ai");
    process.exit(1);
  }

  const totalPages = getTotalPages(firstPage);
  if (totalPages === 0) {
    console.error("❌ Could not determine page count");
    process.exit(1);
  }
  console.log(`   Total: ${totalPages.toLocaleString()} pages`);

  if (cfg.endPage === 0) cfg.endPage = totalPages;
  cfg.endPage = Math.min(cfg.endPage, totalPages);
  cfg.startPage = Math.max(cfg.startPage, 1);

  const pagesToFetch = cfg.endPage - cfg.startPage + 1;
  console.log(`   Target: pages ${cfg.startPage}–${cfg.endPage} (${pagesToFetch.toLocaleString()})`);
  console.log(`   Concurrency: ${cfg.concurrency} | Proxies: ${proxies.size || "none"} | Apple-only: ${cfg.appleOnly}`);

  const chunks = Math.ceil(pagesToFetch / cfg.concurrency);
  const estMinutes = Math.ceil((chunks * 0.8) / 60);
  console.log(`   ⏱ Estimated: ~${estMinutes} min\n`);

  // ── Scrape in batches ──
  const BATCH_SIZE = 500;
  const totalBatches = Math.ceil(pagesToFetch / BATCH_SIZE);
  const allRows: BenchmarkRow[] = [];
  let totalFromCheckpoint = 0;

  if (cliArgs.resume) {
    const cp = loadCheckpoint(checkpointFile);
    if (cp) totalFromCheckpoint = cp.totalRows;
  }

  const startTime = Date.now();

  for (let b = 0; b < totalBatches; b++) {
    const batchStart = cfg.startPage + b * BATCH_SIZE;
    const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, cfg.endPage);
    const pages = Array.from(
      { length: batchEnd - batchStart + 1 },
      (_, i) => batchStart + i
    );

    console.log(`\n📦 Batch ${b + 1}/${totalBatches}: pages ${batchStart}–${batchEnd}`);
    const rows = await scrapeBatch(pages, cfg, proxies);
    allRows.push(...rows);

    const totalSoFar = totalFromCheckpoint + allRows.length;

    // Write batch JSON
    const batchFile = resolve(
      cfg.outDir,
      `benchmarks_batch_${String(batchStart).padStart(6, "0")}_${String(batchEnd).padStart(6, "0")}.json`
    );
    Bun.write(batchFile, JSON.stringify(rows, null, 2));

    // Save checkpoint
    saveCheckpoint(checkpointFile, {
      lastCompletedPage: batchEnd,
      totalRows: totalSoFar,
      timestamp: new Date().toISOString(),
    });

    console.log(`   ↓ ${rows.length} rows → ${batchFile}`);
    console.log(`   ✓ Checkpoint: page ${batchEnd} | ${totalSoFar.toLocaleString()} total`);

    // Write combined output
    const combinedPath = resolve(cfg.outDir, "benchmarks_all.json");
    Bun.write(combinedPath, JSON.stringify(allRows, null, 2));
    const dataPath = resolve(__dirname, "..", "src", "data", "benchmarks_all.json");
    Bun.write(dataPath, JSON.stringify(allRows, null, 2));
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`\n✅ ${allRows.length.toLocaleString()} rows → benchmarks_all.json`);
  console.log(`⏱  ${Math.floor(elapsed / 60)}m ${elapsed % 60}s`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

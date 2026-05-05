import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import * as cheerio from "cheerio";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const __dirname = dirname(fileURLToPath(import.meta.url));
chromium.use(StealthPlugin());

const URL =
  "https://www.notebooksbilliger.de/produkte/gb?zsorting=h%C3%B6chster_preis_zuerst&pc-typ=produktkategorie__%23__mini-pc,produktkategorie__%23__all-in-one_pc&produkttyp=propertygroupname__%23__pc&prozessor-hersteller=cpu_-_hersteller__%23__apple&arbeitsspeicher=32-64";

function waitForEnter(prompt: string): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, () => { rl.close(); resolve(); });
  });
}

interface Product {
  name: string;
  price: number;
  priceFormatted: string;
  imageUrl: string;
  productUrl: string;
  availability: string;
  ram: string;
  storage: string;
  cpu: string;
  gpu: string;
  os: string;
  formFactor: string;
  connectivity: string[];
  specs: string[];
}

function parsePrice(text: string): { price: number; formatted: string } {
  const m = text.match(/([\d.]+),(\d{2})\s*€/);
  if (!m) return { price: 0, formatted: text };
  return {
    price: Number.parseFloat(m[1].replace(/\./g, "") + "." + m[2]),
    formatted: m[0],
  };
}

function parseSpecs(lines: string[]) {
  let ram = "", storage = "", cpu = "", gpu = "", os = "", ff = "";
  const conn: string[] = [], rest: string[] = [];
  for (const s of lines) {
    const t = s.trim();
    if (!t) continue;
    if (/\d+\s*GB\s*RAM/i.test(t)) ram ||= t;
    else if (/SSD|HDD|\d+\s*GB\s*(M\.2|SSD|Flash)/i.test(t)) storage ||= t;
    else if (/M\d|CPU|Chip|Core/i.test(t) && /Apple|M4|M3|M2|M1/i.test(t)) cpu ||= t;
    else if (/GPU|Core.*GPU/i.test(t)) gpu ||= t;
    else if (/macOS|Windows|Linux/i.test(t)) os ||= t;
    else if (/Form Factor|USFF|AIO|All-in-One|PC System/i.test(t)) ff ||= t;
    else if (/WiFi|Bluetooth|HDMI|USB|DisplayPort|Thunderbolt/i.test(t)) conn.push(t);
    else if (t.length > 3) rest.push(t);
  }
  return { ram, storage, cpu, gpu, os, formFactor: ff, connectivity: conn, other: rest };
}

function extractProducts(html: string): Product[] {
  const $ = cheerio.load(html);
  const products: Product[] = [];
  const priceRx = /([\d.]+),(\d{2})\s*€/;
  const all = $("div, article, li, section").toArray();
  const seen = new Set<string>();

  for (const el of all) {
    const text = $(el).text().trim();
    if (text.length < 80 || text.length > 3000 || !priceRx.test(text)) continue;
    if (!/Apple|Mac mini|iMac|MacBook/i.test(text)) continue;
    const sig = text.slice(0, 80);
    if (seen.has(sig)) continue;
    seen.add(sig);

    const nm = text.match(/Apple\s*(Mac\s*mini|iMac|MacBook)\s*[A-Z0-9\-]+/i);
    const name = nm ? nm[0] : text.split("\n")[0]?.trim() || "";
    const pm = text.match(priceRx);
    if (!pm) continue;
    const { price, formatted } = parsePrice(pm[0]);
    if (price === 0) continue;

    const $el = $(el);
    const img = $el.find("img").first();
    const link = $el.find("a").first();
    let pu = "";
    if (link.attr("href"))
      pu = link.attr("href")!.startsWith("http")
        ? link.attr("href")!
        : "https://www.notebooksbilliger.de" + link.attr("href");

    const lines = text.split(/\n/).map(l => l.trim()).filter(l => l.length > 2 && l !== name.trim());
    const parsed = parseSpecs(lines);

    products.push({
      name, price, priceFormatted: formatted,
      imageUrl: img.attr("src") || img.attr("data-src") || "",
      productUrl: pu,
      availability: text.includes("Sofort") ? "In stock" : text.includes("vorbestellen") ? "Pre-order" : "Unknown",
      ...parsed, specs: lines,
    });
  }

  // Deduplicate
  const unique: Product[] = [];
  const ns = new Set<string>();
  for (const p of products) { if (!ns.has(p.name)) { ns.add(p.name); unique.push(p); } }

  return unique;
}

async function main() {
  console.log("Launching visible Chrome browser...");
  console.log("NOT headless — you can solve captchas manually.\n");

  const browser = await chromium.launch({
    headless: false,
    args: [
      "--no-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--window-size=1400,900",
    ],
  });

  const ctx = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    locale: "de-DE",
    timezoneId: "Europe/Berlin",
  });
  const page = await ctx.newPage();

  console.log(`Opening: ${URL}\n`);
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });

  // Let the page settle — captcha might appear
  await page.waitForTimeout(2000);

  // Check if we hit a captcha / bot page
  let bodyText = await page.evaluate(() => document.body.innerText.slice(0, 500));
  console.log("Page loaded:", bodyText.slice(0, 200));

  if (bodyText.includes("bot") || bodyText.includes("block") || bodyText.includes("captcha") || bodyText.includes("uups")) {
    console.log("\n⚠️  Captcha or bot page detected!");
    console.log("Please solve any captcha in the browser window, then press Enter to continue...");
    await waitForEnter("\nPress Enter after solving captcha: ");

    // Refresh page after captcha
    await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);
    bodyText = await page.evaluate(() => document.body.innerText.slice(0, 500));
    console.log("After refresh:", bodyText.slice(0, 200));
  }

  // Wait for products to render (the page might be an SPA)
  await page.waitForTimeout(3000);

  // Scroll down slowly to trigger lazy loading
  console.log("\nScrolling to load all products...");
  await page.evaluate(async () => {
    await new Promise<void>((r) => {
      let h = 0;
      const t = setInterval(() => {
        window.scrollBy(0, 500);
        h += 500;
        if (h >= document.body.scrollHeight) { clearInterval(t); r(); }
      }, 200);
    });
  });
  await page.waitForTimeout(2000);

  // Scroll back to top
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1000);

  const html = await page.content();
  Bun.write("debug.html", html);

  console.log("You can close the browser now.");
  await browser.close();

  console.log("\nParsing HTML...");
  const products = extractProducts(html);

  console.log(`\n=== ${products.length} products ===\n`);
  for (const p of products)
    console.log(`${p.priceFormatted} | ${p.name.slice(0, 55)} | ${p.cpu.slice(0, 25)} | ${p.ram} | ${p.storage}`);

  const outPath = resolve(__dirname, "..", "src", "data", "products.json");
  Bun.write(outPath, JSON.stringify(products, null, 2));
  Bun.write("products.json", JSON.stringify(products, null, 2));
  console.log(`\n✅ Written ${products.length} products to ${outPath}`);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});

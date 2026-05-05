import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import * as cheerio from "cheerio";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

chromium.use(StealthPlugin());

// idealo.de Apple Mac mini / Mac Studio category
const URL =
  "https://www.idealo.de/preisvergleich/ProductCategory/3020F189906-105543532-107083121-107083122-107083123.html?sortKey=minPrice";

interface IdealoProduct {
  name: string;
  model: string;
  price: number;
  priceFormatted: string;
  imageUrl: string;
  productUrl: string;
  offerCount: number;
  cpu: string;
  ram: string;
  storage: string;
  gpu: string;
  os: string;
  formFactor: string;
  description: string;
}

function parsePrice(text: string): { price: number; formatted: string } {
  // idealo prices: "2.589,00 €"
  const match = text.match(/([\d.]+),(\d{2})\s*€/);
  if (!match) return { price: 0, formatted: text };
  const price = Number.parseFloat(
    match[1].replace(/\./g, "") + "." + match[2],
  );
  return { price, formatted: match[0].trim() };
}

function parseOfferCount(text: string): number {
  // "1 Angebot" or "4 Angebote"
  const match = text.match(/(\d+)\s*Angebot/);
  return match ? Number.parseInt(match[1], 10) : 0;
}

function extractSpecs(name: string, text: string): {
  ram: string;
  storage: string;
  cpu: string;
  gpu: string;
  os: string;
  formFactor: string;
  description: string;
} {
  let ram = "";
  let storage = "";
  let cpu = "";
  let gpu = "";
  let os = "";
  let formFactor = "";
  let description = "";

  // Determine form factor from name
  if (/Mac\s*mini/i.test(name)) {
    formFactor = "Mini-PC";
  } else if (/Mac\s*Studio/i.test(name)) {
    formFactor = "Multimedia-PC";
  } else if (/iMac/i.test(name)) {
    formFactor = "All-in-One PC";
  }

  // Extract RAM: "64 GB RAM", "128 GB RAM"
  const ramMatch = text.match(/(\d+)\s*GB\s*RAM/i);
  if (ramMatch) ram = `${ramMatch[1]} GB`;

  // Extract storage: "512 GB SSD", "1.000 GB SSD", etc.
  const storageMatch = text.match(
    /([\d.]+)\s*GB\s*(SSD|Flash)[-]?Speicher/i,
  );
  if (storageMatch) storage = `${storageMatch[1]} GB ${storageMatch[2]}`;

  // Extract CPU: "Apple M4 Pro, 14-Core", "Apple M4 Max, 16-Core", etc.
  const cpuMatch = text.match(
    /Apple\s*(M\d+\s*(Pro|Max|Ultra)?)(,\s*\d+[-]?Core)/i,
  );
  if (cpuMatch) cpu = `Apple ${cpuMatch[1].trim()}${cpuMatch[3] || ""}`;

  // Extract GPU: "Apple M4 Pro 20-Core GPU", "Apple M4 Max 40-Core GPU"
  const gpuMatch = text.match(
    /Apple\s*(M\d+\s*(Pro|Max|Ultra)?)\s*(\d+[-]?Core)\s*GPU/i,
  );
  if (gpuMatch) gpu = `Apple ${gpuMatch[1]} ${gpuMatch[3]} GPU`;

  // Extract OS
  const osMatch = text.match(/macOS\s*(Sequoia|Ventura|Monterey|Sonoma)/i);
  if (osMatch) os = `macOS ${osMatch[1]}`;

  // Description is the remaining descriptive text
  const cleaned = text
    .replace(ramMatch?.[0] || "", "")
    .replace(storageMatch?.[0] || "", "")
    .replace(cpuMatch?.[0] || "", "")
    .replace(gpuMatch?.[0] || "", "")
    .replace(osMatch?.[0] || "", "")
    .replace(/\s+/g, " ")
    .trim();
  description = cleaned;

  return { ram, storage, cpu, gpu, os, formFactor, description };
}

async function scrapeIdealo() {
  console.log("Launching browser with stealth for idealo.de...");
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-features=IsolateOrigins,site-per-process",
      "--disable-site-isolation-trials",
    ],
  });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
    locale: "de-DE",
    timezoneId: "Europe/Berlin",
  });
  const page = await context.newPage();

  // Additional stealth
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    // @ts-ignore
    window.chrome = { runtime: {} };
  });

  console.log("Navigating to idealo.de...");
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });

  // Wait for content to load
  await page.waitForTimeout(4000);

  // Scroll down slowly to trigger lazy loading
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 350;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= document.body.scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 200);
    });
  });

  await page.waitForTimeout(2000);

  // Try to click "accept cookies" if present
  try {
    const cookieBtn = page.locator(
      'button:has-text("Alle akzeptieren"), button:has-text("Accept all"), button:has-text("Zustimmen")',
    );
    if ((await cookieBtn.count()) > 0) {
      await cookieBtn.first().click();
      await page.waitForTimeout(1500);
      console.log("Accepted cookies");
    }
  } catch {
    console.log("No cookie banner found or already accepted");
  }

  const html = await page.content();

  // Debug: check what we got
  const bodyPreview = await page.evaluate(() =>
    document.body.innerText.slice(0, 800),
  );
  console.log("Body preview:", bodyPreview.slice(0, 400));

  await browser.close();

  // Save full HTML for debugging
  Bun.write("debug_idealo.html", html);

  console.log("\nParsing HTML...");
  const $ = cheerio.load(html);

  const products: IdealoProduct[] = [];
  const priceRegex = /([\d.]+),(\d{2})\s*€/;

  // idealo typically uses various container classes
  // Try multiple strategies to find product cards

  // Strategy 1: Look for offer-list items (idealo classic)
  const offerListItems = $(
    '[class*="offerList"], [class*="productOffers"], [class*="srp-offer"], [data-offer-id]',
  ).toArray();
  console.log(`Offer list items: ${offerListItems.length}`);

  // Strategy 2: Look for product cards (idealo newer layout)
  const productCards = $(
    'article, [class*="product"], [class*="Product"], [class*="item"]',
  ).toArray();
  console.log(`Product card candidates: ${productCards.length}`);

  // Strategy 3: Scan ALL elements for price-like patterns and Mac names
  const allElements = $("div, article, li, section, tr").toArray();
  const candidates: { el: cheerio.AnyNode; text: string }[] = [];
  const seenTexts = new Set<string>();

  for (const el of allElements) {
    const text = $(el).text().trim();
    if (
      text.length > 60 &&
      text.length < 3000 &&
      priceRegex.test(text) &&
      /Apple|Mac mini|Mac Studio|iMac/i.test(text) &&
      !seenTexts.has(text.slice(0, 120))
    ) {
      seenTexts.add(text.slice(0, 120));
      candidates.push({ el, text });
    }
  }

  console.log(`Found ${candidates.length} product candidates`);

  // Filter: prefer leaf nodes (most specific)
  const leafCandidates = candidates.filter((c) => {
    const containedByOther = candidates.some(
      (other) =>
        other !== c &&
        $(c.el).parents().toArray().includes(other.el),
    );
    // We want the most specific (not parent of another)
    const isParent = candidates.some(
      (other) =>
        other !== c &&
        $(other.el).parents().toArray().includes(c.el),
    );
    return !isParent;
  });

  console.log(`Filtered to ${leafCandidates.length} leaf candidates`);

  // Deduplicate by name/model
  const uniqueCandidates: typeof leafCandidates = [];
  const seenNames = new Set<string>();

  for (const c of leafCandidates) {
    // Extract a unique key from the name
    const nameMatch = c.text.match(
      /(Apple\s*(Mac\s*(mini|Studio)))\s*(M\d|20\d\d)/i,
    );
    const modelMatch = c.text.match(/\((Z1[A-Z0-9\-_]+)\)/i);
    const key = modelMatch
      ? modelMatch[1]
      : nameMatch
        ? c.text.slice(0, 60).trim()
        : c.text.slice(0, 40);
    if (!seenNames.has(key)) {
      seenNames.add(key);
      uniqueCandidates.push(c);
    }
  }

  console.log(`Deduplicated to ${uniqueCandidates.length} unique products`);

  for (const { el, text } of uniqueCandidates) {
    const $el = $(el);

    // --- Name ---
    // idealo product name pattern
    let name =
      $el.find('[class*="productTitle"], [class*="offerTitle"], [class*="title"], h2, h3')
        .first()
        .text()
        .trim() ||
      text.split("\n")[0]?.trim() ||
      "";

    // If name is too short, try to extract the full product name
    if (name.length < 15) {
      const longName = text.match(/Apple\s*(Mac\s*(mini|Studio))\s*(20\d\d|M\d).{5,100}?(?=\d{1,3}(?:\.\d{3})*,\d{2}\s*€)/i);
      if (longName) name = longName[0].trim();
    }

    // --- Model number ---
    const modelMatch = text.match(/\((Z1[A-Z0-9\-_]+)\)/);
    const model = modelMatch ? modelMatch[1] : "";

    // --- Price ---
    // idealo shows the lowest price
    const allPrices = [...text.matchAll(new RegExp(priceRegex, "g"))];
    let price = 0;
    let priceFormatted = "";
    if (allPrices.length > 0) {
      // First price is usually the main one
      const p = parsePrice(allPrices[0]![0]);
      price = p.price;
      priceFormatted = p.formatted;
    }
    if (price === 0) continue;

    // --- Offer count ---
    const offerMatch = text.match(/(\d+)\s*Angebot/);
    const offerCount = offerMatch ? Number.parseInt(offerMatch[1], 10) : 0;

    // --- Image ---
    const img = $el.find("img").first();
    const imageUrl = img.attr("src") || img.attr("data-src") || img.attr("data-lazy-src") || "";

    // --- Product URL ---
    const link = $el.find("a[href]").first();
    let productUrl = "";
    if (link.attr("href")) {
      const href = link.attr("href")!;
      productUrl = href.startsWith("http")
        ? href
        : "https://www.idealo.de" + href;
    }

    // --- Combine all text for spec extraction ---
    const allText = text + " " + name;

    const specs = extractSpecs(name, allText);

    products.push({
      name: name.replace(/\s+/g, " ").trim(),
      model,
      price,
      priceFormatted,
      imageUrl,
      productUrl,
      offerCount,
      ...specs,
    });
  }

  console.log(`\nExtracted ${products.length} products from idealo.de:\n`);
  for (const p of products) {
    console.log(
      `${p.priceFormatted.padEnd(14)} | ${p.name.slice(0, 60).padEnd(62)} | ${p.cpu.padEnd(25)} | ${p.ram.padEnd(10)} | ${p.storage.padEnd(15)} | ${p.offerCount} offers`,
    );
  }

  return products;
}

scrapeIdealo()
  .then((products) => {
    // Write both to scraper dir and src/data
    const scraperPath = resolve(__dirname, "products_idealo.json");
    Bun.write(scraperPath, JSON.stringify(products, null, 2));
    console.log(`\nWritten ${products.length} products to ${scraperPath}`);

    const srcPath = resolve(__dirname, "..", "src", "data", "products_idealo.json");
    Bun.write(srcPath, JSON.stringify(products, null, 2));
    console.log(`Written ${products.length} products to ${srcPath}`);
  })
  .catch((err) => {
    console.error("idealo scraping failed:", err);
    process.exit(1);
  });

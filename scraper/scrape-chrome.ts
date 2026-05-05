import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

chromium.use(StealthPlugin());

async function main() {
  // Try with actual Chrome channel and non-headless
  const browser = await chromium.launch({
    headless: false,
    channel: "chrome",
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });

  // Try the original URL with the special hash params
  const url = "https://www.notebooksbilliger.de/produkte/gb?zsorting=h%C3%B6chster_preis_zuerst&pc-typ=produktkategorie__%23__mini-pc,produktkategorie__%23__all-in-one_pc&produkttyp=propertygroupname__%23__pc&prozessor-hersteller=cpu_-_hersteller__%23__apple&arbeitsspeicher=32-64";
  
  console.log("Opening Chrome with URL...");
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(5000);
  
  const text = await page.evaluate(() => document.body.innerText.slice(0, 500));
  console.log("Page:", text.slice(0, 400));
  
  // Keep browser open for 10 seconds to see
  await page.waitForTimeout(5000);
  await browser.close();
}

main().catch(console.error);

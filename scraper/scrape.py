"""
notebooksbilliger.de scraper using nodriver + BeautifulSoup
Targets: .product-card[data-product-id] elements
"""
import asyncio
import json
import re
import html as html_mod
from pathlib import Path
from bs4 import BeautifulSoup
import nodriver as uc

URL = (
    "https://www.notebooksbilliger.de/produkte/gb"
    "?zsorting=h%C3%B6chster_preis_zuerst"
    "&pc-typ=produktkategorie__%23__mini-pc,produktkategorie__%23__all-in-one_pc"
    "&produkttyp=propertygroupname__%23__pc"
    "&prozessor-hersteller=cpu_-_hersteller__%23__apple"
    "&arbeitsspeicher=32-64"
)

OUTPUT = Path(__file__).resolve().parent.parent / "src" / "data" / "products.json"


def parse_price(text: str) -> tuple[float, str]:
    """Parse '3.764,00&nbsp;€' or '3.764,00 €' into (3764.0, '3.764,00 €')"""
    clean = html_mod.unescape(text).replace("\xa0", " ").replace("&nbsp;", " ")
    m = re.search(r"([\d.]+),(\d{2})\s*€", clean)
    if not m:
        return 0.0, clean
    price = float(m.group(1).replace(".", "") + "." + m.group(2))
    return price, m.group(0)


def parse_specs(text: str) -> dict:
    """Parse spec text into structured fields."""
    result = {
        "ram": "", "storage": "", "cpu": "", "gpu": "",
        "os": "", "formFactor": "", "connectivity": [], "other": [],
    }
    # Split on common separators in the card
    parts = re.split(r"\s*\|\s*", text)

    for t in parts:
        t = t.strip()
        if not t:
            continue
        # RAM
        if not result["ram"] and re.search(r"\d+\s*GB\s*RAM", t, re.I):
            result["ram"] = t
        # Storage
        elif not result["storage"] and re.search(r"SSD|HDD|\d+\s*GB\s*(M\.2|SSD|Flash)", t, re.I):
            result["storage"] = t
        elif not result["storage"] and re.search(r"^\d+\s*GB$", t.strip(), re.I):
            result["storage"] = t + " SSD"
        # GPU (check before CPU — "16-Core GPU" matches Core but is GPU)
        if not result["gpu"] and re.search(r"GPU|Core.*GPU", t, re.I):
            result["gpu"] = t
        # CPU
        elif not result["cpu"] and re.search(r"(Apple\s*M\d|M\d\s*(Chip|Pro|Max|Ultra))", t, re.I):
            result["cpu"] = t
        elif not result["cpu"] and re.search(r"CPU", t, re.I) and re.search(r"Apple|Core", t, re.I):
            result["cpu"] = t
        # OS
        elif not result["os"] and re.search(r"macOS|Windows|Linux", t, re.I):
            result["os"] = t
        # Form factor
        elif not result["formFactor"] and re.search(r"Form Factor|USFF|AIO|All-in-One|PC System", t, re.I):
            result["formFactor"] = t
        # Connectivity
        elif re.search(r"WiFi|Bluetooth|HDMI|USB|DisplayPort|Thunderbolt|Webcam", t, re.I):
            result["connectivity"].append(t)
        # Others (skip noise like "Vergleichen", "Zum Produkt", etc.)
        elif len(t) > 3 and t not in ("Vergleichen", "Zum Produkt", "Versandkostenfrei",
                                       "Jetzt vorbestellen", "Sofort ab Lager",
                                       "Auch als Campusprodukt erhältlich"):
            result["other"].append(t)
    return result


async def main():
    print("Launching Chrome via nodriver ...")
    browser = await uc.start(headless=False, browser_args=["--window-size=1400,900"])

    try:
        page = await browser.get(URL)
        print("Page opened, waiting for SPA render ...")
        await page.sleep(7)

        # Verify we got the real page
        body = await page.evaluate("document.body.innerText.slice(0, 500)", return_by_value=True)
        if "nicht gefunden" in body:
            print("❌ Got fake 404 page. Bot protection active.")
            return
        print(f"Page OK: {body[:120]}...\n")

        # Scroll to load all lazy products
        print("Scrolling to load products ...")
        await page.evaluate("""
            new Promise((resolve) => {
                let h = 0;
                const t = setInterval(() => {
                    window.scrollBy(0, 600);
                    h += 600;
                    if (h >= document.body.scrollHeight) { clearInterval(t); resolve(); }
                }, 200);
            });
        """, await_promise=True, return_by_value=True)
        await page.sleep(3)

        # Get HTML
        html = await page.evaluate("document.documentElement.outerHTML", return_by_value=True)
        Path("debug.html").write_text(html, encoding="utf-8")
        soup = BeautifulSoup(html, "html.parser")

        # Parse product cards
        cards = soup.find_all("div", class_="product-card", attrs={"data-product-id": True})
        print(f"Found {len(cards)} product cards\n")

        products = []
        seen_ids = set()

        for card in cards:
            pid = card.get("data-product-id", "")
            # Skip template placeholders
            if not pid or pid in seen_ids or "{{" in pid:
                continue
            seen_ids.add(pid)

            # Name from heading
            heading = card.find(class_="product-card__product-heading-title")
            name = heading.get_text(strip=True) if heading else ""

            # Price from data attribute
            price_raw = card.get("data-product-price", "")
            price_val, price_fmt = parse_price(price_raw)

            # Image
            img = card.find("img", class_="product-card__image")
            image_url = ""
            if img:
                src = img.get("src") or img.get("data-src") or ""
                if src and not src.startswith("http"):
                    src = "https:" + src
                image_url = src

            # Product link
            link = card.find("a", href=re.compile(r"/produkte/"))
            product_url = ""
            if link:
                href = link["href"]
                product_url = href if href.startswith("http") else f"https://www.notebooksbilliger.de{href}"

            # Availability
            card_text = card.get_text(" ")
            availability = "Unknown"
            if "Sofort ab Lager" in card_text:
                availability = "In stock"
            elif "vorbestellen" in card_text.lower():
                availability = "Pre-order"

            # Parse specs from the card text (pipe-delimited)
            specs_text = card.get_text(" | ")
            parsed = parse_specs(specs_text)

            # Collect spec lines for display
            spec_lines = [p.strip() for p in specs_text.split("|") if p.strip() and len(p.strip()) > 2]

            products.append({
                "name": name,
                "price": price_val,
                "priceFormatted": price_fmt,
                "imageUrl": image_url,
                "productUrl": product_url,
                "availability": availability,
                **parsed,
                "specs": spec_lines,
            })

        # Sort by price descending
        products.sort(key=lambda p: p["price"], reverse=True)

        print(f"=== {len(products)} products ===\n")
        for p in products:
            print(f"{p['priceFormatted']:>12s} | {p['name'][:50]:50s} | {p['cpu'][:25]:25s} | {p['ram']:10s} | {p['storage']}")

        # Save
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_text(json.dumps(products, indent=2, ensure_ascii=False), encoding="utf-8")
        Path("products.json").write_text(json.dumps(products, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"\n✅ Written {len(products)} products to {OUTPUT}")

    finally:
        browser.stop()


if __name__ == "__main__":
    asyncio.run(main())

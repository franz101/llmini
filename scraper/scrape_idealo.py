"""
idealo.de scraper using Camoufox (Firefox-based stealth browser).
Scrapes Apple Mac mini / Mac Studio product listings.
"""
import json
import re
import sys
import time
from pathlib import Path

from camoufox.sync_api import Camoufox
from bs4 import BeautifulSoup

URL = (
    "https://www.idealo.de/preisvergleich/ProductCategory/"
    "3020F189906-105543532-107083121-107083122-107083123.html?sortKey=minPrice"
)

# Output paths
SCRAPER_DIR = Path(__file__).resolve().parent
SRC_DATA_DIR = SCRAPER_DIR.parent / "src" / "data"


def parse_price(text: str) -> tuple[float, str]:
    """Parse idealo price like '2.589,00 €' or 'ab3.238,99 €'"""
    # Match patterns like "2.589,00 €" or "ab3.238,99 €"
    match = re.search(r"((?:ab\s*)?[\d.]+,\d{2}\s*€)", text)
    if not match:
        return 0.0, text.strip()
    raw = match.group(1).strip()
    # Remove "ab" prefix and "€" suffix
    cleaned = raw.replace("ab", "").replace("€", "").strip()
    # Convert German number format
    cleaned = cleaned.replace(".", "").replace(",", ".")
    try:
        price = float(cleaned)
    except ValueError:
        return 0.0, raw
    return price, raw


def parse_offer_count(text: str) -> int:
    """Parse '1 Angebot' or '4 Angebote'"""
    match = re.search(r"(\d+)\s*Angebot", text)
    return int(match.group(1)) if match else 0


def extract_specs(name: str, full_text: str) -> dict:
    """Extract specs from the product text."""
    ram = ""
    storage = ""
    cpu = ""
    gpu = ""
    os = ""
    form_factor = ""

    # Form factor
    if re.search(r"Mac\s*mini", name, re.IGNORECASE):
        form_factor = "Mini-PC"
    elif re.search(r"Mac\s*Studio", name, re.IGNORECASE):
        form_factor = "Multimedia-PC"
    elif re.search(r"iMac", name, re.IGNORECASE):
        form_factor = "All-in-One PC"

    # RAM
    ram_match = re.search(r"(\d+)\s*GB\s*RAM", full_text)
    if ram_match:
        ram = f"{ram_match.group(1)} GB"

    # Storage
    storage_match = re.search(
        r"([\d.]+)\s*GB\s*(SSD|Flash)[-]?Speicher", full_text
    )
    if storage_match:
        storage = f"{storage_match.group(1)} GB {storage_match.group(2)}"

    # CPU
    cpu_match = re.search(
        r"Apple\s*(M\d+\s*(Pro|Max|Ultra)?(?:,\s*\d+[-]?Core)?)", full_text
    )
    if cpu_match:
        cpu = f"Apple {cpu_match.group(1).strip()}"

    # GPU
    gpu_match = re.search(
        r"Apple\s*(M\d+\s*(Pro|Max|Ultra)?)\s*(\d+[-]?Core)\s*GPU", full_text
    )
    if gpu_match:
        gpu = f"Apple {gpu_match.group(1)} {gpu_match.group(3)} GPU"

    # OS
    os_match = re.search(r"macOS\s*(Sequoia|Ventura|Monterey|Sonoma)", full_text)
    if os_match:
        os = f"macOS {os_match.group(1)}"

    return {
        "ram": ram,
        "storage": storage,
        "cpu": cpu,
        "gpu": gpu,
        "os": os,
        "formFactor": form_factor,
    }


def scrape() -> list[dict]:
    products = []

    print("Launching Camoufox browser (Firefox-based stealth)...")
    with Camoufox(
        headless=True,
        os="macos",
        humanize=True,
        geoip=True,
        locale="de-DE",
        screen=None,  # auto-generate
        window=(1920, 1080),
        block_images=False,
        block_webrtc=True,
    ) as browser:
        page = browser.new_page()
        page.set_default_timeout(30000)

        print(f"Navigating to {URL}...")
        page.goto(URL, wait_until="domcontentloaded")

        # Wait for content to render
        time.sleep(3)

        # Accept cookies if present
        try:
            for btn_text in ["Alle akzeptieren", "Accept all", "Zustimmen"]:
                btn = page.query_selector(f'button:has-text("{btn_text}")')
                if btn:
                    btn.click()
                    time.sleep(1.5)
                    print("Accepted cookies")
                    break
        except Exception:
            print("No cookie banner found or already accepted")

        # Scroll to load lazy content
        print("Scrolling to load all products...")
        for _ in range(10):
            page.evaluate("window.scrollBy(0, 400)")
            time.sleep(0.3)

        # Scroll back to top
        page.evaluate("window.scrollTo(0, 0)")
        time.sleep(1)

        # Get page content
        html = page.content()

        # Debug: save HTML
        debug_path = SCRAPER_DIR / "debug_idealo.html"
        debug_path.write_text(html, encoding="utf-8")
        print(f"Saved debug HTML to {debug_path}")

        # Check if we got blocked
        body_text = page.evaluate("document.body.innerText")
        print(f"Body preview: {body_text[:400]}")

        if "Something has gone wrong" in body_text or "Sorry" in body_text[:200]:
            print("ERROR: Blocked by idealo.de bot protection!")
            return products

    print("\nParsing HTML with BeautifulSoup...")
    soup = BeautifulSoup(html, "html.parser")

    price_regex = re.compile(r"([\d.]+),(\d{2})\s*€")

    # Strategy 1: Look for structured offer items
    # idealo uses datalist-datasets with product data
    offer_items = soup.select(
        '[class*="offerList"], [class*="productOffers"], '
        '[class*="srp-offer"], [data-offer-id], '
        '[class*="product-list"] article, '
        '[class*="product-list"] [class*="item"]'
    )
    print(f"Offer list items: {len(offer_items)}")

    # Strategy 2: Scan all divs, articles, li, sections for product patterns
    all_elements = soup.find_all(["div", "article", "li", "section"])
    candidates = []
    seen_texts = set()

    for el in all_elements:
        text = el.get_text(strip=True)
        if (
            60 < len(text) < 3000
            and price_regex.search(text)
            and ("Apple" in text and ("Mac mini" in text or "Mac Studio" in text or "iMac" in text))
            and text[:120] not in seen_texts
        ):
            seen_texts.add(text[:120])
            candidates.append(el)

    print(f"Found {len(candidates)} product candidates")

    # Filter to leaf nodes (most specific containers)
    leaf_candidates = []
    for c in candidates:
        # Check if any other candidate is a descendant of this one
        is_parent = False
        for other in candidates:
            if other is not c and other in c.descendants:
                is_parent = True
                break
        if not is_parent:
            leaf_candidates.append(c)

    print(f"Filtered to {len(leaf_candidates)} leaf candidates")

    # Deduplicate by model name
    unique = []
    seen_models = set()

    for el in leaf_candidates:
        text = el.get_text(strip=True)
        # Try to extract model number as unique key
        model_match = re.search(r"\((Z1[A-Z0-9\-_]+)\)", text)
        if model_match:
            key = model_match.group(1)
        else:
            # Use first 60 chars as key
            key = text[:60].strip()
        if key not in seen_models:
            seen_models.add(key)
            unique.append(el)

    print(f"Deduplicated to {len(unique)} unique products")

    for el in unique:
        text = el.get_text(strip=True)

        # --- Name ---
        name_el = el.find(["h2", "h3", "a"]) or el.find(
            class_=re.compile(r"title|name|product", re.I)
        )
        name = name_el.get_text(strip=True) if name_el else ""

        # If name is still empty or too short, extract from text
        if len(name) < 10:
            name_match = re.search(
                r"Apple\s*(Mac\s*(mini|Studio))\s*(20\d{2}|M\d).*?(?=ab\s*[\d.]+,\d{2}\s*€|[\d.]+,\d{2}\s*€)",
                text,
            )
            if name_match:
                name = name_match.group(0).strip()

        if not name:
            # Fallback: first meaningful line
            lines = [l.strip() for l in text.split("\n") if len(l.strip()) > 10]
            name = lines[0] if lines else text[:80]

        # Clean up name
        name = re.sub(r"\s+", " ", name).strip()

        # --- Model ---
        model_match = re.search(r"\((Z1[A-Z0-9\-_]+)\)", text)
        model = model_match.group(1) if model_match else ""

        # --- Price ---
        all_prices = price_regex.findall(text)
        price = 0.0
        price_formatted = ""
        if all_prices:
            euros, cents = all_prices[0]
            price = float(euros.replace(".", "") + "." + cents)
            price_formatted = f"{all_prices[0][0]},{all_prices[0][1]} €"

        if price == 0.0:
            # Try ab-prefix prices
            price_raw, price_formatted = parse_price(text)
            price = price_raw

        if price == 0.0:
            continue

        # --- Offer count ---
        offer_count = 0
        offer_match = re.search(r"(\d+)\s*Angebot", text)
        if offer_match:
            offer_count = int(offer_match.group(1))

        # --- Image ---
        img = el.find("img")
        image_url = ""
        if img:
            image_url = img.get("src") or img.get("data-src") or img.get("data-lazy-src") or ""

        # --- Product URL ---
        product_url = ""
        link = el.find("a", href=True)
        if link:
            href = link["href"]
            product_url = href if href.startswith("http") else f"https://www.idealo.de{href}"

        # --- Specs ---
        combined_text = f"{name} {text}"
        specs = extract_specs(name, combined_text)

        products.append({
            "name": name,
            "model": model,
            "price": price,
            "priceFormatted": price_formatted,
            "imageUrl": image_url,
            "productUrl": product_url,
            "offerCount": offer_count,
            **specs,
        })

    return products


def main():
    try:
        products = scrape()

        if not products:
            print("\n⚠️  No products scraped. Check debug_idealo.html")
            return

        print(f"\nExtracted {len(products)} products from idealo.de:\n")
        print(f"{'Price':<14} | {'Name':<62} | {'CPU':<28} | {'RAM':<10} | {'Storage':<15} | Offers")
        print("-" * 145)
        for p in products:
            print(
                f"{p['priceFormatted']:<14} | "
                f"{p['name'][:60]:<62} | "
                f"{p['cpu'][:26]:<28} | "
                f"{p['ram']:<10} | "
                f"{p['storage']:<15} | "
                f"{p['offerCount']} offers"
            )

        # Write output files
        scraper_path = SCRAPER_DIR / "products_idealo.json"
        with open(scraper_path, "w", encoding="utf-8") as f:
            json.dump(products, f, indent=2, ensure_ascii=False)
        print(f"\nWritten {len(products)} products to {scraper_path}")

        SRC_DATA_DIR.mkdir(parents=True, exist_ok=True)
        src_path = SRC_DATA_DIR / "products_idealo.json"
        with open(src_path, "w", encoding="utf-8") as f:
            json.dump(products, f, indent=2, ensure_ascii=False)
        print(f"Written {len(products)} products to {src_path}")

    except Exception as e:
        print(f"Scraping failed: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

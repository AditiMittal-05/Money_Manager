"""
currency_utils.py — Live Exchange Rate Fetcher
================================================
Tries 3 free APIs in order (no API key needed for any of them).
If all fail (no internet), falls back to hardcoded approximate rates.
Rates are cached for 24 hours in data/currency_cache.json.
"""

import json
import time
import urllib.request
from pathlib import Path

CACHE_FILE = Path(__file__).parent.parent / "data" / "currency_cache.json"
CACHE_TTL  = 24 * 60 * 60  # 24 hours

# Currencies to show in the dashboard widget
DISPLAY_CURRENCIES = ["USD", "EUR", "GBP", "AED", "SGD", "CAD", "AUD", "JPY"]

# Hardcoded fallback — used only when ALL APIs fail
FALLBACK_RATES = {
    "USD": 0.012,  "EUR": 0.011,  "GBP": 0.0094,
    "AED": 0.044,  "SGD": 0.016,  "CAD": 0.016,
    "AUD": 0.018,  "JPY": 1.77
}


def _try_frankfurter() -> dict:
    """API 1: frankfurter.app (ECB data, very accurate)"""
    url = "https://api.frankfurter.app/latest?from=INR"
    with urllib.request.urlopen(url, timeout=6) as res:
        data = json.loads(res.read().decode())
    # response: { "base": "INR", "date": "...", "rates": { "USD": 0.012, ... } }
    return {"rates": data["rates"], "date": data.get("date", "")}


def _try_cdn_api() -> dict:
    """API 2: CDN-hosted currency data (Cloudflare CDN — almost never blocked)"""
    url = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/inr.json"
    with urllib.request.urlopen(url, timeout=6) as res:
        data = json.loads(res.read().decode())
    # response: { "date": "...", "inr": { "usd": 0.012, "eur": 0.011, ... } }
    raw = data.get("inr", {})
    # Convert lowercase keys to uppercase and filter to display currencies
    rates = {
        k.upper(): round(v, 6)
        for k, v in raw.items()
        if k.upper() in DISPLAY_CURRENCIES
    }
    return {"rates": rates, "date": data.get("date", "")}


def _try_open_er_api() -> dict:
    """API 3: open.er-api.com (free tier, no key needed)"""
    url = "https://open.er-api.com/v6/latest/INR"
    with urllib.request.urlopen(url, timeout=6) as res:
        data = json.loads(res.read().decode())
    # response: { "base_code": "INR", "time_last_update_utc": "...", "rates": { ... } }
    all_rates = data.get("rates", {})
    rates = {k: v for k, v in all_rates.items() if k in DISPLAY_CURRENCIES}
    return {"rates": rates, "date": data.get("time_last_update_utc", "")[:10]}


def _fetch_fresh_rates() -> dict:
    """Try each API in order. Return the first one that works."""
    apis = [
        ("frankfurter.app",   _try_frankfurter),
        ("CDN currency API",  _try_cdn_api),
        ("open.er-api.com",   _try_open_er_api),
    ]
    last_error = None
    for name, fn in apis:
        try:
            result = fn()
            print(f"[Currency] ✅ Fetched live rates from {name}")
            return result
        except Exception as e:
            print(f"[Currency] ⚠  {name} failed: {e}")
            last_error = e

    raise RuntimeError(f"All currency APIs failed. Last error: {last_error}")


def get_rates() -> dict:
    """
    Returns exchange rates with INR as base.
    Uses cache if < 24 hours old, else fetches fresh rates.
    Falls back to stale cache or hardcoded values if all APIs fail.
    """
    # ── Check cache ────────────────────────────────────────────────────────
    if CACHE_FILE.exists():
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                cache = json.load(f)
            age = time.time() - cache.get("fetched_at", 0)
            if age < CACHE_TTL:
                return cache   # cache is fresh ✅
        except Exception:
            pass

    # ── Fetch fresh rates ──────────────────────────────────────────────────
    try:
        data = _fetch_fresh_rates()
        result = {
            "base":       "INR",
            "date":       data.get("date", ""),
            "rates":      data["rates"],
            "fetched_at": time.time(),
            "stale":      False
        }
        # Save to cache
        CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2)
        return result

    except Exception as e:
        print(f"[Currency] ❌ All APIs failed — using fallback rates. {e}")

    # ── Return stale cache if available ───────────────────────────────────
    if CACHE_FILE.exists():
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                stale = json.load(f)
            stale["stale"] = True
            return stale
        except Exception:
            pass

    # ── Absolute fallback — hardcoded approximate rates ───────────────────
    return {
        "base":       "INR",
        "date":       "offline",
        "rates":      FALLBACK_RATES,
        "fetched_at": 0,
        "stale":      True
    }


def convert(amount: float, to_currency: str) -> float:
    """Convert an INR amount to another currency using live rates."""
    if to_currency == "INR":
        return amount
    rates = get_rates().get("rates", {})
    rate  = rates.get(to_currency)
    if rate is None:
        return amount
    return round(amount * rate, 2)

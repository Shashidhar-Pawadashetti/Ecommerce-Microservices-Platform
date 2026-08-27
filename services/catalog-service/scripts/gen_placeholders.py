"""One-shot generator for placeholder product SVG images.

Run once with ``python -m scripts.gen_placeholders`` from the service directory
to (re)generate the committed assets under ``static/products/prod-NNNN.svg``.
The generated SVGs are standalone valid SVG documents served as
``image/svg+xml`` by the StaticFiles mount at ``/catalog/static`` (Plan 01).

This script imports the canonical product list from ``scripts.seed`` so the
generated filenames and labels stay in sync with the seeded catalog. It is a
build-time tool only — never invoked at runtime.
"""
from __future__ import annotations

import os
from xml.sax.saxutils import escape

from scripts.seed import PRODUCTS

STATIC_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "static",
    "products",
)

# Palette per category so placeholders look intentional, not random.
BG = {
    "electronics": ("#0f172a", "#1e293b"),
    "accessories": ("#1a1030", "#2a1b4d"),
    "apparel": ("#052e1f", "#0b3d2c"),
    "home": ("#3a1f0a", "#4d2a12"),
}


def _svg(product_id: str, name: str, category: str) -> str:
    top, bottom = BG.get(category, ("#111827", "#1f2937"))
    label = escape(name)
    cat = escape(category)
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" '
        'width="400" height="300" viewBox="0 0 400 300">\n'
        f'  <defs>\n'
        f'    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">\n'
        f'      <stop offset="0%" stop-color="{top}"/>\n'
        f'      <stop offset="100%" stop-color="{bottom}"/>\n'
        f'    </linearGradient>\n'
        f'  </defs>\n'
        f'  <rect width="400" height="300" fill="url(#g)"/>\n'
        f'  <rect x="12" y="12" width="376" height="276" rx="18" fill="none" '
        f'stroke="#475569" stroke-width="2"/>\n'
        f'  <text x="200" y="146" fill="#e2e8f0" font-family="sans-serif" '
        f'font-size="22" font-weight="600" text-anchor="middle">{label}</text>\n'
        f'  <text x="200" y="178" fill="#94a3b8" font-family="sans-serif" '
        f'font-size="14" text-anchor="middle">{cat}</text>\n'
        f'  <text x="200" y="262" fill="#64748b" font-family="sans-serif" '
        f'font-size="12" text-anchor="middle">{escape(product_id)}</text>\n'
        f'</svg>\n'
    )


def generate() -> int:
    os.makedirs(STATIC_DIR, exist_ok=True)
    count = 0
    for row in PRODUCTS:
        path = os.path.join(STATIC_DIR, f"{row['id']}.svg")
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(_svg(row["id"], row["name"], row["category"]))
        count += 1
    return count


if __name__ == "__main__":
    n = generate()
    print(f"Generated {n} placeholder SVGs in {STATIC_DIR}")

"""Draws a synthetic receipt image for OCR testing. There's no real sample
receipt photo in this repo yet (only the CIMB bank statement) — this stands
in until one's available. Run directly to (re)write the fixture:
    python -m pipeline.tests.generate_sample_receipt
"""

import os

from PIL import Image, ImageDraw, ImageFont

FIXTURE_PATH = os.path.join(os.path.dirname(__file__), "fixtures", "sample_receipt.png")

RECEIPT_LINES = [
    "Guardian Pharmacy",
    "Mid Valley Megamall",
    "Date: 03/07/2026",
    "",
    "Panadol Extra x2      RM 18.90",
    "Vitamin C 1000mg      RM 32.50",
    "Face Mask Box         RM 15.00",
    "",
    "TOTAL           RM 66.40",
    "Cash Payment     RM 70.00",
    "Change            RM 3.60",
]


def generate(path: str = FIXTURE_PATH) -> str:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    width, height = 480, 40 + 32 * len(RECEIPT_LINES)
    img = Image.new("L", (width, height), color=255)
    draw = ImageDraw.Draw(img)
    font = ImageFont.load_default(size=22)
    y = 20
    for line in RECEIPT_LINES:
        draw.text((20, y), line, fill=0, font=font)
        y += 32
    img.save(path)
    return path


if __name__ == "__main__":
    print(generate())

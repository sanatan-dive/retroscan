#!/usr/bin/env python3
"""Generate PWA icons for RetroScan-AI."""

from PIL import Image, ImageDraw, ImageFont
import os

OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))

SIZES = [192, 512]
COLOR_TOP = (16, 185, 129)       # #10b981
COLOR_BOTTOM = (6, 182, 212)     # #06b6d4


def make_rounded_mask(size, radius):
    """Create a rounded-rectangle alpha mask."""
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return mask


def draw_gradient(img, color_top, color_bottom):
    """Fill image with a vertical linear gradient."""
    w, h = img.size
    pixels = img.load()
    for y in range(h):
        ratio = y / (h - 1)
        r = int(color_top[0] + (color_bottom[0] - color_top[0]) * ratio)
        g = int(color_top[1] + (color_bottom[1] - color_top[1]) * ratio)
        b = int(color_top[2] + (color_bottom[2] - color_top[2]) * ratio)
        for x in range(w):
            pixels[x, y] = (r, g, b, 255)


def generate_icon(size):
    """Generate a single icon at the given size."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))

    # Draw gradient background
    bg = Image.new("RGBA", (size, size))
    draw_gradient(bg, COLOR_TOP, COLOR_BOTTOM)

    # Apply rounded corners
    corner_radius = size // 5
    mask = make_rounded_mask(size, corner_radius)
    img = Image.composite(bg, img, mask)

    # Draw "RS" text
    draw = ImageDraw.Draw(img)
    font_size = int(size * 0.38)

    # Try to use a bold system font, fall back to default
    font = None
    bold_fonts = [
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/SFNSDisplay-Bold.otf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ]
    for font_path in bold_fonts:
        if os.path.exists(font_path):
            try:
                font = ImageFont.truetype(font_path, font_size)
                break
            except Exception:
                continue

    if font is None:
        font = ImageFont.load_default()

    text = "RS"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    x = (size - tw) / 2 - bbox[0]
    y = (size - th) / 2 - bbox[1]

    # Slight shadow for depth
    draw.text((x + size * 0.01, y + size * 0.01), text, fill=(0, 0, 0, 60), font=font)
    # Main white text
    draw.text((x, y), text, fill=(255, 255, 255, 255), font=font)

    out_path = os.path.join(OUTPUT_DIR, f"icon-{size}.png")
    img.save(out_path, "PNG")
    print(f"Created {out_path} ({size}x{size})")


if __name__ == "__main__":
    for s in SIZES:
        generate_icon(s)
    print("Done!")

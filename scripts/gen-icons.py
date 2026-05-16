#!/usr/bin/env python3
"""Generate PWA icon assets at multiple sizes."""
from PIL import Image, ImageDraw
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT  = ROOT / "public" / "icons"
OUT.mkdir(parents=True, exist_ok=True)

# Color palette
BG_OUTER   = (8,  16,  8)
BG_INNER   = (20, 40, 20)
SKULL      = (255, 70, 70)
SKULL_DARK = (140, 30, 30)
EYES       = (10, 10, 10)
TEETH      = (240, 240, 240)


def draw_icon(size: int, maskable: bool = False) -> Image.Image:
    img  = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d    = ImageDraw.Draw(img)
    s    = size
    pad  = int(s * (0.18 if maskable else 0.05))

    # Outer rounded square (safe area accounted for maskable icons)
    d.rounded_rectangle((0, 0, s, s), radius=int(s * 0.20), fill=BG_OUTER)
    d.rounded_rectangle((pad, pad, s - pad, s - pad), radius=int((s - 2 * pad) * 0.18), fill=BG_INNER)

    # Skull head (circle)
    skull_cx = s // 2
    skull_cy = int(s * 0.45)
    skull_r  = int(s * (0.26 if maskable else 0.32))
    d.ellipse(
        (skull_cx - skull_r, skull_cy - skull_r, skull_cx + skull_r, skull_cy + skull_r),
        fill=SKULL, outline=SKULL_DARK, width=max(2, s // 60),
    )

    # Eye sockets
    eye_r = int(skull_r * 0.28)
    eye_y = skull_cy - int(skull_r * 0.10)
    eye_dx = int(skull_r * 0.40)
    for ex in (-eye_dx, eye_dx):
        d.ellipse(
            (skull_cx + ex - eye_r, eye_y - eye_r, skull_cx + ex + eye_r, eye_y + eye_r),
            fill=EYES,
        )

    # Nose triangle
    nose_h = int(skull_r * 0.20)
    nose_w = int(skull_r * 0.12)
    nose_y = skull_cy + int(skull_r * 0.15)
    d.polygon(
        [
            (skull_cx, nose_y),
            (skull_cx - nose_w, nose_y + nose_h),
            (skull_cx + nose_w, nose_y + nose_h),
        ],
        fill=EYES,
    )

    # Jaw / teeth row
    jaw_y0 = skull_cy + int(skull_r * 0.45)
    jaw_y1 = skull_cy + int(skull_r * 0.85)
    jaw_x0 = skull_cx - int(skull_r * 0.55)
    jaw_x1 = skull_cx + int(skull_r * 0.55)
    d.rounded_rectangle((jaw_x0, jaw_y0, jaw_x1, jaw_y1), radius=int(skull_r * 0.10), fill=TEETH)
    tooth_count = 6
    tooth_w = (jaw_x1 - jaw_x0) / tooth_count
    for i in range(1, tooth_count):
        x = jaw_x0 + int(i * tooth_w)
        d.line((x, jaw_y0 + 2, x, jaw_y1 - 2), fill=SKULL_DARK, width=max(1, s // 200))

    return img


def main() -> None:
    sizes = [
        (192, "icon-192.png", False),
        (512, "icon-512.png", False),
        (512, "icon-512-maskable.png", True),
        (180, "apple-touch-icon.png", False),
        (32,  "favicon-32.png",  False),
    ]
    for size, name, maskable in sizes:
        icon = draw_icon(size, maskable)
        icon.save(OUT / name, "PNG", optimize=True)
        print(f"wrote {OUT / name}  ({size}x{size}{'  maskable' if maskable else ''})")


if __name__ == "__main__":
    main()

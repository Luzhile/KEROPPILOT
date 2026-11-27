"""Cut the supplied Keroppi stickers out of their backgrounds and re-map the
body/cheek colours onto the slider-frog palette, while keeping the original
red-and-white striped outfit and black bow tie.

Sources
  wave  – standing, arms out, white background
  hands – both hands on the cheeks, white background
  phone – holding a phone, sage-green background with a soft shadow
"""
import os
import numpy as np
from PIL import Image, ImageFilter

OUT = r"D:\WECHATCOPILOT\public\frogs"
os.makedirs(OUT, exist_ok=True)

SRC = {
    "wave": r"C:\Users\kl200\.dsh\attachments\v1\objects\73\739bab058a18d9e4dfed6178999853771a9d25873aa0035991c5a729f831f792",
    "hands": r"C:\Users\kl200\.dsh\attachments\v1\objects\ba\bafa4b43601bfbf7760bae6034569f26ecdbd12a890bff79da6ffe33b6aa8b46",
    "phone": r"C:\Users\kl200\.dsh\attachments\v1\objects\2d\2d837895d51dbe30c05f36e8bddf785055f95d7e6ba5b18c34508150d0b2c2fa",
}

BODY = (182, 229, 61)     # slider-frog body
CHEEK = (249, 168, 192)   # slider-frog cheek
INK = (16, 16, 14)
RED = (226, 30, 40)       # Keroppi's outfit, normalised across the stickers


def flood(seed_mask):
    """4-connected flood fill from the border over `seed_mask`."""
    h, w = seed_mask.shape
    visited = np.zeros((h, w), bool)
    stack = []
    for x in range(w):
        for y in (0, h - 1):
            if seed_mask[y, x]:
                stack.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if seed_mask[y, x]:
                stack.append((y, x))
    while stack:
        y, x = stack.pop()
        if visited[y, x] or not seed_mask[y, x]:
            continue
        visited[y, x] = True
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx]:
                stack.append((ny, nx))
    return visited


def key_out(rgb, mode):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    if mode == "white":
        seed = (r > 232) & (g > 232) & (b > 232)
    else:  # sage background + its soft shadow, but never the body or the outline
        seed = (b > 105) & (r > 120) & (g - r > 25)
    return flood(seed)


def recolour(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    out = rgb.copy()
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    cheek = (r > 180) & (b > 120) & (g < 200) & (r - g > 40) & (b - g > -10)
    # red outfit (stripes + bow) with its anti-aliased fringe, normalised
    red = (r - g > 45) & (r - b > 35) & (g < 150) & ~cheek
    red = np.asarray(Image.fromarray((red * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0
    red &= ~cheek
    body = (g > r) & (r > b) & (g > 90) & (b < 175) & (sat > 25) & ~cheek & ~red
    out[body] = BODY
    out[cheek] = CHEEK
    out[red] = RED
    return out


def largest_component(mask):
    h, w = mask.shape
    seen = np.zeros((h, w), bool)
    best = None
    for y0 in range(0, h, 3):
        for x0 in range(0, w, 3):
            if not mask[y0, x0] or seen[y0, x0]:
                continue
            stack = [(y0, x0)]
            comp = []
            while stack:
                y, x = stack.pop()
                if seen[y, x] or not mask[y, x]:
                    continue
                seen[y, x] = True
                comp.append((y, x))
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and not seen[ny, nx]:
                        stack.append((ny, nx))
            if best is None or len(comp) > len(best):
                best = comp
    out = np.zeros((h, w), bool)
    for y, x in best:
        out[y, x] = True
    return out


def label(mask):
    h, w = mask.shape
    seen = np.zeros((h, w), bool)
    comps = []
    for y0 in range(h):
        for x0 in range(w):
            if not mask[y0, x0] or seen[y0, x0]:
                continue
            stack = [(y0, x0)]
            comp = []
            while stack:
                y, x = stack.pop()
                if seen[y, x] or not mask[y, x]:
                    continue
                seen[y, x] = True
                comp.append((y, x))
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and not seen[ny, nx]:
                        stack.append((ny, nx))
            comps.append(comp)
    return comps


def drop_specks(rgb, alpha):
    """Erase tiny enclosed patches that are really leftover background."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    white = (r > 232) & (g > 232) & (b > 232) & (alpha > 0)
    comps = label(white)
    if not comps:
        return alpha
    biggest = max(len(c) for c in comps)
    out = alpha.copy()
    for comp in comps:
        if len(comp) < 0.06 * biggest:
            for y, x in comp:
                out[y, x] = 0
    return out


def build(name, mode, pad=8, ink=True, only_subject=False):
    img = Image.open(SRC[name]).convert("RGB")
    rgb = np.asarray(img).astype(np.int16)
    keep = ~key_out(rgb, mode)
    if only_subject:
        keep = largest_component(keep)
    out = recolour(rgb)
    alpha = np.where(keep, 255, 0).astype(np.uint8)

    ys, xs = np.nonzero(keep)
    y0, y1 = max(0, ys.min() - pad), min(rgb.shape[0], ys.max() + 1 + pad)
    x0, x1 = max(0, xs.min() - pad), min(rgb.shape[1], xs.max() + 1 + pad)
    out = out[y0:y1, x0:x1]
    alpha = alpha[y0:y1, x0:x1]

    # The silhouette is a solid black outline: paint its 4px rim ink so no
    # background fringe survives at small sizes.
    bg = Image.fromarray(np.where(alpha == 0, 255, 0).astype(np.uint8))
    band = (np.asarray(bg.filter(ImageFilter.MaxFilter(9))) > 0) & (alpha > 0)
    out = out.copy()
    out[band] = INK

    alpha = drop_specks(out, alpha)

    sprite = Image.fromarray(np.dstack([out.astype(np.uint8), alpha]), mode="RGBA")
    sprite.save(os.path.join(OUT, f"keroppi-{name}.png"), optimize=True)

    if ink:
        lum = out.mean(axis=2)
        ink_alpha = np.clip((118 - lum) / 46, 0, 1) * (alpha / 255.0)
        ink_rgba = np.dstack([
            np.full_like(ink_alpha, 255, dtype=np.uint8),
            np.full_like(ink_alpha, 255, dtype=np.uint8),
            np.full_like(ink_alpha, 255, dtype=np.uint8),
            (ink_alpha * 255).astype(np.uint8),
        ])
        Image.fromarray(ink_rgba.astype(np.uint8), mode="RGBA").save(
            os.path.join(OUT, f"keroppi-{name}-ink.png"), optimize=True)
    print(name, sprite.size)


build("wave", "white")
build("hands", "white", pad=6)
build("phone", "sage", pad=6, only_subject=True)

"""Build a proper Windows .ico from the supplied neon frog icon.

The artwork sits on a white background; Windows shows icons as squares, so we
key that white out to transparency and keep the rounded lime tile, then emit a
multi-size .ico (16→256) plus a 256 PNG for the bundle.
"""
import numpy as np
from PIL import Image, ImageFilter

SRC = r"C:\Users\kl200\.dsh\attachments\v1\objects\6c\6c4ddd1996d2be9ed8166a2ce72884f228e03062306fd6ad3ee8cb967fbaca6b"
OUT = r"D:\WECHATCOPILOT\src-tauri\icons"

img = Image.open(SRC).convert("RGB")
a = np.asarray(img).astype(np.int16)
h, w, _ = a.shape

white = (a[:, :, 0] > 238) & (a[:, :, 1] > 238) & (a[:, :, 2] > 238)
visited = np.zeros((h, w), bool)
stack = []
for x in range(w):
    for y in (0, h - 1):
        if white[y, x]:
            stack.append((y, x))
for y in range(h):
    for x in (0, w - 1):
        if white[y, x]:
            stack.append((y, x))
while stack:
    y, x = stack.pop()
    if visited[y, x] or not white[y, x]:
        continue
    visited[y, x] = True
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        ny, nx = y + dy, x + dx
        if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx]:
            stack.append((ny, nx))

alpha = np.where(visited, 0, 255).astype(np.uint8)
alpha_img = Image.fromarray(alpha).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.9))
rgba = Image.fromarray(np.dstack([a.astype(np.uint8), np.asarray(alpha_img)]), mode="RGBA")

# Square canvas with a little breathing room, then master size 1024.
side = max(rgba.size)
canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
canvas.paste(rgba, ((side - rgba.width) // 2, (side - rgba.height) // 2))

master = canvas.resize((1024, 1024), Image.LANCZOS)
master.save(f"{OUT}\\icon-source.png")
base = master.resize((256, 256), Image.LANCZOS)
base.save(f"{OUT}\\icon.png")

sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
base.save(f"{OUT}\\icon.ico", format="ICO", sizes=sizes)

print("saved", Image.open(f"{OUT}\\icon.ico").info.get("sizes"))
for size in (16, 32, 256):
    base.resize((size, size), Image.LANCZOS).save(rf"D:\WECHATCOPILOT\docs\ui\icon-{size}.png")

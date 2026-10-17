"""
Pamjet paraprake të widget-eve të Android-it (lista e widget-eve kur prindi mban gishtin në ekranin kryesor).
Vizatohen me të njëjtat ngjyra, tekste dhe rregullim si widgets/android-home/BebixWidget.tsx (tema e çelët).

    python scripts/build-widget-previews.py

Del: assets/widgets/preview-quick.png (4×2) dhe assets/widgets/preview-mini.png (2×2).
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONTS = ROOT / "node_modules/@expo-google-fonts/inter"
OUT = ROOT / "assets/widgets"
S = 3  # px për dp

BG, INK, SOFT = "#FFFFFF", "#1C1A16", "#565047"
FEED = ("#9E2C5B", "#F6DCE7")
DIAPER = ("#285F90", "#D9E7F2")
DIRTY = ("#845612", "#F3E4C8")
SLEEP = ("#692E81", "#E7DAEF")


def font(weight: str, size: float) -> ImageFont.FreeTypeFont:
    name = {"bold": "700Bold/Inter_700Bold.ttf", "semi": "600SemiBold/Inter_600SemiBold.ttf", "reg": "400Regular/Inter_400Regular.ttf"}[weight]
    return ImageFont.truetype(str(FONTS / name), round(size * S))


def box(d: ImageDraw.ImageDraw, x: float, y: float, w: float, h: float, r: float, fill: str) -> None:
    d.rounded_rectangle([x * S, y * S, (x + w) * S, (y + h) * S], radius=r * S, fill=fill)


def text(d: ImageDraw.ImageDraw, x: float, y: float, s: str, f: ImageFont.FreeTypeFont, fill: str, anchor: str = "la") -> None:
    d.text((x * S, y * S), s, font=f, fill=fill, anchor=anchor)


def canvas(w: int, h: int) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    img = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    box(d, 0, 0, w, h, 24, BG)
    return img, d


def quick() -> Image.Image:
    w, h, pad, gap = 300, 140, 8, 6
    img, d = canvas(w, h)
    cw = (w - 2 * pad - 2 * gap) / 3
    ch = h - 2 * pad - gap - 40
    cells = [
        (FEED, "Ushqimi", "09:40", "Biberon"),
        (DIAPER, "Pelena", "10:15", "E lagur"),
        (SLEEP, "Gjumi", "08:30", "U zgjua"),
    ]
    for i, ((tint, bg), label, value, detail) in enumerate(cells):
        x = pad + i * (cw + gap)
        box(d, x, pad, cw, ch, 16, bg)
        cy = pad + ch / 2
        text(d, x + 10, cy - 22, label, font("bold", 11), tint)
        text(d, x + 10, cy - 8, value, font("bold", 17), INK)
        text(d, x + 10, cy + 12, detail, font("reg", 11), SOFT)
    aw = (w - 2 * pad - 3 * gap) / 4
    ay = pad + ch + gap
    for i, ((tint, bg), label) in enumerate([(FEED, "Ushqim"), (DIAPER, "E lagur"), (DIRTY, "Jashtëqitje"), (SLEEP, "Fli")]):
        x = pad + i * (aw + gap)
        box(d, x, ay, aw, 40, 14, bg)
        text(d, x + aw / 2, ay + 20, label, font("bold", 12), tint, "mm")
    return img


def mini() -> Image.Image:
    w = h = 150
    img, d = canvas(w, h)
    text(d, 14, 14, "Bebix · Ana", font("bold", 12), INK)
    rows = [(FEED, "Ushqimi", "09:40"), (DIAPER, "Pelena", "10:15"), (SLEEP, "Gjumi", "08:30")]
    top, rh = 38, (h - 38 - 12) / 3
    for i, ((tint, _), label, value) in enumerate(rows):
        cy = top + i * rh + rh / 2
        d.ellipse([(14) * S, (cy - 4) * S, (22) * S, (cy + 4) * S], fill=tint)
        text(d, 30, cy, label, font("semi", 12), SOFT, "lm")
        text(d, w - 14, cy, value, font("bold", 15), INK, "rm")
    return img


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    quick().save(OUT / "preview-quick.png", optimize=True)
    mini().save(OUT / "preview-mini.png", optimize=True)
    print("ok", OUT)

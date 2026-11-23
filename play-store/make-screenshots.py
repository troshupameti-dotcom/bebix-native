"""Fotot e dyqanit (Google Play / App Store) nga screenshot-et e telefonit.

1. Bëj screenshot në telefon (pamja e çelët, me të dhëna prove, pa emra të vërtetë klientësh) dhe ruaji te
   `play-store/screenshots/raw/` me emrat 01.png … 08.png (radha është ajo e dyqanit).
2. Nga rrënja e projektit:  python play-store/make-screenshots.py
3. Fotot e gatshme dalin te `play-store/screenshots/out/` (1080×1920, PNG) me titullin sipër, në ngjyrat e TROA-s.

Titujt janë te CAPTIONS më poshtë (shqip dhe anglisht); `--en` i nxjerr në anglisht te `out-en/`.
Duhet vetëm Pillow (`pip install pillow`), që e ke tashmë.
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent
RAW = ROOT / "screenshots" / "raw"
EN = "--en" in sys.argv
OUT = ROOT / "screenshots" / ("out-en" if EN else "out")
FONTS = ROOT.parent / "node_modules" / "@expo-google-fonts"
TITLE_FONT = FONTS / "lora" / "500Medium" / "Lora_500Medium.ttf"
SUB_FONT = FONTS / "inter" / "500Medium" / "Inter_500Medium.ttf"

OLIVE = (88, 87, 45)
CREAM = (247, 237, 229)
CREAM_TEXT = (247, 224, 182)
W, H = 1080, 1920

# (titulli, nëntitulli) për çdo foto, në radhën 01 … 08
CAPTIONS = {
    "sq": [
        ("Gjithë dita e bebit, me një shikim", "Ushqimi, pelenat dhe gjumi me një prekje"),
        ("Natën, me një dorë", "Butona të mëdhenj, ekran i errët, dritë e butë"),
        ("Rritja, javë pas jave", "Pesha dhe gjatësia në grafikë të qartë"),
        ("Çfarë t'i gatuaj sot?", "Receta dhe ushqimet e para sipas moshës"),
        ("Përralla për gjumë", "Një libër i ri çdo javë"),
        ("Dyqani për bebe", "Marka të njohura, dërgesë në shtëpi"),
        ("Prindër dhe ekspertë", "Pyet, ndaj dhe lexo këshilla"),
        ("E gjithë familja bashkë", "Prindërit dhe gjyshërit shohin të njëjtat të dhëna"),
    ],
    "en": [
        ("Your baby's whole day at a glance", "Feeding, diapers and sleep in one tap"),
        ("One-handed at night", "Big buttons, dark screen, soft light"),
        ("Growth, week by week", "Weight and height on clear charts"),
        ("What should I cook today?", "Recipes and first foods by age"),
        ("Bedtime stories", "A new book every week"),
        ("The baby shop", "Trusted brands, delivered home"),
        ("Parents and experts", "Ask, share and read tips"),
        ("The whole family together", "Parents and grandparents see the same data"),
    ],
}


def rounded(img: Image.Image, radius: int) -> Image.Image:
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, img.width - 1, img.height - 1), radius=radius, fill=255)
    out = img.convert("RGBA")
    out.putalpha(mask)
    return out


def wrap(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, width: int) -> list[str]:
    lines, line = [], ""
    for word in text.split():
        trial = f"{line} {word}".strip()
        if draw.textlength(trial, font=font) <= width or not line:
            line = trial
        else:
            lines.append(line)
            line = word
    return lines + [line]


def make(src: Path, title: str, sub: str, dark: bool) -> Image.Image:
    bg_col, title_col, sub_col = (OLIVE, CREAM_TEXT, (226, 214, 180)) if dark else (CREAM, OLIVE, (110, 108, 80))
    canvas = Image.new("RGB", (W, H), bg_col)
    draw = ImageDraw.Draw(canvas)
    tf = ImageFont.truetype(str(TITLE_FONT), 74)
    sf = ImageFont.truetype(str(SUB_FONT), 38)

    y = 120
    for ln in wrap(draw, title, tf, W - 160):
        draw.text((W / 2, y), ln, font=tf, fill=title_col, anchor="mt")
        y += 92
    y += 14
    for ln in wrap(draw, sub, sf, W - 200):
        draw.text((W / 2, y), ln, font=sf, fill=sub_col, anchor="mt")
        y += 52

    # screenshot-i: i zvogëluar që të hyjë poshtë titujve, me cepa të rrumbullakët dhe hije të butë
    shot = Image.open(src).convert("RGB")
    top = y + 60
    max_h, max_w = H - top - 60, W - 200
    scale = min(max_w / shot.width, max_h / shot.height)
    shot = shot.resize((round(shot.width * scale), round(shot.height * scale)), Image.LANCZOS)
    shot = rounded(shot, 46)
    x = (W - shot.width) // 2
    shadow = Image.new("RGBA", (shot.width + 120, shot.height + 120), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((60, 70, shot.width + 60, shot.height + 70), radius=46, fill=(0, 0, 0, 90))
    shadow = shadow.filter(ImageFilter.GaussianBlur(28))
    canvas.paste(shadow, (x - 60, top - 60), shadow)
    canvas.paste(shot, (x, top), shot)
    return canvas


def main() -> None:
    files = sorted(p for p in RAW.glob("*") if p.suffix.lower() in (".png", ".jpg", ".jpeg"))
    if not files:
        print(f"S'ka foto te {RAW}. Vendosi screenshot-et si 01.png, 02.png …")
        return
    OUT.mkdir(parents=True, exist_ok=True)
    caps = CAPTIONS["en" if EN else "sq"]
    for i, src in enumerate(files):
        title, sub = caps[i % len(caps)]
        # foto e dytë (nata) mbi ulli, të tjerat mbi krem, që të mos duken të gjitha njësoj
        img = make(src, title, sub, dark=(i % 4 == 1))
        dst = OUT / f"{i + 1:02d}.png"
        img.save(dst, optimize=True)
        print("gati:", dst.relative_to(ROOT.parent))


if __name__ == "__main__":
    main()

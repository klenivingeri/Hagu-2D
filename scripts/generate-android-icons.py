"""Gera os icones do app Android (mipmap-*dpi) a partir de
public/icons/android-chrome-512x512.png, sem depender de rede (sharp/
@capacitor/assets falharam por causa da mesma instabilidade de IPv6 do
ambiente que afetou o download do Gradle). Rodar de novo sempre que o icone
de origem mudar: python scripts/generate-android-icons.py
"""
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(ROOT, 'public', 'icons', 'android-chrome-512x512.png')
RES = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')

# density -> tamanho do icone "legacy" (ic_launcher/ic_launcher_round)
LEGACY_SIZES = {
    'mipmap-mdpi': 48,
    'mipmap-hdpi': 72,
    'mipmap-xhdpi': 96,
    'mipmap-xxhdpi': 144,
    'mipmap-xxxhdpi': 192,
}

# density -> tamanho do canvas do icone adaptativo (108dp de base)
FOREGROUND_SIZES = {
    'mipmap-mdpi': 108,
    'mipmap-hdpi': 162,
    'mipmap-xhdpi': 216,
    'mipmap-xxhdpi': 324,
    'mipmap-xxxhdpi': 432,
}

# So ~66% do canvas do icone adaptativo fica visivel (o resto e cortado
# pela mascara do sistema - circulo, squircle, etc conforme o launcher do
# aparelho) - por isso o logo entra ENCOLHIDO e centralizado, nunca esticado
# até a borda do canvas.
FOREGROUND_LOGO_RATIO = 0.62


def make_round(img):
    size = img.size
    mask = Image.new('L', size, 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, size[0], size[1]), fill=255)
    rounded = Image.new('RGBA', size, (0, 0, 0, 0))
    rounded.paste(img, (0, 0), mask)
    return rounded


def main():
    source = Image.open(SOURCE).convert('RGBA')

    for folder, size in LEGACY_SIZES.items():
        out_dir = os.path.join(RES, folder)
        os.makedirs(out_dir, exist_ok=True)
        resized = source.resize((size, size), Image.LANCZOS)
        resized.save(os.path.join(out_dir, 'ic_launcher.png'))
        make_round(resized).save(os.path.join(out_dir, 'ic_launcher_round.png'))
        print(f'{folder}: ic_launcher.png / ic_launcher_round.png ({size}x{size})')

    for folder, canvas_size in FOREGROUND_SIZES.items():
        out_dir = os.path.join(RES, folder)
        os.makedirs(out_dir, exist_ok=True)
        logo_size = round(canvas_size * FOREGROUND_LOGO_RATIO)
        logo = source.resize((logo_size, logo_size), Image.LANCZOS)
        canvas = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
        offset = ((canvas_size - logo_size) // 2, (canvas_size - logo_size) // 2)
        canvas.paste(logo, offset, logo)
        canvas.save(os.path.join(out_dir, 'ic_launcher_foreground.png'))
        print(f'{folder}: ic_launcher_foreground.png ({canvas_size}x{canvas_size}, logo {logo_size}x{logo_size})')


if __name__ == '__main__':
    main()

import os
import sys
import numpy as np
from PIL import Image

def generate_all_icons():
    src_path = r'C:\Users\H P\.gemini\antigravity-ide\brain\00fd1810-122e-4f52-afb1-416f9cf1e32d\.user_uploaded\media_1791296704387.jpg'
    img = Image.open(src_path).convert('RGB')
    w, h = img.size

    # Clean squircle mask with exact exponent n = 4.8
    cx, cy = 512.0, 512.0
    a = 366.0
    n = 4.8

    xx, yy = np.meshgrid(np.linspace(0, w - 1, w * 2), np.linspace(0, h - 1, h * 2))
    dx = np.abs(xx - cx)
    dy = np.abs(yy - cy)
    dist_val = (dx / a) ** n + (dy / a) ** n

    mask_arr = np.clip((1.008 - dist_val) / 0.02, 0.0, 1.0) * 255.0
    mask_hr = Image.fromarray(mask_arr.astype(np.uint8), mode='L')
    alpha_mask = mask_hr.resize((w, h), Image.Resampling.LANCZOS)

    rgba = img.convert('RGBA')
    rgba.putalpha(alpha_mask)

    bbox = rgba.getbbox()
    cropped = rgba.crop(bbox)

    side = max(cropped.width, cropped.height)
    pad = int(side * 0.08) # 8% margin for OS docks and taskbars
    target_canvas = side + 2 * pad

    canvas = Image.new('RGBA', (target_canvas, target_canvas), (0, 0, 0, 0))
    paste_x = (target_canvas - cropped.width) // 2
    paste_y = (target_canvas - cropped.height) // 2
    canvas.paste(cropped, (paste_x, paste_y), cropped)

    icon_1024 = canvas.resize((1024, 1024), Image.Resampling.LANCZOS)

    # Directories
    build_dir = r'c:\Dev\OS11\build'
    icons_dir = os.path.join(build_dir, 'icons')
    public_dir = r'c:\Dev\OS11\public'

    os.makedirs(build_dir, exist_ok=True)
    os.makedirs(icons_dir, exist_ok=True)
    os.makedirs(public_dir, exist_ok=True)

    # 1. Linux / general size exports
    sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024]
    for s in sizes:
        resized = icon_1024.resize((s, s), Image.Resampling.LANCZOS)
        resized.save(os.path.join(icons_dir, f'{s}x{s}.png'), 'PNG')

    # 2. Main PNG icons
    icon_512 = icon_1024.resize((512, 512), Image.Resampling.LANCZOS)
    icon_512.save(os.path.join(build_dir, 'icon.png'), 'PNG')
    icon_512.save(os.path.join(public_dir, 'icon.png'), 'PNG')

    # 3. Windows ICO icons (multi-size: 16, 24, 32, 48, 64, 128, 256)
    ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    icon_1024.save(os.path.join(build_dir, 'icon.ico'), format='ICO', sizes=ico_sizes)
    icon_1024.save(os.path.join(public_dir, 'icon.ico'), format='ICO', sizes=ico_sizes)

    # 4. Favicon (16, 32, 48)
    favicon_sizes = [(16, 16), (32, 32), (48, 48)]
    icon_1024.save(os.path.join(public_dir, 'favicon.ico'), format='ICO', sizes=favicon_sizes)

    # 5. macOS ICNS icon
    try:
        icon_1024.save(os.path.join(build_dir, 'icon.icns'), format='ICNS')
        print("Generated ICNS successfully.")
    except Exception as e:
        print("ICNS export note:", e)

    print("All app icons successfully generated!")

if __name__ == '__main__':
    generate_all_icons()

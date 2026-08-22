import os
import numpy as np
from PIL import Image

def process_user_surlignage():
    src_path = r'C:\Users\adrie\Downloads\surlignage.png'
    if not os.path.exists(src_path):
        print(f"Source file not found at {src_path}")
        return

    src_img = Image.open(src_path).convert('RGBA')
    bbox = src_img.getbbox()
    print(f"Tight bounding box: {bbox}")
    cropped = src_img.crop(bbox)

    arr = np.array(cropped, dtype=float)
    h, w, _ = arr.shape
    print(f"Cropped dimensions: {w} x {h}")

    # Extract native alpha and normalized texture intensity
    raw_alpha = arr[:, :, 3] / 255.0  # 0.0 to 1.0

    # Calculate internal texture/fiber variance from RGB (luminance)
    # The source is yellow, so B channel represents pigment absorption depth
    b_channel = arr[:, :, 2] / 255.0
    # Where ink is dense, B is lower (~0.58). Where paper is light, B is higher (~0.95).
    ink_density = 1.0 - (b_channel - 0.55) / 0.45
    ink_density = np.clip(ink_density, 0.2, 1.2)

    # Combined alpha with fiber texture
    textured_alpha = raw_alpha * ink_density
    # Normalize
    textured_alpha = np.clip(textured_alpha / (textured_alpha.max() + 1e-5), 0.0, 1.0)

    # 6 Colors definitions
    colors = {
        'yellow': {
            'light_rgb': (245, 195, 20),
            'light_opacity': 0.82,
            'dark_rgb': (250, 204, 21),
            'dark_opacity': 0.42,
            'dark_text': '#FEF9C3'
        },
        'green': {
            'light_rgb': (34, 197, 94),
            'light_opacity': 0.80,
            'dark_rgb': (74, 222, 128),
            'dark_opacity': 0.40,
            'dark_text': '#DCFCE7'
        },
        'blue': {
            'light_rgb': (14, 165, 233),
            'light_opacity': 0.80,
            'dark_rgb': (56, 189, 248),
            'dark_opacity': 0.42,
            'dark_text': '#E0F2FE'
        },
        'amber': {
            'light_rgb': (249, 115, 22),
            'light_opacity': 0.80,
            'dark_rgb': (251, 146, 60),
            'dark_opacity': 0.42,
            'dark_text': '#FFEDD5'
        },
        'purple': {
            'light_rgb': (168, 85, 247),
            'light_opacity': 0.80,
            'dark_rgb': (192, 132, 252),
            'dark_opacity': 0.42,
            'dark_text': '#F3E8FF'
        },
        'rose': {
            'light_rgb': (244, 63, 94),
            'light_opacity': 0.80,
            'dark_rgb': (251, 113, 133),
            'dark_opacity': 0.42,
            'dark_text': '#FFE4E6'
        }
    }

    out_light_dir = 'web/img/textures/light'
    out_dark_dir = 'web/img/textures/dark'
    os.makedirs(out_light_dir, exist_ok=True)
    os.makedirs(out_dark_dir, exist_ok=True)

    # Modes: single, start, mid, end
    for mode in ['single', 'start', 'mid', 'end']:
        if mode == 'single':
            mode_alpha = textured_alpha.copy()
        elif mode == 'start':
            mode_alpha = textured_alpha.copy()
            # Bridge right 10% smoothly into flat full stroke
            cut = int(w * 0.90)
            target_slice = np.median(mode_alpha[:, cut-10:cut], axis=1, keepdims=True)
            for x in range(cut, w):
                t = (x - cut) / (w - cut)
                mode_alpha[:, x] = (1 - t) * mode_alpha[:, x] + t * target_slice[:, 0]
        elif mode == 'mid':
            # Middle 60%
            cut_l = int(w * 0.20)
            cut_r = int(w * 0.80)
            mode_alpha = textured_alpha[:, cut_l:cut_r].copy()
        elif mode == 'end':
            mode_alpha = textured_alpha.copy()
            # Bridge left 10% smoothly from flat full stroke
            cut = int(w * 0.10)
            target_slice = np.median(mode_alpha[:, cut:cut+10], axis=1, keepdims=True)
            for x in range(cut):
                t = x / cut
                mode_alpha[:, x] = (1 - t) * target_slice[:, 0] + t * mode_alpha[:, x]

        mh, mw = mode_alpha.shape

        for name, cinfo in colors.items():
            # Light Mode PNG
            lr, lg, lb = cinfo['light_rgb']
            l_img = np.zeros((mh, mw, 4), dtype=np.uint8)
            l_img[:, :, 0] = lr
            l_img[:, :, 1] = lg
            l_img[:, :, 2] = lb
            l_img[:, :, 3] = (np.clip(mode_alpha * cinfo['light_opacity'], 0, 1) * 255).astype(np.uint8)
            Image.fromarray(l_img, mode='RGBA').save(os.path.join(out_light_dir, f'marker_{name}_{mode}.png'))

            # Dark Mode PNG
            dr, dg, db = cinfo['dark_rgb']
            d_img = np.zeros((mh, mw, 4), dtype=np.uint8)
            d_img[:, :, 0] = dr
            d_img[:, :, 1] = dg
            d_img[:, :, 2] = db
            d_img[:, :, 3] = (np.clip(mode_alpha * cinfo['dark_opacity'], 0, 1) * 255).astype(np.uint8)
            Image.fromarray(d_img, mode='RGBA').save(os.path.join(out_dark_dir, f'marker_{name}_{mode}.png'))

    print(f"Successfully generated all textures from {src_path}!")

if __name__ == '__main__':
    process_user_surlignage()

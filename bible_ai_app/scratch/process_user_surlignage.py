import os
import numpy as np
from PIL import Image

def process_user_surlignage_perfect_seamless():
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
    b_channel = arr[:, :, 2] / 255.0
    ink_density = 1.0 - (b_channel - 0.55) / 0.45
    ink_density = np.clip(ink_density, 0.2, 1.2)

    # Combined alpha with fiber texture
    textured_alpha = raw_alpha * ink_density
    textured_alpha = np.clip(textured_alpha / (textured_alpha.max() + 1e-5), 0.0, 1.0)

    # Compute a universal middle slice (median across 40px in center)
    mid_start = int(w * 0.45)
    mid_end = int(w * 0.55)
    universal_mid_slice = np.median(textured_alpha[:, mid_start:mid_end], axis=1) # shape (h,)

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

    # 1. Mode 'single' (Full standalone stroke with natural start & end)
    single_alpha = textured_alpha.copy()

    # 2. Mode 'start' (Natural start tip, blends smoothly into universal_mid_slice at the right edge)
    start_alpha = textured_alpha[:, :mid_end].copy()
    sw = start_alpha.shape[1]
    blend_len = int(sw * 0.40)
    blend_start = sw - blend_len
    for i, x in enumerate(range(blend_start, sw)):
        t = (i + 1) / blend_len  # 0 to 1
        # Smooth cosine interpolation
        t_cos = 0.5 * (1 - np.cos(np.pi * t))
        start_alpha[:, x] = (1 - t_cos) * start_alpha[:, x] + t_cos * universal_mid_slice

    # Ensure the last column is strictly identical to universal_mid_slice
    start_alpha[:, -1] = universal_mid_slice

    # 3. Mode 'end' (Starts strictly from universal_mid_slice, blends smoothly into natural end tip)
    end_alpha = textured_alpha[:, mid_start:].copy()
    ew = end_alpha.shape[1]
    blend_len = int(ew * 0.40)
    for x in range(blend_len):
        t = (blend_len - x) / blend_len  # 1 to 0
        t_cos = 0.5 * (1 - np.cos(np.pi * t))
        end_alpha[:, x] = t_cos * universal_mid_slice + (1 - t_cos) * end_alpha[:, x]

    # Ensure the first column is strictly identical to universal_mid_slice
    end_alpha[:, 0] = universal_mid_slice

    # 4. Mode 'mid' (Pure middle texture, both left and right edges blend to universal_mid_slice)
    mid_alpha = textured_alpha[:, mid_start:mid_end].copy()
    mw = mid_alpha.shape[1]
    mid_blend = int(mw * 0.30)
    for x in range(mid_blend):
        t = (mid_blend - x) / mid_blend
        t_cos = 0.5 * (1 - np.cos(np.pi * t))
        mid_alpha[:, x] = t_cos * universal_mid_slice + (1 - t_cos) * mid_alpha[:, x]
    for i, x in enumerate(range(mw - mid_blend, mw)):
        t = (i + 1) / mid_blend
        t_cos = 0.5 * (1 - np.cos(np.pi * t))
        mid_alpha[:, x] = (1 - t_cos) * mid_alpha[:, x] + t_cos * universal_mid_slice
    mid_alpha[:, 0] = universal_mid_slice
    mid_alpha[:, -1] = universal_mid_slice

    alpha_modes = {
        'single': single_alpha,
        'start': start_alpha,
        'mid': mid_alpha,
        'end': end_alpha
    }

    # Verify mathematical perfection:
    diff_start_end = np.abs(start_alpha[:, -1] - end_alpha[:, 0]).max()
    diff_start_mid = np.abs(start_alpha[:, -1] - mid_alpha[:, 0]).max()
    diff_mid_end = np.abs(mid_alpha[:, -1] - end_alpha[:, 0]).max()
    print(f"Verification - Max difference start->end: {diff_start_end}")
    print(f"Verification - Max difference start->mid: {diff_start_mid}")
    print(f"Verification - Max difference mid->end: {diff_mid_end}")

    for mode, m_alpha in alpha_modes.items():
        mh, mw = m_alpha.shape
        for name, cinfo in colors.items():
            # Light Mode PNG
            lr, lg, lb = cinfo['light_rgb']
            l_img = np.zeros((mh, mw, 4), dtype=np.uint8)
            l_img[:, :, 0] = lr
            l_img[:, :, 1] = lg
            l_img[:, :, 2] = lb
            l_img[:, :, 3] = (np.clip(m_alpha * cinfo['light_opacity'], 0, 1) * 255).astype(np.uint8)
            Image.fromarray(l_img, mode='RGBA').save(os.path.join(out_light_dir, f'marker_{name}_{mode}.png'))

            # Dark Mode PNG
            dr, dg, db = cinfo['dark_rgb']
            d_img = np.zeros((mh, mw, 4), dtype=np.uint8)
            d_img[:, :, 0] = dr
            d_img[:, :, 1] = dg
            d_img[:, :, 2] = db
            d_img[:, :, 3] = (np.clip(m_alpha * cinfo['dark_opacity'], 0, 1) * 255).astype(np.uint8)
            Image.fromarray(d_img, mode='RGBA').save(os.path.join(out_dark_dir, f'marker_{name}_{mode}.png'))

    print("Successfully generated all mathematically seamless textures!")

if __name__ == '__main__':
    process_user_surlignage_perfect_seamless()

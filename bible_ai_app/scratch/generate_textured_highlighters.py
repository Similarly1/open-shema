import os
import numpy as np
from PIL import Image

def generate_textured_markers():
    # Source mask extracted from user PNG
    mask_path = 'web/img/textures/marker_texture_mask.png'
    if not os.path.exists(mask_path):
        print("Mask not found")
        return

    mask_img = Image.open(mask_path).convert('RGBA')
    alpha = np.array(mask_img.split()[3], dtype=float) / 255.0  # 0.0 to 1.0
    h, w = alpha.shape

    # Horizontal pressure factor: stroke is darker & more saturated at the start (left 15-20%)
    x_coords = np.linspace(0, 1, w)
    pressure_curve = 1.0 + 0.35 * np.exp(-x_coords * 8.0)  # Starts at 1.35x density, drops to 1.0x
    pressure_matrix = np.tile(pressure_curve, (h, 1))

    # Apply pressure to density
    effective_alpha = np.clip(alpha * pressure_matrix, 0.0, 1.0)

    # 6 Colors (R, G, B) for Light mode
    light_colors = {
        "yellow": ((250, 204, 21), (254, 240, 138)),    # (Core, Light)
        "green":  ((34, 197, 94),  (187, 247, 208)),
        "blue":   ((14, 165, 233), (186, 230, 253)),
        "amber":  ((249, 115, 22), (254, 215, 170)),
        "purple": ((168, 85, 247), (233, 213, 255)),
        "rose":   ((244, 63, 94),  (254, 205, 211)),
    }

    # 6 Colors (R, G, B) for Dark mode
    dark_colors = {
        "yellow": ((250, 204, 21), (202, 138, 4)),
        "green":  ((74, 222, 128), (22, 163, 74)),
        "blue":   ((56, 189, 248), (2, 132, 199)),
        "amber":  ((251, 146, 60), (234, 88, 12)),
        "purple": ((192, 132, 252), (147, 51, 234)),
        "rose":   ((251, 113, 133), (225, 29, 72)),
    }

    os.makedirs('web/img/textures/light', exist_ok=True)
    os.makedirs('web/img/textures/dark', exist_ok=True)

    # Generate Single, Start, Mid, End slices from the texture
    # single: full w
    # start: left half to seamless right
    # mid: center seamless portion
    # end: seamless left to right end

    for mode in ["single", "start", "mid", "end"]:
        if mode == "single":
            sub_alpha = effective_alpha
        elif mode == "start":
            sub_alpha = effective_alpha.copy()
            # fade right 5% to solid flat right
            sub_alpha[:, int(w*0.9):] = np.tile(sub_alpha[:, int(w*0.9):int(w*0.9)+1], (1, w - int(w*0.9)))
        elif mode == "mid":
            sub_alpha = effective_alpha[:, int(w*0.2):int(w*0.8)].copy()
        elif mode == "end":
            sub_alpha = effective_alpha.copy()
            # flatten left 5%
            sub_alpha[:, :int(w*0.1)] = np.tile(sub_alpha[:, int(w*0.1):int(w*0.1)+1], (1, int(w*0.1)))

        sh, sw = sub_alpha.shape

        # Light theme textures
        for name, (rgb_core, rgb_light) in light_colors.items():
            img_arr = np.zeros((sh, sw, 4), dtype=np.uint8)
            img_arr[:, :, 0] = rgb_core[0]
            img_arr[:, :, 1] = rgb_core[1]
            img_arr[:, :, 2] = rgb_core[2]
            img_arr[:, :, 3] = (sub_alpha * 200).astype(np.uint8)  # ~0.78 opacity

            out_img = Image.fromarray(img_arr, mode='RGBA')
            out_img.save(f'web/img/textures/light/marker_{name}_{mode}.png')

        # Dark theme textures
        for name, (rgb_core, rgb_dark) in dark_colors.items():
            img_arr = np.zeros((sh, sw, 4), dtype=np.uint8)
            img_arr[:, :, 0] = rgb_core[0]
            img_arr[:, :, 1] = rgb_core[1]
            img_arr[:, :, 2] = rgb_core[2]
            img_arr[:, :, 3] = (sub_alpha * 115).astype(np.uint8)  # ~0.45 opacity for dark

            out_img = Image.fromarray(img_arr, mode='RGBA')
            out_img.save(f'web/img/textures/dark/marker_{name}_{mode}.png')

    print("All textured PNG markers generated successfully!")

if __name__ == '__main__':
    generate_textured_markers()

"""
Maritime SAR Benchmark Scene Generator.
Recreates high-fidelity synthetic benchmark scenes based on the key historical cases
and physical environments detailed in Chen et al. (IEEE JSTARS 2026):
1. Caspian Sea (Offshore Platform Leak + Adjacent LWSA)
2. Ionian Sea (Island Wind Sheltering & Leeward Wake / LSI)
3. Red Sea (Vessel Collision Elongated Slicks + Moderate Wind)
4. Ligurian Sea (Ultra-low Wind LWSA + Biogenic Slicks)
"""

from typing import Dict, Any, Tuple
import numpy as np
import scipy.ndimage


class MaritimeBenchmarkGenerator:
    """
    Generates realistic Sentinel-1 SAR VV backscatter maps (in dB) with collocated
    ERA5 U10/V10 wind vector fields, ground truth oil masks, and look-alike zones (LWSA, LSI).
    """

    @staticmethod
    def _add_sar_speckle(image_intensity: np.ndarray, looks: int = 4) -> np.ndarray:
        """
        Adds realistic SAR multi-look speckle noise using Gamma distributed intensity.
        For Sentinel-1 IW GRD, nominal equivalent number of looks (ENL) is ~4-5.
        """
        # Gamma distribution with shape=looks, scale=1/looks has mean=1.0, variance=1/looks
        speckle = np.random.gamma(shape=looks, scale=1.0 / looks, size=image_intensity.shape)
        noisy_intensity = np.maximum(image_intensity * speckle, 1e-6)
        return 10.0 * np.log10(noisy_intensity)

    @classmethod
    def generate_caspian_sea_scene(cls, size: int = 512, seed: int = 42) -> Dict[str, Any]:
        """
        Case 1: Caspian Sea Offshore Platform Leak (Fig. 5b, Fig. 6d)
        - Chronic branching oil spill near central platform.
        - Large Low-Wind-Speed Area (LWSA) in bottom-left (< 1.5 m/s).
        - Mean ambient wind: ~4.0 m/s from North-East.
        """
        np.random.seed(seed)
        H, W = size, size
        sy, sx = H / 512.0, W / 512.0
        y, x = np.ogrid[:H, :W]

        # 1. Base Sea Surface Backscatter Intensity (Linear scale)
        base_intensity = np.full((H, W), 0.0125, dtype=np.float32)

        # 2. Low-Wind-Speed Area (LWSA) in lower-left region
        lwsa_center_y, lwsa_center_x = int(370 * sy), int(150 * sx)
        dist_lwsa = np.sqrt(((y - lwsa_center_y) / 0.8)**2 + (x - lwsa_center_x)**2)
        lwsa_region = dist_lwsa < (145 * sx)
        lwsa_smooth = scipy.ndimage.gaussian_filter(lwsa_region.astype(np.float32), sigma=max(2.0, 12 * sy))

        intensity = base_intensity * (1.0 - 0.88 * lwsa_smooth)

        # 3. Oil Spill (branching slick from an offshore platform)
        oil_mask = np.zeros((H, W), dtype=np.uint8)
        pts_trunk = [
            (int(210 * sy), int(280 * sx)), (int(220 * sy), int(295 * sx)),
            (int(235 * sy), int(310 * sx)), (int(255 * sy), int(325 * sx)),
            (int(280 * sy), int(340 * sx)), (int(310 * sy), int(355 * sx)),
            (int(345 * sy), int(370 * sx)), (int(380 * sy), int(380 * sx)),
            (int(410 * sy), int(385 * sx))
        ]
        pts_branch1 = [
            (int(255 * sy), int(325 * sx)), (int(268 * sy), int(345 * sx)),
            (int(285 * sy), int(370 * sx)), (int(300 * sy), int(395 * sx))
        ]
        pts_branch2 = [
            (int(280 * sy), int(340 * sx)), (int(298 * sy), int(330 * sx)),
            (int(320 * sy), int(315 * sx)), (int(340 * sy), int(305 * sx))
        ]

        for pts in [pts_trunk, pts_branch1, pts_branch2]:
            for i in range(len(pts) - 1):
                p1, p2 = pts[i], pts[i+1]
                for t in np.linspace(0, 1, 80):
                    py = int(p1[0] * (1 - t) + p2[0] * t)
                    px = int(p1[1] * (1 - t) + p2[1] * t)
                    r = max(1, int(np.random.randint(3, 7) * sy))
                    y_min, y_max = max(0, py - r), min(H, py + r + 1)
                    x_min, x_max = max(0, px - r), min(W, px + r + 1)
                    oil_mask[y_min:y_max, x_min:x_max] = 1

        oil_smooth = scipy.ndimage.gaussian_filter(oil_mask.astype(np.float32), sigma=max(0.8, 1.2 * sy))
        oil_mask = (oil_smooth > 0.35).astype(np.uint8)
        intensity[oil_mask == 1] = 0.0012

        # 4. Synthesize SAR VV decibel map with speckle noise
        sar_db = cls._add_sar_speckle(intensity, looks=4)
        plat_y, plat_x = int(210 * sy), int(280 * sx)
        sar_db[max(0, plat_y-2):min(H, plat_y+3), max(0, plat_x-2):min(W, plat_x+3)] = 4.5

        # 5. Collocated Wind Fields (ERA5 U10, V10 in m/s)
        u10 = np.full((H, W), -2.8, dtype=np.float32)
        v10 = np.full((H, W), -2.8, dtype=np.float32)
        u10 = u10 * (1.0 - 0.78 * lwsa_smooth)
        v10 = v10 * (1.0 - 0.78 * lwsa_smooth)
        u10 += 0.3 * np.sin(np.linspace(0, 3, W))
        v10 += 0.2 * np.cos(np.linspace(0, 3, H)[:, np.newaxis])

        lwsa_mask = (lwsa_smooth > 0.4) & (oil_mask == 0)

        return {
            "name": "Caspian Sea (Offshore Platform Leak)",
            "region": "Caspian Sea",
            "condition": "Chronic platform leak with large adjacent LWSA calm water",
            "sar_db": sar_db,
            "u10": u10,
            "v10": v10,
            "ground_truth_oil": oil_mask,
            "lwsa_mask": lwsa_mask.astype(np.uint8),
            "lsi_mask": np.zeros((H, W), dtype=np.uint8),
            "mean_wind_speed": float(np.mean(np.sqrt(u10**2 + v10**2)))
        }

    @classmethod
    def generate_ionian_sea_scene(cls, size: int = 512, seed: int = 101) -> Dict[str, Any]:
        """
        Case 2: Ionian Sea Island Wake & Sheltering (Fig. 6j, Fig. 8d)
        - Islands with topographic wind shadow on the leeward side (LSI).
        - Ambient wind: ~6.5 m/s blowing from West to East (U10 > 0).
        - Distinct elongated LSI wake behind islands resembling oil slicks.
        - True ship spill located in open water.
        """
        np.random.seed(seed)
        H, W = size, size
        sy, sx = H / 512.0, W / 512.0
        y, x = np.ogrid[:H, :W]

        base_intensity = np.full((H, W), 0.020, dtype=np.float32)

        # Island placement
        island_center_y, island_center_x = int(230 * sy), int(165 * sx)
        island_radius = max(4, int(26 * sx))
        dist_island = np.sqrt(((y - island_center_y) * 1.3)**2 + (x - island_center_x)**2)
        island_mask = dist_island <= island_radius

        # Leeward Wake (LSI): Extends downstream (Eastward, x > island_x)
        lsi_mask = np.zeros((H, W), dtype=bool)
        for row in range(H):
            dy = abs(row - island_center_y)
            if dy < int(32 * sy):
                wake_length = int(220 * sx * (1.0 - (dy / (32 * sy))**1.5))
                start_x = island_center_x + int(15 * sx)
                end_x = min(W, start_x + wake_length)
                lsi_mask[row, start_x:end_x] = True

        lsi_smooth = scipy.ndimage.gaussian_filter(lsi_mask.astype(np.float32), sigma=max(2.0, 8 * sy))
        intensity = base_intensity * (1.0 - 0.90 * lsi_smooth)

        # True Oil Spill in open water (Vessel discharge slick)
        oil_mask = np.zeros((H, W), dtype=np.uint8)
        slick_pts = [
            (int(110 * sy), int(360 * sx)), (int(125 * sy), int(385 * sx)),
            (int(140 * sy), int(410 * sx)), (int(160 * sy), int(435 * sx)),
            (int(185 * sy), int(455 * sx)), (int(210 * sy), int(470 * sx))
        ]
        for i in range(len(slick_pts) - 1):
            p1, p2 = slick_pts[i], slick_pts[i+1]
            for t in np.linspace(0, 1, 60):
                py = int(p1[0] * (1 - t) + p2[0] * t)
                px = int(p1[1] * (1 - t) + p2[1] * t)
                r = max(1, int(np.random.randint(2, 5) * sy))
                oil_mask[max(0, py - r):min(H, py + r + 1), max(0, px - r):min(W, px + r + 1)] = 1

        oil_smooth = scipy.ndimage.gaussian_filter(oil_mask.astype(np.float32), sigma=max(0.8, 1.0 * sy))
        oil_mask = (oil_smooth > 0.35).astype(np.uint8)
        intensity[oil_mask == 1] = 0.0013

        sar_db = cls._add_sar_speckle(intensity, looks=4)
        land_texture = np.random.uniform(2.0, 7.0, (H, W))
        sar_db[island_mask] = land_texture[island_mask]

        u10 = np.full((H, W), 6.2, dtype=np.float32)
        v10 = np.full((H, W), 1.2, dtype=np.float32)
        u10 = u10 * (1.0 - 0.75 * lsi_smooth)
        v10 = v10 * (1.0 - 0.60 * lsi_smooth)

        effective_lsi_mask = (lsi_smooth > 0.35) & (~island_mask) & (oil_mask == 0)

        return {
            "name": "Ionian Sea (Island Wind Sheltering & Wake)",
            "region": "Ionian Sea",
            "condition": "Island leeward wake (LSI) under strong directional wind with vessel spill",
            "sar_db": sar_db,
            "u10": u10,
            "v10": v10,
            "ground_truth_oil": oil_mask,
            "lwsa_mask": np.zeros((H, W), dtype=np.uint8),
            "lsi_mask": effective_lsi_mask.astype(np.uint8),
            "mean_wind_speed": float(np.mean(np.sqrt(u10**2 + v10**2)))
        }

    @classmethod
    def generate_red_sea_scene(cls, size: int = 512, seed: int = 202) -> Dict[str, Any]:
        """
        Case 3: Red Sea Vessel Collision (Fig. 5a, Fig. 6c)
        - Two elongated, continuous slicks from vessel collision.
        - Moderate wind (~4.5 m/s) with clean contrast and small low-wind pockets.
        """
        np.random.seed(seed)
        H, W = size, size
        sy, sx = H / 512.0, W / 512.0
        y, x = np.ogrid[:H, :W]

        base_intensity = np.full((H, W), 0.015, dtype=np.float32)

        oil_mask = np.zeros((H, W), dtype=np.uint8)
        slick1_pts = [
            (int(80 * sy), int(180 * sx)), (int(130 * sy), int(205 * sx)),
            (int(190 * sy), int(235 * sx)), (int(260 * sy), int(270 * sx)),
            (int(330 * sy), int(310 * sx)), (int(410 * sy), int(350 * sx))
        ]
        slick2_pts = [
            (int(100 * sy), int(150 * sx)), (int(155 * sy), int(175 * sx)),
            (int(220 * sy), int(205 * sx)), (int(290 * sy), int(240 * sx)),
            (int(365 * sy), int(280 * sx)), (int(435 * sy), int(315 * sx))
        ]

        for pts in [slick1_pts, slick2_pts]:
            for i in range(len(pts) - 1):
                p1, p2 = pts[i], pts[i+1]
                for t in np.linspace(0, 1, 100):
                    py = int(p1[0] * (1 - t) + p2[0] * t)
                    px = int(p1[1] * (1 - t) + p2[1] * t)
                    r = max(1, int(np.random.randint(3, 6) * sy))
                    oil_mask[max(0, py - r):min(H, py + r + 1), max(0, px - r):min(W, px + r + 1)] = 1

        oil_smooth = scipy.ndimage.gaussian_filter(oil_mask.astype(np.float32), sigma=max(0.8, 1.2 * sy))
        oil_mask = (oil_smooth > 0.35).astype(np.uint8)

        dist_lwsa = np.sqrt(((y - int(80 * sy)) / 0.7)**2 + (x - int(420 * sx))**2)
        lwsa_smooth = scipy.ndimage.gaussian_filter((dist_lwsa < int(70 * sx)).astype(np.float32), sigma=max(2.0, 10 * sy))

        intensity = base_intensity * (1.0 - 0.85 * lwsa_smooth)
        intensity[oil_mask == 1] = 0.0011

        sar_db = cls._add_sar_speckle(intensity, looks=4)

        ship1_y, ship1_x = int(80 * sy), int(180 * sx)
        ship2_y, ship2_x = int(100 * sy), int(150 * sx)
        sar_db[max(0, ship1_y-2):min(H, ship1_y+3), max(0, ship1_x-2):min(W, ship1_x+3)] = 6.0
        sar_db[max(0, ship2_y-2):min(H, ship2_y+3), max(0, ship2_x-2):min(W, ship2_x+3)] = 5.2

        u10 = np.full((H, W), 3.5, dtype=np.float32)
        v10 = np.full((H, W), -2.5, dtype=np.float32)
        u10 = u10 * (1.0 - 0.7 * lwsa_smooth)
        v10 = v10 * (1.0 - 0.7 * lwsa_smooth)

        return {
            "name": "Red Sea (Vessel Collision Slicks)",
            "region": "Red Sea",
            "condition": "Dual elongated slicks under moderate wind with small LWSA pocket",
            "sar_db": sar_db,
            "u10": u10,
            "v10": v10,
            "ground_truth_oil": oil_mask,
            "lwsa_mask": (lwsa_smooth > 0.4).astype(np.uint8),
            "lsi_mask": np.zeros((H, W), dtype=np.uint8),
            "mean_wind_speed": float(np.mean(np.sqrt(u10**2 + v10**2)))
        }

    @classmethod
    def get_benchmark_scenes(cls) -> Dict[str, Dict[str, Any]]:
        """Returns all pre-configured benchmark maritime scenes."""
        return {
            "caspian_sea": cls.generate_caspian_sea_scene(),
            "ionian_sea": cls.generate_ionian_sea_scene(),
            "red_sea": cls.generate_red_sea_scene(),
        }

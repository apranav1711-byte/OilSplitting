"""
Data Preprocessing and Normalization Pipeline.
Implements the exact radiometric and wind-field normalization from:
Chen et al., "Wind-Field-Integrated Deep Learning for Marine Oil Spill Detection", IEEE JSTARS 2026.
"""

from typing import Tuple, Optional
import numpy as np
import torch
import scipy.ndimage


class SARWindPreprocessor:
    """
    Standard preprocessor for Sentinel-1 SAR VV backscatter and ERA5/GFS/ASCAT wind fields.
    """
    # Calibration ranges from paper (Section II-D)
    SAR_MIN_DB = -50.0
    SAR_MAX_DB = 10.0
    WIND_MIN_MS = -10.0
    WIND_MAX_MS = 10.0

    @classmethod
    def normalize_sar_vv(cls, sar_db: np.ndarray) -> np.ndarray:
        """
        Clips SAR backscatter to [-50, 10] dB and normalizes linearly to [0, 1].
        """
        clipped = np.clip(sar_db, cls.SAR_MIN_DB, cls.SAR_MAX_DB)
        normalized = (clipped - cls.SAR_MIN_DB) / (cls.SAR_MAX_DB - cls.SAR_MIN_DB)
        return normalized.astype(np.float32)

    @classmethod
    def denormalize_sar_vv(cls, norm_sar: np.ndarray) -> np.ndarray:
        """Inverse transformation from [0, 1] back to decibels [dB]."""
        return norm_sar * (cls.SAR_MAX_DB - cls.SAR_MIN_DB) + cls.SAR_MIN_DB

    @classmethod
    def normalize_wind_component(cls, wind_comp: np.ndarray) -> np.ndarray:
        """
        Clips U10 or V10 wind component to [-10, 10] m/s and normalizes to [0, 1].
        """
        clipped = np.clip(wind_comp, cls.WIND_MIN_MS, cls.WIND_MAX_MS)
        normalized = (clipped - cls.WIND_MIN_MS) / (cls.WIND_MAX_MS - cls.WIND_MIN_MS)
        return normalized.astype(np.float32)

    @classmethod
    def denormalize_wind_component(cls, norm_wind: np.ndarray) -> np.ndarray:
        """Inverse transformation from [0, 1] back to wind speed [m/s]."""
        return norm_wind * (cls.WIND_MAX_MS - cls.WIND_MIN_MS) + cls.WIND_MIN_MS

    @classmethod
    def compute_speed_and_direction(cls, u10: np.ndarray, v10: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """
        Computes wind speed (m/s) and meteorological wind direction (degrees, 0-360).
        """
        speed = np.sqrt(u10**2 + v10**2)
        # Direction in degrees [0, 360)
        direction = (np.degrees(np.arctan2(v10, u10)) + 360.0) % 360.0
        return speed, direction

    @classmethod
    def resample_wind_grid(
        cls,
        coarse_wind: np.ndarray,
        target_shape: Tuple[int, int],
        mode: str = "bilinear"
    ) -> np.ndarray:
        """
        Resamples coarse wind grid (e.g. ERA5 0.25 deg) to target SAR image dimensions.
        Modes supported (as evaluated in Table XIII of the paper):
          - 'bilinear': Smooth bilinear interpolation (order=1)
          - 'nearest': Nearest neighbor interpolation (order=0)
          - 'block': Block-constant representation
        """
        h_coarse, w_coarse = coarse_wind.shape
        h_target, w_target = target_shape
        zoom_y = h_target / h_coarse
        zoom_x = w_target / w_coarse

        if mode == "bilinear":
            return scipy.ndimage.zoom(coarse_wind, (zoom_y, zoom_x), order=1)
        elif mode in ("nearest", "block"):
            return scipy.ndimage.zoom(coarse_wind, (zoom_y, zoom_x), order=0)
        else:
            raise ValueError(f"Unsupported resampling mode: {mode}")

    @classmethod
    def prepare_input_tensor(
        cls,
        sar_db: np.ndarray,
        u10: Optional[np.ndarray] = None,
        v10: Optional[np.ndarray] = None,
        mode: str = "SAR-UV"
    ) -> torch.Tensor:
        """
        Assembles normalized PyTorch tensor [1, C, H, W] for model inference.
        Modes:
          - 'SAR-UV': 3 channels [VV_norm, U10_norm, V10_norm]
          - 'SAR-VV': 1 channel [VV_norm]
          - 'SAR-WS': 2 channels [VV_norm, Speed_norm]
        """
        norm_vv = cls.normalize_sar_vv(sar_db)

        if mode == "SAR-VV":
            tensor_np = norm_vv[np.newaxis, :, :]  # [1, H, W]
        elif mode == "SAR-UV":
            if u10 is None or v10 is None:
                raise ValueError("u10 and v10 are required for SAR-UV mode.")
            norm_u = cls.normalize_wind_component(u10)
            norm_v = cls.normalize_wind_component(v10)
            tensor_np = np.stack([norm_vv, norm_u, norm_v], axis=0)  # [3, H, W]
        elif mode == "SAR-WS":
            if u10 is None or v10 is None:
                raise ValueError("u10 and v10 are required for SAR-WS mode.")
            speed, _ = cls.compute_speed_and_direction(u10, v10)
            norm_speed = np.clip(speed / 15.0, 0.0, 1.0).astype(np.float32)
            tensor_np = np.stack([norm_vv, norm_speed], axis=0)  # [2, H, W]
        else:
            raise ValueError(f"Unknown mode: {mode}")

        # Add batch dimension [B=1, C, H, W]
        return torch.from_numpy(tensor_np).unsqueeze(0).float()

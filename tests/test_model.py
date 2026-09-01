"""
Unit tests for model architecture and SCSE attention block.
"""

import unittest
import torch

from src.models.scse import SCSEBlock, ChannelSqueezeSpatialExcitation, SpatialSqueezeChannelExcitation
from src.models.unet_plus_plus import UNetPlusPlus


class TestModelArchitecture(unittest.TestCase):

    def test_scse_block(self):
        B, C, H, W = 2, 32, 64, 64
        x = torch.randn(B, C, H, W)
        scse = SCSEBlock(in_channels=C)
        out = scse(x)

        self.assertEqual(out.shape, x.shape, "SCSE output shape must match input tensor shape")
        self.assertFalse(torch.isnan(out).any(), "SCSE output should not contain NaNs")

    def test_unet_plus_plus_sar_uv(self):
        # 3 channels (VV + U10 + V10)
        B, C, H, W = 1, 3, 128, 128
        x = torch.randn(B, C, H, W)
        model = UNetPlusPlus(
            in_channels=3,
            num_classes=1,
            nb_filter=[8, 16, 32, 64, 128],
            use_scse=True
        )
        out = model(x)
        self.assertEqual(out.shape, (B, 1, H, W), "UNet++ SAR-UV output shape mismatch")

        prob = model.predict_probability(x)
        self.assertEqual(prob.shape, (B, 1, H, W))
        self.assertTrue(torch.all(prob >= 0.0) and torch.all(prob <= 1.0), "Probabilities must be in [0, 1]")

    def test_unet_plus_plus_sar_vv(self):
        # 1 channel (VV only)
        B, C, H, W = 1, 1, 128, 128
        x = torch.randn(B, C, H, W)
        model = UNetPlusPlus(
            in_channels=1,
            num_classes=1,
            nb_filter=[8, 16, 32, 64, 128],
            use_scse=False
        )
        out = model(x)
        self.assertEqual(out.shape, (B, 1, H, W), "UNet++ SAR-VV output shape mismatch")


if __name__ == "__main__":
    unittest.main()

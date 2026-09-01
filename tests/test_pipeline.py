"""
Unit tests for data preprocessing, benchmark generation, and metrics calculation.
"""

import unittest
import numpy as np
import torch

from src.data.preprocessor import SARWindPreprocessor
from src.data.benchmark_generator import MaritimeBenchmarkGenerator
from src.engine.losses_metrics import SegmentationMetrics, get_loss_function


class TestPipeline(unittest.TestCase):

    def test_preprocessor_normalization(self):
        sar_db = np.array([-50.0, -20.0, 10.0, 20.0, -60.0])
        norm_sar = SARWindPreprocessor.normalize_sar_vv(sar_db)

        self.assertAlmostEqual(norm_sar[0], 0.0, places=5)
        self.assertAlmostEqual(norm_sar[2], 1.0, places=5)
        # Clipping test
        self.assertAlmostEqual(norm_sar[3], 1.0, places=5)
        self.assertAlmostEqual(norm_sar[4], 0.0, places=5)

        # Wind normalization
        wind = np.array([-10.0, 0.0, 10.0])
        norm_wind = SARWindPreprocessor.normalize_wind_component(wind)
        self.assertAlmostEqual(norm_wind[0], 0.0, places=5)
        self.assertAlmostEqual(norm_wind[1], 0.5, places=5)
        self.assertAlmostEqual(norm_wind[2], 1.0, places=5)

    def test_benchmark_generator(self):
        caspian = MaritimeBenchmarkGenerator.generate_caspian_sea_scene(size=256)
        self.assertIn("sar_db", caspian)
        self.assertIn("u10", caspian)
        self.assertIn("v10", caspian)
        self.assertIn("ground_truth_oil", caspian)
        self.assertIn("lwsa_mask", caspian)

        self.assertEqual(caspian["sar_db"].shape, (256, 256))
        self.assertTrue(np.any(caspian["ground_truth_oil"] > 0), "Should contain oil slick pixels")
        self.assertTrue(np.any(caspian["lwsa_mask"] > 0), "Should contain LWSA calm water pixels")

    def test_metrics_computation(self):
        gt = np.zeros((100, 100), dtype=np.uint8)
        gt[20:40, 20:40] = 1  # 400 positive pixels

        pred = np.zeros((100, 100), dtype=np.uint8)
        pred[20:40, 20:40] = 1  # 400 true positives
        pred[50:60, 50:60] = 1  # 100 false positives

        lwsa = np.zeros((100, 100), dtype=np.uint8)
        lwsa[50:60, 50:60] = 1  # The false positives are inside LWSA

        metrics = SegmentationMetrics.compute(pred, gt, lwsa_mask=lwsa)
        self.assertEqual(metrics["TP"], 400)
        self.assertEqual(metrics["FP"], 100)
        self.assertEqual(metrics["FN"], 0)
        self.assertAlmostEqual(metrics["Precision"], 400 / 500)
        self.assertAlmostEqual(metrics["Recall"], 1.0)
        self.assertAlmostEqual(metrics["FPR_LWSA"], 1.0)  # All 100 LWSA pixels were falsely marked


if __name__ == "__main__":
    unittest.main()

"""
Loss Functions and Evaluation Metrics for Marine Oil Spill Detection.
Implements the exact formulas (Eq. 1-6) and loss ablation candidates from:
Chen et al., "Wind-Field-Integrated Deep Learning for Marine Oil Spill Detection", IEEE JSTARS 2026.
"""

from typing import Dict, Any, Optional
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F


# -------------------------------------------------------------------------
# Loss Functions (Ablation candidates from Table IX)
# -------------------------------------------------------------------------

class DiceLoss(nn.Module):
    """
    Soft Dice Loss for binary segmentation.
    Optimizes spatial region overlap.
    """
    def __init__(self, smooth: float = 1.0):
        super().__init__()
        self.smooth = smooth

    def forward(self, logits: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        probs = torch.sigmoid(logits)
        probs_flat = probs.view(-1)
        targets_flat = targets.view(-1)

        intersection = (probs_flat * targets_flat).sum()
        dice = (2.0 * intersection + self.smooth) / (probs_flat.sum() + targets_flat.sum() + self.smooth)
        return 1.0 - dice


class FocalLoss(nn.Module):
    """
    Focal Loss for addressing extreme class imbalance in hard pixels.
    """
    def __init__(self, alpha: float = 0.25, gamma: float = 2.0):
        super().__init__()
        self.alpha = alpha
        self.gamma = gamma

    def forward(self, logits: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        probs = torch.sigmoid(logits)
        bce = F.binary_cross_entropy_with_logits(logits, targets, reduction='none')
        p_t = probs * targets + (1.0 - probs) * (1.0 - targets)
        focal_weight = (1.0 - p_t) ** self.gamma

        if self.alpha >= 0:
            alpha_t = self.alpha * targets + (1.0 - self.alpha) * (1.0 - targets)
            focal_weight = alpha_t * focal_weight

        return (focal_weight * bce).mean()


class BCEDiceLoss(nn.Module):
    """Combined BCE + Dice Loss."""
    def __init__(self, bce_weight: float = 0.5, dice_weight: float = 0.5):
        super().__init__()
        self.bce = nn.BCEWithLogitsLoss()
        self.dice = DiceLoss()
        self.bce_weight = bce_weight
        self.dice_weight = dice_weight

    def forward(self, logits: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        return self.bce_weight * self.bce(logits, targets) + self.dice_weight * self.dice(logits, targets)


def get_loss_function(name: str = "BCE") -> nn.Module:
    """Factory to retrieve loss function by name."""
    name_upper = name.upper()
    if name_upper == "BCE":
        return nn.BCEWithLogitsLoss()
    elif name_upper == "DICE":
        return DiceLoss()
    elif name_upper in ("BCE_DICE", "BCE+DICE"):
        return BCEDiceLoss()
    elif name_upper == "FOCAL":
        return FocalLoss()
    else:
        raise ValueError(f"Unknown loss function: {name}. Choose from BCE, DICE, BCE_DICE, FOCAL.")


# -------------------------------------------------------------------------
# Evaluation Metrics (Eq. 1 - 4 & Stratified FPR)
# -------------------------------------------------------------------------

class SegmentationMetrics:
    """
    Computes Precision (P), Recall (R), F1-score (F1), and False Positive Rate (FPR),
    including stratified evaluation in Low-Wind-Speed Areas (LWSAs) and Leeward Sides of Islands (LSIs).
    """

    @staticmethod
    def compute(
        pred_mask: np.ndarray,
        gt_mask: np.ndarray,
        lwsa_mask: Optional[np.ndarray] = None,
        lsi_mask: Optional[np.ndarray] = None,
        eps: float = 1e-7
    ) -> Dict[str, float]:
        """
        Computes standard and stratified segmentation metrics.
        pred_mask: Binary prediction array (0 or 1)
        gt_mask: Ground truth oil mask (0 or 1)
        lwsa_mask: Binary mask for low wind speed calm water look-alike
        lsi_mask: Binary mask for island leeward wake look-alike
        """
        pred = (pred_mask > 0).astype(bool)
        gt = (gt_mask > 0).astype(bool)

        tp = np.logical_and(pred, gt).sum()
        fp = np.logical_and(pred, ~gt).sum()
        fn = np.logical_and(~pred, gt).sum()
        tn = np.logical_and(~pred, ~gt).sum()

        precision = float(tp) / float(tp + fp + eps)
        recall = float(tp) / float(tp + fn + eps)
        f1 = (2.0 * precision * recall) / (precision + recall + eps)
        fpr = float(fp) / float(fp + tn + eps)

        results = {
            "TP": int(tp),
            "FP": int(fp),
            "FN": int(fn),
            "TN": int(tn),
            "Precision": float(precision),
            "Recall": float(recall),
            "F1": float(f1),
            "FPR": float(fpr)
        }

        # Stratified FPR in LWSA look-alike regions
        if lwsa_mask is not None and np.any(lwsa_mask > 0):
            lwsa_non_oil = (lwsa_mask > 0) & (~gt)
            total_lwsa_non_oil = lwsa_non_oil.sum()
            if total_lwsa_non_oil > 0:
                fp_lwsa = np.logical_and(pred, lwsa_non_oil).sum()
                results["FPR_LWSA"] = float(fp_lwsa) / float(total_lwsa_non_oil)
            else:
                results["FPR_LWSA"] = 0.0
        else:
            results["FPR_LWSA"] = 0.0

        # Stratified FPR in LSI look-alike regions
        if lsi_mask is not None and np.any(lsi_mask > 0):
            lsi_non_oil = (lsi_mask > 0) & (~gt)
            total_lsi_non_oil = lsi_non_oil.sum()
            if total_lsi_non_oil > 0:
                fp_lsi = np.logical_and(pred, lsi_non_oil).sum()
                results["FPR_LSI"] = float(fp_lsi) / float(total_lsi_non_oil)
            else:
                results["FPR_LSI"] = 0.0
        else:
            results["FPR_LSI"] = 0.0

        return results

"""
Spatial and Channel Squeeze-and-Excitation (SCSE) Attention Module.
Reference: Roy et al., "Recalibrating Fully Convolutional Networks with Spatial and Channel 'Squeeze & Excitation' Blocks", IEEE TMI 2018.
Used in the UNet++ SCSE architecture for marine oil spill detection (Chen et al., IEEE JSTARS 2026).
"""

import torch
import torch.nn as nn


class ChannelSqueezeSpatialExcitation(nn.Module):
    """
    Channel Squeeze and Spatial Excitation (sSE) block.
    Squeezes channel dimensions via 1x1 convolution, producing a spatial attention map.
    """
    def __init__(self, in_channels: int):
        super().__init__()
        self.conv = nn.Conv2d(in_channels, 1, kernel_size=1, bias=False)
        self.sigmoid = nn.Sigmoid()

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: [B, C, H, W]
        # Spatial attention map: [B, 1, H, W]
        attn = self.sigmoid(self.conv(x))
        return x * attn


class SpatialSqueezeChannelExcitation(nn.Module):
    """
    Spatial Squeeze and Channel Excitation (cSE) block.
    Squeezes spatial dimensions via global average pooling, producing channel attention weights.
    """
    def __init__(self, in_channels: int, reduction: int = 2):
        super().__init__()
        reduced_channels = max(1, in_channels // reduction)
        self.avg_pool = nn.AdaptiveAvgPool2d(1)
        self.fc = nn.Sequential(
            nn.Conv2d(in_channels, reduced_channels, kernel_size=1, bias=True),
            nn.ReLU(inplace=True),
            nn.Conv2d(reduced_channels, in_channels, kernel_size=1, bias=True),
            nn.Sigmoid()
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: [B, C, H, W]
        # Channel weights: [B, C, 1, 1]
        weights = self.fc(self.avg_pool(x))
        return x * weights


class SCSEBlock(nn.Module):
    """
    Concurrent Spatial and Channel Squeeze-and-Excitation (SCSE) block.
    Combines sSE and cSE additively: Output = x_cSE + x_sSE.
    """
    def __init__(self, in_channels: int, reduction: int = 2):
        super().__init__()
        self.cSE = SpatialSqueezeChannelExcitation(in_channels, reduction=reduction)
        self.sSE = ChannelSqueezeSpatialExcitation(in_channels)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.cSE(x) + self.sSE(x)

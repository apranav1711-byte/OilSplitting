"""
Model Training Script for SAR-VV and SAR-UV (Chen et al., IEEE JSTARS 2026).
Trains UNet++ (with/without SCSE attention) on SAR scenes with BCE loss.
"""

from typing import Tuple, List, Optional
import os
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
import numpy as np

from src.models.unet_plus_plus import UNetPlusPlus
from src.data.benchmark_generator import MaritimeBenchmarkGenerator
from src.data.preprocessor import SARWindPreprocessor


class SyntheticSARDataset(Dataset):
    """
    Generates training patches from benchmark maritime scenarios.
    """
    def __init__(self, mode: str = "SAR-UV", patch_size: int = 256, num_samples: int = 60, seed: int = 42):
        self.mode = mode
        self.patch_size = patch_size
        self.num_samples = num_samples
        np.random.seed(seed)

        # Generate base scenes
        scenes = [
            MaritimeBenchmarkGenerator.generate_caspian_sea_scene(size=512, seed=seed),
            MaritimeBenchmarkGenerator.generate_ionian_sea_scene(size=512, seed=seed + 1),
            MaritimeBenchmarkGenerator.generate_red_sea_scene(size=512, seed=seed + 2)
        ]

        self.samples = []
        for _ in range(num_samples):
            # Select random scene
            sc = scenes[np.random.randint(0, len(scenes))]
            # Select random crop coordinates
            H, W = sc["sar_db"].shape
            y = np.random.randint(0, H - patch_size + 1)
            x = np.random.randint(0, W - patch_size + 1)

            sar_crop = sc["sar_db"][y:y+patch_size, x:x+patch_size]
            u_crop = sc["u10"][y:y+patch_size, x:x+patch_size]
            v_crop = sc["v10"][y:y+patch_size, x:x+patch_size]
            gt_crop = sc["ground_truth_oil"][y:y+patch_size, x:x+patch_size]

            # Augmentations (90/180 rotations as in paper Section II-D)
            k_rot = np.random.choice([0, 1, 2])
            if k_rot > 0:
                sar_crop = np.rot90(sar_crop, k=k_rot).copy()
                u_crop = np.rot90(u_crop, k=k_rot).copy()
                v_crop = np.rot90(v_crop, k=k_rot).copy()
                gt_crop = np.rot90(gt_crop, k=k_rot).copy()

            input_tensor = SARWindPreprocessor.prepare_input_tensor(
                sar_db=sar_crop,
                u10=u_crop,
                v10=v_crop,
                mode=self.mode
            ).squeeze(0)  # Shape [C, H, W]

            target_tensor = torch.from_numpy(gt_crop).unsqueeze(0).float()  # Shape [1, H, W]
            self.samples.append((input_tensor, target_tensor))

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor]:
        return self.samples[idx]


def train_model(
    mode: str = "SAR-UV",
    epochs: int = 12,
    batch_size: int = 4,
    lr: float = 1e-3,
    save_path: Optional[str] = None
) -> UNetPlusPlus:
    """
    Trains a lightweight UNet++ model for the specified configuration (SAR-VV or SAR-UV).
    Uses ResNet-style channel layout: [16, 32, 64, 128, 256].
    """
    in_channels = 3 if mode == "SAR-UV" else 1
    use_scse = True if mode == "SAR-UV" else False

    model = UNetPlusPlus(
        in_channels=in_channels,
        num_classes=1,
        nb_filter=[16, 32, 64, 128, 256],
        use_scse=use_scse,
        deep_supervision=False
    )

    dataset = SyntheticSARDataset(mode=mode, patch_size=256, num_samples=48)
    loader = DataLoader(dataset, batch_size=batch_size, shuffle=True)

    criterion = nn.BCEWithLogitsLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=1e-4)

    model.train()
    print(f"--> Training {mode} model ({epochs} epochs, in_channels={in_channels}, use_scse={use_scse})...")
    for epoch in range(epochs):
        epoch_loss = 0.0
        for inputs, targets in loader:
            optimizer.zero_grad()
            outputs = model(inputs)
            loss = criterion(outputs, targets)
            loss.backward()
            optimizer.step()
            epoch_loss += loss.item() * inputs.size(0)

        epoch_loss /= len(dataset)
        if (epoch + 1) % 4 == 0 or epoch == epochs - 1:
            print(f"    Epoch {epoch+1:02d}/{epochs:02d} - BCE Loss: {epoch_loss:.4f}")

    if save_path:
        os.makedirs(os.path.dirname(os.path.abspath(save_path)), exist_ok=True)
        torch.save(model.state_dict(), save_path)
        print(f"--> Saved checkpoint to: {save_path}")

    return model


if __name__ == "__main__":
    train_model(mode="SAR-VV", epochs=12, save_path="checkpoints/sar_vv_model.pt")
    train_model(mode="SAR-UV", epochs=12, save_path="checkpoints/sar_uv_model.pt")

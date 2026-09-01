"""
Benchmark Evaluation Runner (CLI).
Executes comparative evaluation across all benchmark maritime scenarios
(Caspian Sea, Ionian Sea, Red Sea) and prints comparative metrics.
"""

from typing import Dict, Any
import numpy as np

from src.data.benchmark_generator import MaritimeBenchmarkGenerator
from src.engine.evaluator import OilSpillEvaluator


def run_benchmark_suite():
    print("=" * 76)
    print("  MARITIME SAR OIL SPILL DETECTION BENCHMARK SUITE (Chen et al., 2026)")
    print("=" * 76)

    evaluator = OilSpillEvaluator()
    benchmarks = MaritimeBenchmarkGenerator.get_benchmark_scenes()

    summary_rows = []

    for key, scene in benchmarks.items():
        print(f"\nEvaluating: {scene['name']} ({scene['region']})")
        print(f"Condition: {scene['condition']}")

        eval_res = evaluator.evaluate_scene(scene, threshold=0.5)
        m_vv = eval_res["metrics_vv"]
        m_uv = eval_res["metrics_uv"]
        delta = eval_res["comparison"]

        row = [
            scene["region"],
            f"{m_vv['Precision']*100:.1f}%",
            f"{m_uv['Precision']*100:.1f}% ({delta['Delta_Precision_pct']:+.1f}%)",
            f"{m_vv['Recall']*100:.1f}%",
            f"{m_uv['Recall']*100:.1f}% ({delta['Delta_Recall_pct']:+.1f}%)",
            f"{m_vv['F1']*100:.1f}%",
            f"{m_uv['F1']*100:.1f}% ({delta['Delta_F1_pct']:+.1f}%)",
            f"{m_vv.get('FPR_LWSA', 0.0)*100:.1f}%",
            f"{m_uv.get('FPR_LWSA', 0.0)*100:.1f}%",
            f"{m_vv.get('FPR_LSI', 0.0)*100:.1f}%",
            f"{m_uv.get('FPR_LSI', 0.0)*100:.1f}%"
        ]
        summary_rows.append(row)

    headers = [
        "Region",
        "VV Prec", "UV Prec",
        "VV Rec", "UV Rec",
        "VV F1", "UV F1",
        "VV LWSA", "UV LWSA",
        "VV LSI", "UV LSI"
    ]

    print("\n" + "=" * 76)
    print("  SUMMARY BENCHMARK RESULTS")
    print("=" * 76)
    # Simple plain format without external dependency
    col_widths = [14, 9, 18, 8, 18, 8, 18, 9, 9, 8, 8]
    header_str = " | ".join(f"{h:<{w}}" for h, w in zip(headers, col_widths))
    print(header_str)
    print("-" * len(header_str))
    for r in summary_rows:
        print(" | ".join(f"{str(val):<{w}}" for val, w in zip(r, col_widths)))
    print("=" * 76)


if __name__ == "__main__":
    run_benchmark_suite()

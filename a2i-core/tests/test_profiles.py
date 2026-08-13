from __future__ import annotations

import sys
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from profiles import model_profiles, recommend_profile


class ModelProfileTests(unittest.TestCase):
    def test_twelve_gb_pc_recommends_balanced_local(self) -> None:
        profile = recommend_profile(12)
        self.assertEqual(profile.id, "balanced-local")
        self.assertEqual(profile.model_key, "qwen-3b")

    def test_low_memory_pc_falls_back_to_fast_local(self) -> None:
        profile = recommend_profile(6)
        self.assertEqual(profile.id, "fast-local")
        self.assertEqual(profile.model_key, "qwen-1.5b")

    def test_quality_profile_is_possible_but_not_recommended_at_twelve_gb(self) -> None:
        profiles = {profile["id"]: profile for profile in model_profiles(12)}
        quality = profiles["quality-local"]
        self.assertTrue(quality["suitable"])
        self.assertFalse(quality["recommended"])

    def test_khmer_profile_is_local_and_possible_at_twelve_gb(self) -> None:
        profiles = {profile["id"]: profile for profile in model_profiles(12)}
        khmer = profiles["khmer-local"]
        self.assertEqual(khmer["model_key"], "sea-lion-7b")
        self.assertTrue(khmer["suitable"])
        self.assertFalse(khmer["recommended"])
        self.assertNotIn("remote", khmer)


if __name__ == "__main__":
    unittest.main()

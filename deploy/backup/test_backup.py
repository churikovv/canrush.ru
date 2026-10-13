import datetime as dt
import unittest
import io
import os
from pathlib import Path
import subprocess
import tempfile
from unittest.mock import patch
from backup import main
from backup import expired, periods


class RetentionTests(unittest.TestCase):
    def test_iso_year_boundary(self):
        self.assertEqual(periods(dt.date(2027, 1, 1)),
                         {"daily": "2027-01-01", "weekly": "2026-W53", "monthly": "2027-01"})

    def test_retention_ignores_unrelated_and_partial_files(self):
        for category, names in {
            "daily": ["2026-10-11", "2026-10-12", "2026-10-13"],
            "weekly": ["2026-W40", "2026-W41", "2026-W42"],
            "monthly": ["2026-09", "2026-10"],
        }.items():
            files = [f"canrush-{name}.dump" for name in names]
            self.assertEqual(expired(files + ["other.dump", files[0] + ".partial"], category), files[:1])

    def test_under_limit(self):
        self.assertEqual(expired(["canrush-2026-10-13.dump"], "daily"), [])



class PipelineTests(unittest.TestCase):
    def exercise(self, corrupt=False, fail_dump=False):
        calls = []
        old = {"daily": ["canrush-2000-01-01.dump", "canrush-2000-01-02.dump"],
               "weekly": ["canrush-2000-W01.dump", "canrush-2000-W02.dump"],
               "monthly": ["canrush-2000-01.dump"]}
        def fake_run(*args, **kwargs):
            calls.append(args)
            if args[0] == "docker" and "sh" in args:
                if fail_dump:
                    raise subprocess.CalledProcessError(1, args)
                kwargs["stdout"].write(b"test dump")
            if "lsf" in args:
                category = args[args.index("lsf") + 1].split(":")[1].strip("/")
                return subprocess.CompletedProcess(args, 0, "\n".join(old[category]))
            if "moveto" in args:
                category, name = args[-1].split(":")[1].split("/")
                old[category].append(name)
            return subprocess.CompletedProcess(args, 0)
        with tempfile.TemporaryDirectory() as temp:
            config = Path(temp) / "rclone.conf"
            config.write_text("[canrush-backup]\ntype = crypt\n")
            env = {"RCLONE_CONFIG": str(config), "BACKUP_STATE": temp, "BACKUP_REMOTE": "canrush-backup:"}
            with patch.dict(os.environ, env), patch("backup.run", side_effect=fake_run), patch("backup.subprocess.Popen") as popen:
                popen.side_effect = lambda *a, **kw: type("Readback", (), {
                    "stdout": io.BytesIO(b"corrupt" if corrupt else b"test dump"),
                    "wait": lambda self: 0})()
                if corrupt or fail_dump:
                    with self.assertRaises((RuntimeError, subprocess.CalledProcessError)):
                        main()
                else:
                    main()
            self.assertFalse(list(Path(temp).glob("dump-*")))
        return calls

    def test_verified_upload_then_rotation(self):
        calls = self.exercise()
        self.assertEqual(sum("moveto" in c for c in calls), 3)
        self.assertEqual(sum("deletefile" in c for c in calls), 3)
        self.assertLess(max(i for i, c in enumerate(calls) if "moveto" in c),
                        min(i for i, c in enumerate(calls) if "deletefile" in c))

    def test_corrupt_upload_never_published_or_pruned(self):
        calls = self.exercise(corrupt=True)
        self.assertFalse(any("moveto" in c or "deletefile" in c for c in calls))

    def test_dump_failure_never_uploaded_or_pruned(self):
        calls = self.exercise(fail_dump=True)
        self.assertFalse(any("copyto" in c or "deletefile" in c for c in calls))


if __name__ == "__main__":
    unittest.main()

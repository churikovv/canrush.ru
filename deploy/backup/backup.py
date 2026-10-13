#!/usr/bin/env python3
"""PostgreSQL -> encrypted rclone remote; retain 2 days, 2 weeks, 1 month."""
import datetime as dt
import fcntl
import hashlib
import os
from pathlib import Path
import re
import subprocess
import tempfile
from zoneinfo import ZoneInfo

PATTERNS = {
    "daily": r"canrush-\d{4}-\d{2}-\d{2}\.dump",
    "weekly": r"canrush-\d{4}-W\d{2}\.dump",
    "monthly": r"canrush-\d{4}-\d{2}\.dump",
}
KEEP = {"daily": 2, "weekly": 2, "monthly": 1}


def periods(now):
    year, week, _ = now.isocalendar()
    return {"daily": now.strftime("%Y-%m-%d"),
            "weekly": f"{year}-W{week:02}", "monthly": now.strftime("%Y-%m")}


def expired(names, category):
    valid = sorted({name for name in names if re.fullmatch(PATTERNS[category], name)}, reverse=True)
    return valid[KEEP[category]:]


def run(*args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)


def digest_stream(stream):
    digest = hashlib.sha256()
    for chunk in iter(lambda: stream.read(1024 * 1024), b""):
        digest.update(chunk)
    return digest.digest()


def main():
    root = Path(os.environ.get("CANRUSH_ROOT", "/opt/canrush"))
    state = Path(os.environ.get("BACKUP_STATE", "/var/lib/canrush-backup"))
    remote = os.environ.get("BACKUP_REMOTE", "canrush-backup:")
    # Refuse plaintext remotes: the selected named remote must itself be crypt.
    config = Path(os.environ.get("RCLONE_CONFIG", "/root/.config/rclone/rclone.conf"))
    import configparser
    parser = configparser.ConfigParser(interpolation=None)
    parser.read(config)
    section = remote.split(":", 1)[0]
    if ":" not in remote or parser.get(section, "type", fallback="") != "crypt":
        raise RuntimeError("BACKUP_REMOTE must name a crypt remote in RCLONE_CONFIG")
    state.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(state, 0o700)
    os.umask(0o077)
    with (state / "lock").open("w") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print("Backup already running", flush=True)
            return
        rc = ["rclone", "--config", str(config), "--retries", "3", "--contimeout", "30s", "--timeout", "5m"]
        base = remote.rstrip("/")
        def location(category, name=""):
            return base + ("" if base.endswith(":") else "/") + category + "/" + name
        pending = []
        for category, period in periods(dt.datetime.now(ZoneInfo("Europe/Moscow"))).items():
            folder = location(category)
            run(*rc, "mkdir", folder)
            names = run(*rc, "lsf", folder, "--files-only", "--max-depth", "1",
                        capture_output=True, text=True).stdout.splitlines()
            name = f"canrush-{period}.dump"
            if name not in names:
                pending.append((category, name))
        with tempfile.TemporaryDirectory(prefix="dump-", dir=state) as temp:
            dump = Path(temp) / "database.dump"
            if pending:
                with dump.open("wb") as out:
                    run("docker", "compose", "exec", "-T", "postgres", "sh", "-c",
                        'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc',
                        cwd=root, stdout=out)
                if dump.stat().st_size == 0:
                    raise RuntimeError("Empty dump")
                with dump.open("rb") as source:
                    run("docker", "compose", "exec", "-T", "postgres", "pg_restore", "--list",
                        cwd=root, stdin=source, stdout=subprocess.DEVNULL)
                with dump.open("rb") as source:
                    digest = digest_stream(source)
                for category, name in pending:
                    target = location(category, name)
                    partial = target + ".partial"
                    run(*rc, "copyto", str(dump), partial)
                    # Read back through crypt: verify decrypted contents before publishing/pruning.
                    proc = subprocess.Popen([*rc, "cat", partial], stdout=subprocess.PIPE)
                    with proc.stdout as stream:
                        actual = digest_stream(stream)
                    if proc.wait() != 0 or actual != digest:
                        raise RuntimeError("Uploaded backup failed read-back verification")
                    run(*rc, "moveto", partial, target)
                    print(f"Verified: {category}/{name}", flush=True)
            # Only prune after every required upload has succeeded.
            for category in KEEP:
                names = run(*rc, "lsf", location(category), "--files-only", "--max-depth", "1",
                            capture_output=True, text=True).stdout.splitlines()
                for name in expired(names, category):
                    run(*rc, "deletefile", location(category, name))
                    print(f"Expired: {category}/{name}", flush=True)
        print("Backup completed", flush=True)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Double-fork a command so it survives the parent shell exiting (Cursor agent shells).

Usage:
  dev-detach.py PIDFILE LOGFILE CWD -- CMD [ARGS...]
"""
from __future__ import annotations

import os
import sys


def main() -> None:
    if len(sys.argv) < 5 or "--" not in sys.argv:
        print(
            "Usage: dev-detach.py PIDFILE LOGFILE CWD -- CMD [ARGS...]",
            file=sys.stderr,
        )
        sys.exit(2)

    dash = sys.argv.index("--")
    if dash != 4 or len(sys.argv) <= dash + 1:
        print(
            "Usage: dev-detach.py PIDFILE LOGFILE CWD -- CMD [ARGS...]",
            file=sys.stderr,
        )
        sys.exit(2)

    pidfile, logfile, cwd = sys.argv[1], sys.argv[2], sys.argv[3]
    cmd = sys.argv[dash + 1 :]

    # First fork: parent waits for intermediate child, then exits.
    first = os.fork()
    if first > 0:
        os.waitpid(first, 0)
        if not os.path.isfile(pidfile):
            print(f"detach failed: no pid file at {pidfile}", file=sys.stderr)
            sys.exit(1)
        sys.exit(0)

    os.setsid()

    # Second fork: intermediate exits; grandchild is the daemon.
    second = os.fork()
    if second > 0:
        sys.exit(0)

    os.chdir(cwd)
    with open(logfile, "a", encoding="utf-8") as log:
        os.dup2(log.fileno(), 1)
        os.dup2(log.fileno(), 2)
    null_fd = os.open(os.devnull, os.O_RDONLY)
    os.dup2(null_fd, 0)
    os.close(null_fd)

    with open(pidfile, "w", encoding="utf-8") as f:
        f.write(str(os.getpid()))

    os.execvp(cmd[0], cmd)


if __name__ == "__main__":
    main()

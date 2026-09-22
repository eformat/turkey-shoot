#!/usr/bin/env bash
# ralph.sh — Ralph Wiggum loop: iterate on PRD.md until DONE exists.
# Each round spawns a FRESH agent context (no context rot).
# Usage: ./ralph.sh            (runs until DONE; monitor with tail -f ralph.log)
#        ./ralph.sh <max>      (optional round cap)
set -u
cd "$(dirname "$0")"

ROUND=0
MAX_ROUNDS="${1:-0}"   # 0 = no cap

PROMPT='You are an agent inside a Ralph Wiggum loop building a game autonomously. Do not ask questions; make sensible decisions yourself.

1. Read PRD.md in full — it is the law. Pay attention to section 0 (how to work).
2. Read progress.txt — it tells you the current state and the exact next steps.
3. Continue the work exactly per the PRD and progress.txt. Write code, fix bugs, add what remains.
4. Run the full verification in PRD.md section 9 after your changes. If anything fails, fix it and re-run until it passes.
5. APPEND to progress.txt: date, what you did, verification results, what remains, exact next steps for the next round.
6. If and ONLY if every item in PRD.md section 10 (Definition of DONE) genuinely passes, create the file DONE in the project root.

Persist until the PRD is satisfied. Iteration beats perfection. Failures are data.'

while [ ! -f DONE ]; do
  ROUND=$((ROUND+1))
  echo "=== RALPH ROUND $ROUND start: $(date) ===" >> ralph.log

  if opencode run --auto --log-level WARN "$PROMPT" >> ralph.log 2>&1; then
    echo "=== RALPH ROUND $ROUND agent exited cleanly: $(date) ===" >> ralph.log
  else
    echo "=== RALPH ROUND $ROUND agent exited with ERROR: $(date) ===" >> ralph.log
  fi

  if [ "$MAX_ROUNDS" -gt 0 ] && [ "$ROUND" -ge "$MAX_ROUNDS" ]; then
    echo "=== RALPH ROUND CAP ($MAX_ROUNDS) REACHED — stopping: $(date) ===" >> ralph.log
    exit 1
  fi
  sleep 2
done

echo "=== RALPH: DONE DETECTED after $ROUND round(s): $(date) ===" >> ralph.log

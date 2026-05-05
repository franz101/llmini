#!/usr/bin/env bash
# tmux.sh — launch llmini dev server in a tmux session
#
# Usage:
#   ./tmux.sh          create or attach the session
#   ./tmux.sh kill     kill the session

SESSION="llmini"
PORT="${PORT:-3000}"

if [ "$1" = "kill" ]; then
	tmux kill-session -t "$SESSION" 2>/dev/null && echo "Killed session: $SESSION" || echo "No session: $SESSION"
	exit 0
fi

# If the session already exists, attach to it
if tmux has-session -t "$SESSION" 2>/dev/null; then
	tmux attach-session -t "$SESSION"
	exit 0
fi

# Create a new detached session, send the dev command, then attach
tmux new-session -d -s "$SESSION" -n dev
tmux send-keys -t "$SESSION" "PORT=$PORT npm run dev" Enter
tmux attach-session -t "$SESSION"

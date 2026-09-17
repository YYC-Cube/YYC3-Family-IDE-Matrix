#!/usr/bin/env bash
# YYC³ 舰队本机开发栈一键启停 — vLLM 桩(:8000) + 治理中枢(:25700) + 8 Agent(:25600-25607)
# 用法: scripts/dev/fleet-up.sh [start|stop|status]
set -u
AGENTS_DIR="$(cd "$(dirname "$0")/../.." && pwd)/docs/YYC3-AI-Family-Agent/yyc3-family-ai-agents/agents"
VENV="$(cd "$(dirname "$0")/../.." && pwd)/.venv-fleet/bin/python"
STUB="$(cd "$(dirname "$0")" && pwd)/vllm-stub.py"
GOV="$(cd "$(dirname "$0")/../.." && pwd)/docs/YYC3-AI-Family-Agent/yyc3-family-ai-agents/governance_hub.py"
LOG_DIR="/tmp/yyc3-fleet"
mkdir -p "$LOG_DIR" /tmp/yyc3-gov

FLEET=(yuanqi-tianshu yanqi-qianhang yushu-wanwu yujian-xianzhi zhiyu-bole zhiyun-shouhu gewu-zongshi chuangxiang-lingyun)

start() {
  [ -x "$VENV" ] || { echo "venv 缺失: 先执行 python3 -m venv .venv-fleet && .venv-fleet/bin/pip install flask requests"; exit 1; }
  nohup "$VENV" "$STUB" >"$LOG_DIR/vllm-stub.log" 2>&1 &
  echo "vLLM stub :8000 pid=$!"
  GOVERNANCE_DB=/tmp/yyc3-gov/governance.db nohup "$VENV" "$GOV" >"$LOG_DIR/governance.log" 2>&1 &
  echo "governance :25700 pid=$!"
  sleep 1
  i=0
  for a in "${FLEET[@]}"; do
    AGENT_NAME="$a" AGENT_ROLE=member AGENT_LABEL="$a" \
    SYSTEM_PROMPT_PATH="$AGENTS_DIR/$a/SYSTEM.md" \
    GOVERNANCE_ENDPOINT=http://localhost:25700 \
    VLLM_ENDPOINT=http://localhost:8000/v1 \
    nohup "$VENV" "$AGENTS_DIR/$a/agent_server.py" --port $((25600+i)) >"$LOG_DIR/$a.log" 2>&1 &
    echo "$a :$((25600+i)) pid=$!"
    i=$((i+1))
  done
  sleep 3
  status
}

stop() {
  pkill -f "vllm-stub.py" 2>/dev/null
  pkill -f "governance_hub.py" 2>/dev/null
  pkill -f "agent_server.py --port 256" 2>/dev/null
  echo "fleet stopped"
}

status() {
  for p in 8000 25700 $(seq 25600 25607); do
    nc -z -w1 localhost "$p" >/dev/null 2>&1 && echo ":$p OK" || echo ":$p DOWN"
  done
}

case "${1:-start}" in
  start) start ;;
  stop) stop ;;
  status) status ;;
  *) echo "usage: $0 [start|stop|status]" ;;
esac

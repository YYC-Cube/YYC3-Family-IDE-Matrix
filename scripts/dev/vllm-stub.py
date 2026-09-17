#!/usr/bin/env python3
"""vLLM 开发桩 — 模拟 Qwen3.6-27B-FP8 端点（:8000/v1）
供舰队 /health 探测 vllm_reachable=true 走 healthy 全绿路径；
/chat 回复固定文案（开发验证用，非生产推理）。
"""
from flask import Flask, jsonify, request

app = Flask(__name__)
MODEL = "Qwen/Qwen3.6-27B-FP8"


@app.route("/v1/models")
def models():
    return jsonify({"object": "list", "data": [{"id": MODEL, "object": "model"}]})


@app.route("/v1/chat/completions", methods=["POST"])
def chat():
    body = request.get_json(force=True) or {}
    prompt_roles = [m.get("role", "?") for m in body.get("messages", [])]
    reply = f"[vLLM-stub] 收到 {len(prompt_roles)} 条消息（{'+'.join(prompt_roles)}）— 桩回复"
    return jsonify({
        "id": "chatcmpl-stub",
        "object": "chat.completion",
        "model": MODEL,
        "choices": [{
            "index": 0,
            "message": {"role": "assistant", "content": reply},
            "finish_reason": "stop",
        }],
        "usage": {"prompt_tokens": 12, "completion_tokens": 24, "total_tokens": 36},
    })


if __name__ == "__main__":
    # 0.0.0.0 监听 — 供 docker 容器经宿主机 IP 访问（new-api 渠道上游）
    app.run(host="0.0.0.0", port=8000, debug=False)

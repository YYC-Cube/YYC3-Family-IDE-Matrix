# YYC³ 协作服务端

y-websocket **协议兼容**的自建服务端（y-websocket ≥ 3 已 client-only，无官方 server）。

## 运行

```bash
cd ide
pnpm collab:server              # 127.0.0.1:1234
HOST=0.0.0.0 PORT=443 node collab-server/server.mjs   # 自定义
```

健康检查：`curl http://127.0.0.1:1234/healthz` → `{"ok":true,"rooms":N,...}`

## 客户端配置（ide/）

```bash
cp .env.example .env.local
# .env.local
VITE_COLLAB_SERVER_URL=ws://127.0.0.1:1234
```

或代码级显式注入（优先级最高）：

```ts
import { createCollabServiceFromConfig } from "@/services/collab";

const collab = createCollabServiceFromConfig({
  serverUrl: "wss://collab.example.com",
  room: "proj-42",
  userName: "YYC³",
});
collab.connect();
```

## 部署（PM2 + wss）

```bash
pm2 start collab-server/server.mjs --name yyc3-collab --env production
# wss 需前置 Nginx/Caddy 终结 TLS：
#   location / { proxy_pass http://127.0.0.1:1234; proxy_http_version 1.1;
#                proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; }
```

客户端随后配置 `VITE_COLLAB_SERVER_URL=wss://<域名>`。

## 协议说明

按 y-websocket 线协议实现（`messageSync=0 / messageAwareness=1 / messageAuth=2 /
queryAwareness=3`），`WebsocketProvider(serverUrl, room, doc)` 直连无需任何客户端
改动。房间名取 URL 路径段或 `?room=` 参数；文档在房间清空后驻留内存（生产可加
TTL 回收与 y-leveldb 持久化，见 server.mjs 注释）。

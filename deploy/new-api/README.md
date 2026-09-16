# YYC³ Matrix — new-api 生产代理部署资产

> 五高之「高安全」落地：浏览器零密钥。API Key 仅存服务端，前端经 `proxyAdapter`
> （`ide/services/llm/proxyAdapter.ts`）的 `proxyFetch` 转发，密钥在 nginx 层注入。

## 架构

```
浏览器 IDE (proxyFetch)
   │  POST {base}/{providerId}/v1/chat/completions
   │  头: X-Proxy-Auth: {PROXY_AUTH_TOKEN}
   ▼
nginx :3001  ── 路由翻译 / 密钥注入 / SSE 透传 / 限 body
   ▼
new-api :3000  ── 令牌鉴权 / 渠道管理 / 计量计费 / 限速
   ▼
上游 Provider（zhipu / dashscope / deepseek / ollama / …）
```

与 `ide/ProxyService.ts` 的契约：

| 契约项 | Matrix 侧 | 本部署 |
| --- | --- | --- |
| baseUrl | `http://<host>:3001/api/proxy` | nginx `location /api/proxy/` |
| 请求形状 | `/{providerId}{endpoint}` | 正则剥离 `providerId` → new-api 根路径 |
| 健康探测 | `GET {base}/health` | 反代 `new-api /api/status` |
| 前端认证 | `X-Proxy-Auth` 头 | 剥离后不外泄（可选强制校验） |
| 密钥 | 浏览器不持有 | `Authorization: Bearer ${NEW_API_KEY}` 注入 |
| 流式 | `Accept: text/event-stream` | `proxy_buffering off` SSE 透传 |

## 部署步骤

```bash
# 1. 准备环境变量
cd deploy/new-api
cp .env.example .env
# 填入 NEW_API_KEY（new-api 后台 → 令牌 → 新建系统令牌 sk-xxx）
# 可选：PROXY_AUTH_TOKEN（前端代理设置里填同值即可启用前端认证）

# 2. 启动
docker compose up -d

# 3. 验证
curl http://localhost:3001/api/proxy/health
# 期望: {"success":true,...} （new-api /api/status）

# 4. new-api 后台配置上游渠道
#    http://localhost:3001 → root 登录（INIT_ROOT_PASSWORD）
#    渠道管理 → 添加渠道（zhipu/dashscope/deepseek/ollama…）
#    模型重定向：把 Matrix 使用模型映射到对应上游模型
```

## IDE 侧接入（浏览器一次性配置）

模型设置 → 代理配置（`ProxyConfigPanel`）：

| 字段 | 值 |
| --- | --- |
| 启用代理 | 开 |
| baseUrl | `http://<proxy-host>:3001/api/proxy` |
| authToken | 与 `.env` 的 `PROXY_AUTH_TOKEN` 一致（未设置则留空） |

此后 `smartChatCompletion` 自动代理优先、直发回退（`isProxyHealthy` 1 分钟缓存探测）。

## providerId → 渠道路由

`proxyChatCompletion` 以 `provider.id` 拼接 URL（`zai-plan` / `ollama`），nginx 剥离该段后
new-api 按「模型名」路由渠道。即在 new-api 中：

- `zai-plan` 渠道：绑定智谱上游 + Matrix 所用模型名
- `ollama` 渠道：绑定本地 Ollama（`http://host.docker.internal:11434`）+ 本地模型名

若需按 providerId 强隔离，可在 `nginx.conf` 追加两个精确 location 分别
`proxy_set_header Authorization "Bearer <渠道专属令牌>"`。

## 与旧版 CF Worker 代理的关系

`ide/ProxyService.ts` 内嵌 Cloudflare Worker 源码（`PROVIDER_ENDPOINTS` 静态映射）为
开发/边缘方案；本资产为**生产自托管方案**，二者共用前端契约，按 `baseUrl` 切换，互不冲突。

## 安全清单

- [x] API Key 仅存服务端 `.env`，不入库不入前端
- [x] `client_max_body_size 8m` 防超大请求
- [x] `GLOBAL_API_RATE_LIMIT` 票据级限速
- [x] 未匹配路径一律 404，最小暴露面
- [ ] 公网部署时：nginx 前加 TLS（443 终结）+ `PROXY_AUTH_TOKEN` 强制启用
- [ ] new-api 初始 root 密码首登后立即修改

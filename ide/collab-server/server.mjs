/**
 * YYC³ 协作服务端 — y-websocket 协议兼容（ws + yjs + y-protocols 自建实现）
 *
 * 背景：y-websocket ≥3 为 client-only（无 bin/server 导出），此处按其线协议
 * （messageSync=0 / messageAwareness=1 / messageAuth=2 / queryAwareness=3）
 * 实现等价服务端，供 ide/services/collab 的 WebsocketProvider 直连。
 *
 * 运行：node collab-server/server.mjs
 * 环境变量：HOST（默认 127.0.0.1） PORT（默认 1234）
 * 部署：pm2 start collab-server/server.mjs --name yyc3-collab
 *      （客户端配置 VITE_COLLAB_SERVER_URL=wss://<域名>）
 */

import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";

const HOST = process.env.HOST ?? "127.0.0.1";
const PORT = Number(process.env.PORT ?? 1234);
const PING_INTERVAL = 30_000;
const AWARENESS_TIMEOUT = 30_000;

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
const MESSAGE_QUERY_AWARENESS = 3;

/** 房间文档（每房间一个 Y.Doc + Awareness + 连接集） */
class RoomDoc extends Y.Doc {
  constructor() {
    super();
    this.awareness = new awarenessProtocol.Awareness(this);
    this.awareness.setLocalState(null);
    this.conns = new Set();

    // 本地 awareness 变更（如超时清理）广播给全体
    this.awareness.on("update", ({ added, updated, removed }, origin) => {
      const changedClients = added.concat(updated, removed);
      if (origin === "local" || origin === null) return; // 服务端自身不产生状态
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients),
      );
      broadcast(this, encoding.toUint8Array(encoder));
    });
  }
}

function broadcast(doc, message, exclude = null) {
  for (const conn of doc.conns) {
    if (conn === exclude) continue;
    if (conn.readyState === conn.OPEN) conn.send(message, { binary: true });
  }
}

/** 房间表 */
const docs = new Map();

function getRoomDoc(roomName) {
  let doc = docs.get(roomName);
  if (!doc) {
    doc = new RoomDoc();
    docs.set(roomName, doc);
  }
  return doc;
}

/** 建立 WS 连接的同步语义（与 y-websocket 服务端一致） */
function setupWSConnection(conn, doc) {
  doc.conns.add(conn);
  conn.binaryType = "arraybuffer";

  // 1) 初始 sync：发送 state 向量请求 + 当前状态
  const syncEncoder = encoding.createEncoder();
  encoding.writeVarUint(syncEncoder, MESSAGE_SYNC);
  syncProtocol.writeSyncStep1(syncEncoder, doc);
  conn.send(encoding.toUint8Array(syncEncoder), { binary: true });

  // 2) 初始 awareness 快照
  const awarenessStates = doc.awareness.getStates();
  if (awarenessStates.size > 0) {
    const awarenessEncoder = encoding.createEncoder();
    encoding.writeVarUint(awarenessEncoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(
      awarenessEncoder,
      awarenessProtocol.encodeAwarenessUpdate(
        doc.awareness,
        [...awarenessStates.keys()],
      ),
    );
    conn.send(encoding.toUint8Array(awarenessEncoder), { binary: true });
  }

  // 3) 心跳
  conn.isAlive = true;
  conn.on("pong", () => { conn.isAlive = true; });

  // 4) 消息处理
  conn.on("message", (data) => {
    try {
      const decoder = decoding.createDecoder(new Uint8Array(data));
      const encoder = encoding.createEncoder();
      const messageType = decoding.readVarUint(decoder);
      switch (messageType) {
        case MESSAGE_SYNC: {
          encoding.writeVarUint(encoder, MESSAGE_SYNC);
          syncProtocol.readSyncMessage(decoder, encoder, doc, conn.origin);
          if (encoding.length(encoder) > 1) {
            conn.send(encoding.toUint8Array(encoder), { binary: true });
          }
          break;
        }
        case MESSAGE_AWARENESS: {
          // 只读一次：第一次读用于广播、同一字节再喂 apply（原实现二次读越界）
          const update = decoding.readVarUint8Array(decoder);
          encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
          encoding.writeVarUint8Array(encoder, update);
          broadcast(doc, encoding.toUint8Array(encoder), conn);
          awarenessProtocol.applyAwarenessUpdate(doc.awareness, update, conn.origin);
          break;
        }
        case MESSAGE_QUERY_AWARENESS: {
          encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
          encoding.writeVarUint8Array(
            encoder,
            awarenessProtocol.encodeAwarenessUpdate(
              doc.awareness,
              [...doc.awareness.getStates().keys()],
            ),
          );
          conn.send(encoding.toUint8Array(encoder), { binary: true });
          break;
        }
        default:
          break;
      }
    } catch (err) {
      console.error("[collab-server] message error:", err);
    }
  });

  // 5) 断开：清理 awareness 并广播
  conn.on("close", () => {
    doc.conns.delete(conn);
    if (doc.conns.size === 0) {
      // 房间清空：清理全部 awareness 状态
      if (doc.awareness.getStates().size > 0) {
        awarenessProtocol.removeAwarenessStates(
          doc.awareness,
          [...doc.awareness.getStates().keys()],
          "connection closed",
        );
      }
      // 简单驻留策略：保留文档供重连（生产可加 TTL 回收/持久化）
    }
  });
}

// ── HTTP + WS 启动 ──

const server = createServer((req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, rooms: docs.size, ts: Date.now() }));
    return;
  }
  res.writeHead(404).end();
});

const wss = new WebSocketServer({ server });

wss.on("connection", (conn, request) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
  // 房间名：路径段或 ?room= 查询参数（客户端 WebsocketProvider(serverUrl, room, doc)
  // 的 room 会作为路径拼接）
  const roomName = decodeURIComponent(
    url.searchParams.get("room") ?? url.pathname.replace(/^\/+/, "") ?? "default",
  ) || "default";
  conn.origin = `ws-${Math.random().toString(36).slice(2, 10)}`;
  setupWSConnection(conn, getRoomDoc(roomName));
});

// 心跳：踢除僵死连接
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, PING_INTERVAL);
heartbeat.unref?.();

// awareness 超时清理（协议默认 30s）
setInterval(() => {
  for (const doc of docs.values()) {
    awarenessProtocol.removeAwarenessStates(
      doc.awareness,
      awarenessProtocol.getAwarenessStatesToClean?.(doc.awareness, AWARENESS_TIMEOUT) ?? [],
      "timeout",
    );
  }
}, AWARENESS_TIMEOUT).unref?.();

server.listen(PORT, HOST, () => {
  console.log(
    `[collab-server] y-websocket 兼容服务已启动: ws://${HOST}:${PORT} (健康检查: http://${HOST}:${PORT}/healthz)`,
  );
});

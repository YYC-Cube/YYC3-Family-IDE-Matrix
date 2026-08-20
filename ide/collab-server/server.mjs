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
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
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
/** 房间 TTL：最后一个连接断开后经此毫秒数回收（env 可调；0=禁用回收） */
const ROOM_TTL_MS = Number(process.env.ROOM_TTL_MS ?? 10 * 60_000);
/** 持久化目录：Y.Doc 状态快照（env 可调；空串=禁用持久化） */
const PERSIST_DIR = process.env.PERSIST_DIR ?? "./collab-server/data";
/** 持久化写盘防抖 */
const PERSIST_DEBOUNCE_MS = 2_000;

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
const MESSAGE_QUERY_AWARENESS = 3;

/** 房间文档（每房间一个 Y.Doc + Awareness + 连接集） */
class RoomDoc extends Y.Doc {
  constructor(roomName) {
    super();
    this.roomName = roomName;
    this.gcTimer = null;        // TTL 回收计时器
    this.persistTimer = null;   // 写盘防抖计时器
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

// ── 持久化：房间级 Y.Doc 状态快照（原子写：tmp → rename）──

const persistDirAbs = PERSIST_DIR ? resolve(PERSIST_DIR) : null;
if (persistDirAbs) await mkdir(persistDirAbs, { recursive: true });

function persistPath(roomName) {
  // 房间名仅作文件名：剔除路径分隔符防目录穿越
  const safe = roomName.replace(/[\\/]/g, "_");
  return join(persistDirAbs, `${safe}.ydoc`);
}

async function loadPersistedState(roomName) {
  if (!persistDirAbs) return null;
  const file = persistPath(roomName);
  if (!existsSync(file)) return null;
  try {
    return new Uint8Array(await readFile(file));
  } catch (err) {
    console.error(`[collab-server] 读取快照失败 (${roomName}):`, err.message);
    return null;
  }
}

async function persistRoomState(roomName, doc) {
  if (!persistDirAbs) return;
  const file = persistPath(roomName);
  const tmp = `${file}.${Date.now()}.tmp`;
  try {
    await writeFile(tmp, Y.encodeStateAsUpdate(doc));
    await rename(tmp, file); // 原子替换
  } catch (err) {
    console.error(`[collab-server] 写入快照失败 (${roomName}):`, err.message);
  }
}

function broadcast(doc, message, exclude = null) {
  for (const conn of doc.conns) {
    if (conn === exclude) continue;
    if (conn.readyState === conn.OPEN) conn.send(message, { binary: true });
  }
}

/** 房间表（含 TTL 回收） */
const docs = new Map();

function cancelRoomGC(doc) {
  if (doc.gcTimer) {
    clearTimeout(doc.gcTimer);
    doc.gcTimer = null;
  }
}

/** 房间回收：立即落盘 → 从表中移除 → destroy */
function gcRoom(roomName) {
  const doc = docs.get(roomName);
  if (!doc || doc.conns.size > 0) return;
  docs.delete(roomName);
  const finalFlush = doc.persistTimer
    ? Promise.resolve()
    : persistRoomState(roomName, doc);
  if (doc.persistTimer) {
    clearTimeout(doc.persistTimer);
    doc.persistTimer = null;
  }
  Promise.resolve(finalFlush)
    .then(() => persistRoomState(roomName, doc))
    .catch(() => undefined)
    .finally(() => doc.destroy());
  console.log(`[collab-server] 房间 "${roomName}" 已回收（TTL 到期，状态已持久化）`);
}

function scheduleRoomGC(doc) {
  if (!ROOM_TTL_MS) return; // 0 = 禁用回收（永久驻留）
  cancelRoomGC(doc);
  doc.gcTimer = setTimeout(() => gcRoom(doc.roomName), ROOM_TTL_MS);
  doc.gcTimer.unref?.();
}

/** 防抖落盘 */
function schedulePersist(doc) {
  if (!persistDirAbs) return;
  if (doc.persistTimer) clearTimeout(doc.persistTimer);
  doc.persistTimer = setTimeout(() => {
    doc.persistTimer = null;
    void persistRoomState(doc.roomName, doc);
  }, PERSIST_DEBOUNCE_MS);
  doc.persistTimer.unref?.();
}

/**
 * 获取（或创建）房间文档；创建时异步恢复持久化快照。
 * 返回 doc（快照在后台 apply，首个 sync-step 交互天然兼容增量合并）。
 */
function getRoomDoc(roomName) {
  let doc = docs.get(roomName);
  if (!doc) {
    doc = new RoomDoc(roomName);
    docs.set(roomName, doc);

    // 文档变更 → 防抖落盘
    doc.on("update", () => schedulePersist(doc));

    // 恢复快照（如有）
    if (persistDirAbs) {
      loadPersistedState(roomName).then((state) => {
        if (state && docs.get(roomName) === doc && doc.conns.size > 0) {
          Y.applyUpdate(doc, state, "persistence");
        } else if (state) {
          // 尚无连接：先恢复内存态，等首连同步分发
          Y.applyUpdate(doc, state, "persistence");
        }
      });
    }
  }
  cancelRoomGC(doc); // 活跃连接存在 → 取消回收
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
      // 房间空置：排程 TTL 回收（回收时最终落盘；重连会取消）
      scheduleRoomGC(doc);
    }
  });
}

// ── HTTP + WS 启动 ──

const server = createServer((req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, rooms: docs.size, persistence: !!persistDirAbs, roomTtlMs: ROOM_TTL_MS, ts: Date.now() }));
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

// 优雅退出：全部房间最终落盘
async function shutdown() {
  const rooms = [...docs.entries()];
  await Promise.all(rooms.map(([name, doc]) => persistRoomState(name, doc)));
  console.log(`[collab-server] 已持久化 ${rooms.length} 个房间，退出`);
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

server.listen(PORT, HOST, () => {
  console.log(
    `[collab-server] y-websocket 兼容服务已启动: ws://${HOST}:${PORT} (健康检查: http://${HOST}:${PORT}/healthz)`,
  );
});

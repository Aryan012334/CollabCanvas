const WebSocket = require('../../node_modules/ws');

const API_URL = 'http://localhost:3001';

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`${response.status}: ${JSON.stringify(body)}`);
  return body;
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.once('open', () => resolve(socket));
    socket.once('error', reject);
  });
}

function nextEvent(socket, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting for WebSocket event')), timeoutMs);
    socket.once('message', (raw) => {
      clearTimeout(timer);
      resolve(JSON.parse(raw.toString()));
    });
  });
}

(async () => {
  const suffix = Date.now();
  const email = `mobile-smoke-${suffix}@example.com`;
  await api('/signup', { method: 'POST', body: JSON.stringify({ name: 'Mobile Smoke Test', email, password: 'smoke-password-123' }) });
  const login = await api('/login', { method: 'POST', body: JSON.stringify({ email, password: 'smoke-password-123' }) });
  const token = login.user.token;
  const roomId = (await api('/room', { method: 'POST', headers: { Authorization: token }, body: JSON.stringify({ name: `smoke-${suffix}` }) })).data.roomId;
  const url = `ws://localhost:4000?token=${encodeURIComponent(token)}`;
  const first = await connect(url);
  const second = await connect(url);
  first.send(JSON.stringify({ type: 'join-room', roomId }));
  second.send(JSON.stringify({ type: 'join-room', roomId }));
  await nextEvent(first);
  const received = nextEvent(second);
  first.send(JSON.stringify({
    type: 'shape:create',
    roomId,
    shape: {
      startX: 10,
      startY: 20,
      width: 30,
      height: 25,
      type: 'FREEHAND',
      points: [{ x: 10, y: 20 }, { x: 25, y: 30 }, { x: 40, y: 45 }],
      strokeWidth: 4,
      strokeColor: '#f2f0e9',
      strokeStyle: 'solid',
    },
  }));
  const event = await received;
  if (event.type !== 'shape:create' || event.shape?.type !== 'FREEHAND' || event.shape.points?.length !== 3) {
    throw new Error(`Unexpected event: ${JSON.stringify(event)}`);
  }
  let persisted = [];
  for (let attempt = 0; attempt < 10; attempt += 1) {
    persisted = await api(`/shapes/${roomId}`, { headers: { Authorization: token } });
    if (persisted.some((shape) => shape.type === 'FREEHAND' && shape.points?.length === 3)) break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (!persisted.some((shape) => shape.type === 'FREEHAND' && shape.points?.length === 3)) throw new Error(`Shape was broadcast but not persisted: ${JSON.stringify(persisted)}`);
  await api(`/room/${roomId}`, { method: 'DELETE', headers: { Authorization: token } });
  console.log(JSON.stringify({ ok: true, event: event.type, shapeType: event.shape.type, pointCount: event.shape.points.length, persisted: true }));
  first.close();
  second.close();
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});

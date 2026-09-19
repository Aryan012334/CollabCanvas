const fs = require('fs');
const path = require('path');
const jwt = require('../../apps/ws-server/node_modules/jsonwebtoken');
const WebSocket = require('../../node_modules/ws');

const env = fs.readFileSync(path.resolve(__dirname, '../../.env'), 'utf8');
const secret = env.match(/^JWT_SECRET=(.*)$/m)?.[1]?.trim();
if (!secret) throw new Error('JWT_SECRET is missing from .env');

const token = jwt.sign({ userId: `smoke-${Date.now()}`, name: 'Mobile Smoke Test' }, secret, { expiresIn: '5m' });
const roomId = String(Date.now());
const url = `ws://localhost:4000?token=${encodeURIComponent(token)}`;

function connect() {
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
  const first = await connect();
  const second = await connect();
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
  console.log(JSON.stringify({ ok: true, event: event.type, shapeType: event.shape.type, pointCount: event.shape.points.length }));
  first.close();
  second.close();
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});

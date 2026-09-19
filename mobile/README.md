# CollabDraw Mobile

Expo React Native MVP for the existing CollabDraw backend.

## Implemented

- Login and signup through the existing REST API.
- JWT persistence with `expo-secure-store`.
- Room creation and joining by numeric ID or slug.
- Initial canvas loading from `GET /shapes/:roomId`.
- Touch freehand drawing over `react-native-svg`.
- Real-time `shape:create` and `shape:id_assigned` synchronization.
- Live collaborator cursor positions through `cursor:move`.
- Graceful `join-room` and `leave-room` events.

## Run

From the repository root:

```bash
pnpm install
pnpm --filter mobile start
```

Then open the project in Expo Go or an Android emulator. The same backend URLs can be overridden with Expo public environment variables:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.20:3001
EXPO_PUBLIC_WS_URL=ws://192.168.1.20:4000
```

Use the computer's LAN IP rather than `localhost` when running Expo Go on a physical phone. Android emulators can usually reach a host service through `10.0.2.2` instead.

The PostgreSQL migration adding `FREEHAND` must be applied before drawing is persisted:

```bash
pnpm db:migrate
```

## Protocol

The mobile client uses the existing raw JWT convention:

- REST: `Authorization: <token>`
- WebSocket: `ws://<host>:4000?token=<token>`

The drawing event is the existing `shape:create` event with `shape.type = "FREEHAND"` and a `points` array. The corresponding migration and web renderer are included in this branch so mobile-created strokes are visible to web clients too.

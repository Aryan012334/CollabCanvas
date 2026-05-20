# CollabDraw — Full Project Report

## What It Is

CollabDraw is a real-time collaborative drawing application — think Excalidraw but self-hosted. Multiple users can join a shared canvas room and draw shapes together in real time. Built as a pnpm monorepo with Turborepo.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui |
| HTTP Backend | Express 5, TypeScript, Prisma ORM, bcryptjs, JWT |
| WebSocket Server | Node.js, `ws` library, TypeScript |
| Database | PostgreSQL (via Prisma) |
| Monorepo | pnpm workspaces + Turborepo |
| Auth | JWT stored in cookie (`nookies`), no OAuth |
| State | React Context (user), TanStack Query (server state) |
| Canvas | Raw HTML5 Canvas API (no canvas library) |

---

## Monorepo Structure

```
CollabDraw/
├── apps/
│   ├── web/                  # Next.js frontend (port 3000)
│   ├── http-backend/         # Express REST API (port 3001)
│   └── ws-server/            # WebSocket server (port 4000)
├── packages/
│   ├── db/                   # Prisma client + schema
│   ├── common/               # Shared Zod validation schemas
│   ├── backend-common/       # JWT_SECRET config
│   ├── ui/                   # Shared UI components (minimal)
│   ├── eslint-config/        # Shared ESLint config
│   └── typescript-config/   # Shared tsconfig bases
├── docker-compose.yml        # postgres + http-backend + ws-server
├── .env                      # Root env file (shared by all apps)
└── turbo.json
```

---

## Database Schema (Prisma)

```
User          id(uuid), email(unique), password(hashed), name, photo?, createdAt, updatedAt, deletedAt?
Room          id(int autoincrement), slug(unique), adminId(→User), createdAt, updatedAt, deletedAt?
RoomParticipant  id, roomId(→Room), userId(→User), unique(roomId+userId)
Chat          id, roomId, userId, message, createdAt
Shape         id, roomId, userId, type(ShapeType enum), startX?, startY?, width?, height?,
              strokeColor?, fillColor?, strokeWidth?, strokeStyle?, fillStyle?,
              points(Json?), text?, fontSize?, createdAt, updatedAt

enum ShapeType { RECTANGLE, CIRCLE, LINE, DIAMOND, ARROW, TEXT }
```

Key notes:
- `startX`, `startY`, `width`, `height` are nullable (`Int?`) in the DB
- `Room.deletedAt` exists for soft-delete but `DELETE /room/:roomId` does a hard delete (inconsistency)
- `GET /rooms` only returns rooms where `adminId = userId` (not participant rooms)

---

## Environment Variables

All apps read from the root `.env` file:

```env
DATABASE_URL=postgresql://postgres:mysecretpassword@localhost:5433/collabdraw?schema=public
JWT_SECRET=your_jwt_secret_key_change_in_production
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SOCKET_URL=ws://localhost:4000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NODE_ENV=development
```

- `http-backend` loads it via `dotenv.config({ path: "../../.env" })`
- `ws-server` loads it via `src/env.ts` (same path)
- `packages/db` loads it via a custom `scripts/with-root-env.cjs` wrapper for Prisma CLI

---

## HTTP Backend — All Routes

**Base URL:** `http://localhost:3001`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | DB ping check |
| POST | `/signup` | No | Create user. Body: `{ name, email, password }`. Returns `{ userId }` |
| POST | `/login` | No | Login. Body: `{ email, password }`. Sets `token` cookie + returns `{ user: { id, name, email, photo, token } }` |
| GET | `/me` | Yes | Returns `{ user }` for the token owner |
| POST | `/room` | Yes | Create room. Body: `{ name }` (converted to slug). Returns `{ roomId }` |
| DELETE | `/room/:roomId` | Yes | Hard-delete room (admin only). `roomId` is numeric |
| GET | `/rooms` | Yes | Returns `{ rooms: [] }` — only rooms where `adminId = userId` |
| GET | `/room/:slug` | No | Lookup room by slug. Returns `{ room }` |
| GET | `/shapes/:roomId` | Yes | Returns array of shapes for a room, ordered `id ASC`, max 1000 |

**Auth middleware:** reads `Authorization` header (raw token, no `Bearer` prefix) OR `token` cookie. Attaches `userId` to request.

**JWT payload:** `{ userId: string, name: string }` — signed with `JWT_SECRET`, no expiry set.

---

## WebSocket Server

**URL:** `ws://localhost:4000?token=<jwt>`

Connection flow:
1. Client connects with JWT in query string
2. Server verifies token → extracts `{ userId, name }`
3. User added to in-memory `users` Map
4. On disconnect: user removed from all rooms, remaining users notified

**In-memory state:**
```ts
users: Map<string, User>        // userId → User
rooms: Map<string, Set<User>>   // roomId(string) → Set of Users
```

**Events (client → server):**

```json
{ "type": "join-room",    "roomId": 42 }
{ "type": "leave-room",   "roomId": 42 }
{ "type": "shape:create", "roomId": 42, "shape": { ...shapeData } }
{ "type": "shape:update", "roomId": 42, "shape": { id, ...shapeData } }
{ "type": "chat",         "roomId": 42, "message": "hello" }
```

**Events (server → client):**

```json
{ "type": "user_joined",  "userId": "name" }
{ "type": "user_left",    "userId": "...", "username": "...", "roomId": "..." }
{ "type": "shape:create", "shape": { ...shape, id: dbId }, "roomId": "...", "userId": "...", "username": "..." }
{ "type": "shape:update", "shape": { ...shape, id: dbId }, "roomId": "...", "userId": "...", "username": "..." }
{ "type": "chat",         "message": "...", "roomId": "...", "userId": "...", "username": "..." }
{ "type": "error",        "message": "..." }
```

**Important:** `roomId` is normalized to `String` internally. Client sends numeric, server stores as string key.

**DB write queue:** Shape creates/updates are queued and written to DB asynchronously. On DB error: retries up to 3 times with backoff, then rejects. Broadcast happens immediately (before DB write completes).

---

## Frontend — App Structure

```
apps/web/
├── app/
│   ├── layout.tsx              # Root layout: AppProviders > ContextProvider > UserLoader > children
│   ├── page.tsx                # Landing page (Navbar, Hero, Features, etc.)
│   ├── (auth)/
│   │   ├── login/page.tsx      # Login page
│   │   └── signup/page.tsx     # Signup page
│   ├── dashboard/
│   │   └── page.tsx            # Dashboard (protected, shows rooms)
│   └── board/
│       ├── game.ts             # Canvas engine (all drawing logic)
│       ├── repaint.ts          # Shape rendering functions
│       ├── types.ts            # Shape types, tool types, ShapeType enum
│       └── [roomId]/
│           └── page.tsx        # Board/canvas page
├── components/
│   ├── providers/
│   │   ├── AppProvider.tsx     # QueryClient + ThemeProvider
│   │   └── ContextProvider.tsx # User context + UserLoader (fetches /me on mount)
│   ├── dashboard/
│   │   ├── Header.tsx          # Top nav with logout, profile dropdown
│   │   ├── QuickActions.tsx    # Create room, Join via code, Import, Export
│   │   ├── RoomsGrid.tsx       # Room cards with open/share/delete
│   │   ├── StatsCard.tsx       # Hardcoded stats (Total Rooms, Collaborators, Hours)
│   │   ├── RecentActivity.tsx  # Hardcoded mock activity feed
│   │   ├── Searchbar.tsx       # Search input (filters rooms client-side)
│   │   └── DashboardSkeleton.tsx
│   ├── landing/                # Landing page sections (Navbar, Hero, etc.)
│   ├── login-form.tsx          # Login form with react-hook-form + zod
│   ├── signup-form.tsx         # Signup form
│   ├── Propertypanel.tsx       # Shape property editor (stroke, fill, width, style)
│   ├── StrokeControl.tsx       # Stroke width + style picker
│   ├── TextOnCanvas.tsx        # Floating textarea for text tool
│   ├── CanvasDropdown.tsx      # Board menu: theme switcher, social links
│   └── DarkMode.tsx            # Theme toggle button
├── hooks/
│   ├── useWebSocket.tsx        # WS connection with reconnect (5 attempts, 3s backoff)
│   └── useUserFetcher.tsx      # TanStack Query wrapper for GET /me
├── actions/
│   └── action.ts               # All API calls (login, signup, createRoom, getRooms, etc.)
└── lib/
    ├── axios.ts                # Axios instance (baseURL from NEXT_PUBLIC_API_URL)
    └── utils.ts                # cn() utility
```

---

## Auth Flow

1. **Signup:** POST `/signup` → redirect to `/login`
2. **Login:** POST `/login` → server sets `token` cookie + returns user data → client sets Context user + `nookies` cookie → redirect to `/dashboard`
3. **Session restore:** On every page load, `UserLoader` calls `GET /me` (if token cookie exists) → populates Context with user data + token
4. **Logout:** Destroy cookie → clear Context → redirect to `/login`
5. **No route guards:** There is no Next.js middleware protecting `/dashboard` or `/board/*`. Protection is implicit — if no token, WS connection fails and board redirects to `/login`.

---

## Canvas System

**`game.ts`** is the core engine. It's a module-level singleton:

```ts
export let allDrawings: Shape[] = []  // global mutable array
```

**`initDrawing(canvas, send, roomId, ...)`** — async function that:
1. Fetches all existing shapes from `GET /shapes/:roomId` and renders them
2. Attaches mouse event listeners (mousedown, mousemove, mouseup, dblclick)
3. Attaches wheel listener for zoom-to-cursor
4. Returns a cleanup function that removes all listeners

**Drawing flow:**
- `mousedown` → start drawing (record `startX`, `startY`)
- `mousemove` → preview shape on canvas (not saved yet)
- `mouseup` → `send({ type: "shape:create", roomId, shape: {...} })` to WS
- WS server saves to DB, broadcasts back with real DB `id`
- All clients receive `shape:create` → push to `allDrawings` → re-render
- Creator also receives echo → pushed to `allDrawings` (gets real DB id), but re-render skipped (already visible)

**Shape types:** `RECTANGLE`, `CIRCLE`, `LINE`, `DIAMOND`, `ARROW`, `TEXT`

**Tools:** hand (pan), select, rect, diamond, circle, arrow, line, text, eraser (eraser has no implementation)

**Zoom/Pan:** Managed via React state (`zoom`, `panOffset`) + refs for use inside canvas callbacks. Wheel zoom is cursor-anchored.

**Text tool:** Double-click on canvas → floating `<textarea>` overlay → on blur/Ctrl+Enter → `send({ type: "shape:create", shape: { type: "TEXT", text, ... } })`

**Select tool:** Click shape → drag to move → on mouseup sends `shape:update`. Double-click text shape → opens text editor.

---

## Dashboard Features

| Feature | Status |
|---------|--------|
| Create room | ✅ Working — dialog → POST /room → invalidates rooms query |
| List rooms | ✅ Working — GET /rooms (own rooms only) |
| Open room | ✅ Working — navigates to `/board/:roomId` |
| Delete room | ✅ Working — admin only, DELETE /room/:roomId |
| Share room | ✅ Working — copies `/board/:roomId` link |
| Join via Code | ✅ Working — dialog → navigates to `/board/<code>` |
| Import Canvas | ✅ Working — file picker → reads JSON → stores in sessionStorage |
| Export Canvas | ✅ Informational toast (export only available from inside board) |
| Search rooms | ✅ Working — client-side filter on slug |
| Stats cards | ⚠️ Hardcoded fake values (12 rooms, 24 collaborators, 18.5 hours) |
| Recent Activity | ⚠️ Hardcoded mock data — no real API |
| Profile page | ⚠️ Toast "coming soon" |
| Settings page | ⚠️ Toast "coming soon" |
| Notifications | ⚠️ Toast "no new notifications" |

---

## Board/Canvas Features

| Feature | Status |
|---------|--------|
| Load existing shapes | ✅ Working |
| Draw shapes (rect, circle, line, diamond, arrow) | ✅ Working |
| Text tool | ✅ Working |
| Select + move shapes | ✅ Working |
| Property panel (stroke/fill color, width, style) | ✅ Working |
| Zoom (buttons + mouse wheel) | ✅ Working |
| Pan (hand tool) | ✅ Working |
| Canvas background color | ✅ Working |
| Reset canvas (local only) | ✅ Working |
| Multiplayer sync | ✅ Working |
| Reconnect after disconnect | ✅ Working (5 attempts, 3s backoff) |
| Connection timeout error | ✅ Working (15s → error + back button) |
| Auth redirect | ✅ Working (no token → /login) |
| Eraser tool | ❌ Not implemented (button exists, no logic) |
| Export canvas to image/JSON | ❌ Not implemented from board |
| Undo/redo | ❌ Not implemented |
| Touch/mobile support | ❌ Mouse events only |

---

## Multiplayer Architecture

```
User A draws shape
  → send({ type: "shape:create", roomId: 42, shape: {...} })
  → WS server receives
  → Enqueues DB write (async)
  → Broadcasts to ALL users in room (including sender):
     { type: "shape:create", shape: { ...shape, id: dbId }, userId: "A" }
  → User A receives echo → pushes to allDrawings (gets real DB id), skips re-render
  → User B receives → pushes to allDrawings → re-renders canvas
```

Room membership is in-memory only. If WS server restarts, all room state is lost (users must rejoin). Shape data persists in DB.

---

## Known Limitations / Not Implemented

1. **Stats cards** — hardcoded fake numbers, no API
2. **Recent Activity** — hardcoded mock data, no activity log in DB
3. **Profile / Settings pages** — show "coming soon" toast
4. **Eraser tool** — button in toolbar, zero implementation
5. **Export from board** — no PNG/JSON export from canvas
6. **Undo/redo** — not implemented
7. **No Next.js middleware** — `/dashboard` and `/board/*` have no server-side auth guard
8. **JWT has no expiry** — tokens never expire
9. **JWT secret fallback** — `packages/backend-common/src/config.ts` falls back to `"123"` if `JWT_SECRET` env is not set
10. **GitHub OAuth buttons** — exist in login/signup forms, do nothing
11. **Forgot password** — links to `#`, no flow
12. **Mobile/touch** — canvas uses mouse events only
13. **Room participants** — `GET /rooms` only returns rooms you admin, not rooms you joined as participant
14. **Soft delete** — schema has `deletedAt` but delete route does hard delete
15. **WS in-memory state** — if ws-server restarts, all active room memberships are lost; no Redis pub/sub yet

---

## Files Modified in Recent Audit (what was fixed)

- `apps/web/app/board/[roomId]/page.tsx` — auth redirect, connection timeout, shape echo fix, cleanup fix, removed unused state/imports
- `apps/web/app/board/game.ts` — hit-test type fix, nullable field normalization, wheel zoom, unused imports removed
- `apps/web/hooks/useWebSocket.tsx` — reconnect logic added
- `apps/web/hooks/useUserFetcher.tsx` — skip fetch when no token, removed debug log
- `apps/web/components/providers/ContextProvider.tsx` — null photo fix
- `apps/web/components/dashboard/Header.tsx` — removed dead code block, wired Bell button
- `apps/web/components/dashboard/QuickActions.tsx` — wired Join/Import/Export buttons
- `apps/web/components/dashboard/RoomsGrid.tsx` — removed unused import, fixed share link, null-safe filter
- `apps/web/components/dashboard/StatsCard.tsx` — fixed broken template literal
- `apps/web/components/Propertypanel.tsx` — fixed invalid `#AARRGGBB` CSS color
- `apps/web/components/landing/navbar.tsx` — replaced missing image with icon
- `apps/web/components/auth/AuthImage.tsx` — replaced `<img>` with Next.js `<Image>`
- `apps/web/app/dashboard/page.tsx` — restored loading skeleton
- `apps/web/next.config.js` — added Unsplash remote image pattern
- `apps/http-backend/src/index.ts` — JWT includes name, rooms filtered by owner, shapes in asc order, empty catch blocks fixed
- `apps/ws-server/src/events/handlers.ts` — roomId string normalization (critical multiplayer fix), retry limit
- `docker-compose.yml` — fixed volume path, added backend services
- `apps/http-backend/Dockerfile` — fixed port, selective COPY
- `apps/ws-server/Dockerfile` — selective COPY
- `turbo.json` — added NEXT_PUBLIC_SOCKET_URL to build env
- `.env.example` — updated to match actual vars
- `.dockerignore` — added tsbuildinfo


---

## DevOps Infrastructure (Added)

### Docker

All three services are fully Dockerized with multi-stage builds:

| Image | Built from | Port |
|-------|-----------|------|
| `aryanyewale/collabdraw-http` | `apps/http-backend/Dockerfile` | 3001 |
| `aryanyewale/collabdraw-ws` | `apps/ws-server/Dockerfile` | 4000 |
| `aryanyewale/collabdraw-web` | `apps/web/Dockerfile` | 3000 |

Run the full stack locally:
```bash
docker compose up --build
# Frontend: http://localhost:3000
# API:      http://localhost:3001
# WS:       ws://localhost:4000
```

### Kubernetes

All manifests in `k8s/`. Tested locally on Docker Desktop Kubernetes.

```bash
kubectl apply -f k8s/
# Frontend: http://localhost  (via nginx ingress on port 80)
# API:      http://localhost/api/health
```

For AWS EKS: swap nginx ingress annotations for ALB annotations (documented in `k8s/ingress.yaml`).

### CI/CD

`Jenkinsfile` at repo root. Pipeline: git push → build images → push to Docker Hub → rolling deploy to Kubernetes.

### Monitoring

`k8s/monitoring.yaml` deploys Prometheus + Grafana to the `monitoring` namespace.

### Full Documentation

- `DEVOPS.md` — complete DevOps guide with all commands
- `CHANGES.md` — full change log of everything fixed and built

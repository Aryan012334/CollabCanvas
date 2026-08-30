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


---

## Complete DevOps Infrastructure

### Overview

CollabDraw has a full DevOps pipeline from local development to live AWS EKS deployment.

```
Developer Machine
  │
  ├── pnpm dev              → local development (ports 3000/3001/4000)
  ├── docker compose up     → full stack in Docker (same ports)
  └── kubectl apply -f k8s/ → Kubernetes (local: port 80, EKS: ALB DNS)
                                    │
                              AWS EKS Cluster
                              ├── ALB (public entry point)
                              ├── frontend pods (Next.js)
                              ├── http-backend pods (Express)
                              ├── ws-server pod (WebSocket)
                              └── postgres pod (EBS volume)
```

### Docker

Three multi-stage Dockerfiles — one per service. Each has:
- **Stage 1 (builder):** Install pnpm → compile TypeScript → JavaScript
- **Stage 2 (runner):** Copy compiled output only → run it

Key fix: `.dockerignore` must include `**/node_modules` — Windows symlinks break Linux containers.

Run locally:
```bash
docker compose up --build
```

### Kubernetes

13 YAML manifests in `k8s/`. Key concepts:
- **Deployment** — runs pods, restarts on crash
- **Service** — stable DNS name for pods
- **ConfigMap** — non-sensitive config
- **Secret** — passwords/keys (base64)
- **PVC** — persistent storage (EBS on AWS)
- **Ingress** — public entry point, path-based routing

Run locally (Docker Desktop):
```bash
kubectl apply -f k8s/
```

### AWS EKS (Live)

**Live URL:** `http://k8s-collabdr-collabdr-0c35dcb652-657159459.ap-south-1.elb.amazonaws.com`

- Region: `ap-south-1` (Mumbai)
- Cluster: `collabdraw-cluster`
- Nodes: 2× `t3.small` EC2
- Images stored in ECR: `collabdraw-http`, `collabdraw-ws`, `collabdraw-web`

Traffic flow:
```
Browser → AWS ALB → Ingress
  /api/*  → http-backend (Express)
  /ws     → ws-server (WebSocket)
  /       → frontend (Next.js)
```

### Terraform

Infrastructure-as-Code in `terraform/`. Creates VPC, EKS cluster, ECR repos.

```bash
cd terraform
terraform init && terraform apply
```

### Jenkins CI/CD

`Jenkinsfile` at repo root. Pipeline:
```
git push → build images → push to Docker Hub → kubectl set image → rolling deploy
```

### Monitoring

`k8s/monitoring.yaml` deploys Prometheus + Grafana to `monitoring` namespace.

```bash
kubectl port-forward svc/grafana 3001:3000 -n monitoring
# Open: http://localhost:3001
```

### Tools Installed

| Tool | Version | Purpose |
|------|---------|---------|
| kubectl | v1.34.1 | Kubernetes CLI |
| eksctl | 0.226.0 | EKS cluster management |
| helm | v3.17.3 | Kubernetes package manager |
| docker | 29.1.3 | Container runtime |
| aws CLI | 2.34.50 | AWS management |

### Complete Documentation

| File | Contents |
|------|---------|
| `DEVOPS.md` | Full DevOps guide — Docker, K8s, EKS, Jenkins, Prometheus |
| `CHANGES.md` | Every bug fixed, feature built, file modified |
| `EKS_RESTART.md` | Step-by-step guide to recreate the EKS cluster |
| `terraform/README.md` | Terraform + EKS deployment guide |






























////////////////
Windows PowerShell
Copyright (C) Microsoft Corporation. All rights reserved.

Install the latest PowerShell for new features and improvements! https://aka.ms/PSWindows

PS C:\Users\Aryan Yewale> $env:PATH = "$env:PATH;$env:USERPROFILE\tools"
PS C:\Users\Aryan Yewale> eksctl version
0.226.0
PS C:\Users\Aryan Yewale> eksctl create cluster `
>>   --name collabdraw-cluster `
>>   --region ap-south-1 `
>>   --nodegroup-name workers `
>>   --node-type t3.medium `
>>   --nodes 2 `
>>   --nodes-min 1 `
>>   --nodes-max 3 `
>>   --managed
2026-05-20 21:28:45 [ℹ]  eksctl version 0.226.0
2026-05-20 21:28:45 [ℹ]  using region ap-south-1
2026-05-20 21:28:46 [ℹ]  setting availability zones to [ap-south-1c ap-south-1a ap-south-1b]
2026-05-20 21:28:46 [ℹ]  subnets for ap-south-1c - public:192.168.0.0/19 private:192.168.96.0/19
2026-05-20 21:28:46 [ℹ]  subnets for ap-south-1a - public:192.168.32.0/19 private:192.168.128.0/19
2026-05-20 21:28:46 [ℹ]  subnets for ap-south-1b - public:192.168.64.0/19 private:192.168.160.0/19
2026-05-20 21:28:46 [ℹ]  nodegroup "workers" will use "" [AmazonLinux2023/1.34]
2026-05-20 21:28:46 [!]  Auto Mode will be enabled by default in an upcoming release of eksctl. This means managed node groups and managed networking add-ons will no longer be created by default. To maintain current behavior, explicitly set 'autoModeConfig.enabled: false' in your cluster configuration. Learn more: https://eksctl.io/usage/auto-mode/
2026-05-20 21:28:46 [ℹ]  using Kubernetes version 1.34
2026-05-20 21:28:46 [ℹ]  creating EKS cluster "collabdraw-cluster" in "ap-south-1" region with managed nodes
2026-05-20 21:28:46 [ℹ]  will create 2 separate CloudFormation stacks for cluster itself and the initial managed nodegroup
2026-05-20 21:28:46 [ℹ]  if you encounter any issues, check CloudFormation console or try 'eksctl utils describe-stacks --region=ap-south-1 --cluster=collabdraw-cluster'
2026-05-20 21:28:46 [ℹ]  Kubernetes API endpoint access will use default of {publicAccess=true, privateAccess=false} for cluster "collabdraw-cluster" in "ap-south-1"
2026-05-20 21:28:46 [ℹ]  CloudWatch logging will not be enabled for cluster "collabdraw-cluster" in "ap-south-1"
2026-05-20 21:28:46 [ℹ]  you can enable it with 'eksctl utils update-cluster-logging --enable-types={SPECIFY-YOUR-LOG-TYPES-HERE (e.g. all)} --region=ap-south-1 --cluster=collabdraw-cluster'
2026-05-20 21:28:46 [ℹ]  default addons vpc-cni, kube-proxy, coredns, metrics-server were not specified, will install them as EKS addons
2026-05-20 21:28:46 [ℹ]
2 sequential tasks: { create cluster control plane "collabdraw-cluster",
    2 sequential sub-tasks: {
        2 sequential sub-tasks: {
            1 task: { create addons },
            wait for control plane to become ready,
        },
        create managed nodegroup "workers",
    }
}
2026-05-20 21:28:46 [ℹ]  building cluster stack "eksctl-collabdraw-cluster-cluster"
2026-05-20 21:28:47 [ℹ]  deploying stack "eksctl-collabdraw-cluster-cluster"
2026-05-20 21:29:17 [ℹ]  waiting for CloudFormation stack "eksctl-collabdraw-cluster-cluster"
2026-05-20 21:29:47 [ℹ]  waiting for CloudFormation stack "eksctl-collabdraw-cluster-cluster"
2026-05-20 21:30:48 [ℹ]  waiting for CloudFormation stack "eksctl-collabdraw-cluster-cluster"
2026-05-20 21:31:49 [ℹ]  waiting for CloudFormation stack "eksctl-collabdraw-cluster-cluster"
2026-05-20 21:32:50 [ℹ]  waiting for CloudFormation stack "eksctl-collabdraw-cluster-cluster"
2026-05-20 21:33:50 [ℹ]  waiting for CloudFormation stack "eksctl-collabdraw-cluster-cluster"
2026-05-20 21:34:50 [ℹ]  waiting for CloudFormation stack "eksctl-collabdraw-cluster-cluster"
2026-05-20 21:35:51 [ℹ]  waiting for CloudFormation stack "eksctl-collabdraw-cluster-cluster"
2026-05-20 21:36:51 [ℹ]  waiting for CloudFormation stack "eksctl-collabdraw-cluster-cluster"
2026-05-20 21:36:54 [!]  recommended policies were found for "vpc-cni" addon, but since OIDC is disabled on the cluster, eksctl cannot configure the requested permissions; the recommended way to provide IAM permissions for "vpc-cni" addon is via pod identity associations; after addon creation is completed, add all recommended policies to the config file, under `addon.PodIdentityAssociations`, and run `eksctl update addon`
2026-05-20 21:36:54 [ℹ]  creating addon: vpc-cni
2026-05-20 21:36:54 [ℹ]  successfully created addon: vpc-cni
2026-05-20 21:36:54 [ℹ]  creating addon: kube-proxy
2026-05-20 21:36:55 [ℹ]  successfully created addon: kube-proxy
2026-05-20 21:36:55 [ℹ]  creating addon: coredns
2026-05-20 21:36:55 [ℹ]  successfully created addon: coredns
2026-05-20 21:38:59 [ℹ]  building managed nodegroup stack "eksctl-collabdraw-cluster-nodegroup-workers"
2026-05-20 21:39:00 [ℹ]  deploying stack "eksctl-collabdraw-cluster-nodegroup-workers"
2026-05-20 21:39:00 [ℹ]  waiting for CloudFormation stack "eksctl-collabdraw-cluster-nodegroup-workers"
2026-05-20 21:39:31 [ℹ]  waiting for CloudFormation stack "eksctl-collabdraw-cluster-nodegroup-workers"
2026-05-20 21:40:05 [ℹ]  waiting for CloudFormation stack "eksctl-collabdraw-cluster-nodegroup-workers"
2026-05-20 21:41:40 [ℹ]  waiting for CloudFormation stack "eksctl-collabdraw-cluster-nodegroup-workers"
2026-05-20 21:43:11 [ℹ]  waiting for CloudFormation stack "eksctl-collabdraw-cluster-nodegroup-workers"
2026-05-20 21:44:46 [ℹ]  waiting for CloudFormation stack "eksctl-collabdraw-cluster-nodegroup-workers"
2026-05-20 21:46:20 [ℹ]  waiting for CloudFormation stack "eksctl-collabdraw-cluster-nodegroup-workers"
2026-05-20 21:48:18 [ℹ]  waiting for CloudFormation stack "eksctl-collabdraw-cluster-nodegroup-workers"
2026-05-20 21:49:16 [ℹ]  waiting for CloudFormation stack "eksctl-collabdraw-cluster-nodegroup-workers"
2026-05-20 21:49:56 [ℹ]  waiting for CloudFormation stack "eksctl-collabdraw-cluster-nodegroup-workers"
2026-05-20 21:51:39 [ℹ]  waiting for CloudFormation stack "eksctl-collabdraw-cluster-nodegroup-workers"
2026-05-20 21:52:37 [ℹ]  waiting for CloudFormation stack "eksctl-collabdraw-cluster-nodegroup-workers"
2026-05-20 21:54:06 [ℹ]  waiting for CloudFormation stack "eksctl-collabdraw-cluster-nodegroup-workers"
2026-05-20 21:55:40 [ℹ]  waiting for CloudFormation stack "eksctl-collabdraw-cluster-nodegroup-workers"
2026-05-20 21:57:25 [ℹ]  waiting for CloudFormation stack "eksctl-collabdraw-cluster-nodegroup-workers"
2026-05-20 21:59:18 [ℹ]  waiting for CloudFormation stack "eksctl-collabdraw-cluster-nodegroup-workers"
2026-05-20 22:00:33 [ℹ]  waiting for CloudFormation stack "eksctl-collabdraw-cluster-nodegroup-workers"
2026-05-20 22:02:27 [ℹ]  waiting for CloudFormation stack "eksctl-collabdraw-cluster-nodegroup-workers"
2026-05-20 22:03:30 [ℹ]  waiting for CloudFormation stack "eksctl-collabdraw-cluster-nodegroup-workers"
2026-05-20 22:03:30 [!]  1 error(s) occurred and cluster hasn't been created properly, you may wish to check CloudFormation console
2026-05-20 22:03:30 [ℹ]  to cleanup resources, run 'eksctl delete cluster --region=ap-south-1 --name=collabdraw-cluster'
2026-05-20 22:03:30 [✖]  exceeded max wait time for StackCreateComplete waiter
Error: failed to create cluster "collabdraw-cluster"
PS C:\Users\Aryan Yewale> aws eks describe-cluster --name collabdraw-cluster --region ap-south-1 --query "cluster.status" --output text
ACTIVE

PS C:\Users\Aryan Yewale> aws eks update-kubeconfig --name collabdraw-cluster --region ap-south-1
Added new context arn:aws:eks:ap-south-1:494487213388:cluster/collabdraw-cluster to C:\Users\Aryan Yewale\.kube\config
PS C:\Users\Aryan Yewale> kubectl get nodes
No resources found
PS C:\Users\Aryan Yewale>
PS C:\Users\Aryan Yewale> aws cloudformation describe-stack-events `
>>   --stack-name eksctl-collabdraw-cluster-nodegroup-workers `
>>   --region ap-south-1 `
>>   --query "StackEvents[?ResourceStatus=='CREATE_FAILED'].{Resource:LogicalResourceId,Reason:ResourceStatusReason}" `
>>   --output table
--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
|                                                                                                                                                                                                                                                                                          DescribeStackEvents                                                                                                                                                                                                                                                                                         |
+----------+-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
|  Reason  |  Resource handler returned message: "[Issue(Code=AsgInstanceLaunchFailures, Message=Could not launch On-Demand Instances. InvalidParameterCombination - The specified instance type is not eligible for Free Tier. For a list of Free Tier instance types, run 'describe-instance-types' with the filter 'free-tier-eligible=true'. Launching EC2 instance failed., ResourceIds=[eks-workers-7ccf2313-0eb3-81ad-e57d-defcb782ef9a])] (Service: null, Status Code: 0, Request ID: null)" (RequestToken: 6fa52710-1b9e-8feb-65e7-e5a3f91f49af, HandlerErrorCode: GeneralServiceException)   |
|  Resource|  ManagedNodeGroup                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
+----------+-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+

PS C:\Users\Aryan Yewale>
PS C:\Users\Aryan Yewale>
PS C:\Users\Aryan Yewale> eksctl delete nodegroup `
>>   --cluster collabdraw-cluster `
>>   --name workers `
>>   --region ap-south-1
Error: operation error EKS: DescribeNodegroup, https response error StatusCode: 404, RequestID: 3eb4e51a-f19d-44e4-8603-8bc72f91ffe2, ResourceNotFoundException: No node group found for name: workers.
PS C:\Users\Aryan Yewale>
PS C:\Users\Aryan Yewale> eksctl create nodegroup `
>>   --cluster collabdraw-cluster `
>>   --name workers `
>>   --region ap-south-1 `
>>   --node-type t3.small `
>>   --nodes 2 `
>>   --nodes-min 1 `
>>   --nodes-max 3 `
>>   --managed
2026-05-20 22:16:44 [ℹ]  will use version 1.34 for new nodegroup(s) based on control plane version
2026-05-20 22:16:46 [ℹ]  nodegroup "workers" will use "" [AmazonLinux2023/1.34]
2026-05-20 22:16:47 [ℹ]  1 nodegroup (workers) was included (based on the include/exclude rules)
2026-05-20 22:16:47 [ℹ]  will create a CloudFormation stack for each of 1 managed nodegroups in cluster "collabdraw-cluster"
2026-05-20 22:16:47 [ℹ]
2 sequential tasks: { fix cluster compatibility, 1 task: { 1 task: { create managed nodegroup "workers" } }
}
2026-05-20 22:16:47 [ℹ]  checking cluster stack for missing resources
2026-05-20 22:16:47 [ℹ]  cluster stack has all required resources
2026-05-20 22:16:48 [ℹ]  building managed nodegroup stack "eksctl-collabdraw-cluster-nodegroup-workers"
2026-05-20 22:16:48 [ℹ]  deploying stack "eksctl-collabdraw-cluster-nodegroup-workers"
2026-05-20 22:16:48 [ℹ]  waiting for CloudFormation stack "eksctl-collabdraw-cluster-nodegroup-workers"
2026-05-20 22:17:18 [ℹ]  waiting for CloudFormation stack "eksctl-collabdraw-cluster-nodegroup-workers"
2026-05-20 22:18:05 [ℹ]  waiting for CloudFormation stack "eksctl-collabdraw-cluster-nodegroup-workers"
2026-05-20 22:18:45 [ℹ]  waiting for CloudFormation stack "eksctl-collabdraw-cluster-nodegroup-workers"
2026-05-20 22:19:44 [ℹ]  waiting for CloudFormation stack "eksctl-collabdraw-cluster-nodegroup-workers"
2026-05-20 22:19:44 [ℹ]  no tasks
2026-05-20 22:19:44 [✔]  created 0 nodegroup(s) in cluster "collabdraw-cluster"
2026-05-20 22:19:44 [ℹ]  nodegroup "workers" has 2 node(s)
2026-05-20 22:19:44 [ℹ]  node "ip-192-168-14-194.ap-south-1.compute.internal" is ready
2026-05-20 22:19:44 [ℹ]  node "ip-192-168-79-170.ap-south-1.compute.internal" is ready
2026-05-20 22:19:44 [ℹ]  waiting for at least 1 node(s) to become ready in "workers"
2026-05-20 22:19:44 [ℹ]  nodegroup "workers" has 2 node(s)
2026-05-20 22:19:44 [ℹ]  node "ip-192-168-14-194.ap-south-1.compute.internal" is ready
2026-05-20 22:19:44 [ℹ]  node "ip-192-168-79-170.ap-south-1.compute.internal" is ready
2026-05-20 22:19:44 [✔]  created 1 managed nodegroup(s) in cluster "collabdraw-cluster"
2026-05-20 22:19:45 [ℹ]  checking security group configuration for all nodegroups
2026-05-20 22:19:45 [ℹ]  all nodegroups have up-to-date cloudformation templates
PS C:\Users\Aryan Yewale>
PS C:\Users\Aryan Yewale> kubectl get nodes
NAME                                            STATUS   ROLES    AGE    VERSION
ip-192-168-14-194.ap-south-1.compute.internal   Ready    <none>   4m3s   v1.34.7-eks-7fcd7ec
ip-192-168-79-170.ap-south-1.compute.internal   Ready    <none>   4m4s   v1.34.7-eks-7fcd7ec
PS C:\Users\Aryan Yewale> # Get the VPC ID
PS C:\Users\Aryan Yewale> $VPC_ID = aws eks describe-cluster --name collabdraw-cluster --region ap-south-1 --query "cluster.resourcesVpcConfig.vpcId" --output text
PS C:\Users\Aryan Yewale> Write-Host "VPC ID: $VPC_ID"
VPC ID: vpc-0c3109ec699fd7d92
PS C:\Users\Aryan Yewale>
PS C:\Users\Aryan Yewale> # Add helm repo
PS C:\Users\Aryan Yewale> helm repo add eks https://aws.github.io/eks-charts
"eks" has been added to your repositories
PS C:\Users\Aryan Yewale> helm repo update
Hang tight while we grab the latest from your chart repositories...
...Successfully got an update from the "eks" chart repository
Update Complete. ⎈Happy Helming!⎈
PS C:\Users\Aryan Yewale>
PS C:\Users\Aryan Yewale> # Install ALB Controller
PS C:\Users\Aryan Yewale> helm install aws-load-balancer-controller eks/aws-load-balancer-controller `
>>   -n kube-system `
>>   --set clusterName=collabdraw-cluster `
>>   --set serviceAccount.create=true `
>>   --set serviceAccount.name=aws-load-balancer-controller `
>>   --set region=ap-south-1 `
>>   --set vpcId=$VPC_ID
NAME: aws-load-balancer-controller
LAST DEPLOYED: Wed May 20 22:22:42 2026
NAMESPACE: kube-system
STATUS: deployed
REVISION: 1
TEST SUITE: None
NOTES:
AWS Load Balancer controller installed!
PS C:\Users\Aryan Yewale>
PS C:\Users\Aryan Yewale> # Verify it's running (wait ~30s)
PS C:\Users\Aryan Yewale> kubectl get deployment -n kube-system aws-load-balancer-controller
NAME                           READY   UP-TO-DATE   AVAILABLE   AGE
aws-load-balancer-controller   0/2     2            0           2s
PS C:\Users\Aryan Yewale>
PS C:\Users\Aryan Yewale> aws ecr create-repository --repository-name collabdraw-http --region ap-south-1
{
    "repository": {
        "repositoryArn": "arn:aws:ecr:ap-south-1:494487213388:repository/collabdraw-http",
        "registryId": "494487213388",
        "repositoryName": "collabdraw-http",
        "repositoryUri": "494487213388.dkr.ecr.ap-south-1.amazonaws.com/collabdraw-http",
        "createdAt": "2026-05-20T22:23:06.605000+05:30",
        "imageTagMutability": "MUTABLE",
        "imageScanningConfiguration": {
            "scanOnPush": false
        },
        "encryptionConfiguration": {
            "encryptionType": "AES256"
        }
    }
}

PS C:\Users\Aryan Yewale> aws ecr create-repository --repository-name collabdraw-ws   --region ap-south-1
{
    "repository": {
        "repositoryArn": "arn:aws:ecr:ap-south-1:494487213388:repository/collabdraw-ws",
        "registryId": "494487213388",
        "repositoryName": "collabdraw-ws",
        "repositoryUri": "494487213388.dkr.ecr.ap-south-1.amazonaws.com/collabdraw-ws",
        "createdAt": "2026-05-20T22:23:08.618000+05:30",
        "imageTagMutability": "MUTABLE",
        "imageScanningConfiguration": {
            "scanOnPush": false
        },
        "encryptionConfiguration": {
            "encryptionType": "AES256"
        }
    }
}

PS C:\Users\Aryan Yewale> aws ecr create-repository --repository-name collabdraw-web  --region ap-south-1
{
    "repository": {
        "repositoryArn": "arn:aws:ecr:ap-south-1:494487213388:repository/collabdraw-web",
        "registryId": "494487213388",
        "repositoryName": "collabdraw-web",
        "repositoryUri": "494487213388.dkr.ecr.ap-south-1.amazonaws.com/collabdraw-web",
        "createdAt": "2026-05-20T22:23:10.601000+05:30",
        "imageTagMutability": "MUTABLE",
        "imageScanningConfiguration": {
            "scanOnPush": false
        },
        "encryptionConfiguration": {
            "encryptionType": "AES256"
        }
    }
}

PS C:\Users\Aryan Yewale>
PS C:\Users\Aryan Yewale> cd E:\Projects\excal\CollabDraw
PS E:\Projects\excal\CollabDraw>
PS E:\Projects\excal\CollabDraw> # Login to ECR
PS E:\Projects\excal\CollabDraw> aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin 494487213388.dkr.ecr.ap-south-1.amazonaws.com
Login Succeeded
PS E:\Projects\excal\CollabDraw>
PS E:\Projects\excal\CollabDraw> # Build + push http-backend
PS E:\Projects\excal\CollabDraw> docker build -f apps/http-backend/Dockerfile -t 494487213388.dkr.ecr.ap-south-1.amazonaws.com/collabdraw-http:latest .
[+] Building 0.8s (21/21) FINISHED docker:desktop-linux
 => [internal] load build definition from Docker  0.1s
 => => transferring dockerfile: 2.23kB            0.0s
 => [internal] load metadata for docker.io/libra  0.1s
 => [internal] load .dockerignore                 0.0s
 => => transferring context: 976B                 0.0s
 => [builder  1/10] FROM docker.io/library/node:  0.0s
 => => resolve docker.io/library/node:20-alpine@  0.0s
 => [internal] load build context                 0.1s
 => => transferring context: 14.66kB              0.1s
 => CACHED [builder  2/10] WORKDIR /app           0.0s
 => CACHED [builder  3/10] RUN corepack enable &  0.0s
 => CACHED [builder  4/10] COPY package.json pnp  0.0s
 => CACHED [builder  5/10] COPY packages/ ./pack  0.0s
 => CACHED [builder  6/10] COPY apps/http-backen  0.0s
 => CACHED [builder  7/10] RUN pnpm install --fr  0.0s
 => CACHED [builder  8/10] COPY apps/http-backen  0.0s
 => CACHED [builder  9/10] COPY turbo.json ./     0.0s
 => CACHED [builder 10/10] RUN pnpm build:api     0.0s
 => CACHED [runner 3/8] COPY --from=builder /app  0.0s
 => CACHED [runner 4/8] COPY --from=builder /app  0.0s
 => CACHED [runner 5/8] COPY --from=builder /app  0.0s
 => CACHED [runner 6/8] COPY --from=builder /app  0.0s
 => CACHED [runner 7/8] COPY --from=builder /app  0.0s
 => CACHED [runner 8/8] COPY --from=builder /app  0.0s
 => exporting to image                            0.2s
 => => exporting layers                           0.0s
 => => exporting manifest sha256:f4608c5275296b7  0.0s
 => => exporting config sha256:2a0df79c95e9c3e19  0.0s
 => => exporting attestation manifest sha256:9b2  0.0s
 => => exporting manifest list sha256:9e7ff5e676  0.0s
 => => naming to 494487213388.dkr.ecr.ap-south-1  0.0s
 => => unpacking to 494487213388.dkr.ecr.ap-sout  0.0s
PS E:\Projects\excal\CollabDraw> docker push 494487213388.dkr.ecr.ap-south-1.amazonaws.com/collabdraw-http:latest
The push refers to repository [494487213388.dkr.ecr.ap-south-1.amazonaws.com/collabdraw-http]
f74d3895c33c: Pushed
2d4c91162349: Pushed
f6b80484b1a0: Pushed
b2cbbfe903b0: Pushed
093b73010984: Pushed
5a568b8d888c: Pushed
fff4e2c1b189: Pushed
ba028563a0ce: Pushed
6a0ac1617861: Pushed
f6677d2b4b4b: Pushed
4feea04c1543: Pushed
96c7d6cc0b02: Pushed
latest: digest: sha256:9e7ff5e67600b874ccff43a02fbcc0733290a108393f80f778283fb2ef8db695 size: 856
PS E:\Projects\excal\CollabDraw>
PS E:\Projects\excal\CollabDraw> # Build + push ws-server
PS E:\Projects\excal\CollabDraw> docker build -f apps/ws-server/Dockerfile -t 494487213388.dkr.ecr.ap-south-1.amazonaws.com/collabdraw-ws:latest .
[+] Building 0.6s (21/21) FINISHED docker:desktop-linux
 => [internal] load build definition from Docker  0.0s
 => => transferring dockerfile: 1.84kB            0.0s
 => [internal] load metadata for docker.io/libra  0.1s
 => [internal] load .dockerignore                 0.0s
 => => transferring context: 976B                 0.0s
 => [builder  1/10] FROM docker.io/library/node:  0.0s
 => => resolve docker.io/library/node:20-alpine@  0.0s
 => [internal] load build context                 0.0s
 => => transferring context: 18.76kB              0.0s
 => CACHED [builder  2/10] WORKDIR /app           0.0s
 => CACHED [builder  3/10] RUN corepack enable &  0.0s
 => CACHED [builder  4/10] COPY package.json pnp  0.0s
 => CACHED [builder  5/10] COPY packages/ ./pack  0.0s
 => CACHED [builder  6/10] COPY apps/ws-server/p  0.0s
 => CACHED [builder  7/10] RUN pnpm install --fr  0.0s
 => CACHED [builder  8/10] COPY apps/ws-server/   0.0s
 => CACHED [builder  9/10] COPY turbo.json ./     0.0s
 => CACHED [builder 10/10] RUN pnpm build:ws      0.0s
 => CACHED [runner 3/8] COPY --from=builder /app  0.0s
 => CACHED [runner 4/8] COPY --from=builder /app  0.0s
 => CACHED [runner 5/8] COPY --from=builder /app  0.0s
 => CACHED [runner 6/8] COPY --from=builder /app  0.0s
 => CACHED [runner 7/8] COPY --from=builder /app  0.0s
 => CACHED [runner 8/8] COPY --from=builder /app  0.0s
 => exporting to image                            0.2s
 => => exporting layers                           0.0s
 => => exporting manifest sha256:b08860abd86a1d7  0.0s
 => => exporting config sha256:ab2f2113f14f797ff  0.0s
 => => exporting attestation manifest sha256:ce5  0.0s
 => => exporting manifest list sha256:fb4c52e5d3  0.0s
 => => naming to 494487213388.dkr.ecr.ap-south-1  0.0s
 => => unpacking to 494487213388.dkr.ecr.ap-sout  0.0s
PS E:\Projects\excal\CollabDraw> docker push 494487213388.dkr.ecr.ap-south-1.amazonaws.com/collabdraw-ws:latest
The push refers to repository [494487213388.dkr.ecr.ap-south-1.amazonaws.com/collabdraw-ws]
6c0593b6a0b6: Pushed
1c90ed3b28f3: Pushed
f6b80484b1a0: Pushed
4feea04c1543: Pushed
6a0ac1617861: Pushed
b2cbbfe903b0: Pushed
617db6ff8a73: Pushed
931bf1cabf37: Pushed
7058f6827bd0: Pushed
8c4a1f1a4c93: Pushed
6ad23178dad4: Pushed
fff4e2c1b189: Pushed
latest: digest: sha256:fb4c52e5d39ab94416cf4bb72eda4dae966f5fe97a4f265dd2f906d736488d6a size: 856
PS E:\Projects\excal\CollabDraw>
PS E:\Projects\excal\CollabDraw> # Build + push frontend (placeholder URLs — rebuilt after getting ALB DNS)
PS E:\Projects\excal\CollabDraw> docker build `
>>   --build-arg NEXT_PUBLIC_API_URL=http://placeholder/api `
>>   --build-arg NEXT_PUBLIC_SOCKET_URL=ws://placeholder/ws `
>>   --build-arg NEXT_PUBLIC_SITE_URL=http://placeholder `
>>   -f apps/web/Dockerfile `
>>   -t 494487213388.dkr.ecr.ap-south-1.amazonaws.com/collabdraw-web:latest .
[+] Building 121.0s (18/18) FINISHED docker:desktop-lin
 => [internal] load build definition from Docker  0.0s
 => => transferring dockerfile: 2.11kB            0.0s
 => [internal] load metadata for docker.io/libra  0.0s
 => [internal] load .dockerignore                 0.0s
 => => transferring context: 976B                 0.0s
 => [builder  1/10] FROM docker.io/library/node:  0.0s
 => => resolve docker.io/library/node:20-alpine@  0.0s
 => [internal] load build context                 0.1s
 => => transferring context: 405.44kB             0.1s
 => CACHED [builder  2/10] WORKDIR /app           0.0s
 => CACHED [builder  3/10] RUN corepack enable &  0.0s
 => CACHED [builder  4/10] COPY package.json pnp  0.0s
 => CACHED [builder  5/10] COPY packages/ ./pack  0.0s
 => CACHED [builder  6/10] COPY apps/web/package  0.0s
 => CACHED [builder  7/10] RUN pnpm install --fr  0.0s
 => CACHED [builder  8/10] COPY apps/web/ ./apps  0.0s
 => CACHED [builder  9/10] COPY turbo.json ./     0.0s
 => [builder 10/10] RUN pnpm build:web          111.2s
 => [runner 3/5] COPY --from=builder /app/apps/w  1.7s
 => [runner 4/5] COPY --from=builder /app/apps/w  0.1s
 => [runner 5/5] COPY --from=builder /app/apps/w  0.1s
 => exporting to image                            6.6s
 => => exporting layers                           3.9s
 => => exporting manifest sha256:7b434fdf5bf54bf  0.0s
 => => exporting config sha256:270c49367f4b09ab7  0.0s
 => => exporting attestation manifest sha256:3bf  0.1s
 => => exporting manifest list sha256:2d74764745  0.0s
 => => naming to 494487213388.dkr.ecr.ap-south-1  0.0s
 => => unpacking to 494487213388.dkr.ecr.ap-sout  2.5s
PS E:\Projects\excal\CollabDraw> docker push 494487213388.dkr.ecr.ap-south-1.amazonaws.com/collabdraw-web:latest
The push refers to repository [494487213388.dkr.ecr.ap-south-1.amazonaws.com/collabdraw-web]
4feea04c1543: Pushed
f6b80484b1a0: Pushed
c3fd78ede194: Pushed
fff4e2c1b189: Pushed
6a0ac1617861: Pushed
c7ea31a2e3c7: Pushed
d35b5ffd233a: Pushed
b2cbbfe903b0: Pushed
71c8e2882bfe: Pushed
latest: digest: sha256:2d747647458c4ddac517d2eaae51918bd3db286f1c34839f0071203cf3fbe978 size: 856
PS E:\Projects\excal\CollabDraw>
PS E:\Projects\excal\CollabDraw> cd E:\Projects\excal\CollabDraw
PS E:\Projects\excal\CollabDraw>
PS E:\Projects\excal\CollabDraw> kubectl apply -f k8s/namespace.yaml
namespace/collabdraw created
PS E:\Projects\excal\CollabDraw> kubectl apply -f k8s/configmap.yaml
configmap/collabdraw-config created
PS E:\Projects\excal\CollabDraw> kubectl apply -f k8s/secret.yaml
secret/collabdraw-secret created
PS E:\Projects\excal\CollabDraw> kubectl apply -f k8s/postgres-deployment.yaml
persistentvolumeclaim/postgres-pvc created
deployment.apps/postgres created
PS E:\Projects\excal\CollabDraw> kubectl apply -f k8s/postgres-service.yaml
service/postgres created
PS E:\Projects\excal\CollabDraw> kubectl apply -f k8s/http-deployment.yaml
deployment.apps/http-backend created
PS E:\Projects\excal\CollabDraw> kubectl apply -f k8s/http-service.yaml
service/http-backend created
PS E:\Projects\excal\CollabDraw> kubectl apply -f k8s/ws-deployment.yaml
deployment.apps/ws-server created
PS E:\Projects\excal\CollabDraw> kubectl apply -f k8s/ws-service.yaml
service/ws-server created
PS E:\Projects\excal\CollabDraw> kubectl apply -f k8s/frontend-deployment.yaml
deployment.apps/frontend created
PS E:\Projects\excal\CollabDraw> kubectl apply -f k8s/frontend-service.yaml
service/frontend created
PS E:\Projects\excal\CollabDraw> kubectl apply -f k8s/ingress.yaml
Warning: annotation "kubernetes.io/ingress.class" is deprecated, please use 'spec.ingressClassName' instead
ingress.networking.k8s.io/collabdraw-ingress created
PS E:\Projects\excal\CollabDraw>
PS E:\Projects\excal\CollabDraw> # Watch pods start
PS E:\Projects\excal\CollabDraw> kubectl get pods -n collabdraw -w
NAME                           READY   STATUS              RESTARTS   AGE
frontend-6fdccb6fdf-dgksb      0/1     ContainerCreating   0          5s
frontend-6fdccb6fdf-wj7bh      0/1     ContainerCreating   0          5s
http-backend-fbb76596b-dqtch   0/1     ContainerCreating   0          13s
http-backend-fbb76596b-pwtph   0/1     ContainerCreating   0          13s
postgres-77ddc7bb74-mznh4      0/1     Pending             0          16s
ws-server-7f69fbfb7b-vdjzc     0/1     ContainerCreating   0          9s
http-backend-fbb76596b-dqtch   0/1     Running             0          13s
frontend-6fdccb6fdf-wj7bh      0/1     Running             0          6s
http-backend-fbb76596b-dqtch   0/1     Error               0          15s
frontend-6fdccb6fdf-dgksb      0/1     Running             0          7s
http-backend-fbb76596b-dqtch   0/1     Running             1 (1s ago)   16s
http-backend-fbb76596b-pwtph   0/1     Running             0            18s
http-backend-fbb76596b-dqtch   0/1     Error               1 (3s ago)   18s
http-backend-fbb76596b-dqtch   0/1     CrashLoopBackOff    1 (2s ago)   19s
http-backend-fbb76596b-pwtph   0/1     Error               0            21s
ws-server-7f69fbfb7b-vdjzc     0/1     Running             0            17s
http-backend-fbb76596b-pwtph   0/1     Running             1 (2s ago)   22s
http-backend-fbb76596b-pwtph   0/1     Error               1 (3s ago)   23s
http-backend-fbb76596b-pwtph   0/1     CrashLoopBackOff    1 (1s ago)   24s
http-backend-fbb76596b-dqtch   0/1     Running             2 (15s ago)   32s
http-backend-fbb76596b-dqtch   0/1     Error               2 (16s ago)   33s
http-backend-fbb76596b-dqtch   0/1     CrashLoopBackOff    2 (2s ago)    34s
frontend-6fdccb6fdf-wj7bh      1/1     Running             0             27s
frontend-6fdccb6fdf-dgksb      1/1     Running             0             30s
http-backend-fbb76596b-pwtph   0/1     Running             2 (21s ago)   44s
http-backend-fbb76596b-pwtph   0/1     Error               2 (22s ago)   45s
http-backend-fbb76596b-pwtph   0/1     CrashLoopBackOff    2 (1s ago)    46s
http-backend-fbb76596b-dqtch   0/1     Running             3 (26s ago)   58s
http-backend-fbb76596b-dqtch   0/1     Error               3 (27s ago)   59s
http-backend-fbb76596b-dqtch   0/1     CrashLoopBackOff    3 (2s ago)    60s
http-backend-fbb76596b-pwtph   0/1     Running             3 (29s ago)   74s
http-backend-fbb76596b-pwtph   0/1     Error               3 (30s ago)   75s
http-backend-fbb76596b-pwtph   0/1     CrashLoopBackOff    3 (1s ago)    76s
http-backend-fbb76596b-dqtch   0/1     Running             4 (45s ago)   103s
http-backend-fbb76596b-dqtch   0/1     Error               4 (46s ago)   104s
http-backend-fbb76596b-dqtch   0/1     CrashLoopBackOff    4 (2s ago)    105s
ws-server-7f69fbfb7b-vdjzc     0/1     Running             1 (0s ago)    106s
http-backend-fbb76596b-pwtph   0/1     Running             4 (42s ago)   117s
http-backend-fbb76596b-pwtph   0/1     Error               4 (44s ago)   119s
http-backend-fbb76596b-pwtph   0/1     CrashLoopBackOff    4 (2s ago)    2m
PS E:\Projects\excal\CollabDraw> kubectl logs -n collabdraw deployment/http-backend --previous
Found 2 pods, using pod/http-backend-fbb76596b-dqtch
unable to retrieve container logs for containerd://79a06a7e4af2c543ee4082ef2c574b9c607b3dc0f5a9c35bad95570f43932e57
PS E:\Projects\excal\CollabDraw> # Delete the broken postgres resources
PS E:\Projects\excal\CollabDraw> kubectl delete pvc postgres-pvc -n collabdraw
persistentvolumeclaim "postgres-pvc" deleted from collabdraw namespace
PS E:\Projects\excal\CollabDraw> kubectl delete deployment postgres -n collabdraw
deployment.apps "postgres" deleted from collabdraw namespace
PS E:\Projects\excal\CollabDraw>
PS E:\Projects\excal\CollabDraw> # Reapply with gp2 storage class
PS E:\Projects\excal\CollabDraw> kubectl apply -f k8s/postgres-deployment.yaml
persistentvolumeclaim/postgres-pvc created
deployment.apps/postgres created
PS E:\Projects\excal\CollabDraw>
PS E:\Projects\excal\CollabDraw> # Watch postgres come up
PS E:\Projects\excal\CollabDraw> kubectl get pods -n collabdraw -w
NAME                           READY   STATUS             RESTARTS        AGE
frontend-6fdccb6fdf-dgksb      1/1     Running            0               5m54s
frontend-6fdccb6fdf-wj7bh      1/1     Running            0               5m54s
http-backend-fbb76596b-dqtch   0/1     CrashLoopBackOff   6 (11s ago)     6m2s
http-backend-fbb76596b-pwtph   0/1     CrashLoopBackOff   5 (2m42s ago)   6m2s
postgres-77ddc7bb74-mw8pv      0/1     Pending            0               1s
ws-server-7f69fbfb7b-vdjzc     0/1     Running            3 (72s ago)     5m58s
http-backend-fbb76596b-pwtph   0/1     Running            6 (2m52s ago)   6m12s
http-backend-fbb76596b-pwtph   0/1     Error              6 (2m53s ago)   6m13s
http-backend-fbb76596b-pwtph   0/1     CrashLoopBackOff   6 (1s ago)      6m14s
ws-server-7f69fbfb7b-vdjzc     0/1     Running            4 (0s ago)      6m16s
ws-server-7f69fbfb7b-vdjzc     0/1     Running            5 (0s ago)      7m46s
ws-server-7f69fbfb7b-vdjzc     0/1     Running            6 (1s ago)      9m17s
ws-server-7f69fbfb7b-vdjzc     0/1     CrashLoopBackOff   6 (0s ago)      10m
http-backend-fbb76596b-dqtch   0/1     Running            7 (5m9s ago)    11m
http-backend-fbb76596b-dqtch   0/1     Error              7 (5m11s ago)   11m
http-backend-fbb76596b-dqtch   0/1     CrashLoopBackOff   7 (13s ago)     11m
http-backend-fbb76596b-pwtph   0/1     Running            7 (5m11s ago)   11m
http-backend-fbb76596b-pwtph   0/1     Error              7 (5m13s ago)   11m
http-backend-fbb76596b-pwtph   0/1     CrashLoopBackOff   7 (6s ago)      11m
PS E:\Projects\excal\CollabDraw> # Wait for the addon to be ACTIVE
PS E:\Projects\excal\CollabDraw> aws eks describe-addon --cluster-name collabdraw-cluster --addon-name aws-ebs-csi-driver --region ap-south-1 --query "addon.status" --output text
CREATING

PS E:\Projects\excal\CollabDraw> # Should return: ACTIVE
PS E:\Projects\excal\CollabDraw>
PS E:\Projects\excal\CollabDraw> # Then watch postgres
PS E:\Projects\excal\CollabDraw> kubectl get pods -n collabdraw -w
NAME                           READY   STATUS             RESTARTS      AGE
frontend-6fdccb6fdf-dgksb      1/1     Running            0             12m
frontend-6fdccb6fdf-wj7bh      1/1     Running            0             12m
http-backend-fbb76596b-dqtch   0/1     CrashLoopBackOff   7 (80s ago)   12m
http-backend-fbb76596b-pwtph   0/1     CrashLoopBackOff   7 (56s ago)   12m
postgres-77ddc7bb74-mw8pv      0/1     Pending            0             6m20s
ws-server-7f69fbfb7b-vdjzc     0/1     CrashLoopBackOff   6 (91s ago)   12m
PS E:\Projects\excal\CollabDraw> # Wait for the addon to be ACTIVE
PS E:\Projects\excal\CollabDraw> aws eks describe-addon --cluster-name collabdraw-cluster --addon-name aws-ebs-csi-driver --region ap-south-1 --query "addon.status" --output text
CREATING

PS E:\Projects\excal\CollabDraw> # Should return: ACTIVE
PS E:\Projects\excal\CollabDraw>
PS E:\Projects\excal\CollabDraw> # Then watch postgres
PS E:\Projects\excal\CollabDraw> kubectl get pods -n collabdraw -w
NAME                           READY   STATUS             RESTARTS        AGE
frontend-6fdccb6fdf-dgksb      1/1     Running            0               13m
frontend-6fdccb6fdf-wj7bh      1/1     Running            0               13m
http-backend-fbb76596b-dqtch   0/1     CrashLoopBackOff   7 (2m32s ago)   13m
http-backend-fbb76596b-pwtph   0/1     CrashLoopBackOff   7 (2m8s ago)    13m
postgres-77ddc7bb74-mw8pv      0/1     Pending            0               7m32s
ws-server-7f69fbfb7b-vdjzc     0/1     CrashLoopBackOff   6 (2m43s ago)   13m
ws-server-7f69fbfb7b-vdjzc     0/1     Running            7 (2m46s ago)   13m
PS E:\Projects\excal\CollabDraw> aws eks describe-addon --cluster-name collabdraw-cluster --addon-name aws-ebs-csi-driver --region ap-south-1 --query "addon.status" --output text
CREATING

PS E:\Projects\excal\CollabDraw> aws eks describe-addon --cluster-name collabdraw-cluster --addon-name aws-ebs-csi-driver --region ap-south-1 --query "addon.status" --output text
CREATING

PS E:\Projects\excal\CollabDraw> aws eks describe-addon --cluster-name collabdraw-cluster --addon-name aws-ebs-csi-driver --region ap-south-1 --query "addon.status" --output text
CREATING

PS E:\Projects\excal\CollabDraw> aws eks describe-addon --cluster-name collabdraw-cluster --addon-name aws-ebs-csi-driver --region ap-south-1 --query "addon.status" --output text
CREATING

PS E:\Projects\excal\CollabDraw> aws eks describe-addon --cluster-name collabdraw-cluster --addon-name aws-ebs-csi-driver --region ap-south-1 --query "addon.status" --output text
ACTIVE

PS E:\Projects\excal\CollabDraw> kubectl delete deployment postgres -n collabdraw
deployment.apps "postgres" deleted from collabdraw namespace
PS E:\Projects\excal\CollabDraw> kubectl apply -f k8s/postgres-deployment.yaml
persistentvolumeclaim/postgres-pvc unchanged
deployment.apps/postgres created
PS E:\Projects\excal\CollabDraw> kubectl get pods -n collabdraw -w
NAME                           READY   STATUS              RESTARTS         AGE
frontend-6fdccb6fdf-dgksb      1/1     Running             0                44m
frontend-6fdccb6fdf-wj7bh      1/1     Running             0                44m
http-backend-fbb76596b-dqtch   0/1     CrashLoopBackOff    13 (2m58s ago)   44m
http-backend-fbb76596b-pwtph   0/1     CrashLoopBackOff    13 (2m38s ago)   44m
postgres-6c4488798d-dc78s      0/1     ContainerCreating   0                1s
ws-server-7f69fbfb7b-vdjzc     0/1     Running             14 (5m20s ago)   44m
postgres-6c4488798d-dc78s      1/1     Running             0                10s
ws-server-7f69fbfb7b-vdjzc     1/1     Running             14 (5m36s ago)   45m
http-backend-fbb76596b-dqtch   0/1     Running             14 (5m7s ago)    47m
http-backend-fbb76596b-dqtch   1/1     Running             14 (5m19s ago)   47m
http-backend-fbb76596b-pwtph   0/1     Running             14 (5m7s ago)    47m
http-backend-fbb76596b-pwtph   1/1     Running             14 (5m18s ago)   47m
PS E:\Projects\excal\CollabDraw>
PS E:\Projects\excal\CollabDraw> kubectl get pods -n collabdraw
NAME                           READY   STATUS    RESTARTS         AGE
frontend-6fdccb6fdf-dgksb      1/1     Running   0                48m
frontend-6fdccb6fdf-wj7bh      1/1     Running   0                48m
http-backend-fbb76596b-dqtch   1/1     Running   14 (6m47s ago)   48m
http-backend-fbb76596b-pwtph   1/1     Running   14 (6m27s ago)   48m
postgres-6c4488798d-dc78s      1/1     Running   0                3m50s
ws-server-7f69fbfb7b-vdjzc     1/1     Running   14 (9m9s ago)    48m
PS E:\Projects\excal\CollabDraw> # Run migrations
PS E:\Projects\excal\CollabDraw> kubectl exec -n collabdraw deployment/http-backend -- sh -c "packages/db/node_modules/.bin/prisma migrate deploy --schema=packages/db/prisma/schema.prisma"
Prisma schema loaded from packages/db/prisma/schema.prisma
Datasource "db": PostgreSQL database "collabdraw", schema "public" at "postgres:5432"

3 migrations found in prisma/migrations


No pending migrations to apply.
┌─────────────────────────────────────────────────────────┐
│  Update available 6.17.0 -> 7.8.0                       │
│                                                         │
│  This is a major update - please follow the guide at    │
│  https://pris.ly/d/major-version-upgrade                │
│                                                         │
│  Run the following to update                            │
│    npm i --save-dev prisma@latest                       │
│    npm i @prisma/client@latest                          │
└─────────────────────────────────────────────────────────┘
PS E:\Projects\excal\CollabDraw>
PS E:\Projects\excal\CollabDraw> # Get the public ALB URL (wait ~2 min after ingress was applied)
PS E:\Projects\excal\CollabDraw> kubectl get ingress -n collabdraw
NAME                 CLASS    HOSTS   ADDRESS   PORTS   AGE
collabdraw-ingress   <none>   *                 80      48m
PS E:\Projects\excal\CollabDraw>
PS E:\Projects\excal\CollabDraw> kubectl delete ingress collabdraw-ingress -n collabdraw
ingress.networking.k8s.io "collabdraw-ingress" deleted from collabdraw namespace
PS E:\Projects\excal\CollabDraw> kubectl apply -f k8s/ingress.yaml
Warning: annotation "kubernetes.io/ingress.class" is deprecated, please use 'spec.ingressClassName' instead
ingress.networking.k8s.io/collabdraw-ingress created
PS E:\Projects\excal\CollabDraw>
PS E:\Projects\excal\CollabDraw> # Watch for the ADDRESS to appear (check every 30s)
PS E:\Projects\excal\CollabDraw> kubectl get ingress -n collabdraw
NAME                 CLASS    HOSTS   ADDRESS   PORTS   AGE
collabdraw-ingress   <none>   *                 80      2s
PS E:\Projects\excal\CollabDraw> kubectl get ingress -n collabdraw
NAME                 CLASS    HOSTS   ADDRESS   PORTS   AGE
collabdraw-ingress   <none>   *                 80      29s
PS E:\Projects\excal\CollabDraw> cd E:\Projects\excal\CollabDraw
PS E:\Projects\excal\CollabDraw>
PS E:\Projects\excal\CollabDraw> docker build `
>>   --build-arg NEXT_PUBLIC_API_URL=http://k8s-collabdr-collabdr-0c35dcb652-657159459.ap-south-1.elb.amazonaws.com/api `
>>   --build-arg NEXT_PUBLIC_SOCKET_URL=ws://k8s-collabdr-collabdr-0c35dcb652-657159459.ap-south-1.elb.amazonaws.com/ws `
>>   --build-arg NEXT_PUBLIC_SITE_URL=http://k8s-collabdr-collabdr-0c35dcb652-657159459.ap-south-1.elb.amazonaws.com `
>>   -f apps/web/Dockerfile `
>>   -t 494487213388.dkr.ecr.ap-south-1.amazonaws.com/collabdraw-web:latest .
[+] Building 93.3s (18/18) FINISHED docker:desktop-linu
 => [internal] load build definition from Docker  0.1s
 => => transferring dockerfile: 2.11kB            0.0s
 => [internal] load metadata for docker.io/libra  0.1s
 => [internal] load .dockerignore                 0.0s
 => => transferring context: 976B                 0.0s
 => [internal] load build context                 0.1s
 => => transferring context: 7.75kB               0.0s
 => [builder  1/10] FROM docker.io/library/node:  0.0s
 => => resolve docker.io/library/node:20-alpine@  0.0s
 => CACHED [builder  2/10] WORKDIR /app           0.0s
 => CACHED [builder  3/10] RUN corepack enable &  0.0s
 => CACHED [builder  4/10] COPY package.json pnp  0.0s
 => CACHED [builder  5/10] COPY packages/ ./pack  0.0s
 => CACHED [builder  6/10] COPY apps/web/package  0.0s
 => CACHED [builder  7/10] RUN pnpm install --fr  0.0s
 => CACHED [builder  8/10] COPY apps/web/ ./apps  0.0s
 => CACHED [builder  9/10] COPY turbo.json ./     0.0s
 => [builder 10/10] RUN pnpm build:web           86.1s
 => [runner 3/5] COPY --from=builder /app/apps/w  1.3s
 => [runner 4/5] COPY --from=builder /app/apps/w  0.1s
 => [runner 5/5] COPY --from=builder /app/apps/w  0.1s
 => exporting to image                            4.8s
 => => exporting layers                           3.2s
 => => exporting manifest sha256:b3227bca3a62977  0.0s
 => => exporting config sha256:f776132c19cbd131d  0.0s
 => => exporting attestation manifest sha256:6b4  0.0s
 => => exporting manifest list sha256:c63f5494bf  0.0s
 => => naming to 494487213388.dkr.ecr.ap-south-1  0.0s
 => => unpacking to 494487213388.dkr.ecr.ap-sout  1.4s
PS E:\Projects\excal\CollabDraw>
PS E:\Projects\excal\CollabDraw> docker push 494487213388.dkr.ecr.ap-south-1.amazonaws.com/collabdraw-web:latest
The push refers to repository [494487213388.dkr.ecr.ap-south-1.amazonaws.com/collabdraw-web]
9f60245b25ce: Pushed
3c1480e22731: Pushed
f6b80484b1a0: Layer already exists
b2cbbfe903b0: Layer already exists
2f9dc6fdf8f6: Pushed
6a0ac1617861: Layer already exists
4feea04c1543: Layer already exists
fff4e2c1b189: Layer already exists
a1a2bbee512e: Pushed
latest: digest: sha256:c63f5494bfc2ae2f8cfc00d7f7e23341d91d43c32d31321853f03fd66f3d4d15 size: 856
PS E:\Projects\excal\CollabDraw>
PS E:\Projects\excal\CollabDraw> kubectl rollout restart deployment/frontend -n collabdraw
deployment.apps/frontend restarted
PS E:\Projects\excal\CollabDraw> kubectl rollout status deployment/frontend -n collabdraw
Waiting for deployment "frontend" rollout to finish: 1 out of 2 new replicas have been updated...
Waiting for deployment "frontend" rollout to finish: 1 out of 2 new replicas have been updated...
Waiting for deployment "frontend" rollout to finish: 1 out of 2 new replicas have been updated...
Waiting for deployment "frontend" rollout to finish: 1 old replicas are pending termination...
Waiting for deployment "frontend" rollout to finish: 1 old replicas are pending terminatkubectl delete pvc postgres-pvc -n collabdrawuccessfullkubectl delete pvc postgres-pvc -n collabdraw                                                                                       
                            
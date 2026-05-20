# CollabDraw — Complete Change Log

Everything that was audited, fixed, built, and verified across all sessions.
Use this as a reference for presentations, code reviews, or onboarding.

---

## Table of Contents

1. [Application Bug Fixes](#1-application-bug-fixes)
2. [Docker Setup](#2-docker-setup)
3. [Kubernetes Setup](#3-kubernetes-setup)
4. [CI/CD — Jenkins](#4-cicd--jenkins)
5. [Monitoring — Prometheus + Grafana](#5-monitoring--prometheus--grafana)
6. [Local Kubernetes Verification](#6-local-kubernetes-verification)
7. [Files Created or Modified](#7-files-created-or-modified)
8. [Current System Status](#8-current-system-status)

---

## 1. Application Bug Fixes

### 1.1 Critical — Multiplayer / WebSocket

| Fix | File | What was wrong | What was done |
|-----|------|----------------|---------------|
| roomId type mismatch | `ws-server/src/events/handlers.ts` | Client sends numeric roomId, WS server Map used string keys — users never ended up in the same room, no broadcasting worked | Normalize all `data.roomId` to `String(roomId)` at handler entry |
| Infinite DB retry loop | `ws-server/src/events/handlers.ts` | On DB error, job was re-queued with no retry limit — could OOM the process | Added `MAX_RETRIES = 3` with exponential backoff, job rejected after limit |
| JWT missing `name` field | `http-backend/src/index.ts` | JWT was signed with only `{ userId }` — WS server fell back to `"John"` for every user's name | Added `name: user.name` to JWT payload |
| `shape:create` echo duplicate | `apps/web/app/board/[roomId]/page.tsx` | WS server broadcasts `shape:create` back to sender too. Creator's shape had no DB id, couldn't be selected/moved | Push echo to `allDrawings` for everyone; skip re-render only for creator |
| `useCallback` stale closure | `apps/web/app/board/[roomId]/page.tsx` | `user?.id` was stale inside WS handler because dep array was `[]` | Changed to `[user?.id]` |
| No WebSocket reconnect | `apps/web/hooks/useWebSocket.tsx` | On disconnect, `isConnected` became `false` and board showed "Connecting..." forever | Added exponential backoff reconnect (5 attempts, 3s×attempt delay) |

### 1.2 Critical — Canvas / Drawing

| Fix | File | What was wrong | What was done |
|-----|------|----------------|---------------|
| Hit-test always failing | `apps/web/app/board/game.ts` | `getShapeAtPosition` compared `shape.type` against lowercase strings (`'line'`, `'arrow'`) but shapes stored with uppercase `ShapeType` enum — lines/arrows never selectable | Normalize with `.toUpperCase()` |
| Stale shapes on room switch | `apps/web/app/board/game.ts` | `allDrawings` module-level array never cleared on unmount — stale shapes appeared when navigating between rooms | `clearAllDrawings()` called in board page cleanup |
| Nullable DB fields crash | `apps/web/app/board/game.ts` | `startX`, `startY`, `width`, `height` are `Int?` in DB — null values caused rendering crashes | Normalize to `?? 0` when loading shapes |
| Mouse wheel zoom not wired | `apps/web/app/board/game.ts` | `onZoom` handler existed but no wheel event listener was attached | Added `wheel` event listener with zoom-to-cursor math |
| Unused imports | `apps/web/app/board/game.ts` | `uuidv4` and `repaintPencil` imported but never used | Removed |
| `shape:update` type check | `apps/web/app/board/[roomId]/page.tsx` | Checked `eventData.shape.type === "text"` (lowercase) vs actual `"TEXT"` (enum) | Fixed to `"TEXT"` |
| PropertyPanel double update | `apps/web/app/board/[roomId]/page.tsx` | `onPropertyChange` callback called `handlePropertyChange` which called `setCurrentProperties` again — double state update | Simplified to pass `handlePropertyChange` directly |
| Canvas cleanup lost | `apps/web/app/board/[roomId]/page.tsx` | Inner canvas cleanup (resize/dblclick listeners) was stored in wrong variable and never called | Split into `cleanup` + `innerCleanup`, both called on unmount |
| No auth guard on board | `apps/web/app/board/[roomId]/page.tsx` | Unauthenticated users stuck on "Connecting..." forever | Added redirect to `/login` when `user.token` is empty |
| No connection timeout | `apps/web/app/board/[roomId]/page.tsx` | Infinite spinner if server is down | Added 15s timeout with "Back to Dashboard" fallback |

### 1.3 Critical — Multiplayer Room Joining via Slug

| Fix | File | What was wrong | What was done |
|-----|------|----------------|---------------|
| Slug → NaN roomId | `apps/web/app/board/[roomId]/page.tsx` | When joining via slug (e.g. `/board/my-room`), `Number("my-room")` = `NaN`. WS server stored it as key `"NaN"` — completely different room from owner's `"42"`. Canvas loaded empty. | Added `resolvedRoomId` state. If URL param is numeric use directly; if slug call `GET /room/:slug` to get numeric ID first |
| Missing `getRoomBySlug` action | `apps/web/actions/action.ts` | No function to resolve slug → numeric ID | Added `getRoomBySlug()` calling `GET /room/:slug` |

### 1.4 Important — Backend

| Fix | File | What was wrong | What was done |
|-----|------|----------------|---------------|
| All rooms returned to all users | `apps/http-backend/src/index.ts` | `/rooms` returned every room in the DB — privacy issue | Restored `adminId: userId` filter |
| Shapes in wrong order | `apps/http-backend/src/index.ts` | `/shapes/:roomId` returned shapes `desc` — older shapes rendered on top | Changed to `asc` |
| Empty catch blocks | `apps/http-backend/src/index.ts` | `/rooms` and `/room/:slug` had empty `catch {}` — silent failures | Added proper error responses |
| CORS blocking Docker | `apps/http-backend/src/index.ts` | Production CORS only allowed `collabdraw.showcase.wiki` — blocked `localhost:3000` in Docker | Added `CORS_ORIGIN` env var; docker-compose sets it to `http://localhost:3000` |

### 1.5 Important — Dashboard

| Fix | File | What was wrong | What was done |
|-----|------|----------------|---------------|
| Duplicate return block | `components/dashboard/Header.tsx` | File had two `return` statements — dead code with old branding and no-op handlers | Removed dead block; added `onClick` to Bell button |
| 3 buttons with no handlers | `components/dashboard/QuickActions.tsx` | "Join via Code", "Import Canvas", "Export Canvas" were pure UI placeholders | Wired up: Join navigates to `/board/<code>`, Import reads JSON file, Export shows informational toast |
| Unused import breaking lint | `components/dashboard/RoomsGrid.tsx` | `import { set } from "zod"` — unused, breaks `--max-warnings 0` | Removed |
| Share link used slug, Open used id | `components/dashboard/RoomsGrid.tsx` | Share dialog generated `/board/${room.slug}` but board page calls `Number(roomId)` → NaN for slug | Both now use `room.id` (numeric) |
| Crash on undefined rooms | `components/dashboard/RoomsGrid.tsx` | `data?.rooms?.filter(...)` crashes when `data` is undefined | Changed to `(data?.rooms ?? []).filter(...)` |
| Broken gradient class | `components/dashboard/StatsCard.tsx` | Template literal in single-quoted string → gradient class never applied | Fixed to backtick template literal |
| Loading skeleton commented out | `apps/web/app/dashboard/page.tsx` | `useFetchUser` and `DashboardSkeleton` were commented out | Restored with guard against infinite skeleton when no token |

### 1.6 Important — Auth / Session

| Fix | File | What was wrong | What was done |
|-----|------|----------------|---------------|
| Fetch on every page load | `hooks/useUserFetcher.tsx` | Always called `getUser()` even without a token cookie → guaranteed 401 on public pages | Skip fetch when no token; removed debug `console.log` |
| Null photo crash | `components/providers/ContextProvider.tsx` | `photo` field could be `null` from DB → type error | Added `?? ""` fallback |

### 1.7 Build Fixes — Lint Warnings (--max-warnings 0)

All of these caused `next build` to fail in Docker:

| File | Warning fixed |
|------|--------------|
| `board/[roomId]/page.tsx` | TypeScript `undefined` param, `any` types, unused `_isPanning` |
| `board/game.ts` | Unused `currentPoints`, `index`, `rect`; `any` types |
| `board/repaint.ts` | `@ts-ignore` → `@ts-expect-error` |
| `board/types.ts` | 13 unused lucide imports removed |
| `Propertypanel.tsx` | `any` → `unknown`, unused `onClose` in destructure, duplicate declaration fixed |
| `StrokeControl.tsx` | `any` → `unknown` |
| `TextOnCanvas.tsx` | Unused `isEditingText` in destructure |
| `RoomsGrid.tsx` | `any` → `Room` type, empty catch block fixed |
| `demo-section.tsx` | 3 unused imports, `any` → `React.ReactNode` |
| `login-form.tsx` | 3 unused imports (`redirect`, `parseCookies`, `destroyCookie`) |
| `ContextProvider.tsx` | Unused `user` in destructure |
| `signup-form.tsx` | Unescaped `'` → `&apos;` |
| `layout.tsx` | Unused `Context` import |
| `dashboard/page.tsx` | Unused `useContext`, `useEffect` imports |

---

## 2. Docker Setup

### 2.1 Dockerfiles Created

Three multi-stage Dockerfiles — one per service:

**`apps/http-backend/Dockerfile`**
- Stage 1 (builder): pnpm install → compile TypeScript → `dist/`
- Stage 2 (runner): copy dist + node_modules → run server
- CMD runs Prisma migrations then starts the server automatically

**`apps/ws-server/Dockerfile`**
- Same pattern as http-backend

**`apps/web/Dockerfile`**
- Stage 1 (builder): pnpm install → `next build` → `.next/standalone/`
- Stage 2 (runner): copy standalone + static + public → `node server.js`
- `NEXT_PUBLIC_*` URLs passed as `--build-arg` (baked into JS bundle at build time)
- Requires `output: "standalone"` in `next.config.js`

### 2.2 Critical Docker Fix — `.dockerignore`

**Root cause of all "Cannot find module" errors:**
Local Windows `node_modules` use symlinks that don't work in Linux containers. When Docker copied `apps/ws-server/` it overwrote the Linux-compatible `node_modules` that pnpm had just installed inside the container.

**Fix:** Added `**/node_modules` to `.dockerignore` — prevents all nested `node_modules` from being copied into the build context.

### 2.3 Critical Docker Fix — Prisma Schema Timing

**Root cause:** `packages/db/package.json` has `postinstall: "pnpm prisma generate"` which runs automatically during `pnpm install`. At that point only `package.json` files had been copied — `schema.prisma` didn't exist yet.

**Fix:** Copy `packages/db/prisma/` before `pnpm install` in all three Dockerfiles.

### 2.4 `docker-compose.yml`

- All 4 services: `postgres`, `http-backend`, `ws-server`, `web`
- Private `collab-net` bridge network — services reach each other by name
- Startup order: postgres (healthcheck) → backends → frontend
- `CORS_ORIGIN: http://localhost:3000` added to http-backend so browser requests work
- `NEXT_PUBLIC_*` passed as build `args` (not `environment`) — baked at build time
- Postgres volume: `postgres_data:/var/lib/postgresql/data`

### 2.5 `next.config.js`

Added `output: "standalone"` — required for the slim Docker runner stage to work.

### 2.6 Verified Working

```
docker compose up --build
```

All four containers start, migrations run automatically, app accessible at:
- Frontend: http://localhost:3000
- API: http://localhost:3001
- WebSocket: ws://localhost:4000
- Postgres: localhost:5433

## 3. Kubernetes Setup

### 3.1 Manifests Created

All files in `k8s/`:

| File | What it creates |
|------|----------------|
| `namespace.yaml` | `collabdraw` namespace — isolates all resources |
| `configmap.yaml` | Non-secret config: `DATABASE_URL`, `NODE_ENV`, `NEXT_PUBLIC_*` URLs |
| `secret.yaml` | Base64-encoded secrets: `POSTGRES_PASSWORD`, `JWT_SECRET` |
| `postgres-deployment.yaml` | Postgres pod + 1Gi PersistentVolumeClaim |
| `postgres-service.yaml` | ClusterIP service — DNS name `postgres:5432` |
| `http-deployment.yaml` | 2 replicas, readiness/liveness probes on `/health` |
| `http-service.yaml` | ClusterIP service — DNS name `http-backend:3001` |
| `ws-deployment.yaml` | 1 replica (in-memory state limitation) |
| `ws-service.yaml` | ClusterIP service — DNS name `ws-server:4000` |
| `frontend-deployment.yaml` | 2 replicas, readiness/liveness probes on `/` |
| `frontend-service.yaml` | ClusterIP service — DNS name `frontend:3000` |
| `ingress.yaml` | nginx ingress (local) / AWS ALB (EKS) — routes all traffic |
| `monitoring.yaml` | Prometheus + Grafana in `monitoring` namespace |

### 3.2 Ingress Routing

```
localhost:80 (nginx ingress)
  /api/*  → http-backend:3001  (strips /api prefix via rewrite)
  /ws     → ws-server:4000     (WebSocket upgrade)
  /       → frontend:3000      (catch-all)
```

### 3.3 Key Design Decisions

- **ws-server: 1 replica** — room state is in-memory (`Map<roomId, Set<User>>`). Multiple replicas would split users across pods. Future fix: Redis Pub/Sub.
- **postgres: Deployment not StatefulSet** — simpler for student project. Production would use AWS RDS.
- **imagePullPolicy: IfNotPresent** — uses locally built images without requiring a registry push for local testing.
- **ConfigMap vs Secret** — non-sensitive config in ConfigMap, passwords/JWT in Secret.

---

## 4. CI/CD — Jenkins

### 4.1 `Jenkinsfile` Created

4-stage pipeline:

```
git push → GitHub webhook → Jenkins
  Stage 1: Checkout — pull latest code
  Stage 2: Build Docker Images — all 3 services
  Stage 3: Push to Docker Hub — tagged with Git commit hash
  Stage 4: Deploy to Kubernetes — kubectl set image (rolling update)
```

### 4.2 Key Details

- Images tagged with `GIT_COMMIT.take(7)` — every build is uniquely versioned
- `kubectl set image` + `kubectl rollout status` — zero-downtime rolling update
- Credentials stored in Jenkins (never in code): `dockerhub-creds`, `kubeconfig`
- Docker Hub username: `aryanyewale`
- Image names: `aryanyewale/collabdraw-http`, `aryanyewale/collabdraw-ws`, `aryanyewale/collabdraw-web`

---

## 5. Monitoring — Prometheus + Grafana

### 5.1 `k8s/monitoring.yaml` Created

Deploys to `monitoring` namespace:

- **Prometheus** — scrapes pod metrics every 15s via Kubernetes service discovery
- **Grafana** — reads from Prometheus, shows dashboards at port 3000

### 5.2 Access

```bash
kubectl port-forward svc/grafana 3001:3000 -n monitoring
# Open: http://localhost:3001  (admin/admin)

kubectl port-forward svc/prometheus 9090:9090 -n monitoring
# Open: http://localhost:9090
```

### 5.3 Pod Discovery

Pods are auto-discovered via annotations:
```yaml
prometheus.io/scrape: "true"
prometheus.io/port: "3001"
```

---

## 6. Local Kubernetes Verification

### 6.1 Cluster

- **Tool:** Docker Desktop built-in Kubernetes (enabled via Settings → Kubernetes)
- **kubectl version:** v1.34.1
- **Node:** `docker-desktop` — Ready

### 6.2 Ingress Controller

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.1/deploy/static/provider/cloud/deploy.yaml
```

Fix applied: deleted `ingress-nginx-admission` ValidatingWebhookConfiguration (was blocking ingress creation before controller was fully ready).

### 6.3 Deployment Commands

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/postgres-deployment.yaml
kubectl apply -f k8s/postgres-service.yaml
kubectl apply -f k8s/http-deployment.yaml
kubectl apply -f k8s/http-service.yaml
kubectl apply -f k8s/ws-deployment.yaml
kubectl apply -f k8s/ws-service.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/frontend-service.yaml
kubectl apply -f k8s/ingress.yaml
```

### 6.4 Migrations

```bash
kubectl exec -n collabdraw deployment/http-backend -- sh -c \
  "packages/db/node_modules/.bin/prisma migrate deploy --schema=packages/db/prisma/schema.prisma"
```

### 6.5 Verified Results

| Check | Result |
|-------|--------|
| All 6 pods Running | ✅ |
| `http://localhost` (frontend) | HTTP 200 ✅ |
| `http://localhost/api/health` (backend) | HTTP 200 ✅ |
| WebSocket pod running | ✅ |
| Prisma migrations applied | ✅ |
| Ingress routing working | ✅ |

### 6.6 For AWS EKS

The only change needed is swapping the ingress annotations:

```yaml
# Replace nginx annotations with:
kubernetes.io/ingress.class: alb
alb.ingress.kubernetes.io/scheme: internet-facing
alb.ingress.kubernetes.io/target-type: ip  # required for WebSocket
```

---

## 7. Files Created or Modified

### New Files Created

| File | Purpose |
|------|---------|
| `apps/web/Dockerfile` | Next.js frontend Docker image |
| `apps/http-backend/Dockerfile` | Express API Docker image |
| `apps/ws-server/Dockerfile` | WebSocket server Docker image |
| `docker-compose.yml` | Full local stack orchestration |
| `.dockerignore` | Excludes node_modules, dist, .env from Docker builds |
| `k8s/namespace.yaml` | Kubernetes namespace |
| `k8s/configmap.yaml` | Non-secret configuration |
| `k8s/secret.yaml` | Sensitive credentials |
| `k8s/postgres-deployment.yaml` | Postgres pod + PVC |
| `k8s/postgres-service.yaml` | Postgres internal DNS |
| `k8s/http-deployment.yaml` | Express API pods |
| `k8s/http-service.yaml` | API internal DNS |
| `k8s/ws-deployment.yaml` | WebSocket server pod |
| `k8s/ws-service.yaml` | WebSocket internal DNS |
| `k8s/frontend-deployment.yaml` | Next.js pods |
| `k8s/frontend-service.yaml` | Frontend internal DNS |
| `k8s/ingress.yaml` | Traffic routing (nginx local / ALB on EKS) |
| `k8s/monitoring.yaml` | Prometheus + Grafana |
| `Jenkinsfile` | CI/CD pipeline definition |
| `PROJECT_REPORT.md` | Full project documentation |
| `DEVOPS.md` | Complete DevOps guide |
| `CHANGES.md` | This file |

### Modified Application Files

| File | Changes |
|------|---------|
| `apps/web/next.config.js` | Added `output: "standalone"` + Unsplash image domain |
| `apps/web/actions/action.ts` | Added `getRoomBySlug()` for slug → numeric ID resolution |
| `apps/web/app/board/[roomId]/page.tsx` | Auth redirect, connection timeout, slug resolution, shape echo fix, cleanup fix, removed unused state/imports, `any` types fixed |
| `apps/web/app/board/game.ts` | Hit-test type fix, nullable field normalization, wheel zoom, unused imports removed, `any` types fixed |
| `apps/web/app/board/repaint.ts` | `@ts-ignore` → `@ts-expect-error` |
| `apps/web/app/board/types.ts` | Removed 13 unused lucide imports |
| `apps/web/app/dashboard/page.tsx` | Restored loading skeleton, removed unused imports |
| `apps/web/app/layout.tsx` | Removed unused `Context` import |
| `apps/web/hooks/useWebSocket.tsx` | Added reconnect logic (5 attempts, exponential backoff) |
| `apps/web/hooks/useUserFetcher.tsx` | Skip fetch when no token, removed debug log |
| `apps/web/components/providers/ContextProvider.tsx` | Removed unused `user` destructure, null photo fix |
| `apps/web/components/dashboard/Header.tsx` | Removed dead code block, wired Bell button |
| `apps/web/components/dashboard/QuickActions.tsx` | Wired Join/Import/Export buttons |
| `apps/web/components/dashboard/RoomsGrid.tsx` | Removed unused import, fixed share link, null-safe filter, `any` types fixed |
| `apps/web/components/dashboard/StatsCard.tsx` | Fixed broken template literal |
| `apps/web/components/Propertypanel.tsx` | Fixed invalid CSS color, `any` → `unknown`, removed duplicate declaration |
| `apps/web/components/StrokeControl.tsx` | `any` → `unknown` |
| `apps/web/components/TextOnCanvas.tsx` | Removed unused `isEditingText` from destructure |
| `apps/web/components/CanvasDropdown.tsx` | Removed unused dropdown imports |
| `apps/web/components/landing/demo-section.tsx` | Removed unused imports, `any` → `React.ReactNode` |
| `apps/web/components/landing/navbar.tsx` | Replaced missing image with `PaintBucket` icon |
| `apps/web/components/auth/AuthImage.tsx` | Replaced `<img>` with Next.js `<Image>` |
| `apps/web/components/login-form.tsx` | Removed unused imports |
| `apps/web/components/signup-form.tsx` | Fixed unescaped apostrophe |
| `apps/http-backend/src/index.ts` | JWT includes name, CORS_ORIGIN env var, rooms filtered by owner, shapes in asc order, empty catch blocks fixed, Prisma migrations in CMD |
| `apps/ws-server/src/events/handlers.ts` | roomId string normalization (critical multiplayer fix), retry limit added |
| `turbo.json` | Added `NEXT_PUBLIC_SOCKET_URL` to build env |
| `.env.example` | Updated to match actual vars used |

---

## 8. Current System Status

### What Works

| Feature | Status |
|---------|--------|
| Signup / Login / Logout | ✅ |
| Dashboard — create room | ✅ |
| Dashboard — list rooms (own only) | ✅ |
| Dashboard — open/share/delete room | ✅ |
| Dashboard — join via code | ✅ |
| Dashboard — import canvas (JSON) | ✅ |
| Board — load existing shapes | ✅ |
| Board — draw shapes (rect, circle, line, diamond, arrow) | ✅ |
| Board — text tool | ✅ |
| Board — select + move shapes | ✅ |
| Board — property panel (stroke/fill/width/style) | ✅ |
| Board — zoom (buttons + mouse wheel) | ✅ |
| Board — pan (hand tool) | ✅ |
| Board — canvas background color | ✅ |
| Board — reset canvas | ✅ |
| Multiplayer — multiple users same room | ✅ |
| Multiplayer — live drawing sync | ✅ |
| Multiplayer — join via slug or numeric ID | ✅ |
| WebSocket reconnect on disconnect | ✅ |
| Connection timeout with error message | ✅ |
| Auth redirect (no token → /login) | ✅ |
| Docker Compose — full stack | ✅ |
| Kubernetes — local (Docker Desktop) | ✅ |
| Kubernetes — all pods running | ✅ |
| Kubernetes — ingress routing | ✅ |

### Known Limitations (not implemented)

| Feature | Status |
|---------|--------|
| Stats cards (real data) | ⚠️ Hardcoded fake values |
| Recent Activity feed | ⚠️ Hardcoded mock data |
| Profile / Settings pages | ⚠️ "Coming soon" toast |
| Eraser tool | ❌ Button exists, no logic |
| Export canvas to PNG/JSON | ❌ Not implemented from board |
| Undo / Redo | ❌ Not implemented |
| Mobile / touch support | ❌ Mouse events only |
| GitHub OAuth | ❌ Buttons exist, no OAuth flow |
| JWT expiry | ❌ Tokens never expire |
| Route guards (middleware) | ❌ No Next.js middleware on /dashboard or /board |
| ws-server horizontal scaling | ❌ 1 replica only (needs Redis Pub/Sub) |
| Soft delete for rooms | ❌ Schema has deletedAt but hard delete is used |

### Docker Hub Images

- `aryanyewale/collabdraw-http:latest`
- `aryanyewale/collabdraw-ws:latest`
- `aryanyewale/collabdraw-web:latest`

### Quick Start Commands

```bash
# Local development (Docker Compose)
docker compose up --build

# Local Kubernetes (Docker Desktop)
kubectl apply -f k8s/
kubectl exec -n collabdraw deployment/http-backend -- sh -c \
  "packages/db/node_modules/.bin/prisma migrate deploy --schema=packages/db/prisma/schema.prisma"
# Open: http://localhost

# Check status
kubectl get pods -n collabdraw
docker compose ps
```

---

## 9. Terraform + AWS EKS Infrastructure

### 9.1 Files Created

```
terraform/
├── provider.tf               ← AWS + Kubernetes provider, versions
├── variables.tf              ← All configurable settings (region, instance type, etc.)
├── vpc.tf                    ← VPC, 2 public subnets, IGW, route table, security group
├── eks.tf                    ← EKS cluster, managed node group, ALB IAM role + IRSA
├── main.tf                   ← ECR repositories (3×) with lifecycle policies
├── outputs.tf                ← Prints cluster name, ECR URLs, kubectl command after apply
├── terraform.tfvars.example  ← Copy to terraform.tfvars and fill in values
└── README.md                 ← Complete step-by-step EKS deployment guide
```

### 9.2 What Terraform Creates

| Resource | Purpose |
|----------|---------|
| VPC (`10.0.0.0/16`) | Isolated private network for all AWS resources |
| 2 public subnets | Spread across 2 AZs — where EKS nodes and ALB run |
| Internet Gateway | Connects VPC to the internet |
| Route table | Routes `0.0.0.0/0` traffic through the IGW |
| Security group | Controls traffic to/from worker nodes |
| EKS cluster | Kubernetes control plane (managed by AWS) |
| Managed node group | 2× `t3.medium` EC2 worker nodes |
| IAM role (IRSA) | Lets the ALB Controller create AWS ALBs from inside Kubernetes |
| Kubernetes ServiceAccount | Links the IAM role to the ALB Controller pod |
| ECR repo: `collabdraw-http` | Stores http-backend Docker images |
| ECR repo: `collabdraw-ws` | Stores ws-server Docker images |
| ECR repo: `collabdraw-web` | Stores frontend Docker images |
| ECR lifecycle policies | Auto-delete old images, keep last 10 |

### 9.3 Key Design Decisions

- **Public subnets only** — private subnets require a NAT Gateway (~$32/month extra). Not needed for a student project.
- **Official EKS Terraform module** (`terraform-aws-modules/eks/aws`) — handles 200+ lines of IAM boilerplate automatically.
- **IRSA (IAM Roles for Service Accounts)** — the ALB Controller pod gets AWS permissions via a Kubernetes service account annotation, not hardcoded credentials.
- **ECR lifecycle policies** — keep only 10 images per repo to avoid storage cost creep.
- **`enable_cluster_creator_admin_permissions = true`** — the IAM user running Terraform automatically gets kubectl admin access.

### 9.4 Deployment Flow (Local → EKS)

```
1. terraform init       ← download providers and modules
2. terraform plan       ← preview what will be created
3. terraform apply      ← create VPC + EKS + ECR (~15-20 min)
4. aws eks update-kubeconfig  ← connect kubectl to EKS
5. helm install aws-load-balancer-controller  ← install ALB Controller
6. docker build + push to ECR  ← push images
7. kubectl apply -f k8s/  ← deploy the app
8. kubectl get ingress -n collabdraw  ← get the public ALB URL
```

### 9.5 Traffic Flow on EKS

```
Browser
  │
  ▼
AWS ALB  (auto-created by ALB Controller when ingress.yaml is applied)
  │  DNS: k8s-collabdraw-xxx.us-east-1.elb.amazonaws.com
  │
  ├── /api/*  → http-backend Service → Express pods (on EC2 nodes)
  ├── /ws     → ws-server Service   → WebSocket pod (target-type: ip required)
  └── /       → frontend Service   → Next.js pods
                                          │
                                   postgres Service → Postgres pod
```

### 9.6 Cost Estimate

| Resource | Monthly cost |
|----------|-------------|
| EKS control plane | ~$72 |
| 2× t3.medium nodes | ~$60 |
| ALB | ~$20 |
| ECR storage | ~$1 |
| **Total** | **~$153/month** |

Run `terraform destroy` when not using to stop all charges.

### 9.7 `.gitignore` Updated

Added Terraform entries to prevent committing secrets and state:
```
terraform/.terraform/
terraform/terraform.tfvars      ← your actual values (may contain secrets)
terraform/terraform.tfstate     ← current infrastructure state
terraform/terraform.tfstate.backup
terraform/*.tfplan
```

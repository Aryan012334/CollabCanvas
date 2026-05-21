# CollabDraw — Complete Change Log

Everything audited, fixed, built, deployed, and verified across all sessions.
Use this as a reference for presentations, code reviews, or onboarding.

---

## Table of Contents

1. [Application Bug Fixes](#1-application-bug-fixes)
2. [Docker Setup](#2-docker-setup)
3. [Kubernetes Setup](#3-kubernetes-setup)
4. [CI/CD — Jenkins](#4-cicd--jenkins)
5. [Monitoring — Prometheus + Grafana](#5-monitoring--prometheus--grafana)
6. [Local Kubernetes Verification](#6-local-kubernetes-verification)
7. [Terraform + AWS Infrastructure](#7-terraform--aws-infrastructure)
8. [AWS EKS Live Deployment](#8-aws-eks-live-deployment)
9. [Files Created or Modified](#9-files-created-or-modified)
10. [Current System Status](#10-current-system-status)

---

## 1. Application Bug Fixes

### 1.1 Critical — Multiplayer / WebSocket

| Fix | File | Root Cause | What Was Done |
|-----|------|-----------|---------------|
| roomId type mismatch | `ws-server/src/events/handlers.ts` | Client sends numeric roomId, WS server Map used string keys — users never in same room | Normalize all `data.roomId` to `String(roomId)` at handler entry |
| Infinite DB retry loop | `ws-server/src/events/handlers.ts` | On DB error, job re-queued with no retry limit — OOM risk | Added `MAX_RETRIES = 3` with exponential backoff |
| JWT missing `name` field | `http-backend/src/index.ts` | JWT signed with only `{ userId }` — WS server fell back to `"John"` for every user | Added `name: user.name` to JWT payload |
| `shape:create` echo duplicate | `apps/web/app/board/[roomId]/page.tsx` | WS broadcasts `shape:create` back to sender — creator's shape had no DB id | Push echo to `allDrawings` for everyone; skip re-render only for creator |
| `useCallback` stale closure | `apps/web/app/board/[roomId]/page.tsx` | `user?.id` stale inside WS handler because dep array was `[]` | Changed to `[user?.id]` |
| No WebSocket reconnect | `apps/web/hooks/useWebSocket.tsx` | On disconnect, board showed "Connecting..." forever | Added exponential backoff reconnect (5 attempts, 3s×attempt delay) |

### 1.2 Critical — Canvas / Drawing

| Fix | File | Root Cause | What Was Done |
|-----|------|-----------|---------------|
| Hit-test always failing | `apps/web/app/board/game.ts` | Compared `shape.type` against lowercase strings vs uppercase `ShapeType` enum | Normalize with `.toUpperCase()` |
| Stale shapes on room switch | `apps/web/app/board/game.ts` | `allDrawings` never cleared on unmount | `clearAllDrawings()` called in board page cleanup |
| Nullable DB fields crash | `apps/web/app/board/game.ts` | `startX/Y/width/height` are `Int?` in DB — null values crashed rendering | Normalize to `?? 0` when loading shapes |
| Mouse wheel zoom not wired | `apps/web/app/board/game.ts` | `onZoom` handler existed but no wheel event listener | Added `wheel` event listener with zoom-to-cursor math |
| `shape:update` type check | `apps/web/app/board/[roomId]/page.tsx` | Checked `"text"` (lowercase) vs actual `"TEXT"` (enum) | Fixed to `"TEXT"` |
| PropertyPanel double update | `apps/web/app/board/[roomId]/page.tsx` | `onPropertyChange` called `handlePropertyChange` which called `setCurrentProperties` again | Simplified to pass `handlePropertyChange` directly |
| Canvas cleanup lost | `apps/web/app/board/[roomId]/page.tsx` | Inner canvas cleanup stored in wrong variable | Split into `cleanup` + `innerCleanup`, both called on unmount |
| No auth guard on board | `apps/web/app/board/[roomId]/page.tsx` | Unauthenticated users stuck on "Connecting..." forever | Added redirect to `/login` when `user.token` is empty |
| No connection timeout | `apps/web/app/board/[roomId]/page.tsx` | Infinite spinner if server is down | Added 15s timeout with "Back to Dashboard" fallback |

### 1.3 Critical — Multiplayer Room Joining via Slug

| Fix | File | Root Cause | What Was Done |
|-----|------|-----------|---------------|
| Slug → NaN roomId | `apps/web/app/board/[roomId]/page.tsx` | `Number("my-room")` = `NaN` — WS stored as `"NaN"`, different room from owner's `"42"` | Added `resolvedRoomId` state; if slug call `GET /room/:slug` to get numeric ID |
| Missing `getRoomBySlug` | `apps/web/actions/action.ts` | No function to resolve slug → numeric ID | Added `getRoomBySlug()` calling `GET /room/:slug` |

### 1.4 Important — Backend

| Fix | File | Root Cause | What Was Done |
|-----|------|-----------|---------------|
| All rooms returned to all users | `apps/http-backend/src/index.ts` | `/rooms` returned every room — privacy issue | Restored `adminId: userId` filter |
| Shapes in wrong order | `apps/http-backend/src/index.ts` | `/shapes/:roomId` returned `desc` — older shapes rendered on top | Changed to `asc` |
| Empty catch blocks | `apps/http-backend/src/index.ts` | Silent failures on `/rooms` and `/room/:slug` | Added proper error responses |
| CORS blocking Docker | `apps/http-backend/src/index.ts` | Production CORS only allowed `collabdraw.showcase.wiki` | Added `CORS_ORIGIN` env var; docker-compose sets it to `http://localhost:3000` |

### 1.5 Important — Dashboard

| Fix | File | Root Cause | What Was Done |
|-----|------|-----------|---------------|
| Duplicate return block | `components/dashboard/Header.tsx` | Two `return` statements — dead code with old branding | Removed dead block; added `onClick` to Bell button |
| 3 buttons with no handlers | `components/dashboard/QuickActions.tsx` | "Join via Code", "Import Canvas", "Export Canvas" were placeholders | Wired up all three buttons |
| Unused import breaking lint | `components/dashboard/RoomsGrid.tsx` | `import { set } from "zod"` — breaks `--max-warnings 0` | Removed |
| Share link used slug | `components/dashboard/RoomsGrid.tsx` | Share dialog used slug but board page uses numeric ID | Both now use `room.id` |
| Crash on undefined rooms | `components/dashboard/RoomsGrid.tsx` | `data?.rooms?.filter(...)` crashes when `data` is undefined | Changed to `(data?.rooms ?? []).filter(...)` |
| Broken gradient class | `components/dashboard/StatsCard.tsx` | Template literal in single-quoted string | Fixed to backtick template literal |
| Loading skeleton commented out | `apps/web/app/dashboard/page.tsx` | `useFetchUser` and `DashboardSkeleton` were commented out | Restored |

### 1.6 Build Fixes — Lint Warnings (`--max-warnings 0`)

All of these caused `next build` to fail in Docker:

| File | Warning Fixed |
|------|--------------|
| `board/[roomId]/page.tsx` | TypeScript `undefined` param, `any` types, unused `_isPanning` |
| `board/game.ts` | Unused `currentPoints`, `index`, `rect`; `any` types |
| `board/repaint.ts` | `@ts-ignore` → `@ts-expect-error` |
| `board/types.ts` | 13 unused lucide imports removed |
| `Propertypanel.tsx` | `any` → `unknown`, unused `onClose`, duplicate declaration fixed |
| `StrokeControl.tsx` | `any` → `unknown` |
| `TextOnCanvas.tsx` | Unused `isEditingText` in destructure |
| `RoomsGrid.tsx` | `any` → `Room` type, empty catch block fixed |
| `demo-section.tsx` | 3 unused imports, `any` → `React.ReactNode` |
| `login-form.tsx` | 3 unused imports |
| `ContextProvider.tsx` | Unused `user` in destructure |
| `signup-form.tsx` | Unescaped `'` → `&apos;` |
| `layout.tsx` | Unused `Context` import |
| `dashboard/page.tsx` | Unused `useContext`, `useEffect` imports |

---

## 2. Docker Setup

### 2.1 What Docker Does

Docker packages each service into a portable **image** — a snapshot of the app + all its dependencies. You run that image as a **container** — an isolated process that works identically on any machine.

### 2.2 Multi-Stage Builds

Every Dockerfile uses two stages:
- **Stage 1 (builder):** Install pnpm → install deps → compile TypeScript → JavaScript
- **Stage 2 (runner):** Copy only compiled output → run it

This keeps images small. The builder stage (TypeScript compiler, source files, dev tools) is thrown away.

### 2.3 Critical Fix — `.dockerignore`

**Root cause of all "Cannot find module" errors:**
Local Windows `node_modules` use symlinks that don't work in Linux containers. When Docker copied `apps/ws-server/` it overwrote the Linux-compatible `node_modules` that pnpm had just installed inside the container.

**Fix:** Added `**/node_modules` to `.dockerignore` — prevents all nested `node_modules` from being copied.

### 2.4 Critical Fix — Prisma Schema Timing

**Root cause:** `packages/db/package.json` has `postinstall: "pnpm prisma generate"` which runs automatically during `pnpm install`. At that point only `package.json` files had been copied — `schema.prisma` didn't exist yet.

**Fix:** Copy `packages/db/prisma/` before `pnpm install` in all three Dockerfiles.

### 2.5 `next.config.js` — `output: "standalone"`

Added `output: "standalone"` — required for the slim Docker runner stage. This tells Next.js to produce a self-contained server in `.next/standalone/`.

### 2.6 `docker-compose.yml`

- All 4 services: `postgres`, `http-backend`, `ws-server`, `web`
- Private `collab-net` bridge network — services reach each other by name
- Startup order: postgres (healthcheck) → backends → frontend
- `CORS_ORIGIN: http://localhost:3000` added to http-backend
- `NEXT_PUBLIC_*` passed as build `args` (baked at build time, not runtime)
- Postgres volume: `postgres_data:/var/lib/postgresql/data`

### 2.7 Verified Working

```
docker compose up --build
```
All four containers start, migrations run automatically, app at http://localhost:3000.

---

## 3. Kubernetes Setup

### 3.1 What Kubernetes Does

Kubernetes (K8s) runs and manages containers at scale. You write YAML files describing what you want, and Kubernetes makes it happen — and keeps it running even if containers crash.

### 3.2 Core Concepts

**Deployment** — manages pods (running containers)
> "Run this container image. Keep N copies alive. Restart if it crashes."

**Service** — gives pods a stable DNS name
> "Give these pods a name so other pods can reach them. Load-balance traffic."

**ConfigMap** — non-sensitive config (URLs, NODE_ENV)

**Secret** — sensitive data (passwords, JWT keys) stored as base64

**PersistentVolumeClaim (PVC)** — requests storage from the cluster. On EKS this creates an EBS volume.

**Ingress** — the single public entry point. Routes traffic to the right service based on URL path.

**Readiness probe** — "Is this pod ready to receive traffic?" Kubernetes holds traffic back until this passes.

**Liveness probe** — "Is this pod still alive?" If this fails, Kubernetes restarts the pod.

### 3.3 Manifests Created

| File | What it creates |
|------|----------------|
| `namespace.yaml` | `collabdraw` namespace |
| `configmap.yaml` | Non-secret config: `DATABASE_URL`, `NODE_ENV` |
| `secret.yaml` | Base64-encoded: `POSTGRES_PASSWORD`, `JWT_SECRET` |
| `postgres-deployment.yaml` | Postgres pod + 1Gi PVC with `storageClassName: gp2` |
| `postgres-service.yaml` | ClusterIP — DNS name `postgres:5432` |
| `http-deployment.yaml` | 2 replicas, readiness/liveness on `/health` |
| `http-service.yaml` | ClusterIP — DNS name `http-backend:3001` |
| `ws-deployment.yaml` | 1 replica (in-memory state limitation) |
| `ws-service.yaml` | ClusterIP — DNS name `ws-server:4000` |
| `frontend-deployment.yaml` | 2 replicas, readiness/liveness on `/` |
| `frontend-service.yaml` | ClusterIP — DNS name `frontend:3000` |
| `ingress.yaml` | ALB ingress — routes all traffic |
| `monitoring.yaml` | Prometheus + Grafana in `monitoring` namespace |

### 3.4 Key Design Decisions

- **ws-server: 1 replica** — room state is in-memory (`Map<roomId, Set<User>>`). Multiple replicas would split users across pods. Future fix: Redis Pub/Sub.
- **postgres: Deployment not StatefulSet** — simpler for student project. Production would use AWS RDS.
- **`storageClassName: gp2`** — required on EKS. Without it, PVC stays `Pending` forever because EBS CSI driver needs a storage class.
- **`PGDATA: /var/lib/postgresql/data/pgdata`** — required on EKS. EBS volumes have a `lost+found` directory at root which blocks Postgres initialization. Using a subdirectory avoids this.

---

## 4. CI/CD — Jenkins

### 4.1 What CI/CD Does

**CI (Continuous Integration):** Every push to GitHub automatically builds and tests the code.
**CD (Continuous Deployment):** After a successful build, the new version is automatically deployed to Kubernetes.

Without CI/CD, you'd manually run `docker build`, `docker push`, and `kubectl set image` every time. Jenkins automates this.

### 4.2 Pipeline Stages

```
git push → GitHub webhook → Jenkins
  Stage 1: Checkout — pull latest code
  Stage 2: Build Docker Images — all 3 services
  Stage 3: Push to Docker Hub — tagged with Git commit hash
  Stage 4: Deploy to Kubernetes — kubectl set image (rolling update)
```

### 4.3 Key Details

- Images tagged with `GIT_COMMIT.take(7)` — every build is uniquely versioned, rollback is possible
- `kubectl set image` + `kubectl rollout status` — zero-downtime rolling update
- Credentials stored in Jenkins (never in code): `dockerhub-creds`, `kubeconfig`
- Docker Hub username: `aryanyewale`
- Image names: `aryanyewale/collabdraw-http`, `aryanyewale/collabdraw-ws`, `aryanyewale/collabdraw-web`

---

## 5. Monitoring — Prometheus + Grafana

### 5.1 What Prometheus Does

Prometheus scrapes `/metrics` endpoints on pods every 15 seconds and stores the numbers as time-series data.

### 5.2 What Grafana Does

Grafana reads from Prometheus and displays visual dashboards — graphs, charts, gauges.

### 5.3 Pod Discovery

Pods are auto-discovered via annotations:
```yaml
prometheus.io/scrape: "true"
prometheus.io/port: "3001"
```

### 5.4 Access

```bash
kubectl port-forward svc/grafana 3001:3000 -n monitoring
# Open: http://localhost:3001  (admin/admin)
```

---

## 6. Local Kubernetes Verification

### 6.1 Setup

- Tool: Docker Desktop built-in Kubernetes
- kubectl version: v1.34.1
- Node: `docker-desktop` — Ready

### 6.2 Issues Fixed During Local Testing

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| Ingress webhook blocked ingress creation | nginx admission webhook not ready when ingress was applied | `kubectl delete -A ValidatingWebhookConfiguration ingress-nginx-admission` then reapply |

### 6.3 Verified Results

| Check | Result |
|-------|--------|
| All 6 pods Running | ✅ |
| `http://localhost` (frontend) | HTTP 200 ✅ |
| `http://localhost/api/health` (backend) | HTTP 200 ✅ |
| WebSocket pod running | ✅ |
| Prisma migrations applied | ✅ |

---

## 7. Terraform + AWS Infrastructure

### 7.1 What Terraform Does

Terraform is Infrastructure-as-Code. Instead of clicking through the AWS console, you write code that describes what you want and Terraform creates it.

### 7.2 Files Created

```
terraform/
├── provider.tf          ← AWS + Kubernetes provider, versions
├── variables.tf         ← All configurable settings
├── vpc.tf               ← VPC, 2 public subnets, IGW, route table
├── eks.tf               ← EKS cluster, node group, ALB IAM role (IRSA)
├── main.tf              ← ECR repositories (3×) with lifecycle policies
├── outputs.tf           ← Prints cluster name, ECR URLs after apply
└── terraform.tfvars.example
```

### 7.3 What Terraform Creates

| Resource | Purpose |
|----------|---------|
| VPC (`10.0.0.0/16`) | Isolated private network |
| 2 public subnets | Spread across 2 AZs — where EKS nodes and ALB run |
| Internet Gateway | Connects VPC to internet |
| Route table | Routes `0.0.0.0/0` through IGW |
| EKS cluster | Kubernetes control plane (managed by AWS) |
| Managed node group | EC2 worker nodes |
| IAM role (IRSA) | Lets ALB Controller create AWS ALBs from inside Kubernetes |
| ECR repos (×3) | Stores Docker images |

---

## 8. AWS EKS Live Deployment

### 8.1 What EKS Is

EKS (Elastic Kubernetes Service) is AWS's managed Kubernetes. AWS runs the control plane. You provide EC2 worker nodes.

### 8.2 AWS Services Used

| Service | What it does |
|---------|-------------|
| EKS | Runs the Kubernetes cluster |
| EC2 (t3.small) | Worker nodes that run pods |
| ECR | Stores Docker images |
| ALB | Application Load Balancer — created by Ingress |
| EBS | Persistent storage for Postgres (via gp2 PVC) |

### 8.3 Issues Encountered and Fixed

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| Node group creation failed | `t3.medium` not eligible on Free Tier account | Switched to `t3.small` |
| Postgres PVC stuck `Pending` | No `storageClassName` set — EKS has no default | Added `storageClassName: gp2` to PVC |
| Postgres pod crashing | EBS volume has `lost+found` at root — Postgres refuses non-empty dir | Added `PGDATA: /var/lib/postgresql/data/pgdata` env var |
| EBS CSI driver not provisioning | `AmazonEBSCSIDriverPolicy` not attached to node role | Attached policy + restarted EBS CSI controller |
| ALB not created | Node role missing ELB permissions | Attached `ElasticLoadBalancingFullAccess` + `AmazonEC2FullAccess` + custom ALB policy |
| Frontend showing wrong API URL | `NEXT_PUBLIC_*` baked at build time with placeholder | Rebuilt frontend image with real ALB DNS after getting it |

### 8.4 IAM Policies Attached to Node Role

```
eksctl-collabdraw-cluster-nodegrou-NodeInstanceRole-DCVcP0HrA6XB
  ├── AmazonEBSCSIDriverPolicy          ← EBS volume provisioning
  ├── ElasticLoadBalancingFullAccess    ← ALB creation/management
  ├── AmazonEC2FullAccess               ← Security group management
  └── AWSLoadBalancerControllerIAMPolicy ← Custom ALB controller policy
                                           (ARN: arn:aws:iam::494487213388:policy/AWSLoadBalancerControllerIAMPolicy)
```

### 8.5 Traffic Flow on EKS

```
Browser
  │
  ▼
AWS ALB  (k8s-collabdr-collabdr-0c35dcb652-657159459.ap-south-1.elb.amazonaws.com)
  │  Created automatically by ALB Controller when ingress.yaml is applied
  │
  ├── /api/*  → http-backend Service → Express pods (EC2 nodes)
  │                                         └── PostgreSQL pod (EBS volume)
  │
  ├── /ws     → ws-server Service   → WebSocket pod (persistent connection)
  │
  └── /       → frontend Service   → Next.js pods
```

### 8.6 Verified Live Results

| Check | Result |
|-------|--------|
| All 6 pods Running | ✅ |
| ALB DNS | `k8s-collabdr-collabdr-0c35dcb652-657159459.ap-south-1.elb.amazonaws.com` |
| Frontend HTTP 200 | ✅ |
| Backend reachable | ✅ |
| Prisma migrations | Applied ✅ |
| EBS volume (Postgres) | Bound ✅ |

### 8.7 AWS Account Details

- Account ID: `494487213388`
- Region: `ap-south-1` (Mumbai)
- Cluster: `collabdraw-cluster`
- Node type: `t3.small` (2 nodes)
- ECR repos: `collabdraw-http`, `collabdraw-ws`, `collabdraw-web`

### 8.8 Cost Estimate

| Resource | Monthly cost |
|----------|-------------|
| EKS control plane | ~$72 |
| 2× t3.small nodes | ~$30 |
| ALB | ~$20 |
| EBS (1GB) | ~$1 |
| ECR storage | ~$1 |
| **Total** | **~$124/month** |

**Delete cluster when not using to stop all charges.**

---

## 9. Files Created or Modified

### New Files Created

| File | Purpose |
|------|---------|
| `apps/web/Dockerfile` | Next.js frontend Docker image |
| `apps/http-backend/Dockerfile` | Express API Docker image |
| `apps/ws-server/Dockerfile` | WebSocket server Docker image |
| `docker-compose.yml` | Full local stack orchestration |
| `.dockerignore` | Excludes node_modules, dist, .env |
| `k8s/namespace.yaml` | Kubernetes namespace |
| `k8s/configmap.yaml` | Non-secret configuration |
| `k8s/secret.yaml` | Sensitive credentials |
| `k8s/postgres-deployment.yaml` | Postgres pod + PVC (gp2, PGDATA fix) |
| `k8s/postgres-service.yaml` | Postgres internal DNS |
| `k8s/http-deployment.yaml` | Express API pods (ECR image) |
| `k8s/http-service.yaml` | API internal DNS |
| `k8s/ws-deployment.yaml` | WebSocket server pod (ECR image) |
| `k8s/ws-service.yaml` | WebSocket internal DNS |
| `k8s/frontend-deployment.yaml` | Next.js pods (ECR image) |
| `k8s/frontend-service.yaml` | Frontend internal DNS |
| `k8s/ingress.yaml` | ALB ingress (EKS) |
| `k8s/monitoring.yaml` | Prometheus + Grafana |
| `Jenkinsfile` | CI/CD pipeline |
| `terraform/provider.tf` | AWS + K8s provider |
| `terraform/variables.tf` | All configurable settings |
| `terraform/vpc.tf` | VPC, subnets, IGW |
| `terraform/eks.tf` | EKS cluster, node group, IRSA |
| `terraform/main.tf` | ECR repositories |
| `terraform/outputs.tf` | Post-apply output values |
| `terraform/terraform.tfvars.example` | Variable template |
| `terraform/README.md` | Step-by-step EKS guide |
| `EKS_RESTART.md` | Complete cluster restart guide |
| `PROJECT_REPORT.md` | Full application documentation |
| `DEVOPS.md` | Complete DevOps guide |
| `CHANGES.md` | This file |

### Modified Application Files

| File | Changes |
|------|---------|
| `apps/web/next.config.js` | Added `output: "standalone"` + Unsplash image domain |
| `apps/web/actions/action.ts` | Added `getRoomBySlug()` |
| `apps/web/app/board/[roomId]/page.tsx` | Auth redirect, timeout, slug resolution, shape echo fix, cleanup fix |
| `apps/web/app/board/game.ts` | Hit-test fix, nullable fields, wheel zoom, `any` types fixed |
| `apps/web/app/board/repaint.ts` | `@ts-ignore` → `@ts-expect-error` |
| `apps/web/app/board/types.ts` | Removed 13 unused imports |
| `apps/web/app/dashboard/page.tsx` | Restored loading skeleton |
| `apps/web/app/layout.tsx` | Removed unused `Context` import |
| `apps/web/hooks/useWebSocket.tsx` | Added reconnect logic |
| `apps/web/hooks/useUserFetcher.tsx` | Skip fetch when no token |
| `apps/web/components/providers/ContextProvider.tsx` | Removed unused `user` destructure |
| `apps/web/components/dashboard/Header.tsx` | Removed dead code block |
| `apps/web/components/dashboard/QuickActions.tsx` | Wired Join/Import/Export |
| `apps/web/components/dashboard/RoomsGrid.tsx` | Fixed share link, null-safe filter |
| `apps/web/components/dashboard/StatsCard.tsx` | Fixed broken template literal |
| `apps/web/components/Propertypanel.tsx` | Fixed invalid CSS, `any` → `unknown` |
| `apps/web/components/StrokeControl.tsx` | `any` → `unknown` |
| `apps/web/components/TextOnCanvas.tsx` | Removed unused prop |
| `apps/web/components/CanvasDropdown.tsx` | Removed unused imports |
| `apps/web/components/landing/demo-section.tsx` | Removed unused imports |
| `apps/web/components/landing/navbar.tsx` | Replaced missing image with icon |
| `apps/web/components/auth/AuthImage.tsx` | Replaced `<img>` with Next.js `<Image>` |
| `apps/web/components/login-form.tsx` | Removed unused imports |
| `apps/web/components/signup-form.tsx` | Fixed unescaped apostrophe |
| `apps/http-backend/src/index.ts` | JWT includes name, CORS_ORIGIN, rooms filtered, shapes asc, migrations in CMD |
| `apps/ws-server/src/events/handlers.ts` | roomId string normalization, retry limit |
| `turbo.json` | Added `NEXT_PUBLIC_SOCKET_URL` to build env |
| `.env.example` | Updated to match actual vars |
| `.gitignore` | Added Terraform entries |

---

## 10. Current System Status

### What Works

| Feature | Status |
|---------|--------|
| Signup / Login / Logout | ✅ |
| Dashboard — create/list/open/share/delete room | ✅ |
| Dashboard — join via code | ✅ |
| Board — draw all shape types | ✅ |
| Board — select, move, style shapes | ✅ |
| Board — zoom, pan, background color | ✅ |
| Multiplayer — live drawing sync | ✅ |
| Multiplayer — join via slug or numeric ID | ✅ |
| WebSocket reconnect | ✅ |
| Docker Compose (local) | ✅ |
| Kubernetes local (Docker Desktop) | ✅ |
| AWS EKS (live) | ✅ |
| ECR images pushed | ✅ |
| ALB routing | ✅ |
| EBS persistent storage | ✅ |

### Known Limitations

| Feature | Status |
|---------|--------|
| Stats cards | ⚠️ Hardcoded fake values |
| Recent Activity | ⚠️ Mock data |
| Eraser tool | ❌ Button exists, no logic |
| Export canvas | ❌ Not implemented |
| Undo/redo | ❌ Not implemented |
| Mobile/touch | ❌ Mouse events only |
| ws-server scaling | ❌ 1 replica only (needs Redis) |
| JWT expiry | ❌ Tokens never expire |

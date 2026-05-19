# CollabDraw — DevOps Guide

A complete guide to the Docker and Kubernetes setup for CollabDraw.
Written to be understandable for a college presentation.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Directory Structure](#2-directory-structure)
3. [Docker Setup](#3-docker-setup)
4. [How docker-compose Works](#4-how-docker-compose-works)
5. [Kubernetes Setup](#5-kubernetes-setup)
6. [How Traffic Flows in Kubernetes](#6-how-traffic-flows-in-kubernetes)
7. [Commands — Docker](#7-commands--docker)
8. [Commands — Kubernetes](#8-commands--kubernetes)
9. [Deployment Order](#9-deployment-order)
10. [Common Problems and Fixes](#10-common-problems-and-fixes)

---

## 1. Project Overview

CollabDraw has four services that need to run together:

```
┌─────────────────────────────────────────────────────┐
│                     Browser                         │
│  Opens http://localhost:3000                        │
│  Calls REST API at http://localhost:3001            │
│  Connects WebSocket at ws://localhost:4000          │
└──────────┬──────────────┬──────────────┬────────────┘
           │              │              │
           ▼              ▼              ▼
      ┌─────────┐  ┌──────────┐  ┌───────────┐
      │  web    │  │  http-   │  │  ws-      │
      │ :3000   │  │ backend  │  │ server    │
      │ Next.js │  │  :3001   │  │  :4000    │
      └─────────┘  └────┬─────┘  └─────┬─────┘
                        │              │
                        └──────┬───────┘
                               ▼
                        ┌─────────────┐
                        │  postgres   │
                        │   :5432     │
                        └─────────────┘
```

---

## 2. Directory Structure

```
CollabDraw/
│
├── apps/
│   ├── web/
│   │   └── Dockerfile          ← Next.js frontend image
│   ├── http-backend/
│   │   └── Dockerfile          ← Express REST API image
│   └── ws-server/
│       └── Dockerfile          ← WebSocket server image
│
├── k8s/                        ← All Kubernetes files
│   ├── namespace.yaml
│   ├── configmap.yaml
│   ├── secret.yaml
│   ├── postgres-deployment.yaml
│   ├── postgres-service.yaml
│   ├── http-deployment.yaml
│   ├── http-service.yaml
│   ├── ws-deployment.yaml
│   ├── ws-service.yaml
│   ├── frontend-deployment.yaml
│   ├── frontend-service.yaml
│   └── ingress.yaml
│
├── docker-compose.yml          ← Run everything locally
├── .dockerignore               ← Files Docker should ignore
├── .env.example                ← Template for environment variables
├── PROJECT_REPORT.md           ← Full project documentation
└── DEVOPS.md                   ← This file
```

---

## 3. Docker Setup

### What is Docker?

Docker packages an application and everything it needs (Node.js, dependencies, compiled code) into a single portable **image**. You run that image as a **container** — an isolated process on your machine.

### Why multi-stage builds?

Each Dockerfile has two stages:

```
Stage 1 (builder):   Install deps + compile TypeScript → JavaScript
Stage 2 (runner):    Copy only the compiled output, throw away the rest
```

This keeps the final image small. The builder stage has TypeScript, pnpm, source files — all of which are only needed during compilation. The runner stage only has the compiled JavaScript and production dependencies.

### The three Dockerfiles

#### `apps/http-backend/Dockerfile`

```
Stage 1 (builder):
  - Install pnpm
  - Copy package.json files (layer cache trick)
  - pnpm install --frozen-lockfile
  - Copy source code
  - pnpm db:generate  (creates Prisma query helpers)
  - pnpm build:api    (TypeScript → dist/)

Stage 2 (runner):
  - Copy dist/ folder
  - Copy node_modules
  - node apps/http-backend/dist/index.js
```

#### `apps/ws-server/Dockerfile`

Same pattern as http-backend. Compiles TypeScript, runs the compiled output.

#### `apps/web/Dockerfile`

```
Stage 1 (builder):
  - Install pnpm
  - Copy package.json files
  - pnpm install
  - Set NEXT_PUBLIC_* build args (baked into JS bundle)
  - pnpm build:web  (Next.js build → .next/standalone/)

Stage 2 (runner):
  - Copy .next/standalone/  (self-contained Next.js server)
  - Copy .next/static/      (CSS, JS assets)
  - Copy public/            (images, icons)
  - node apps/web/server.js
```

**Important:** `NEXT_PUBLIC_*` variables are baked into the JavaScript at build time. They cannot be changed after the image is built. This is a Next.js design decision — the browser needs to know these URLs before the server starts.

### Layer caching explained

```dockerfile
# This is copied FIRST — before source code
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# pnpm install only re-runs if the above files changed
RUN pnpm install --frozen-lockfile

# Source code is copied AFTER — changes here don't re-run install
COPY packages/ ./packages/
COPY apps/http-backend/ ./apps/http-backend/
```

Docker caches each layer. If `package.json` hasn't changed, Docker reuses the cached `node_modules` layer and skips `pnpm install`. This makes rebuilds much faster.

---

## 4. How docker-compose Works

`docker-compose.yml` defines all four services and how they connect.

### The network

```yaml
networks:
  collab-net:
    driver: bridge
```

All containers join `collab-net`. Inside this network, containers reach each other by **service name**. So `http-backend` connects to Postgres at `postgres:5432` — not `localhost:5432`.

### Service startup order

```
postgres starts first
    ↓ (healthcheck passes)
http-backend starts
ws-server starts
    ↓ (both healthy)
web starts
```

`depends_on` with `condition: service_healthy` makes Docker wait for the healthcheck to pass before starting the next service.

### Environment variables

```yaml
environment:
  DATABASE_URL: postgresql://postgres:postgres@postgres:5432/collabdraw?schema=public
```

Notice `@postgres:5432` — `postgres` is the service name, not `localhost`. Docker DNS resolves it automatically.

### NEXT_PUBLIC_* and why they use localhost

```yaml
args:
  NEXT_PUBLIC_API_URL: http://localhost:3001
  NEXT_PUBLIC_SOCKET_URL: ws://localhost:4000
```

These point to `localhost` because the **browser** makes these requests — not Docker. The browser runs on your machine, not inside a container. So it needs to reach the ports you exposed (`3001`, `4000`) on your machine.

---

## 5. Kubernetes Setup

### What is Kubernetes?

Kubernetes (K8s) is a system that runs and manages containers at scale. Instead of running `docker run` manually, you write YAML files describing what you want, and Kubernetes makes it happen.

### The files and what they do

| File | What it is | Why it exists |
|------|-----------|---------------|
| `namespace.yaml` | A folder for all our resources | Keeps CollabDraw isolated from other apps |
| `configmap.yaml` | Non-secret config values | One place to store URLs and settings |
| `secret.yaml` | Sensitive values (passwords, keys) | Keeps secrets separate from code |
| `postgres-deployment.yaml` | Runs the Postgres container | Manages the database pod |
| `postgres-service.yaml` | Stable DNS name for Postgres | Other pods reach it at `postgres:5432` |
| `http-deployment.yaml` | Runs the Express API | Manages 2 API pods |
| `http-service.yaml` | Stable DNS name for the API | Ingress routes `/api/*` here |
| `ws-deployment.yaml` | Runs the WebSocket server | Manages 1 WS pod |
| `ws-service.yaml` | Stable DNS name for WS | Ingress routes `/ws` here |
| `frontend-deployment.yaml` | Runs the Next.js app | Manages 2 frontend pods |
| `frontend-service.yaml` | Stable DNS name for frontend | Ingress routes `/` here |
| `ingress.yaml` | The public entry point | Routes internet traffic to the right service |

### Deployment vs Service — what's the difference?

```
Deployment = "run this container, keep N copies alive, restart if it crashes"
Service    = "give these pods a stable name and load-balance traffic to them"
```

A Deployment manages pods. A Service makes those pods reachable.

### ConfigMap vs Secret

```
ConfigMap = non-sensitive config (URLs, port numbers, NODE_ENV)
Secret    = sensitive data (passwords, JWT keys) — base64 encoded
```

Both are referenced in Deployments like this:

```yaml
env:
  - name: DATABASE_URL
    valueFrom:
      configMapKeyRef:
        name: collabdraw-config
        key: DATABASE_URL

  - name: JWT_SECRET
    valueFrom:
      secretKeyRef:
        name: collabdraw-secret
        key: JWT_SECRET
```

---

## 6. How Traffic Flows in Kubernetes

### Full traffic diagram

```
Internet
    │
    ▼
AWS ALB (Application Load Balancer)
    │   Created automatically by the AWS Load Balancer Controller
    │   when it sees the Ingress resource
    │
    ├── Path: /api/*
    │       │
    │       ▼
    │   http-backend Service (ClusterIP, port 3001)
    │       │
    │       ▼
    │   http-backend Pod 1  ──┐
    │   http-backend Pod 2  ──┘  (load balanced)
    │
    ├── Path: /ws
    │       │
    │       ▼
    │   ws-server Service (ClusterIP, port 4000)
    │       │
    │       ▼
    │   ws-server Pod 1
    │   (WebSocket connection stays open here)
    │
    └── Path: / (everything else)
            │
            ▼
        frontend Service (ClusterIP, port 3000)
            │
            ▼
        frontend Pod 1  ──┐
        frontend Pod 2  ──┘  (load balanced)
```

### How Kubernetes DNS works

Every Service gets a DNS name: `<service-name>.<namespace>.svc.cluster.local`

Within the same namespace you can use just the service name:
- `postgres` resolves to the Postgres Service
- `http-backend` resolves to the HTTP Backend Service
- `ws-server` resolves to the WebSocket Service

This is why `DATABASE_URL` uses `@postgres:5432` — Kubernetes DNS handles the rest.

### Why WebSocket needs special handling

WebSocket starts as an HTTP request and then "upgrades" to a persistent connection. The AWS ALB supports this, but requires:

```yaml
alb.ingress.kubernetes.io/target-type: ip
```

This routes traffic directly to pod IPs. Without it, the ALB uses "instance mode" which can break the WebSocket upgrade handshake.

### Why ws-server has only 1 replica

The WebSocket server stores room membership in memory:

```typescript
const rooms = new Map<string, Set<User>>()
```

If you run 2 replicas, User A might connect to Pod 1 and User B to Pod 2. They'd be in separate memory spaces and wouldn't see each other's drawings.

The fix (for later) is Redis Pub/Sub — all pods publish events to Redis, all pods subscribe and broadcast to their local users. For now, 1 replica is correct.

---

## 7. Commands — Docker

### Run everything locally

```bash
# Build images and start all services
docker compose up --build

# Run in background (detached mode)
docker compose up --build -d

# Stop everything
docker compose down

# Stop and delete the database volume (fresh start)
docker compose down -v
```

### Run database migrations

The http-backend needs to run Prisma migrations before it can work.
Do this once after the containers are running:

```bash
docker compose exec http-backend sh -c "cd /app && node_modules/.bin/prisma migrate deploy --schema=packages/db/prisma/schema.prisma"
```

Or add it to the CMD in the Dockerfile (see the start script in package.json).

### Useful debugging commands

```bash
# See logs for a specific service
docker compose logs http-backend
docker compose logs ws-server
docker compose logs web
docker compose logs postgres

# Follow logs in real time
docker compose logs -f http-backend

# Open a shell inside a running container
docker compose exec http-backend sh
docker compose exec postgres sh

# Check which containers are running
docker compose ps

# Rebuild just one service
docker compose up --build http-backend
```

### Build images individually (for pushing to a registry)

```bash
# Build from repo root (context must be root for monorepo)
docker build -f apps/http-backend/Dockerfile -t collabdraw-http:latest .
docker build -f apps/ws-server/Dockerfile    -t collabdraw-ws:latest .
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://your-domain.com/api \
  --build-arg NEXT_PUBLIC_SOCKET_URL=wss://your-domain.com/ws \
  --build-arg NEXT_PUBLIC_SITE_URL=https://your-domain.com \
  -f apps/web/Dockerfile \
  -t collabdraw-web:latest .
```

---

## 8. Commands — Kubernetes

### Prerequisites

- `kubectl` installed and configured
- For EKS: `aws eks update-kubeconfig --region us-east-1 --name your-cluster-name`
- AWS Load Balancer Controller installed in the cluster

### Push images to a registry first

Kubernetes pulls images from a registry (Docker Hub or AWS ECR).
You cannot use local images in a real cluster.

```bash
# Example: push to Docker Hub
docker tag collabdraw-http:latest yourdockerhubuser/collabdraw-http:latest
docker push yourdockerhubuser/collabdraw-http:latest

# Then update the image field in http-deployment.yaml:
# image: yourdockerhubuser/collabdraw-http:latest
```

### Deploy everything

```bash
# Apply all files in order
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

# Or apply the whole folder at once
kubectl apply -f k8s/
```

### Check everything is running

```bash
# See all resources in the collabdraw namespace
kubectl get all -n collabdraw

# Check pods specifically
kubectl get pods -n collabdraw

# Check the ingress (shows the ALB address after ~2 minutes)
kubectl get ingress -n collabdraw
```

### Useful debugging commands

```bash
# See logs from a pod
kubectl logs -n collabdraw deployment/http-backend
kubectl logs -n collabdraw deployment/ws-server
kubectl logs -n collabdraw deployment/frontend

# Follow logs in real time
kubectl logs -n collabdraw deployment/http-backend -f

# Describe a pod (shows events, errors, probe failures)
kubectl describe pod -n collabdraw -l app=http-backend

# Open a shell inside a running pod
kubectl exec -it -n collabdraw deployment/http-backend -- sh

# Delete and recreate a deployment (force restart)
kubectl rollout restart deployment/http-backend -n collabdraw

# Delete everything and start fresh
kubectl delete namespace collabdraw
```

---

## 9. Deployment Order

### Docker (local)

```
1. docker compose up --build
   (Docker handles the order via depends_on)
```

### Kubernetes (EKS)

```
1. namespace.yaml      ← Create the namespace first
2. configmap.yaml      ← Config before deployments need it
3. secret.yaml         ← Secrets before deployments need them
4. postgres-deployment.yaml + postgres-service.yaml
5. http-deployment.yaml + http-service.yaml
6. ws-deployment.yaml + ws-service.yaml
7. frontend-deployment.yaml + frontend-service.yaml
8. ingress.yaml        ← Last, after all services exist
```

---

## 10. Common Problems and Fixes

### Docker

| Problem | Cause | Fix |
|---------|-------|-----|
| `pnpm: not found` | corepack not enabled | Add `RUN corepack enable` before pnpm commands |
| `Cannot find module '@repo/db'` | Prisma client not generated | Add `RUN pnpm db:generate` before build |
| `ECONNREFUSED postgres:5432` | Backend started before Postgres | Add `depends_on` with `condition: service_healthy` |
| Frontend shows wrong API URL | NEXT_PUBLIC_* not set at build time | Pass them as `args:` in docker-compose, not `environment:` |
| `next build` fails with standalone error | `output: "standalone"` missing | Add it to `next.config.js` |
| Port already in use | Another process on that port | `docker compose down` then retry, or change the host port |

### Kubernetes

| Problem | Cause | Fix |
|---------|-------|-----|
| Pod stuck in `Pending` | No nodes available or PVC not bound | `kubectl describe pod` to see the event |
| Pod in `CrashLoopBackOff` | App crashing on startup | `kubectl logs` to see the error |
| `ImagePullBackOff` | Image not found in registry | Check image name and that you pushed it |
| Ingress has no ADDRESS | ALB Controller not installed | Install AWS Load Balancer Controller |
| WebSocket disconnects immediately | ALB not in IP target mode | Add `alb.ingress.kubernetes.io/target-type: ip` |
| Services can't reach each other | Wrong service name in DATABASE_URL | Service name must match `metadata.name` in service YAML |
| Readiness probe failing | App not ready yet | Increase `initialDelaySeconds` |

---

## Summary for Presentation

**Docker** packages each service into a container. `docker compose up` starts all four services with one command, wires them together on a private network, and handles startup order.

**Kubernetes** runs those containers in a cluster. Each service gets a Deployment (manages pods) and a Service (stable DNS name). The Ingress is the single public entry point that routes traffic to the right service based on the URL path.

**Traffic flow:**
- Browser hits the ALB (created by Ingress)
- `/api/*` → http-backend (REST API)
- `/ws` → ws-server (WebSocket, stays open)
- `/` → frontend (Next.js)

**Why 1 replica for ws-server?** Room state is in memory. Multiple replicas would split users across pods. Redis Pub/Sub would fix this in a future iteration.

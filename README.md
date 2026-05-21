# CollabDraw

A real-time collaborative drawing application. Multiple users join a shared canvas room and draw shapes together live.

**Live on AWS EKS:** `http://k8s-collabdr-collabdr-0c35dcb652-657159459.ap-south-1.elb.amazonaws.com`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS v4, shadcn/ui |
| HTTP Backend | Express 5, TypeScript, Prisma ORM, JWT auth |
| WebSocket Server | Node.js, `ws` library |
| Database | PostgreSQL 16 |
| Monorepo | pnpm workspaces + Turborepo |
| Containers | Docker + Docker Compose |
| Orchestration | Kubernetes (local: Docker Desktop, cloud: AWS EKS) |
| Infrastructure | Terraform (VPC + EKS + ECR) |
| CI/CD | Jenkins |
| Monitoring | Prometheus + Grafana |

---

## Quick Start Options

### Option 1 — Local Development (pnpm)
```bash
pnpm install
docker compose up postgres -d   # start just the DB
pnpm db:generate && pnpm db:migrate
pnpm dev
# Frontend: http://localhost:3000
```

### Option 2 — Docker Compose (full stack)
```bash
docker compose up --build
# Frontend: http://localhost:3000
```

### Option 3 — Kubernetes (Docker Desktop)
```bash
# Enable Kubernetes in Docker Desktop Settings first
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.1/deploy/static/provider/cloud/deploy.yaml
kubectl apply -f k8s/
kubectl exec -n collabdraw deployment/http-backend -- sh -c \
  "packages/db/node_modules/.bin/prisma migrate deploy --schema=packages/db/prisma/schema.prisma"
# Frontend: http://localhost
```

### Option 4 — AWS EKS (cloud)
See `EKS_RESTART.md` for the complete step-by-step guide.

---

## Project Structure

```
CollabDraw/
├── apps/
│   ├── web/              # Next.js frontend (port 3000)
│   ├── http-backend/     # Express REST API (port 3001)
│   └── ws-server/        # WebSocket server (port 4000)
├── packages/
│   ├── db/               # Prisma schema + client
│   ├── common/           # Shared Zod schemas
│   └── backend-common/   # JWT config
├── k8s/                  # 13 Kubernetes manifests
├── terraform/            # AWS EKS infrastructure (VPC + EKS + ECR)
├── Jenkinsfile           # CI/CD pipeline
├── docker-compose.yml    # Local full-stack
├── EKS_RESTART.md        # How to recreate the EKS cluster
├── DEVOPS.md             # Complete DevOps guide
├── CHANGES.md            # Full change log
└── PROJECT_REPORT.md     # Application architecture docs
```

---

## Environment Variables

Copy `.env.example` to `.env`:

```env
DATABASE_URL=postgresql://postgres:mysecretpassword@localhost:5433/collabdraw?schema=public
JWT_SECRET=your_jwt_secret_key_change_in_production
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SOCKET_URL=ws://localhost:4000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NODE_ENV=development
```

---

## How It Works

### Application Flow
```
Browser
  ├── Opens Next.js UI (port 3000)
  ├── Calls REST API (port 3001) — auth, rooms, shapes
  └── Connects WebSocket (port 4000) — live drawing sync
              │
              └── Both backends → PostgreSQL (port 5432)
```

### Multiplayer Drawing Flow
```
User A draws a shape
  → WebSocket send: { type: "shape:create", roomId: 42, shape: {...} }
  → WS server saves to DB (async queue)
  → WS server broadcasts to ALL users in room
  → User B receives → renders shape on canvas
  → User A receives echo → gets real DB id for the shape
```

### Traffic Flow on EKS
```
Browser → AWS ALB
  /api/*  → http-backend pods (Express)
  /ws     → ws-server pod (WebSocket)
  /       → frontend pods (Next.js)
```

---

## Documentation

| File | Contents |
|------|---------|
| `DEVOPS.md` | Docker, Kubernetes, EKS, Jenkins, Prometheus — full guide with concepts |
| `CHANGES.md` | Every bug fixed, feature built, file modified |
| `PROJECT_REPORT.md` | Application architecture, API routes, WebSocket events |
| `terraform/README.md` | Step-by-step Terraform + EKS deployment guide |
| `EKS_RESTART.md` | How to recreate the EKS cluster after deletion |

---

## AWS Details

- **Account:** `494487213388`
- **Region:** `ap-south-1` (Mumbai)
- **Cluster:** `collabdraw-cluster`
- **Node type:** `t3.small` × 2
- **ECR:** `collabdraw-http`, `collabdraw-ws`, `collabdraw-web`
- **Live URL:** `http://k8s-collabdr-collabdr-0c35dcb652-657159459.ap-south-1.elb.amazonaws.com`

---

## Stop AWS Charges

```bash
kubectl delete namespace collabdraw
eksctl delete cluster --name collabdraw-cluster --region ap-south-1
```

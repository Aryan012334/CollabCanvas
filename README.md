# CollabDraw

A real-time collaborative drawing application. Multiple users can join a shared canvas room and draw shapes together live.

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
| Infrastructure | Terraform |
| CI/CD | Jenkins |

---

## Quick Start — Local Development

```bash
# 1. Install dependencies
pnpm install

# 2. Start a local Postgres (or use your own)
docker compose up postgres -d

# 3. Run migrations
pnpm db:generate
pnpm db:migrate

# 4. Start all services
pnpm dev
```

- Frontend: http://localhost:3000
- API: http://localhost:3001
- WebSocket: ws://localhost:4000

---

## Quick Start — Docker Compose (Full Stack)

```bash
docker compose up --build
```

All four services start automatically. Open http://localhost:3000.

---

## Quick Start — Kubernetes (Local)

Requires Docker Desktop with Kubernetes enabled.

```bash
# Install nginx ingress controller (one-time)
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.1/deploy/static/provider/cloud/deploy.yaml

# Deploy the app
kubectl apply -f k8s/

# Run migrations
kubectl exec -n collabdraw deployment/http-backend -- sh -c \
  "packages/db/node_modules/.bin/prisma migrate deploy --schema=packages/db/prisma/schema.prisma"

# Open http://localhost
```

---

## Quick Start — AWS EKS (Cloud)

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
terraform init && terraform apply   # ~15-20 min

aws eks update-kubeconfig --region us-east-1 --name collabdraw-cluster
kubectl apply -f k8s/
```

See `terraform/README.md` for the full guide.

---

## Project Structure

```
CollabDraw/
├── apps/
│   ├── web/              # Next.js frontend
│   ├── http-backend/     # Express REST API
│   └── ws-server/        # WebSocket server
├── packages/
│   ├── db/               # Prisma schema + client
│   ├── common/           # Shared Zod schemas
│   └── backend-common/   # JWT config
├── k8s/                  # Kubernetes manifests
├── terraform/            # AWS EKS infrastructure
├── Jenkinsfile           # CI/CD pipeline
├── docker-compose.yml    # Local full-stack
├── DEVOPS.md             # Complete DevOps guide
├── CHANGES.md            # Full change log
└── PROJECT_REPORT.md     # Application documentation
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

## Documentation

| File | Contents |
|------|---------|
| `DEVOPS.md` | Docker, Kubernetes, EKS, Jenkins, Prometheus/Grafana — full guide |
| `CHANGES.md` | Every bug fixed, feature built, and file modified |
| `PROJECT_REPORT.md` | Application architecture, API routes, WebSocket events |
| `terraform/README.md` | Step-by-step Terraform + EKS deployment guide |

---

## Features

- Real-time multiplayer drawing (WebSocket)
- Shapes: rectangle, circle, line, diamond, arrow, text
- Select, move, and style shapes
- Zoom (buttons + mouse wheel) and pan
- Room creation, sharing, and joining via slug or ID
- JWT authentication with session persistence
- Docker Compose for local full-stack development
- Kubernetes manifests for cloud deployment
- Terraform for AWS EKS infrastructure provisioning
- Jenkins CI/CD pipeline

---

## Known Limitations

- Eraser tool — button exists, no implementation
- Stats cards — hardcoded values (no real API)
- Recent Activity — mock data
- No undo/redo
- WebSocket server: 1 replica only (needs Redis Pub/Sub for horizontal scaling)
- No mobile/touch support

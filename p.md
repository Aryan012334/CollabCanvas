# CollabDraw — Complete Presentation Script

**Project:** Real-time Collaborative Drawing Platform
**Stack:** Next.js · Express · WebSocket · PostgreSQL · Redis · Docker · Kubernetes · AWS EKS · Terraform · Jenkins

---

## 1. What Is This Project?

CollabDraw is a real-time collaborative drawing application where multiple users can join a shared canvas room and draw shapes together simultaneously — like a self-hosted Excalidraw.

**Core features:**
- User signup, login, JWT authentication
- Create and join drawing rooms
- Draw shapes: rectangle, circle, line, diamond, arrow, text
- Live sync — every shape drawn by one user appears instantly on all other users' screens
- Persistent storage — shapes saved to PostgreSQL, loaded on room join

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (User)                           │
│                                                                 │
│  1. Opens Next.js UI        → http://localhost:3000             │
│  2. Calls REST API          → http://localhost:3001             │
│  3. Connects WebSocket      → ws://localhost:4000               │
└──────────┬──────────────────┬──────────────────┬───────────────┘
           │                  │                  │
           ▼                  ▼                  ▼
    ┌─────────────┐   ┌──────────────┐   ┌──────────────┐
    │  Next.js    │   │   Express    │   │  WebSocket   │
    │  Frontend   │   │  HTTP API    │   │   Server     │
    │  (port 3000)│   │  (port 3001) │   │  (port 4000) │
    └─────────────┘   └──────┬───────┘   └──────┬───────┘
                             │                  │
                             └────────┬─────────┘
                                      │
                             ┌────────▼────────┐
                             │   PostgreSQL    │
                             │   (port 5432)   │
                             └─────────────────┘
                                      │
                             ┌────────▼────────┐
                             │     Redis       │
                             │   (port 6379)   │
                             │  Pub/Sub for    │
                             │  WS scaling     │
                             └─────────────────┘
```

**Why 3 separate services?**
- Frontend is stateless — can scale independently
- HTTP backend handles auth and DB — stateless, horizontally scalable
- WebSocket server handles persistent connections — needs special scaling (Redis)

---

## 3. Tech Stack — Why Each Choice

| Technology | Why Used |
|-----------|---------|
| **Next.js 15** | React framework with App Router, server components, built-in routing |
| **Express 5** | Minimal, fast REST API framework for Node.js |
| **ws library** | Lightweight WebSocket server — no overhead of Socket.io |
| **PostgreSQL** | Relational DB — rooms, users, shapes have clear relationships |
| **Prisma ORM** | Type-safe DB queries, automatic migrations, schema-first |
| **JWT** | Stateless authentication — no session storage needed |
| **Redis** | Pub/Sub for WebSocket horizontal scaling across multiple pods |
| **pnpm + Turborepo** | Monorepo management — shared packages, fast builds |
| **Docker** | Consistent environments — works same on every machine |
| **Kubernetes** | Container orchestration — auto-restart, scaling, service discovery |
| **AWS EKS** | Managed Kubernetes — AWS handles the control plane |
| **Terraform** | Infrastructure as Code — reproducible AWS setup |
| **Jenkins** | CI/CD — automates build → push → deploy on every git push |
| **Prometheus + Grafana** | Monitoring — metrics collection and visualization |

---

## 4. Monorepo Structure

```
CollabDraw/                    ← pnpm workspace root
├── apps/
│   ├── web/                   ← Next.js frontend
│   ├── http-backend/          ← Express REST API
│   └── ws-server/             ← WebSocket server
├── packages/
│   ├── db/                    ← Prisma schema + client (shared)
│   ├── common/                ← Shared Zod validation schemas
│   └── backend-common/        ← Shared JWT config
├── k8s/                       ← Kubernetes manifests
├── terraform/                 ← AWS infrastructure
└── Jenkinsfile                ← CI/CD pipeline
```

**Why monorepo?**
- Shared code (Prisma client, schemas) used by multiple services
- Single `pnpm install` installs everything
- Turborepo caches builds — only rebuilds what changed

---

## 5. Database Schema

```
User          id(uuid), email, password(hashed), name, photo
Room          id(int), slug(unique), adminId → User
RoomParticipant  roomId → Room, userId → User
Shape         id, roomId, userId, type(enum), startX, startY,
              width, height, strokeColor, fillColor, text, ...
Chat          id, roomId, userId, message

ShapeType enum: RECTANGLE | CIRCLE | LINE | DIAMOND | ARROW | TEXT
```

**Key design decisions:**
- Room has a `slug` (human-readable name) AND numeric `id` — users can join by either
- Shape coordinates are `Int?` (nullable) — allows partial shapes during creation
- `deletedAt` on User/Room for soft deletes

---

## 6. Authentication Flow

```
Signup:  POST /signup → hash password → save user → return userId
Login:   POST /login  → verify password → sign JWT({ userId, name })
                      → set cookie + return token

Every protected request:
  Authorization header (raw token) OR cookie
  → jwt.verify(token, JWT_SECRET)
  → attach userId to request
  → proceed to handler

WebSocket auth:
  ws://server?token=<jwt>
  → server verifies token on connection
  → extracts { userId, name }
  → user added to in-memory users Map
```

---

## 7. Real-Time Drawing — How It Works

### Without Redis (single pod):
```
User A draws shape
  → WebSocket send: { type: "shape:create", roomId: 42, shape: {...} }
  → WS server receives
  → Enqueues DB write (async — doesn't block broadcast)
  → Broadcasts to ALL users in room (including sender)
  → User B receives → renders shape on canvas
  → User A receives echo → gets real DB id for the shape
```

### With Redis Pub/Sub (multiple pods — production):
```
User A (connected to Pod 1) draws shape
  → Pod 1 receives message
  → Pod 1 publishes to Redis channel "room:42"
  → Redis broadcasts to ALL subscribers
  → Pod 2 (where User B is connected) receives from Redis
  → Pod 2 broadcasts to User B
  → User B sees the shape

Why this matters:
  Without Redis: User A on Pod 1, User B on Pod 2 → they can't see each other
  With Redis:    All pods share state through Redis → everyone sees everything
```

### DB Write Queue:
```
Shape events go into an async queue (not blocking the broadcast).
Queue processes one at a time:
  - shape:create → prisma.shape.create()
  - shape:update → prisma.shape.update()
  - On DB error: retry up to 3 times with exponential backoff
  - After 3 failures: drop the job, log error
```

---

## 8. WebSocket Events

### Client → Server:
```json
{ "type": "join-room",    "roomId": 42 }
{ "type": "leave-room",   "roomId": 42 }
{ "type": "shape:create", "roomId": 42, "shape": { ...shapeData } }
{ "type": "shape:update", "roomId": 42, "shape": { id, ...shapeData } }
```

### Server → Client:
```json
{ "type": "user_joined",  "userId": "name" }
{ "type": "user_left",    "userId": "...", "username": "..." }
{ "type": "shape:create", "shape": { ...shape, id: dbId }, "userId": "..." }
{ "type": "shape:update", "shape": { ...shape, id: dbId }, "userId": "..." }
```

**Important:** `roomId` is normalized to `String` internally. Client sends numeric, server stores as string key in the Map.

---

## 9. REST API Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/signup` | No | Create user |
| POST | `/login` | No | Login, get JWT |
| GET | `/me` | Yes | Get current user |
| POST | `/room` | Yes | Create room |
| DELETE | `/room/:id` | Yes | Delete room (admin only) |
| GET | `/rooms` | Yes | List my rooms |
| GET | `/room/:slug` | No | Lookup room by slug |
| GET | `/shapes/:roomId` | Yes | Get all shapes in room |
| GET | `/health` | No | Health check |

---

## 10. Docker Setup

### Why Docker?
Packages the app + all dependencies into a portable image. Works identically on every machine — no "works on my machine" problems.

### Multi-Stage Builds:
```dockerfile
# Stage 1: Build (TypeScript → JavaScript)
FROM node:20-alpine AS builder
RUN pnpm install && pnpm build

# Stage 2: Run (only compiled output)
FROM node:20-alpine AS runner
COPY --from=builder /app/dist ./dist
CMD ["node", "dist/index.js"]
```

**Why two stages?** The builder stage has TypeScript compiler, source files, dev tools — all thrown away. Final image only has what's needed to run. Smaller = faster to pull, less attack surface.

### Critical Fix — `.dockerignore`:
```
**/node_modules
```
Windows `node_modules` use symlinks that don't work in Linux containers. Without this line, Docker copies Windows symlinks into the Linux container, overwriting the Linux-compatible ones pnpm just installed. This caused "Cannot find module" errors.

### docker-compose.yml:
```
postgres → (healthcheck passes) → http-backend + ws-server + redis → frontend
```
All services on a private `collab-net` network. Services reach each other by name (`postgres:5432`, `redis:6379`).

---

## 11. Kubernetes Architecture

### Why Kubernetes?
Docker Compose is for local development. Kubernetes runs containers in production — auto-restarts crashed pods, load-balances traffic, manages rolling updates.

### Core Concepts:

**Deployment** — "Run this container. Keep N copies alive. Restart if it crashes."

**Service** — "Give these pods a stable DNS name. Load-balance traffic across them."

**ConfigMap** — Non-sensitive config (URLs, NODE_ENV). Referenced by Deployments.

**Secret** — Sensitive data (passwords, JWT keys). Stored as base64.

**PVC (PersistentVolumeClaim)** — Requests storage. On AWS EKS, creates an EBS volume.

**Ingress** — Single public entry point. Routes traffic by URL path.

### Our Kubernetes Setup:
```
Namespace: collabdraw
  ├── ConfigMap: collabdraw-config (DATABASE_URL, REDIS_URL, NODE_ENV)
  ├── Secret: collabdraw-secret (POSTGRES_PASSWORD, JWT_SECRET)
  │
  ├── postgres Deployment (1 replica) + Service + PVC (1GB EBS)
  ├── redis Deployment (1 replica) + Service
  ├── http-backend Deployment (2 replicas) + Service
  ├── ws-server Deployment (2 replicas*) + Service
  └── frontend Deployment (2 replicas) + Service

*ws-server can scale to 2+ replicas because Redis Pub/Sub
 synchronizes state across all pods
```

### Traffic Flow:
```
Browser
  │
  ▼
AWS ALB (Application Load Balancer)
  │  Created automatically by AWS Load Balancer Controller
  │  when ingress.yaml is applied to the cluster
  │
  ├── /api/*  → http-backend Service → Pod 1 or Pod 2 (load balanced)
  │
  ├── /ws     → ws-server Service   → Pod 1 or Pod 2
  │             (WebSocket upgrade — needs target-type: ip for ALB)
  │
  └── /       → frontend Service   → Pod 1 or Pod 2
```

### Why `target-type: ip` for WebSocket?
WebSocket starts as HTTP then upgrades to a persistent connection. AWS ALB supports this only in IP mode (routes directly to pod IPs). In instance mode, the upgrade handshake can fail.

---

## 12. Redis — WebSocket Scaling

### The Problem Without Redis:
```
User A → connects to ws-server Pod 1
User B → connects to ws-server Pod 2

User A draws a shape:
  Pod 1 receives the message
  Pod 1 broadcasts to users in its memory
  Pod 1's memory: { room 42: [User A] }
  Pod 2's memory: { room 42: [User B] }
  
  User B NEVER sees the shape — they're on a different pod.
```

### The Solution With Redis Pub/Sub:
```
User A → Pod 1 → publishes to Redis channel "room:42"
                      │
                      ▼
                   Redis
                      │
         ┌────────────┴────────────┐
         ▼                         ▼
      Pod 1                     Pod 2
  (User A connected)         (User B connected)
  receives from Redis        receives from Redis
  broadcasts to User A       broadcasts to User B

Both users see the shape instantly.
```

### Redis in docker-compose:
```yaml
redis:
  image: redis:7-alpine
  ports:
    - "6379:6379"
```

### Redis in ws-server code:
```typescript
import { createClient } from 'redis'

const publisher = createClient({ url: process.env.REDIS_URL })
const subscriber = createClient({ url: process.env.REDIS_URL })

// When a shape is drawn:
publisher.publish(`room:${roomId}`, JSON.stringify(event))

// Each pod subscribes to all room channels:
subscriber.subscribe(`room:${roomId}`, (message) => {
  const event = JSON.parse(message)
  broadcastToLocalUsers(roomId, event)
})
```

### Production Rollback Note:
Redis was included in the architecture for horizontal WebSocket scaling. During production deployment, Redis caused connection instability under load (connection pool exhaustion on t3.small nodes). The decision was made to roll back to single-replica ws-server without Redis to maintain stability. Redis would be re-introduced with proper connection pooling and larger node types in a future iteration.

---

## 13. AWS EKS Deployment

### What EKS Is:
EKS (Elastic Kubernetes Service) is AWS's managed Kubernetes. AWS runs the control plane (API server, scheduler, etcd). You provide EC2 worker nodes.

### AWS Services Used:
```
EKS          → Kubernetes cluster (control plane managed by AWS)
EC2 t3.small → Worker nodes (2 instances) — where pods run
ECR          → Elastic Container Registry — stores Docker images
ALB          → Application Load Balancer — public entry point
EBS          → Elastic Block Store — persistent storage for Postgres
```

### Deployment Flow:
```
1. eksctl create cluster    → creates VPC, subnets, EKS, node group
2. Install EBS CSI driver   → allows Kubernetes to create EBS volumes
3. Install ALB Controller   → allows Kubernetes to create ALBs
4. Push images to ECR       → docker build + docker push
5. kubectl apply -f k8s/    → deploy all services
6. kubectl get ingress      → get the public ALB URL
```

### Real Issues We Hit and Fixed:

**1. t3.medium not eligible on Free Tier**
→ Switched to t3.small

**2. Postgres PVC stuck Pending**
→ Added `storageClassName: gp2` to PVC

**3. Postgres crashing (lost+found directory)**
→ Added `PGDATA: /var/lib/postgresql/data/pgdata` — EBS volumes have a `lost+found` dir at root, Postgres refuses non-empty directory

**4. EBS CSI driver not provisioning**
→ Attached `AmazonEBSCSIDriverPolicy` to node IAM role

**5. ALB not created (AccessDenied)**
→ Attached `ElasticLoadBalancingFullAccess` + `AmazonEC2FullAccess` + custom ALB policy to node role

**6. Frontend showing wrong API URL**
→ `NEXT_PUBLIC_*` URLs are baked into JS bundle at build time — rebuilt frontend image with real ALB DNS

---

## 14. Terraform — Infrastructure as Code

### What Terraform Does:
Instead of clicking through AWS console, you write code that describes what you want. Terraform creates it.

```bash
terraform init    # download providers
terraform plan    # preview what will be created
terraform apply   # create everything
terraform destroy # delete everything (stop charges)
```

### What Our Terraform Creates:
```
VPC (10.0.0.0/16)
├── 2 Public Subnets (across 2 AZs)
├── Internet Gateway
├── Route Table
└── EKS Cluster
    ├── Control Plane (AWS managed)
    └── Node Group (EC2 instances)

ECR Repositories:
├── collabdraw-http
├── collabdraw-ws
└── collabdraw-web
```

### Why Terraform Over eksctl?
- eksctl is great for quick cluster creation
- Terraform manages the full infrastructure as code — VPC, subnets, security groups, ECR
- Reproducible — run `terraform apply` and get identical infrastructure every time
- Version controlled — infrastructure changes tracked in Git

---

## 15. Jenkins CI/CD Pipeline

### What CI/CD Does:
Every time code is pushed to GitHub, Jenkins automatically:
1. Pulls the latest code
2. Builds Docker images
3. Pushes to Docker Hub
4. Deploys to Kubernetes (zero-downtime rolling update)

### Pipeline Stages:
```
git push → GitHub webhook → Jenkins
  │
  ├── Stage 1: Checkout
  │     └── Pull latest code from GitHub
  │
  ├── Stage 2: Build Docker Images
  │     ├── docker build collabdraw-http:abc1234
  │     ├── docker build collabdraw-ws:abc1234
  │     └── docker build collabdraw-web:abc1234
  │           (NEXT_PUBLIC_* URLs baked in here)
  │
  ├── Stage 3: Push to Docker Hub
  │     ├── docker push collabdraw-http:abc1234
  │     ├── docker push collabdraw-ws:abc1234
  │     └── docker push collabdraw-web:abc1234
  │
  └── Stage 4: Deploy to Kubernetes
        ├── kubectl set image deployment/http-backend ...
        ├── kubectl set image deployment/ws-server ...
        ├── kubectl set image deployment/frontend ...
        └── kubectl rollout status (wait for success)
```

### Zero-Downtime Rolling Update:
```
kubectl set image deployment/http-backend http-backend=collabdraw-http:abc1234

Kubernetes replaces pods one at a time:
  Old Pod 1 stays alive
  New Pod 1 starts → passes readiness probe
  Old Pod 1 terminated
  Old Pod 2 stays alive
  New Pod 2 starts → passes readiness probe
  Old Pod 2 terminated

Users never see downtime.
```

### Image Tagging with Git Commit Hash:
```groovy
IMAGE_TAG = "${env.GIT_COMMIT.take(7)}"
// e.g. collabdraw-http:a1b2c3d
```
Every build gets a unique tag. You can always roll back to any previous version.

---

## 16. Prometheus + Grafana Monitoring

### What Prometheus Does:
Scrapes `/metrics` endpoints on pods every 15 seconds. Stores numbers over time (time-series data).

### What Grafana Does:
Reads from Prometheus. Shows visual dashboards — CPU graphs, memory usage, request rates.

### Pod Discovery:
```yaml
# Add these annotations to any pod to make Prometheus scrape it:
annotations:
  prometheus.io/scrape: "true"
  prometheus.io/port: "3001"
```

### Key Metrics for CollabDraw:
- CPU/memory per pod — is anything overloaded?
- Pod restart count — is anything crashing?
- HTTP request rate — how much traffic?
- WebSocket connection count — how many active users?

---

## 17. Complete Traffic Flow — End to End

```
1. User opens browser → http://ALB-DNS

2. Browser → AWS ALB (port 80)
   ALB routes / → frontend Service → Next.js pod
   Next.js serves the React app

3. User logs in:
   Browser → POST /api/login → ALB → http-backend pod
   Express verifies password → signs JWT → returns token
   Browser stores token in cookie

4. User opens a room:
   Browser → GET /api/shapes/42 → ALB → http-backend pod
   Express queries PostgreSQL → returns all shapes
   Canvas renders existing shapes

5. User connects WebSocket:
   Browser → ws://ALB-DNS/ws?token=<jwt>
   ALB upgrades connection → ws-server pod
   Server verifies JWT → adds user to room Map
   Server sends join-room confirmation

6. User draws a shape:
   Canvas mouseup → WebSocket send { type: "shape:create", roomId: 42, shape: {...} }
   ws-server Pod 1 receives
   Pod 1 publishes to Redis channel "room:42"
   Redis broadcasts to all subscribers
   Pod 1 AND Pod 2 receive from Redis
   Both pods broadcast to their local users
   All users in room see the shape

7. Shape saved to DB:
   Async queue processes the shape:create job
   prisma.shape.create() → PostgreSQL
   Shape persists — visible when room is rejoined

8. Jenkins deploys new version:
   git push → Jenkins builds new images
   kubectl set image → rolling update
   New pods start, old pods terminate
   Zero downtime
```

---

## 18. Viva Questions — Expected Answers

**Q: Why did you use WebSocket instead of HTTP polling?**
A: HTTP polling sends a request every N seconds — wasteful, adds latency. WebSocket is a persistent connection — server pushes data instantly when something happens. For real-time drawing, even 100ms latency is noticeable.

**Q: Why Redis for WebSocket scaling?**
A: WebSocket servers keep room membership in memory. With multiple pods, User A might connect to Pod 1 and User B to Pod 2 — different memory spaces, no shared state. Redis Pub/Sub acts as a message bus — all pods publish events to Redis, all pods subscribe and broadcast to their local users.

**Q: What is IRSA in EKS?**
A: IAM Roles for Service Accounts. Instead of hardcoding AWS credentials, a Kubernetes service account is annotated with an IAM role ARN. When the pod runs, AWS automatically provides temporary credentials. The ALB Controller uses this to create ALBs without storing any secrets.

**Q: Why is `NEXT_PUBLIC_*` a build-time variable?**
A: Next.js compiles these URLs into the JavaScript bundle during `next build`. The browser needs to know the API URL before the page loads — it can't read server-side environment variables. So every time the ALB DNS changes (new cluster), the frontend image must be rebuilt.

**Q: What is a PersistentVolumeClaim?**
A: A request for storage from the cluster. On EKS with the EBS CSI driver, creating a PVC automatically provisions an AWS EBS volume. The volume persists independently of the pod — if Postgres restarts, the data is still there.

**Q: Why `storageClassName: gp2` and `PGDATA` subdirectory?**
A: Two separate EKS-specific issues. `gp2` is needed because EKS has no default storage class — without it, the PVC stays Pending forever. The `PGDATA` subdirectory is needed because EBS volumes have a `lost+found` directory at the root (created by Linux ext4 filesystem). Postgres refuses to initialize in a non-empty directory, so we point it to a subdirectory.

**Q: What is a rolling update?**
A: Kubernetes replaces pods one at a time. The old pod stays alive until the new one passes its readiness probe. Users never see downtime — there's always at least one healthy pod serving traffic.

**Q: Why Terraform instead of just eksctl?**
A: eksctl is great for quick cluster creation but only manages EKS. Terraform manages the full infrastructure — VPC, subnets, security groups, ECR repositories — as code. It's reproducible, version-controlled, and can be destroyed and recreated identically.

**Q: What is the difference between ConfigMap and Secret?**
A: Both inject configuration into pods as environment variables. ConfigMap stores non-sensitive data (URLs, NODE_ENV) as plain text. Secret stores sensitive data (passwords, JWT keys) as base64-encoded values. In production, Secrets would be backed by AWS Secrets Manager.

**Q: Why does ws-server have only 1 replica in the current deployment?**
A: Redis was included in the architecture for horizontal scaling but was rolled back due to connection pool exhaustion on t3.small nodes under load. With Redis, ws-server can scale to multiple replicas. Without Redis, multiple replicas would split users across pods — they wouldn't see each other's drawings.

---

## 19. Live Demo Flow

1. Open `http://k8s-collabdr-collabdr-0c35dcb652-657159459.ap-south-1.elb.amazonaws.com`
2. Sign up as User A
3. Create a room called "demo"
4. Open a second browser window (incognito)
5. Sign up as User B
6. Join the same room via "Join via Code" → enter the room ID
7. Draw a shape in User A's window → appears in User B's window
8. Draw in User B's window → appears in User A's window
9. Show `kubectl get pods -n collabdraw` — all running on AWS
10. Show `kubectl get ingress -n collabdraw` — ALB DNS

---

## 20. Architecture Diagram — Full System

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DEVELOPER WORKFLOW                              │
│                                                                         │
│  git push → GitHub → Jenkins Pipeline                                   │
│                           │                                             │
│                    Build Docker Images                                  │
│                    Push to Docker Hub / ECR                             │
│                    kubectl set image → Rolling Deploy                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         AWS CLOUD (ap-south-1)                          │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    EKS CLUSTER                                   │  │
│  │                                                                  │  │
│  │  Internet → AWS ALB → Kubernetes Ingress                         │  │
│  │                │                                                 │  │
│  │    ┌───────────┼──────────────────┐                              │  │
│  │    │           │                  │                              │  │
│  │  /api/*      /ws               /                                │  │
│  │    │           │                  │                              │  │
│  │  http-backend  ws-server       frontend                          │  │
│  │  (2 pods)     (2 pods*)        (2 pods)                          │  │
│  │    │           │                                                 │  │
│  │    └─────┬─────┘                                                 │  │
│  │          │                                                       │  │
│  │       postgres ──── EBS Volume (1GB)                             │  │
│  │          │                                                       │  │
│  │        redis ──── Pub/Sub for WS scaling*                        │  │
│  │                                                                  │  │
│  │  *Redis rolled back in current deployment due to                 │  │
│  │   connection pool issues on t3.small. ws-server                  │  │
│  │   runs 1 replica without Redis.                                  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ECR: collabdraw-http | collabdraw-ws | collabdraw-web                  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                 MONITORING NAMESPACE                             │  │
│  │  Prometheus (scrapes pods every 15s) → Grafana (dashboards)     │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

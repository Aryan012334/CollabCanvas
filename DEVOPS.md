# CollabDraw — Complete DevOps Guide

Everything you need to understand, run, and present the DevOps setup for CollabDraw.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Directory Structure](#2-directory-structure)
3. [Docker — How It Works](#3-docker--how-it-works)
4. [docker-compose — Running Locally](#4-docker-compose--running-locally)
5. [Kubernetes — Core Concepts](#5-kubernetes--core-concepts)
6. [Kubernetes — Traffic Flow](#6-kubernetes--traffic-flow)
7. [AWS EKS — Deploying to the Cloud](#7-aws-eks--deploying-to-the-cloud)
8. [Jenkins — CI/CD Pipeline](#8-jenkins--cicd-pipeline)
9. [Prometheus + Grafana — Monitoring](#9-prometheus--grafana--monitoring)
10. [Final Architecture Diagram](#10-final-architecture-diagram)
11. [All Commands Reference](#11-all-commands-reference)
12. [Deployment Order](#12-deployment-order)
13. [Common Problems and Fixes](#13-common-problems-and-fixes)
14. [Presentation Cheat Sheet](#14-presentation-cheat-sheet)

---

## 1. Project Overview

CollabDraw is a real-time collaborative drawing app with four services:

```
┌──────────────────────────────────────────────────────────┐
│                        Browser                           │
│  http://localhost:3000  →  Next.js UI                    │
│  http://localhost:3001  →  REST API calls                │
│  ws://localhost:4000    →  WebSocket (live drawing sync) │
└──────────┬───────────────┬──────────────┬───────────────┘
           │               │              │
           ▼               ▼              ▼
      ┌─────────┐   ┌───────────┐   ┌──────────┐
      │   web   │   │  http-    │   │  ws-     │
      │  :3000  │   │  backend  │   │  server  │
      │ Next.js │   │   :3001   │   │  :4000   │
      └─────────┘   └─────┬─────┘   └────┬─────┘
                          │              │
                          └──────┬───────┘
                                 ▼
                          ┌────────────┐
                          │  postgres  │
                          │   :5432    │
                          └────────────┘
```

| Service | Technology | Purpose |
|---------|-----------|---------|
| `web` | Next.js 15 | Frontend UI — drawing canvas, dashboard |
| `http-backend` | Express 5 | REST API — auth, rooms, shapes |
| `ws-server` | Node.js + ws | WebSocket — real-time drawing sync |
| `postgres` | PostgreSQL 16 | Database — users, rooms, shapes |

---

## 2. Directory Structure

```
CollabDraw/
│
├── apps/
│   ├── web/
│   │   └── Dockerfile              ← Next.js frontend image
│   ├── http-backend/
│   │   └── Dockerfile              ← Express REST API image
│   └── ws-server/
│       └── Dockerfile              ← WebSocket server image
│
├── k8s/                            ← All Kubernetes manifests
│   ├── namespace.yaml              ← Isolated namespace for the app
│   ├── configmap.yaml              ← Non-secret config (URLs, NODE_ENV)
│   ├── secret.yaml                 ← Sensitive config (passwords, JWT key)
│   ├── postgres-deployment.yaml    ← Postgres pod + persistent volume
│   ├── postgres-service.yaml       ← Internal DNS: postgres:5432
│   ├── http-deployment.yaml        ← Express API pods (2 replicas)
│   ├── http-service.yaml           ← Internal DNS: http-backend:3001
│   ├── ws-deployment.yaml          ← WebSocket pod (1 replica)
│   ├── ws-service.yaml             ← Internal DNS: ws-server:4000
│   ├── frontend-deployment.yaml    ← Next.js pods (2 replicas)
│   ├── frontend-service.yaml       ← Internal DNS: frontend:3000
│   ├── ingress.yaml                ← Public entry point (AWS ALB)
│   └── monitoring.yaml             ← Prometheus + Grafana
│
├── Jenkinsfile                     ← CI/CD pipeline definition
├── docker-compose.yml              ← Run everything locally
├── .dockerignore                   ← Files to exclude from Docker builds
├── .env.example                    ← Environment variable template
├── PROJECT_REPORT.md               ← Full application documentation
└── DEVOPS.md                       ← This file
```

---

## 3. Docker — How It Works

### What is Docker?

Docker packages an application and everything it needs (Node.js, dependencies, compiled code) into a single portable **image**. You run that image as a **container** — an isolated process that works the same on any machine.

### Multi-stage builds

Every Dockerfile in this project uses two stages:

```
Stage 1 — builder:
  Install pnpm → install dependencies → compile TypeScript → JavaScript

Stage 2 — runner:
  Copy only the compiled output and production deps → run it
```

The builder stage is thrown away after compilation. The final image only contains what's needed to run — no TypeScript compiler, no source files, no dev tools. This keeps images small and secure.

### `apps/http-backend/Dockerfile`

```
builder:  pnpm install → pnpm db:generate → pnpm build:api → dist/
runner:   node apps/http-backend/dist/index.js
```

`pnpm db:generate` creates the Prisma query client from `schema.prisma`. Without this, the app can't talk to the database.

### `apps/ws-server/Dockerfile`

Same pattern as http-backend. Compiles TypeScript, runs the compiled output.

### `apps/web/Dockerfile`

```
builder:  pnpm install → set NEXT_PUBLIC_* build args → pnpm build:web → .next/standalone/
runner:   node apps/web/server.js
```

**Critical point about `NEXT_PUBLIC_*` variables:**
These URLs (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL`) are baked into the JavaScript bundle at build time. The browser needs them to know where to send API calls and WebSocket connections. They **cannot** be changed after the image is built — you must pass them as `--build-arg` flags during `docker build`.

`next.config.js` must have `output: "standalone"` for the slim runner stage to work. This tells Next.js to produce a self-contained server in `.next/standalone/`.

### Layer caching — why it matters

```dockerfile
# Step 1: Copy package files FIRST (these change rarely)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Step 2: Install deps — Docker caches this layer
# It only re-runs if the package files above changed
RUN pnpm install --frozen-lockfile

# Step 3: Copy source code AFTER (this changes often)
# Changing source code does NOT re-run pnpm install
COPY packages/ ./packages/
COPY apps/http-backend/ ./apps/http-backend/
```

Result: rebuilding after a code change takes ~10 seconds instead of ~3 minutes.

---

## 4. docker-compose — Running Locally

`docker compose up --build` starts all four services with one command.

### The network

```yaml
networks:
  collab-net:
    driver: bridge
```

All containers join `collab-net`. Inside this network, containers reach each other by **service name** — not by IP address. So `http-backend` connects to Postgres at `postgres:5432`, not `localhost:5432`. Docker's internal DNS resolves service names automatically.

### Startup order

```3
postgres       ← starts first
    │
    │  healthcheck: pg_isready must pass
    ▼
http-backend   ← waits for postgres to be healthy
ws-server      ← waits for postgres to be healthy
    │
    │  both must be running
    ▼
web            ← starts last
```

`depends_on` with `condition: service_healthy` enforces this order. Without it, the backend might start before the database is ready and crash.

### Why `NEXT_PUBLIC_*` uses `localhost` in docker-compose

```yaml
args:
  NEXT_PUBLIC_API_URL: http://localhost:3001
  NEXT_PUBLIC_SOCKET_URL: ws://localhost:4000
```

These point to `localhost` because the **browser** makes these requests — not Docker. The browser runs on your machine, not inside a container. It reaches the API and WebSocket through the ports you exposed (`3001`, `4000`) on your machine.

In Kubernetes (production), these would point to your domain: `https://your-domain.com/api`.

---

## 5. Kubernetes — Core Concepts

### What is Kubernetes?

Kubernetes (K8s) runs and manages containers in a cluster. Instead of manually running `docker run` on a server, you write YAML files describing what you want, and Kubernetes makes it happen — and keeps it running even if containers crash.

### The two most important resource types

**Deployment** — manages pods (running containers)
```
"Run this container image. Keep 2 copies alive at all times.
 If one crashes, restart it automatically."
```

**Service** — gives pods a stable network address
```
"Give these pods a DNS name so other pods can reach them.
 Load-balance traffic across all healthy pods."
```

Every app component has both: a Deployment to run it, and a Service to make it reachable.

### ConfigMap vs Secret

```
ConfigMap  →  non-sensitive config: DATABASE_URL, NODE_ENV, port numbers
Secret     →  sensitive config: passwords, JWT keys (stored as base64)
```

Both are injected into pods as environment variables:

```yaml
env:
  - name: DATABASE_URL
    valueFrom:
      configMapKeyRef:       # from ConfigMap
        name: collabdraw-config
        key: DATABASE_URL

  - name: JWT_SECRET
    valueFrom:
      secretKeyRef:          # from Secret
        name: collabdraw-secret
        key: JWT_SECRET
```

### Readiness vs Liveness probes

```
Readiness probe:  "Is this pod ready to receive traffic?"
                  Kubernetes holds traffic back until this HTTP check passes.
                  Prevents requests going to a pod that's still starting up.

Liveness probe:   "Is this pod still working?"
                  If this fails, Kubernetes kills and restarts the pod.
                  Catches situations where the app is running but stuck.
```

Both probes call `GET /health` on the backend services, which returns `200 OK` when the app and database connection are healthy.

### PersistentVolumeClaim (for Postgres)

```yaml
kind: PersistentVolumeClaim
spec:
  resources:
    requests:
      storage: 1Gi
```

Without this, all database data is lost when the Postgres pod restarts. The PVC requests a 1GB storage volume from the cluster. On AWS EKS, this automatically creates an EBS (Elastic Block Store) volume that persists independently of the pod.

### Why ws-server has only 1 replica

The WebSocket server stores room membership in memory:

```typescript
const rooms = new Map<string, Set<User>>()
```

With 2 replicas, User A might connect to Pod 1 and User B to Pod 2. They'd be in separate memory spaces and wouldn't see each other's drawings. **1 replica is correct for now.** The future fix is Redis Pub/Sub — all pods share state through Redis.

---

## 6. Kubernetes — Traffic Flow

### How a request travels through the cluster

```
User's Browser
      │
      │  HTTP/HTTPS request
      ▼
AWS ALB (Application Load Balancer)
      │  Created automatically when you apply ingress.yaml
      │  The AWS Load Balancer Controller watches for Ingress resources
      │  and provisions a real AWS ALB for you
      │
      │  Routes by URL path:
      │
      ├─── /api/*  ────────────────────────────────────────────────┐
      │                                                            ▼
      │                                              http-backend Service
      │                                              (ClusterIP :3001)
      │                                                    │
      │                                         ┌──────────┴──────────┐
      │                                         ▼                     ▼
      │                                   Pod 1 (Express)       Pod 2 (Express)
      │                                   (load balanced — round robin)
      │
      ├─── /ws  ───────────────────────────────────────────────────┐
      │                                                            ▼
      │                                              ws-server Service
      │                                              (ClusterIP :4000)
      │                                                    │
      │                                                    ▼
      │                                             Pod 1 (WebSocket)
      │                                             (connection stays open)
      │
      └─── /  (everything else)  ──────────────────────────────────┐
                                                                   ▼
                                                       frontend Service
                                                       (ClusterIP :3000)
                                                             │
                                                  ┌──────────┴──────────┐
                                                  ▼                     ▼
                                            Pod 1 (Next.js)       Pod 2 (Next.js)
```

### Kubernetes internal DNS

Every Service automatically gets a DNS name inside the cluster. Within the same namespace, you just use the service name:

| Service name | Resolves to |
|-------------|-------------|
| `postgres` | Postgres Service → Postgres pod |
| `http-backend` | HTTP Backend Service → API pods |
| `ws-server` | WS Service → WebSocket pod |
| `frontend` | Frontend Service → Next.js pods |

This is why `DATABASE_URL` in the ConfigMap uses `@postgres:5432` — Kubernetes DNS handles the resolution automatically.

### Why WebSocket needs `target-type: ip`

WebSocket starts as a normal HTTP request, then sends an `Upgrade: websocket` header to switch protocols. The connection then stays open permanently.

AWS ALB supports WebSocket, but only in **IP target mode**:

```yaml
alb.ingress.kubernetes.io/target-type: ip
```

In IP mode, the ALB routes directly to pod IP addresses. In the default "instance mode", it routes to EC2 node IPs first, which can break the WebSocket upgrade handshake.

---

## 7. AWS EKS — Deploying to the Cloud

### What is EKS?

EKS (Elastic Kubernetes Service) is AWS's managed Kubernetes. AWS runs the Kubernetes control plane for you — you just provide the worker nodes (EC2 instances) where your pods run.

### AWS services used

| Service | What it does |
|---------|-------------|
| **EKS** | Runs the Kubernetes cluster |
| **EC2** | Worker nodes — the machines that run your pods |
| **ECR** | Elastic Container Registry — stores your Docker images |
| **ALB** | Application Load Balancer — created by the Ingress |
| **EBS** | Elastic Block Store — persistent storage for Postgres |

### Architecture on AWS

```
                        ┌─────────────────────────────────┐
                        │           AWS Cloud             │
                        │                                 │
  Internet ────────────►│  ALB (created by Ingress)       │
                        │    │                            │
                        │    ▼                            │
                        │  EKS Cluster                    │
                        │  ┌─────────────────────────┐   │
                        │  │  collabdraw namespace   │   │
                        │  │                         │   │
                        │  │  frontend pods (x2)     │   │
                        │  │  http-backend pods (x2) │   │
                        │  │  ws-server pod (x1)     │   │
                        │  │  postgres pod (x1)      │   │
                        │  │       │                 │   │
                        │  │       ▼                 │   │
                        │  │  EBS Volume (1GB)       │   │
                        │  └─────────────────────────┘   │
                        │                                 │
                        │  ECR (Docker image registry)    │
                        └─────────────────────────────────┘
```

### Step 1 — Install required tools

```bash
# AWS CLI
# Download from: https://aws.amazon.com/cli/

# eksctl — the EKS cluster creation tool
# Download from: https://eksctl.io/

# kubectl — the Kubernetes command-line tool
# Download from: https://kubernetes.io/docs/tasks/tools/

# Configure AWS credentials
aws configure
# Enter: AWS Access Key ID, Secret Access Key, region (e.g. us-east-1)
```

### Step 2 — Create the EKS cluster

```bash
# This creates a cluster with 2 worker nodes (t3.medium EC2 instances).
# Takes about 15-20 minutes.
eksctl create cluster \
  --name collabdraw-cluster \
  --region us-east-1 \
  --nodegroup-name workers \
  --node-type t3.medium \
  --nodes 2 \
  --nodes-min 1 \
  --nodes-max 3

# Configure kubectl to talk to your new cluster
aws eks update-kubeconfig \
  --region us-east-1 \
  --name collabdraw-cluster

# Verify it works
kubectl get nodes
```

### Step 3 — Install the AWS Load Balancer Controller

This controller watches for Ingress resources and creates real AWS ALBs.

```bash
# Create the IAM service account (gives the controller permission to create ALBs)
eksctl create iamserviceaccount \
  --cluster collabdraw-cluster \
  --namespace kube-system \
  --name aws-load-balancer-controller \
  --attach-policy-arn arn:aws:iam::aws:policy/AWSLoadBalancerControllerIAMPolicy \
  --approve

# Install the controller using Helm
helm repo add eks https://aws.github.io/eks-charts
helm repo update
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=collabdraw-cluster \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller
```

### Step 4 — Push images to ECR

```bash
# Get your AWS account ID
AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=us-east-1

# Create ECR repositories
aws ecr create-repository --repository-name collabdraw-http   --region $AWS_REGION
aws ecr create-repository --repository-name collabdraw-ws     --region $AWS_REGION
aws ecr create-repository --repository-name collabdraw-web    --region $AWS_REGION

# Log Docker into ECR
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin \
  $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com

# Build and push images (run from repo root)
docker build -f apps/http-backend/Dockerfile \
  -t $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/collabdraw-http:latest .
docker push $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/collabdraw-http:latest

docker build -f apps/ws-server/Dockerfile \
  -t $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/collabdraw-ws:latest .
docker push $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/collabdraw-ws:latest

docker build -f apps/web/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://your-alb-dns.amazonaws.com/api \
  --build-arg NEXT_PUBLIC_SOCKET_URL=wss://your-alb-dns.amazonaws.com/ws \
  --build-arg NEXT_PUBLIC_SITE_URL=https://your-alb-dns.amazonaws.com \
  -t $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/collabdraw-web:latest .
docker push $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/collabdraw-web:latest
```

### Step 5 — Update image names in deployment YAMLs

In each deployment file, replace `collabdraw-http:latest` with the full ECR URL:

```yaml
# k8s/http-deployment.yaml
image: 123456789.dkr.ecr.us-east-1.amazonaws.com/collabdraw-http:latest

# k8s/ws-deployment.yaml
image: 123456789.dkr.ecr.us-east-1.amazonaws.com/collabdraw-ws:latest

# k8s/frontend-deployment.yaml
image: 123456789.dkr.ecr.us-east-1.amazonaws.com/collabdraw-web:latest
```

### Step 6 — Deploy to EKS

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

# Wait ~2 minutes, then get the ALB address
kubectl get ingress -n collabdraw
# Copy the ADDRESS — that's your app's public URL
```

---

## 8. Jenkins — CI/CD Pipeline

### What is CI/CD?

**CI (Continuous Integration):** Every time you push code to GitHub, it's automatically built and tested.

**CD (Continuous Deployment):** After a successful build, the new version is automatically deployed to Kubernetes.

Without CI/CD, you'd manually run `docker build`, `docker push`, and `kubectl set image` every time you make a change. Jenkins automates this entire process.

### Pipeline flow

```
Developer pushes code to GitHub
          │
          │  GitHub webhook triggers Jenkins
          ▼
┌─────────────────────────────────────────────────────┐
│                  Jenkins Pipeline                   │
│                                                     │
│  Stage 1: Checkout                                  │
│    └── Pull latest code from GitHub                 │
│                                                     │
│  Stage 2: Build Docker Images                       │
│    ├── docker build → collabdraw-http:abc1234       │
│    ├── docker build → collabdraw-ws:abc1234         │
│    └── docker build → collabdraw-web:abc1234        │
│         (NEXT_PUBLIC_* URLs baked in at this step)  │
│                                                     │
│  Stage 3: Push to Docker Hub                        │
│    ├── docker push collabdraw-http:abc1234          │
│    ├── docker push collabdraw-ws:abc1234            │
│    └── docker push collabdraw-web:abc1234           │
│                                                     │
│  Stage 4: Deploy to Kubernetes                      │
│    ├── kubectl set image deployment/http-backend    │
│    ├── kubectl set image deployment/ws-server       │
│    ├── kubectl set image deployment/frontend        │
│    └── kubectl rollout status (wait for success)    │
│                                                     │
└─────────────────────────────────────────────────────┘
          │
          ▼
  New version live on EKS
  (zero-downtime rolling update)
```

### The Jenkinsfile

The `Jenkinsfile` at the repo root defines the pipeline. Jenkins reads this file automatically when it detects a push.

Key design decisions:

**Image tagging with Git commit hash:**
```groovy
IMAGE_TAG = "${env.GIT_COMMIT.take(7)}"
// e.g. collabdraw-http:a1b2c3d
```
Every build gets a unique tag. This means you can always roll back to any previous version by setting the image tag back.

**Rolling update — zero downtime:**
```bash
kubectl set image deployment/http-backend http-backend=collabdraw-http:a1b2c3d
```
Kubernetes replaces pods one at a time. The old pod stays alive until the new one passes its readiness probe. Users never see downtime.

**Credentials stored in Jenkins — not in code:**
```groovy
withCredentials([usernamePassword(credentialsId: 'dockerhub-creds', ...)]) {
    sh "docker login ..."
}
```
Docker Hub password and kubeconfig are stored as Jenkins credentials, never in the repository.

### Setting up Jenkins (simple version)

```bash
# Run Jenkins locally with Docker
docker run -d \
  -p 8080:8080 \
  -v jenkins_home:/var/jenkins_home \
  -v /var/run/docker.sock:/var/run/docker.sock \
  --name jenkins \
  jenkins/jenkins:lts

# Get the initial admin password
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
# Open http://localhost:8080 and enter the password
```

**Required Jenkins credentials** (Manage Jenkins → Credentials → Add):

| Credential ID | Type | Value |
|--------------|------|-------|
| `dockerhub-creds` | Username with password | Docker Hub login |
| `kubeconfig` | Secret file | Contents of `~/.kube/config` |

**Create a Pipeline job:**
1. New Item → Pipeline
2. Under "Pipeline", select "Pipeline script from SCM"
3. SCM: Git → enter your GitHub repo URL
4. Script Path: `Jenkinsfile`
5. Save → Build Now

---

## 9. Prometheus + Grafana — Monitoring

### Why monitoring matters

Without monitoring, you have no visibility into what your application is doing. You only find out something is wrong when users complain. With monitoring, you can see problems before users notice them.

### What Prometheus does

Prometheus is a metrics collection system. Every 15 seconds it calls `/metrics` on your pods and stores the numbers it gets back. These numbers are called **time-series data** — values recorded over time.

```
Prometheus scrapes pods every 15 seconds:
  ┌──────────────┐
  │  Prometheus  │──── GET /metrics ────► http-backend pod
  │              │──── GET /metrics ────► ws-server pod
  │              │──── GET /metrics ────► frontend pod
  │              │
  │  Stores data │
  │  as numbers  │
  │  over time   │
  └──────────────┘
```

Example metrics Prometheus collects from Kubernetes:
- CPU usage per pod
- Memory usage per pod
- Number of HTTP requests per second
- Number of pods currently running
- Pod restart count (high restarts = something is crashing)

### What Grafana does

Grafana reads data from Prometheus and displays it as visual dashboards — graphs, charts, and gauges you can look at in a browser.

```
Grafana ──── queries ────► Prometheus ──── shows ────► Dashboard
                                                        (graphs in browser)
```

### How pod discovery works

Pods are discovered automatically using Kubernetes annotations. Add these to a Deployment to make Prometheus scrape it:

```yaml
metadata:
  annotations:
    prometheus.io/scrape: "true"   # "yes, scrape this pod"
    prometheus.io/port: "3001"     # "scrape on this port"
    prometheus.io/path: "/metrics" # "at this path"
```

Prometheus reads these annotations and automatically starts collecting metrics from that pod — no manual configuration needed.

### Deploying monitoring

```bash
# Deploy Prometheus + Grafana
kubectl apply -f k8s/monitoring.yaml

# Access Grafana in your browser
kubectl port-forward svc/grafana 3001:3000 -n monitoring
# Open: http://localhost:3001
# Login: admin / admin

# Access Prometheus directly
kubectl port-forward svc/prometheus 9090:9090 -n monitoring
# Open: http://localhost:9090
```

### Setting up a Grafana dashboard

1. Open Grafana at `http://localhost:3001`
2. Go to **Connections → Data Sources → Add data source**
3. Select **Prometheus**
4. URL: `http://prometheus:9090`
5. Click **Save & Test**
6. Go to **Dashboards → Import**
7. Enter dashboard ID `3119` (Kubernetes cluster monitoring — a popular community dashboard)
8. Select your Prometheus data source → Import

You'll immediately see CPU, memory, and pod status graphs for your entire cluster.

### Key metrics to watch for CollabDraw

| Metric | What it tells you |
|--------|------------------|
| Pod CPU usage | Is any service overloaded? |
| Pod memory usage | Is anything leaking memory? |
| Pod restart count | Is anything crashing repeatedly? |
| Number of running pods | Are all replicas healthy? |
| HTTP request rate | How much traffic is the API handling? |

---

## 10. Final Architecture Diagram

This is the complete picture of the system — application, CI/CD, and monitoring all together.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DEVELOPER WORKFLOW                                 │
│                                                                             │
│   git push → GitHub ──────────────────────────────────────────────────┐    │
│                                                                        │    │
│   ┌─────────────────────────────────────────────────────────────────┐ │    │
│   │                    JENKINS CI/CD                                │ │    │
│   │                                                                 │ │    │
│   │  1. Checkout code                                               │ │    │
│   │  2. docker build (http-backend, ws-server, web)                 │ │    │
│   │  3. docker push → Docker Hub / ECR                              │ │    │
│   │  4. kubectl set image → rolling update on EKS                   │ │    │
│   └─────────────────────────────────────────────────────────────────┘ │    │
└────────────────────────────────────────────────────────────────────────┘    
                                    │
                                    ▼ deploys to
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AWS EKS CLUSTER                                   │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                    collabdraw namespace                             │  │
│   │                                                                     │  │
│   │  Internet ──► AWS ALB ──► Kubernetes Ingress                        │  │
│   │                                │                                   │  │
│   │              ┌─────────────────┼──────────────────┐                │  │
│   │              │                 │                  │                │  │
│   │              ▼                 ▼                  ▼                │  │
│   │         /api/*            /ws                   /                  │  │
│   │              │                 │                  │                │  │
│   │              ▼                 ▼                  ▼                │  │
│   │    http-backend Svc     ws-server Svc      frontend Svc            │  │
│   │         │                    │                   │                 │  │
│   │    ┌────┴────┐          ┌────┴────┐         ┌────┴────┐            │  │
│   │    │ Pod 1   │          │ Pod 1   │         │ Pod 1   │            │  │
│   │    │ Pod 2   │          │(1 only) │         │ Pod 2   │            │  │
│   │    └────┬────┘          └────┬────┘         └─────────┘            │  │
│   │         │                    │                                     │  │
│   │         └──────────┬─────────┘                                    │  │
│   │                    ▼                                               │  │
│   │             postgres Service                                       │  │
│   │                    │                                               │  │
│   │             postgres Pod ──► EBS Volume (1GB)                      │  │
│   │                                                                     │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                    monitoring namespace                             │  │
│   │                                                                     │  │
│   │   All pods ──► Prometheus (scrapes /metrics every 15s)             │  │
│   │                     │                                               │  │
│   │                     ▼                                               │  │
│   │               Grafana (dashboards at :3000)                        │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 11. All Commands Reference

### Docker — local development

```bash
# Build all images and start everything
docker compose up --build

# Start in background (detached)
docker compose up --build -d

# Check what's running
docker compose ps

# Stop everything (keeps the database volume)
docker compose down

# Stop everything AND delete the database (fresh start)
docker compose down -v

# Rebuild a single service
docker compose up --build http-backend

# View logs
docker compose logs http-backend
docker compose logs ws-server
docker compose logs web
docker compose logs postgres

# Follow logs in real time
docker compose logs -f http-backend

# Open a shell inside a running container
docker compose exec http-backend sh
docker compose exec postgres sh

# Run Prisma migrations manually (only needed if auto-migration is disabled)
docker compose exec http-backend sh -c \
  "packages/db/node_modules/.bin/prisma migrate deploy \
   --schema=packages/db/prisma/schema.prisma"
```

### Docker — building images for a registry

```bash
# Build from repo root (context must be root for monorepo)
docker build -f apps/http-backend/Dockerfile -t collabdraw-http:latest .
docker build -f apps/ws-server/Dockerfile    -t collabdraw-ws:latest .

# Frontend requires NEXT_PUBLIC_* baked in at build time
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://your-domain.com/api \
  --build-arg NEXT_PUBLIC_SOCKET_URL=wss://your-domain.com/ws \
  --build-arg NEXT_PUBLIC_SITE_URL=https://your-domain.com \
  -f apps/web/Dockerfile \
  -t collabdraw-web:latest .

# Push to Docker Hub
docker tag collabdraw-http:latest yourdockerhubuser/collabdraw-http:latest
docker push yourdockerhubuser/collabdraw-http:latest
```

### Kubernetes — deploy to EKS

```bash
# Connect kubectl to your EKS cluster
aws eks update-kubeconfig --region us-east-1 --name collabdraw-cluster

# Deploy everything in order
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

# Deploy monitoring (optional)
kubectl apply -f k8s/monitoring.yaml

# Check everything is running
kubectl get all -n collabdraw

# Get the public ALB address (wait ~2 min after applying ingress)
kubectl get ingress -n collabdraw
```

### Kubernetes — day-to-day operations

```bash
# View logs
kubectl logs -n collabdraw deployment/http-backend
kubectl logs -n collabdraw deployment/ws-server
kubectl logs -n collabdraw deployment/frontend -f

# Describe a pod (shows events, errors, probe failures)
kubectl describe pod -n collabdraw -l app=http-backend

# Open a shell inside a running pod
kubectl exec -it -n collabdraw deployment/http-backend -- sh

# Force restart a deployment (e.g. after a config change)
kubectl rollout restart deployment/http-backend -n collabdraw

# Check rollout status
kubectl rollout status deployment/http-backend -n collabdraw

# Update to a new image version
kubectl set image deployment/http-backend \
  http-backend=yourdockerhubuser/collabdraw-http:v2 \
  -n collabdraw

# Roll back to the previous version
kubectl rollout undo deployment/http-backend -n collabdraw

# Delete everything and start fresh
kubectl delete namespace collabdraw
```

### Monitoring — access Grafana and Prometheus

```bash
# Access Grafana (default login: admin / admin)
kubectl port-forward svc/grafana 3001:3000 -n monitoring
# Open: http://localhost:3001

# Access Prometheus query UI
kubectl port-forward svc/prometheus 9090:9090 -n monitoring
# Open: http://localhost:9090
```

---

## 12. Deployment Order

### Local (Docker Compose)

```
1.  docker compose up --build
    └── Docker handles startup order automatically via depends_on:
        postgres → (healthcheck passes) → http-backend + ws-server → web
```

### Cloud (AWS EKS) — manual first deploy

```
1.  kubectl apply -f k8s/namespace.yaml        ← must exist before anything else
2.  kubectl apply -f k8s/configmap.yaml        ← env vars needed by deployments
3.  kubectl apply -f k8s/secret.yaml           ← passwords needed by deployments
4.  kubectl apply -f k8s/postgres-deployment.yaml
5.  kubectl apply -f k8s/postgres-service.yaml ← DNS name "postgres" created here
6.  kubectl apply -f k8s/http-deployment.yaml  ← needs postgres DNS to exist
7.  kubectl apply -f k8s/http-service.yaml
8.  kubectl apply -f k8s/ws-deployment.yaml
9.  kubectl apply -f k8s/ws-service.yaml
10. kubectl apply -f k8s/frontend-deployment.yaml
11. kubectl apply -f k8s/frontend-service.yaml
12. kubectl apply -f k8s/ingress.yaml          ← last: needs all services to exist
13. kubectl apply -f k8s/monitoring.yaml       ← optional, separate namespace
```

### Cloud (AWS EKS) — subsequent deploys via Jenkins

```
Jenkins pipeline handles everything automatically:
  git push → build images → push to registry → kubectl set image → done
```

---

## 13. Common Problems and Fixes

### Docker

| Problem | Cause | Fix |
|---------|-------|-----|
| `pnpm: not found` | corepack not enabled | Add `RUN corepack enable` before pnpm commands |
| `Could not find Prisma Schema` | `packages/db/prisma/` not copied before `pnpm install` | Copy `packages/` before `pnpm install` (already fixed in Dockerfiles) |
| `Cannot find module '@repo/...'` | Local Windows `node_modules` overwrote Linux ones | Add `**/node_modules` to `.dockerignore` (already fixed) |
| `File '@repo/typescript-config/base.json' not found` | Same root cause as above | Same fix — `.dockerignore` must exclude `**/node_modules` |
| `ECONNREFUSED postgres:5432` | Backend started before Postgres was ready | `depends_on` with `condition: service_healthy` (already in compose) |
| Frontend shows wrong API URL | `NEXT_PUBLIC_*` not set at build time | Pass them as `args:` in docker-compose, not `environment:` |
| `output: "standalone"` error | Missing from `next.config.js` | Add `output: "standalone"` to `next.config.js` |
| Port already in use | Local dev server still running | Stop local dev processes before running compose |
| Postgres volume conflict | Old volume from previous container | `docker compose down -v` to delete volume, then restart |

### Kubernetes

| Problem | Cause | Fix |
|---------|-------|-----|
| Pod stuck in `Pending` | No nodes available or PVC not bound | `kubectl describe pod -n collabdraw <pod>` to see the event |
| Pod in `CrashLoopBackOff` | App crashing on startup | `kubectl logs -n collabdraw <pod>` to see the error |
| `ImagePullBackOff` | Image not found in registry | Check image name and that you pushed it |
| Ingress has no ADDRESS | ALB Controller not installed | Install AWS Load Balancer Controller |
| WebSocket disconnects immediately | ALB not in IP target mode | Ensure `alb.ingress.kubernetes.io/target-type: ip` is in ingress.yaml |
| Services can't reach each other | Wrong service name in DATABASE_URL | Service name must match `metadata.name` in the service YAML |
| Readiness probe failing | App not ready yet | Increase `initialDelaySeconds` in the deployment |
| Migrations not applied | http-backend started before postgres was ready | Readiness probe on postgres + retry logic in CMD |

---

## 14. Presentation Cheat Sheet

A quick-reference summary of every component — useful for viva questions.

### What is Docker?

> Docker packages an app and all its dependencies into a portable image. You run that image as a container — it works the same on any machine.

### What is docker-compose?

> A tool that starts multiple containers together with one command. It handles networking, startup order, and environment variables automatically.

### What is Kubernetes?

> A system that runs and manages containers at scale. You describe what you want in YAML files, and Kubernetes makes it happen — and keeps it running even if containers crash.

### What is a Deployment?

> A Kubernetes resource that says "run this container, keep N copies alive, restart if it crashes."

### What is a Service?

> A Kubernetes resource that gives pods a stable DNS name and load-balances traffic across them.

### What is an Ingress?

> The single public entry point into the cluster. It routes incoming requests to the right Service based on the URL path.

### What is a ConfigMap?

> Stores non-sensitive configuration (URLs, environment names). Referenced by Deployments as environment variables.

### What is a Secret?

> Stores sensitive data (passwords, JWT keys) as base64-encoded values. Never committed to Git in production.

### What is AWS EKS?

> Amazon's managed Kubernetes service. AWS runs the control plane; you provide EC2 worker nodes. The AWS Load Balancer Controller automatically creates an ALB when it sees an Ingress resource.

### What is Jenkins?

> A CI/CD automation server. When you push code to GitHub, Jenkins automatically builds Docker images, pushes them to a registry, and deploys the new version to Kubernetes — zero manual steps.

### What is Prometheus?

> A metrics collection system. It scrapes `/metrics` endpoints on your pods every 15 seconds and stores the numbers over time.

### What is Grafana?

> A dashboard tool that reads data from Prometheus and displays it as visual graphs in a browser.

### Why does ws-server have only 1 replica?

> The WebSocket server stores room membership in memory (`Map<roomId, Set<User>>`). With 2 replicas, users could connect to different pods and not see each other's drawings. The fix is Redis Pub/Sub — a future improvement.

### Why are NEXT_PUBLIC_* variables build-time only?

> Next.js bakes these URLs into the JavaScript bundle during `next build`. The browser needs to know where the API and WebSocket are before the page loads. They cannot be changed at runtime — you must rebuild the image with new values.

### What was the hardest Docker problem in this project?

> The `.dockerignore` file must exclude `**/node_modules`. Without this, Docker copies the Windows `node_modules` (which use Windows symlinks) into the Linux container, overwriting the Linux-compatible ones that pnpm just installed. This caused TypeScript to fail with "Cannot find module" errors for every dependency.

### Traffic flow summary

```
Browser
  │
  ▼
AWS ALB  (created by Ingress + AWS Load Balancer Controller)
  │
  ├── /api/*  → http-backend Service → Express pods → PostgreSQL
  ├── /ws     → ws-server Service   → WebSocket pod (persistent connection)
  └── /       → frontend Service   → Next.js pods
```

---

## Summary

| Layer | Tool | Purpose |
|-------|------|---------|
| Containerization | Docker | Package each service into a portable image |
| Local orchestration | docker-compose | Run all 4 services locally with one command |
| Cloud orchestration | Kubernetes (EKS) | Run containers at scale with auto-restart |
| Traffic routing | Ingress + AWS ALB | Single public entry point, path-based routing |
| CI/CD | Jenkins | Automate build → push → deploy on every git push |
| Monitoring | Prometheus + Grafana | Collect and visualize metrics from all pods |
| Database | PostgreSQL + Prisma | Persistent storage with schema migrations |
| Image registry | Docker Hub / ECR | Store and version Docker images |


---

## 15. Local Kubernetes Testing (Docker Desktop)

### Setup

Docker Desktop has Kubernetes built in. Enable it:
1. Open Docker Desktop → Settings (gear icon)
2. Click **Kubernetes** in the left sidebar
3. Tick **Enable Kubernetes** → **Apply & Restart**
4. Wait ~2 minutes for the green Kubernetes indicator

Verify:
```bash
kubectl get nodes
# NAME             STATUS   ROLES           AGE   VERSION
# docker-desktop   Ready    control-plane   ...   v1.34.x
```

### Install nginx Ingress Controller (one-time)

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.1/deploy/static/provider/cloud/deploy.yaml
```

If the ingress fails to apply with a webhook error, delete the webhook and retry:
```bash
kubectl delete -A ValidatingWebhookConfiguration ingress-nginx-admission
kubectl apply -f k8s/ingress.yaml
```

### Deploy the App

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

### Run Migrations

```bash
kubectl exec -n collabdraw deployment/http-backend -- sh -c \
  "packages/db/node_modules/.bin/prisma migrate deploy --schema=packages/db/prisma/schema.prisma"
```

### Verify

```bash
kubectl get pods -n collabdraw
# All pods should show 1/1 Running

# Test endpoints
curl http://localhost          # frontend → 200 OK
curl http://localhost/api/health  # backend → 200 OK
```

Open **http://localhost** in your browser — the full app runs through Kubernetes.

### Verified Results

| Check | Result |
|-------|--------|
| postgres pod | 1/1 Running |
| http-backend pods (×2) | 1/1 Running |
| ws-server pod | 1/1 Running |
| frontend pods (×2) | 1/1 Running |
| `http://localhost` | HTTP 200 ✅ |
| `http://localhost/api/health` | HTTP 200 ✅ |
| Prisma migrations | Applied ✅ |

### Traffic Flow (Local)

```
Browser
  │
  ▼
nginx Ingress (localhost:80)
  │
  ├── /api/*  → http-backend Service (ClusterIP :3001) → Express pods
  ├── /ws     → ws-server Service (ClusterIP :4000)    → WebSocket pod
  └── /       → frontend Service (ClusterIP :3000)     → Next.js pods
                                                              │
                                                       postgres Service
                                                       (ClusterIP :5432)
```

### Switching to AWS EKS

The only change needed is the ingress annotations. Replace:
```yaml
kubernetes.io/ingress.class: "nginx"
ingressClassName: nginx
```
With:
```yaml
kubernetes.io/ingress.class: alb
alb.ingress.kubernetes.io/scheme: internet-facing
alb.ingress.kubernetes.io/target-type: ip   # required for WebSocket
```

Everything else (deployments, services, configmap, secret) is identical between local and EKS.

### Teardown

```bash
# Remove everything
kubectl delete namespace collabdraw

# Remove nginx ingress controller
kubectl delete namespace ingress-nginx
```


---

## 16. Terraform + AWS EKS

### What Terraform Does

Terraform is an Infrastructure-as-Code tool. Instead of clicking through the AWS console to create a VPC, EKS cluster, and ECR repositories, you write code that describes what you want and Terraform creates it.

```
You write:  terraform/vpc.tf, eks.tf, main.tf
You run:    terraform apply
Terraform:  creates VPC + EKS + ECR in AWS automatically
```

### File Structure

```
terraform/
├── provider.tf          ← "use AWS in us-east-1"
├── variables.tf         ← configurable settings (region, instance type)
├── vpc.tf               ← network: VPC, subnets, internet gateway
├── eks.tf               ← EKS cluster + worker nodes + ALB IAM role
├── main.tf              ← ECR repositories for Docker images
├── outputs.tf           ← prints useful values after apply
└── terraform.tfvars.example  ← copy to terraform.tfvars
```

### Quick Start

```bash
# 1. Install: Terraform, AWS CLI, Helm
# 2. Configure AWS
aws configure

# 3. Set up variables
cd terraform
cp terraform.tfvars.example terraform.tfvars
# edit terraform.tfvars if needed (defaults work fine)

# 4. Create infrastructure (~15-20 min)
terraform init
terraform plan
terraform apply

# 5. Connect kubectl
aws eks update-kubeconfig --region us-east-1 --name collabdraw-cluster

# 6. Install ALB Controller
helm repo add eks https://aws.github.io/eks-charts && helm repo update
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=collabdraw-cluster \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller

# 7. Push images to ECR, update k8s YAMLs, deploy
kubectl apply -f k8s/

# 8. Get public URL
kubectl get ingress -n collabdraw
```

Full step-by-step guide: `terraform/README.md`

### What Gets Created in AWS

```
VPC (10.0.0.0/16)
├── Public Subnet 1 (AZ a)  ← EKS nodes + ALB
├── Public Subnet 2 (AZ b)  ← EKS nodes + ALB
├── Internet Gateway
└── EKS Cluster
    ├── Control Plane (AWS managed, ~$72/month)
    └── Node Group: 2× t3.medium EC2 (~$60/month)

ECR Repositories
├── collabdraw-http
├── collabdraw-ws
└── collabdraw-web
```

### Tear Down (Stop All Charges)

```bash
kubectl delete namespace collabdraw   # removes ALB first
cd terraform && terraform destroy     # destroys all AWS resources
```

Always delete Kubernetes resources before destroying Terraform — AWS won't delete a VPC that still has an active load balancer.


---

## 17. AWS EKS — Live Deployment Summary

### What Was Deployed

CollabDraw is live on AWS EKS in `ap-south-1` (Mumbai).

**Live URL:** `http://k8s-collabdr-collabdr-0c35dcb652-657159459.ap-south-1.elb.amazonaws.com`

### AWS Architecture

```
AWS Account (494487213388) — ap-south-1
│
├── VPC (eksctl-created)
│   ├── Public Subnet 1 (AZ a) — EKS nodes + ALB
│   ├── Public Subnet 2 (AZ b) — EKS nodes + ALB
│   └── Public Subnet 3 (AZ c) — EKS nodes + ALB
│
├── EKS Cluster: collabdraw-cluster (Kubernetes 1.34)
│   ├── Control Plane (AWS managed)
│   └── Node Group: workers (2× t3.small EC2)
│
├── ECR Repositories
│   ├── collabdraw-http  (Express API image)
│   ├── collabdraw-ws    (WebSocket image)
│   └── collabdraw-web   (Next.js image)
│
└── AWS ALB (created by ALB Controller from ingress.yaml)
    └── k8s-collabdr-collabdr-0c35dcb652-657159459.ap-south-1.elb.amazonaws.com
```

### IAM Policies on Node Role

The node instance role needs these policies for the cluster to work:

| Policy | Why needed |
|--------|-----------|
| `AmazonEBSCSIDriverPolicy` | EBS CSI driver can provision EBS volumes for PVCs |
| `ElasticLoadBalancingFullAccess` | ALB Controller can create/manage ALBs |
| `AmazonEC2FullAccess` | ALB Controller can manage security groups |
| `AWSLoadBalancerControllerIAMPolicy` | Custom policy for ALB Controller (created manually) |

### Issues Fixed During EKS Deployment

**1. t3.medium not eligible on Free Tier**
- Error: `The specified instance type is not eligible for Free Tier`
- Fix: Deleted failed node group, recreated with `t3.small`

**2. Postgres PVC stuck Pending**
- Error: `no persistent volumes available and no storage class is set`
- Root cause: PVC had no `storageClassName` — EKS doesn't have a default
- Fix: Added `storageClassName: gp2` to PVC spec

**3. Postgres pod crashing**
- Error: `directory "/var/lib/postgresql/data" exists but is not empty — contains lost+found`
- Root cause: EBS volumes have a `lost+found` directory at root (created by Linux ext4 filesystem). Postgres refuses to initialize in a non-empty directory.
- Fix: Added `PGDATA: /var/lib/postgresql/data/pgdata` env var — Postgres uses a subdirectory instead of the mount root

**4. EBS CSI driver not provisioning volumes**
- Error: `not authorized to perform: ec2:DescribeAvailabilityZones`
- Root cause: `AmazonEBSCSIDriverPolicy` not attached to node role
- Fix: Attached policy + restarted EBS CSI controller pods

**5. ALB not created (AccessDenied)**
- Error: `not authorized to perform: elasticloadbalancing:DescribeLoadBalancers`
- Root cause: Node role missing ELB permissions
- Fix: Attached `ElasticLoadBalancingFullAccess` + `AmazonEC2FullAccess` + custom ALB policy, restarted ALB controller

**6. Frontend showing wrong API URL**
- Root cause: `NEXT_PUBLIC_*` URLs are baked into the JS bundle at build time. The first build used placeholder URLs.
- Fix: Rebuilt frontend image with real ALB DNS after getting it from `kubectl get ingress`

### Why NEXT_PUBLIC_* Must Be Rebuilt Each Time

```
Next.js bakes NEXT_PUBLIC_* into the JavaScript bundle at BUILD TIME.
The browser needs to know the API URL before the page loads.
These cannot be changed at runtime — they're compiled into the JS files.

So every time the ALB DNS changes (new cluster = new DNS),
you must rebuild the frontend Docker image with the new URL.
```

### Complete Deployment Commands (Reference)

```powershell
# 1. Create cluster
eksctl create cluster --name collabdraw-cluster --region ap-south-1 \
  --nodegroup-name workers --node-type t3.small --nodes 2 --managed

# 2. Connect kubectl
aws eks update-kubeconfig --name collabdraw-cluster --region ap-south-1

# 3. Install EBS CSI + attach policies
eksctl create addon --name aws-ebs-csi-driver --cluster collabdraw-cluster --region ap-south-1 --force
$ROLE = aws iam list-roles --query "Roles[?contains(RoleName, 'NodeInstanceRole')].RoleName" --output text
aws iam attach-role-policy --role-name $ROLE --policy-arn "arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy"
aws iam attach-role-policy --role-name $ROLE --policy-arn "arn:aws:iam::aws:policy/ElasticLoadBalancingFullAccess"
aws iam attach-role-policy --role-name $ROLE --policy-arn "arn:aws:iam::aws:policy/AmazonEC2FullAccess"
aws iam attach-role-policy --role-name $ROLE --policy-arn "arn:aws:iam::494487213388:policy/AWSLoadBalancerControllerIAMPolicy"

# 4. Install ALB Controller
$VPC_ID = aws eks describe-cluster --name collabdraw-cluster --region ap-south-1 --query "cluster.resourcesVpcConfig.vpcId" --output text
helm install aws-load-balancer-controller eks/aws-load-balancer-controller -n kube-system \
  --set clusterName=collabdraw-cluster --set serviceAccount.create=true \
  --set region=ap-south-1 --set vpcId=$VPC_ID

# 5. Push images to ECR
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin 494487213388.dkr.ecr.ap-south-1.amazonaws.com
docker build -f apps/http-backend/Dockerfile -t 494487213388.dkr.ecr.ap-south-1.amazonaws.com/collabdraw-http:latest .
docker push 494487213388.dkr.ecr.ap-south-1.amazonaws.com/collabdraw-http:latest
docker build -f apps/ws-server/Dockerfile -t 494487213388.dkr.ecr.ap-south-1.amazonaws.com/collabdraw-ws:latest .
docker push 494487213388.dkr.ecr.ap-south-1.amazonaws.com/collabdraw-ws:latest

# 6. Deploy app
kubectl apply -f k8s/
kubectl exec -n collabdraw deployment/http-backend -- sh -c \
  "packages/db/node_modules/.bin/prisma migrate deploy --schema=packages/db/prisma/schema.prisma"

# 7. Get ALB URL
kubectl get ingress -n collabdraw

# 8. Rebuild frontend with real ALB URL
docker build --build-arg NEXT_PUBLIC_API_URL=http://YOUR-ALB-DNS/api \
  --build-arg NEXT_PUBLIC_SOCKET_URL=ws://YOUR-ALB-DNS/ws \
  --build-arg NEXT_PUBLIC_SITE_URL=http://YOUR-ALB-DNS \
  -f apps/web/Dockerfile -t 494487213388.dkr.ecr.ap-south-1.amazonaws.com/collabdraw-web:latest .
docker push 494487213388.dkr.ecr.ap-south-1.amazonaws.com/collabdraw-web:latest
kubectl rollout restart deployment/frontend -n collabdraw

# 9. Tear down (stop charges)
kubectl delete namespace collabdraw
eksctl delete cluster --name collabdraw-cluster --region ap-south-1
```

See `EKS_RESTART.md` for the complete restart guide.

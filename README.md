# CollabDraw – Full Stack Collaborative Drawing App

A production-ready, real-time collaborative drawing application inspired by Excalidraw. This project demonstrates end-to-end system design including frontend, backend APIs, WebSockets, database management, containerization, and cloud deployment.

---

## Tech Stack

### Frontend

- Next.js (React Framework)
- TypeScript
- Tailwind CSS
- Deployed on Vercel

### Backend

- Node.js + Express
- WebSocket (ws library)
- Prisma ORM
- PostgreSQL Database
- Deployed on Render (Docker)

### Development Tools

- Turborepo (Monorepo Management)
- pnpm Workspaces
- Docker
- GitHub Actions (CI/CD)

---

## Project Structure

```
callab-draw/
├── apps/
│   ├── web/                    # Next.js frontend application
│   ├── http-backend/           # Express REST API server
│   └── ws-server/              # WebSocket server for real-time collaboration
│
├── packages/
│   ├── db/                     # Prisma schema and database utilities
│   ├── backend-common/         # Shared backend utilities and types
│   ├── ui/                     # Shared UI components library
│   └── typescript-config/      # Shared TypeScript configurations
│
├── turbo.json                  # Turborepo pipeline configuration
├── package.json                # Root package.json with workspace scripts
├── pnpm-workspace.yaml         # pnpm workspace configuration
└── README.md
```

---

## Features

- **Real-time Collaboration**: Multiple users can draw simultaneously on the same canvas
- **Multi-user Rooms**: Create and join collaborative drawing sessions
- **JWT Authentication**: Secure user authentication and authorization
- **WebSocket Communication**: Low-latency real-time updates
- **Data Persistence**: PostgreSQL database with Prisma ORM
- **Automatic Migrations**: Database schema migrations on deployment
- **Dockerized Services**: Containerized backend for consistent deployments
- **Monorepo Architecture**: Shared code and streamlined development

---

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: >= 18.x
- **pnpm**: >= 8.x
- **Docker**: (optional, for local database)
- **PostgreSQL**: >= 14.x (if not using Docker)

---

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/excalidraw

# Authentication
JWT_SECRET=your_jwt_secret_key
NEXTAUTH_SECRET=your_nextauth_secret_key

# API Endpoints
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SOCKET_URL=ws://localhost:4000
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Environment
NODE_ENV=development
```

**Note**: Production environment variables are configured separately in Render and Vercel dashboards.

---

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/collabdraw.git
cd collabdraw
```

### 2. Install Dependencies

```bash
pnpm install
```

---

## Database Setup

### Option 1: Using Docker (Recommended)

```bash
docker run -d \
  --name excalidraw-db \
  -p 5432:5432 \
  -e POSTGRES_USER=user \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=excalidraw \
  postgres:15
```

### Option 2: Local PostgreSQL

Install PostgreSQL locally and create a database:

```bash
createdb excalidraw
```

### Run Migrations

```bash
pnpm db:migrate
```

---

## Running the Application

### Start All Services

```bash
pnpm dev
```

This starts:

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **WebSocket Server**: ws://localhost:4000

### Start Individual Services

```bash
# Frontend only
pnpm dev:web

# Backend API only
pnpm dev:api

# WebSocket server only
pnpm dev:ws
```

---

## Build for Production

```bash
pnpm build
```

This builds all applications in the monorepo using Turborepo's caching.

---

## Docker Deployment

### Build Backend Image

```bash
docker build -f apps/http-backend/Dockerfile -t excalidraw-backend .
```

### Run Backend Container

```bash
docker run -d \
  -p 3001:3001 \
  -e DATABASE_URL=your_database_url \
  -e JWT_SECRET=your_secret \
  excalidraw-backend
```

---

## Deployment

### Backend & WebSocket Server (Render)

1. Create a new **Web Service** on Render
2. Connect your GitHub repository
3. Select **Docker** as the environment
4. Set the Dockerfile path: `apps/http-backend/Dockerfile`
5. Add environment variables from your `.env` file
6. Enable **Auto-Deploy** from the main branch
7. Deploy

### Frontend (Vercel)

1. Import your GitHub repository on Vercel
2. Set the **Root Directory** to `apps/web`
3. Framework Preset: **Next.js**
4. Add environment variables:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
   NEXT_PUBLIC_SOCKET_URL=wss://your-ws.onrender.com
   NEXTAUTH_SECRET=your_secret
   ```
5. Deploy

---

## Database Migrations

Migrations run automatically on application startup. To run manually:

```bash
pnpm db:migrate
```

To create a new migration:

```bash
pnpm db:migrate:dev --name your_migration_name
```

---

## WebSocket Usage

### Client Connection Example

```javascript
const token = "your_jwt_token";
const ws = new WebSocket(`wss://your-ws-server.onrender.com?token=${token}`);

ws.onopen = () => {
  console.log("Connected to WebSocket server");

  // Join a room
  ws.send(
    JSON.stringify({
      type: "JOIN_ROOM",
      roomId: "room_123",
    }),
  );
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log("Received:", data);
};

ws.onerror = (error) => {
  console.error("WebSocket error:", error);
};
```

### Message Types

- `JOIN_ROOM`: Join a collaborative drawing room
- `DRAW`: Send drawing data to other users
- `CURSOR_MOVE`: Update cursor position
- `ELEMENT_UPDATE`: Update canvas elements

---

## Testing

Currently using manual testing. Future improvements:

```bash
# Unit tests (planned)
pnpm test

# E2E tests (planned)
pnpm test:e2e
```

---

## CI/CD Pipeline

- **GitHub Integration**: Auto-deploy on push to main branch
- **Render Pipeline**: Automatic Docker builds and deployments
- **Vercel Pipeline**: Automatic frontend builds and deployments
- **Prisma Migrations**: Run automatically on backend startup

---

## Performance Optimizations

- **Stateless Services**: Horizontal scaling capability
- **Connection Pooling**: Efficient database connections via Prisma
- **CDN Distribution**: Static assets served via Vercel's Edge Network
- **Turborepo Caching**: Faster builds with intelligent caching
- **WebSocket Optimization**: Binary protocol for reduced bandwidth

---

## Security

- **JWT Authentication**: Secure token-based authentication
- **Environment Variables**: Sensitive data stored securely
- **CORS Configuration**: Restricted API access
- **WSS Protocol**: Encrypted WebSocket connections
- **Input Validation**: Server-side validation for all inputs

---

## Future Improvements

- [ ] Redis pub/sub for multi-server WebSocket scaling
- [ ] Role-Based Access Control (RBAC)
- [ ] Offline mode with conflict resolution
- [ ] Canvas version history and rollback
- [ ] Mobile-responsive drawing interface
- [ ] Export to PNG/SVG/PDF
- [ ] Integration tests with Jest
- [ ] E2E tests with Playwright
- [ ] Performance monitoring and analytics

---

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## License

This project is licensed under the MIT License.

---

## Author

**Rohit Kumar**

- GitHub: [@rohitdev_sol](https://github.com/rohitdev_sol)

---

## Acknowledgements

- Inspired by [Excalidraw](https://excalidraw.com)
- Built for learning and production experimentation
- Special thanks to the open-source community

---

## Support

If you find this project helpful, please consider giving it a star on GitHub!

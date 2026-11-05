# AI DevX architecture assessment

## Repository baseline

- The project is a pnpm/Turborepo monorepo with a Node.js 18+ baseline and TypeScript 5.9.
- `apps/http-backend` is an Express 5 API. Existing user routes use JWT authentication through `authMiddleware`.
- `apps/ws-server` hosts WebSocket collaboration and should not become dependent on AI services.
- `apps/web` is a Next.js 15 App Router frontend. A separate `/devx` route can host the developer dashboard without replacing the whiteboard.
- `packages/db` uses Prisma with PostgreSQL. Existing models cover users, rooms, participants, chat, and shapes.
- Jest is used by the HTTP and WebSocket services. The root `pnpm test` command fails before running tests because Turbo includes workspace packages without a `test` task.
- The HTTP baseline command `pnpm --filter http-backend test` has a Jest module-mapping failure on Windows when resolving `@repo/db/client`; 1 suite passed and 4 failed to load (9 tests ran and passed).
- The WebSocket baseline command `pnpm --filter ws-server test` had 2 suites pass and 1 fail (52 of 53 tests passed). The failing integration assertion expected shape ID `99` but received a timestamp-derived ID; Jest also reported a 15-second teardown-hook timeout.
- The root `pnpm test:ci` command has no corresponding root Turbo task. CI test scripts exist on the individual backend packages.
- The tracked Jenkinsfile builds container images, pushes them to ECR, and deploys to EKS. There is no AI integration in the tracked baseline pipeline.

## Integration boundary

The AI developer platform will be additive and disabled by default. Its HTTP routes will be mounted in the existing backend only when `AI_DEVX_ENABLED=true`. Existing whiteboard and WebSocket behavior will remain independent of model, GitHub, Jenkins, and sandbox availability.

The platform will use bounded modules for provider access, input validation, review/diagnosis/test generation, deterministic risk scoring, persistence, and HTTP adapters. GitHub and Jenkins webhook handling will be isolated from user-facing dashboard routes. User-facing routes will use the existing authentication middleware; webhook routes will use dedicated signature or shared-secret checks.

LLM results will be treated as untrusted and validated before use. The mock provider will be deterministic and explicitly marked as mock output. No workflow will approve or merge a pull request, run arbitrary host commands, or deploy infrastructure.

## Data and deployment constraints

The project already uses PostgreSQL through Prisma. New persistence, if required, must be additive and must not run against production during development. The AI feature flag must keep new database access out of the existing application path when the platform is disabled.

The current working directory contained user modifications when this branch was created. Implementation is isolated in the `feat/ai-developer-experience-platform` worktree, based on the recorded HEAD, so those modifications are not included in this branch.

## Baseline validation

Command: `pnpm test`

- Failed before running tests because Turbo could not find a `test` task in a workspace project.

Command: `pnpm --filter http-backend test`

- 1 suite passed; 4 suites failed during module resolution. The Jest mapper resolved `@repo/db/client` to a malformed path containing the worktree root. The 9 tests in the loaded suite passed.

Command: `pnpm --filter ws-server test`

- 2 suites passed; 1 integration suite failed. One assertion expected shape ID `99` but received a timestamp-derived ID, and a teardown hook exceeded the 15-second timeout. 52 of 53 tests passed before the suite failed.

Command: `pnpm test:ci`

- Failed before executing tests because the root Turbo configuration does not define a `test:ci` task.

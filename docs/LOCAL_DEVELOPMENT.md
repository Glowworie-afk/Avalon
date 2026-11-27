# Local Development

Use Node 24.3.0 (`.nvmrc`) and npm from the repository root. Install all workspaces using the root lockfile:

```bash
npm ci
```

Do not run independent installs inside `client/` or `server/`; the root lockfile is used by CI. Tests and coverage commands are documented in [TESTING.md](TESTING.md); automated checks in [CI.md](CI.md).

## Backend

If `server/.env` does not exist, copy `server/.env.example` to it. Never overwrite existing credentials or commit secrets.

```bash
cd server
MOCK_LOGIN=true PORT=3000 npm run dev
```

Check `http://localhost:3000/health`. HTTP and WebSocket share the port. Mock login is for local development only. Set your own `JWT_SECRET`; the current development-secret fallback remains a known production-hardening issue. Non-mock login also requires valid `WX_APPID` and `WX_SECRET`. `TOKEN_TTL` controls token lifetime in seconds.

## Mini Program

From a second terminal at the repository root:

```bash
AVALON_API_ORIGIN=http://localhost:3000 npm run dev:weapp --workspace client
```

Open `client/` in WeChat Developer Tools. Output is generated in `client/dist/`. Development mode defaults to `http://localhost:3000` when the variable is absent. For a physical device, use the development machine's reachable LAN address. Local domain-check bypasses are for development only.

`AVALON_API_ORIGIN` is a build-time shell environment variable read by `client/config/backend.ts`. HTTP and WebSocket URLs are derived from the same origin. Do not edit generated JavaScript or duplicate endpoints in source. Restart the build/watch process after changing the environment variable.

Production builds require an explicitly configured HTTPS origin:

```bash
AVALON_API_ORIGIN=https://your-backend.example.com npm run build:weapp --workspace client
```

Replace the example with your deployed backend. The corresponding WebSocket endpoint automatically uses WSS. Configure WeChat's permitted request/socket domains and real TLS separately; setting this variable does not provision or secure a server.

For compilation verification only, CI uses `https://ci.invalid`. No requests are made during the build. Do not distribute that build as a working application.

## Limits

The target is the WeChat Mini Program. H5 and other platform scripts do not establish platform support. Client TypeScript and lint baselines still have separately documented failures. Build success does not replace real-device, real-WeChat login, reconnection, or load testing. In-memory state is lost when the backend restarts.

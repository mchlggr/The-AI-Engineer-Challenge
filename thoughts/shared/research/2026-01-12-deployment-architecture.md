---
date: 2026-01-12T12:44:51Z
researcher: Claude
git_commit: 81ab34d102e88766f251f3e629e93b044a088302
branch: main
repository: calendar-club-prototype
topic: "Deployment Architecture and Vercel Unified Deployment"
tags: [research, deployment, vercel, nextjs, fastapi, serverless]
status: complete
last_updated: 2026-01-12
last_updated_by: Claude
---

# Research: Deployment Architecture and Vercel Unified Deployment

**Date**: 2026-01-12T12:44:51Z
**Researcher**: Claude
**Git Commit**: 81ab34d102e88766f251f3e629e93b044a088302
**Branch**: main
**Repository**: calendar-club-prototype

## Research Question

How do I deploy this application? Is there a way to do it with just a single Vercel application project and instance, without having to deploy both the NX server and the Python server? Can they be packaged together into one deployment process? Or can I just deploy Python and then have the next build static files?

## Summary

**Yes, this application is already configured for a single unified Vercel deployment.** Both the Next.js frontend and FastAPI Python backend deploy together as one Vercel project. No separate deployments are needed.

The current architecture:
- **Frontend**: Next.js (SSR, not static) deployed via Vercel's native Next.js support
- **Backend**: FastAPI deployed as a Vercel Python Serverless Function
- **Routing**: `vercel.json` rewrites route `/api/*` requests to the Python function
- **Single `vercel` CLI command** deploys everything together

## Detailed Findings

### Current Deployment Configuration

#### vercel.json (`/vercel.json`)

```json
{
  "version": 2,
  "framework": "nextjs",
  "buildCommand": "cd frontend && npm install && npm run build",
  "outputDirectory": "frontend/.next",
  "rewrites": [
    { "source": "/api/:path*", "destination": "/api/index.py" },
    { "source": "/health", "destination": "/api/index.py" }
  ]
}
```

**How this works:**
1. Vercel detects `framework: "nextjs"` and applies Next.js build optimizations
2. Build command runs the Next.js build from `frontend/` directory
3. Output is read from `frontend/.next` (SSR build, not static export)
4. Rewrites route all `/api/*` and `/health` requests to `api/index.py`
5. Vercel auto-detects `api/index.py` as a Python serverless function

#### Python Serverless Function (`/api/index.py`)

Vercel automatically recognizes Python files in the `api/` directory as serverless functions. The FastAPI `app` object is detected and served via Vercel's ASGI handler.

Key characteristics:
- Dependencies installed from `requirements.txt` during build
- Cold starts on each request (serverless model)
- Stateless execution (SQLite `conversations.db` persists via Vercel's filesystem)

### Deployment Process

**Single command deployment:**
```bash
vercel
```

Or for production:
```bash
vercel --prod
```

This:
1. Builds the Next.js frontend
2. Packages the Python API as serverless function
3. Deploys both to Vercel's edge network
4. Sets up routing via the rewrites

### Can I Use Static Export Instead of SSR?

**Current state**: The frontend is SSR (Server-Side Rendered), not static.

**Why it's SSR:**
- No `output: 'export'` in `next.config.ts`
- Uses App Router with client components
- API proxy route at `frontend/src/app/api/[...path]/route.ts` requires server runtime

**Could you switch to static?**

Technically possible but with caveats:

1. **Add to `next.config.ts`:**
   ```ts
   const config: NextConfig = {
     output: 'export',
   };
   ```

2. **Remove the API proxy route** (`frontend/src/app/api/[...path]/route.ts`)
   - Static export doesn't support API routes or Route Handlers

3. **Update API calls to use absolute URLs**
   - Currently uses relative `/api/*` paths
   - Would need `NEXT_PUBLIC_API_URL` environment variable

4. **Deploy separately:**
   - Static files to any CDN (Vercel, Cloudflare, S3)
   - Python API to Vercel separately

**Recommendation**: Keep the current unified SSR deployment. It's simpler and already works.

### Architecture Options

| Option | Frontend | Backend | Deployments | Complexity |
|--------|----------|---------|-------------|------------|
| **Current (Recommended)** | SSR on Vercel | Python Serverless on Vercel | 1 | Low |
| Static + Separate API | Static export anywhere | Python Serverless on Vercel | 2 | Medium |
| Python-only with static | Static files served by FastAPI | FastAPI on any host | 1 | High |

#### Option 3: Python-Only with Embedded Static Files

If you wanted to deploy just Python with Next.js static files embedded:

1. Build Next.js as static: `next build && next export` (creates `out/` directory)
2. Copy `out/` into Python project
3. Serve static files from FastAPI:
   ```python
   from fastapi.staticfiles import StaticFiles
   app.mount("/", StaticFiles(directory="out", html=True), name="static")
   ```
4. Deploy to any Python host (Railway, Render, Fly.io)

**Downsides:**
- Loses Vercel's edge CDN for static assets
- More complex build process
- No preview deployments per PR

### Frontend API Proxy Architecture

The frontend includes a catch-all API proxy at `frontend/src/app/api/[...path]/route.ts`:

```typescript
function getApiTarget(): string {
  const configured = process.env.API_PROXY_TARGET;
  if (configured) return configured.trim().replace(/\/$/, "");

  if (process.env.NODE_ENV === "development") {
    return "http://127.0.0.1:8000";  // Local FastAPI
  }

  throw new Error("API_PROXY_TARGET not configured for production");
}
```

**Purpose**: This proxy exists for development when running Next.js and FastAPI separately. In production on Vercel, the `vercel.json` rewrites handle routing directly to the Python function—the proxy route is bypassed.

### Environment Variables for Deployment

**Required for Vercel dashboard:**
- `OPENAI_API_KEY` - LLM provider
- `CORS_ORIGINS` - Allowed origins (e.g., `https://your-app.vercel.app`)

**Optional API sources:**
- `EVENTBRITE_API_KEY`
- `FIRECRAWL_API_KEY`
- `EXA_API_KEY`

**Google Calendar OAuth (if using):**
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

**Observability:**
- `HYPERDX_API_KEY`
- `NEXT_PUBLIC_HYPERDX_API_KEY`
- `NEXT_PUBLIC_POSTHOG_KEY`

## Code References

- `/vercel.json` - Vercel deployment configuration
- `/api/index.py` - FastAPI entry point and all API routes
- `/frontend/next.config.ts` - Next.js configuration (minimal, no export config)
- `/frontend/src/app/api/[...path]/route.ts` - Development API proxy (not used in production)
- `/requirements.txt` - Python dependencies for serverless function
- `/frontend/package.json` - Frontend build scripts
- `/TECHSTACK.md` - Hosting strategy documentation

## Architecture Documentation

### Current Production Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Vercel Edge Network                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐         ┌──────────────────────────┐  │
│  │   Next.js SSR    │         │   Python Serverless      │  │
│  │   (frontend/)    │         │   (api/index.py)         │  │
│  │                  │         │                          │  │
│  │  - App Router    │ /api/*  │  - FastAPI app           │  │
│  │  - React 19      │────────▶│  - LLM streaming (SSE)   │  │
│  │  - Tailwind v4   │         │  - Calendar export       │  │
│  │                  │         │  - OAuth flows           │  │
│  └──────────────────┘         └──────────────────────────┘  │
│           │                              │                   │
│           └──────────────┬───────────────┘                   │
│                          │                                   │
│                    Single Deployment                         │
│                    (vercel.json)                             │
└─────────────────────────────────────────────────────────────┘
```

### Deployment Flow

```
git push origin main
        │
        ▼
┌───────────────────┐
│ Vercel detects    │
│ push to main      │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Build Next.js     │  cd frontend && npm install && npm run build
│ (frontend/)       │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Package Python    │  Reads api/index.py + requirements.txt
│ Serverless Func   │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Deploy to Edge    │  CDN for static, serverless for API
│ Network           │
└───────────────────┘
```

## Open Questions

1. **Session persistence**: The SQLite `conversations.db` file persists on Vercel's filesystem, but serverless cold starts may affect this. Consider Turso for production persistence if sessions are critical.

2. **Cold start latency**: Python serverless functions have cold starts (~500ms-2s). For latency-sensitive applications, consider Vercel's Pro tier for always-warm functions.

3. **Build time**: Current build installs frontend deps + builds. Consider caching strategies if build times become problematic.

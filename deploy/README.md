# Deploying canrush.ru

Docker Compose setup with PostgreSQL, Next.js site, parser (Playwright), and Caddy reverse proxy with automatic HTTPS.

## Prerequisites

- A VPS with **Docker** and **Docker Compose** installed
- Domain `canrush.ru` (and `www.canrush.ru`) with **A records** pointing to your VPS IP
- SMTP credentials (SpaceWeb: `smtp.spaceweb.ru:465`)

## Quick Start

### 1. Clone the repo on your VPS

```bash
git clone <your-repo-url> /opt/canrush
cd /opt/canrush
```

### 2. Create `.env` from the example

```bash
cp deploy/.env.example .env
```

Edit `.env` and fill in all required values:

```bash
# Generate a strong PostgreSQL password
openssl rand -base64 32

# Generate BETTER_AUTH_SECRET (must be ≥32 bytes)
openssl rand -base64 48
```

### 3. Build and start all services

```bash
docker compose up -d --build
```

This starts:
- **PostgreSQL** (internal only, port not exposed to host)
- **Site** (Next.js, port 3000 on localhost)
- **Parser** (Playwright + cron scheduler, long-running)
- **Caddy** (ports 80/443, automatic HTTPS via Let's Encrypt)

### 4. Run database migrations

```bash
docker compose exec site node apps/site/scripts/migrate.mjs
```

Or check pending migrations first:

```bash
docker compose exec site node apps/site/scripts/migrate.mjs --plan
```

### 5. Verify

- Visit `https://canrush.ru` — the site should load
- Caddy automatically obtains the SSL certificate on first request
- Check logs: `docker compose logs -f site caddy`

## Architecture

```
Internet → Caddy (80/443, TLS) → Site (3000) → PostgreSQL (5432, internal)
                                        ↑
                              Parser (cron, Playwright)
```

### Shared volumes

| Volume           | Site mount                     | Parser mount                      | Purpose                          |
|------------------|--------------------------------|-----------------------------------|----------------------------------|
| `catalog-data`   | `/app/data`                    | `/app/apps/site/data`             | `catalog.json`, `retailer-icons.json` |
| `product-images` | `/app/apps/site/public/images` | `/app/apps/site/public/images`    | Downloaded product images and retailer logos (`retailers/`) |
| `parser-data`    | —                              | `/app/data`                       | `latest.json`, `history/`, `raw/` |
| `parser-sessions`| —                              | `/app/apps/parser/.sessions`      | Browser sessions (cookies, CAPTCHA) |

## Common Operations

### View logs

```bash
# All services
docker compose logs -f

# Just the site
docker compose logs -f site

# Just the parser
docker compose logs -f parser
```

### Run parser manually (one-time, all sources)

```bash
docker compose exec parser npx tsx apps/parser/src/index.ts run
```

### Run parser for specific sources

```bash
docker compose exec parser npx tsx apps/parser/src/index.ts run --source=ozon,wildberries
```

### Download product images

```bash
docker compose exec parser npx tsx apps/parser/src/index.ts download-images
```

### Unlock a blocked source session

If a source is blocked (403/CAPTCHA), you need to run the unlock command with a visible browser. This requires SSH with X11 forwarding or a VNC session:

```bash
# On the VPS, with X11 forwarding:
docker compose exec -e DISPLAY=$DISPLAY parser npx tsx apps/parser/src/index.ts session:unlock --source=wildberries
```

### Run database migrations after updates

```bash
docker compose exec site node apps/site/scripts/migrate.mjs
```

### Rebuild after code changes

```bash
git pull
docker compose up -d --build
```

### Stop everything

```bash
docker compose down
```

### Stop and remove data (DESTRUCTIVE)

```bash
# Removes all containers AND volumes (database, images, sessions)
docker compose down -v
```

## Notes

- **Caddy** handles HTTPS automatically via Let's Encrypt. The first request may take a few seconds while the certificate is obtained.
- **Parser** runs as a long-running process with `node-cron`. The schedule is set by `CRON_SCHEDULE` (default: `0 6 * * *` = daily at 6:00 AM Moscow time).
- **Playwright** in Docker uses the official Microsoft image with Chromium pre-installed. The `ipc: host` setting is required for Chromium stability.
- **Sessions** (`.sessions/`) are persisted in a Docker volume so cookies and solved CAPTCHAs survive container restarts.
- **Retailer icons** (`public/brand/retailers/`) are committed to the repo and baked into the site image. They are NOT in a shared volume.
- The site's `public/images/` directory is a shared volume populated by the parser at runtime.

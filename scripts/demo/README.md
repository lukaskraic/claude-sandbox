# Demo Hello World

Minimal Express + PostgreSQL app to verify claude-sandbox works end-to-end.

## What it does

- **GET /api/hello** - Returns server info (timestamp, Node version)
- **GET /api/messages** - Lists messages from PostgreSQL
- **POST /api/messages** - Creates a message (`{"text": "..."}`)
- **GET /** - Serves the frontend UI

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | Server listen port |
| POSTGRES_HOST | postgres | PostgreSQL hostname |
| POSTGRES_PORT | 5432 | PostgreSQL port |
| POSTGRES_DB | sandbox | Database name |
| POSTGRES_USER | sandbox | Database user |
| POSTGRES_PASSWORD | sandbox | Database password |

## Usage

Used by `scripts/setup-demo.sh` to create a demo project in claude-sandbox.
The app is copied into a git repo and run inside a container session.

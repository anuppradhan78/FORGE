# FORGE Dashboard

Live monitoring dashboard for the FORGE agentic commerce platform.

## Features

- Real-time agent status display
- Sponsor integration status grid (9 sponsors)
- Neo4j governance graph visualization
- Audit trail with decision provenance
- Financial flux reports from Numeric

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

## Build

```bash
npm run build
npm start
```

## Deployment

This dashboard is configured for deployment on Render. Push to the main branch to trigger automatic deployment.

## Tech Stack

- Next.js 14 (App Router)
- TypeScript (strict mode)
- Tailwind CSS (custom FORGE theme)
- D3.js (for graph visualization)
- Server-Sent Events (for real-time updates)

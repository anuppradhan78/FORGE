# FORGE API Server

Express-based API server for the FORGE agentic commerce platform.

## Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Environment Variables

Create a `.env` file in the api directory:

```env
PORT=3001
DASHBOARD_URL=http://localhost:3000
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-password
```

## API Endpoints

### Voice Interface
- `POST /api/voice/analyze` - Analyze voice command with Modulate Velma

### Scout Engine
- `POST /api/scout/search` - Search for deals using Tavily
- `POST /api/scout/create` - Create Yutori scout for monitoring

### Context Verification
- `POST /api/verify/context` - Verify deal context using Senso

### Governance
- `POST /api/govern/check` - Check transaction against policies
- `GET /api/govern/audit` - Query audit trail

### Finance Reconciliation
- `POST /api/finance/reconcile` - Generate flux report
- `GET /api/finance/flux/:userId` - Get latest flux report

### Demo Flow
- `POST /api/demo/run` - Execute full demo flow
- `POST /api/demo/reset` - Reset demo state

### Health Check
- `GET /health` - Server health status

## Architecture

```
api/
├── src/
│   ├── index.ts              # Express server setup
│   ├── types/                # TypeScript interfaces
│   ├── routes/               # API route handlers
│   ├── middleware/           # Validation middleware
│   └── utils/
│       ├── neo4j-client.ts   # Neo4j connection
│       ├── circuit-breaker.ts # Circuit breaker pattern
│       └── retry.ts          # Retry with exponential backoff
```

## Features

- **CORS**: Configured for dashboard origin
- **Request Logging**: Automatic logging of all requests with duration
- **Error Handling**: Global error handler with structured responses
- **Validation**: Request validation middleware for all endpoints
- **Circuit Breaker**: Automatic fallback to mocks when APIs fail
- **Retry Logic**: Exponential backoff with jitter for resilience

## Development

The server uses `tsx watch` for hot reloading during development. Any changes to TypeScript files will automatically restart the server.

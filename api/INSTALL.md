# API Installation Instructions

## Install Dependencies

Before running the API server, install all required dependencies:

```bash
cd api
npm install
```

This will install:
- express - Web framework
- cors - CORS middleware
- dotenv - Environment variable management
- neo4j-driver - Neo4j database driver
- multer - File upload middleware (for voice commands)

## Development Dependencies

TypeScript and development tools are also installed:
- typescript - TypeScript compiler
- tsx - TypeScript execution
- vitest - Testing framework
- @types/* - Type definitions

## Running the Server

Development mode (with hot reload):
```bash
npm run dev
```

Production build:
```bash
npm run build
npm start
```

## Testing

Run tests:
```bash
npm test
```

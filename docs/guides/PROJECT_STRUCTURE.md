# CCL-3 Project Structure

## Directory Overview

```
CCL-3/
├── client/              # Frontend React application
├── server/              # Backend Node.js server
├── shared/              # Shared code between client and server
├── migrations/          # Database migration files
├── email-system/        # Email campaign system (extracted from legacy)
├── docs/                # All project documentation
├── tests/               # All test files and test utilities
├── scripts/             # Utility and deployment scripts
├── config/              # Environment and deployment configs
├── build-config/        # Build tool configurations
└── project-meta/        # Project metadata and backups
```

## Core Directories

- **client/** - React frontend with component library
- **server/** - Express server with agent system
- **shared/** - Shared TypeScript types and utilities
- **migrations/** - PostgreSQL database migrations

## Organizational Directories

- **docs/** - All markdown documentation
- **tests/** - Unit tests, e2e tests, and test utilities
- **scripts/** - Build, deployment, and utility scripts
- **build-config/** - Config files for build tools (vite, typescript, etc.)
- **project-meta/** - Project planning docs and package backups

## Root Files

- **README.md** - Main project documentation
- **QUICK_START.md** - Quick start guide
- **TROUBLESHOOTING.md** - Common issues and solutions
- **package.json** - Node.js dependencies
- **PROJECT_STRUCTURE.md** - This file
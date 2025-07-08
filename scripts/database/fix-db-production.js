#!/usr/bin/env node
/**
 * Add this to your package.json scripts and run on Render
 */

import { runProductionMigration } from './production-migration.js';

// This can be run as npm run fix:db in production
runProductionMigration();
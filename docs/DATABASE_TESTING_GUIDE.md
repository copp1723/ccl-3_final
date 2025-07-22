# Database Testing Guide

This guide explains how to set up and use the database testing infrastructure for the CCL-3 application.

## Overview

The testing infrastructure provides:
- Isolated test database configuration
- Comprehensive seed data covering all tables
- Database utilities for test scenarios
- Automated migration and setup scripts

## Prerequisites

1. PostgreSQL installed and running locally
2. Node.js and npm installed
3. Access to create databases in PostgreSQL

## Setup

### 1. Environment Configuration

The test environment uses `.env.test` which includes:
- Test database URL: `postgresql://postgres:password@localhost:5432/ccl3_test`
- Mock API keys for external services (Mailgun, Twilio, etc.)
- Test-specific settings

### 2. Initial Setup

Run the complete test database setup:

```bash
npm run test:db:setup
```

This command will:
1. Create a fresh `ccl3_test` database
2. Run all migrations
3. Seed comprehensive test data
4. Verify the setup

## Available Commands

### Database Management

```bash
# Complete setup (create, migrate, seed)
npm run test:db:setup

# Just seed data (assumes database exists)
npm run test:db:seed

# Reset database (drop, recreate, migrate, seed)
npm run test:db:reset

# Run tests with fresh database
npm run test:with-db
```

### Manual Database Operations

```bash
# Generate new migrations from schema changes
npm run db:generate

# Apply migrations to test database
NODE_ENV=test npm run db:migrate
```

## Test Data

The seed script creates comprehensive test data including:

### Users
- `admin` - Admin user
- `agent1` - Agent user
- `testuser` - Regular test user

### Visitors & Leads
- Multiple visitors with varying completion states
- Leads at different qualification stages
- Complete and incomplete PII data

### Templates & Campaigns
- Email templates (Welcome, Abandonment, Approval)
- SMS templates with variable substitution
- Multi-step drip campaigns
- Campaign enrollment tracking

### System Data
- Active agents for different channels
- System activities and logs
- Outreach attempts with various statuses

## Using Test Utilities

### In Your Tests

```typescript
import { testDb } from '../tests/db-test-utils';

describe('Lead Processing', () => {
  beforeAll(async () => {
    await testDb.connect();
    await testDb.resetDatabase();
  });

  afterAll(async () => {
    await testDb.disconnect();
  });

  it('should create a lead', async () => {
    const db = testDb.getDb();
    
    // Create test data
    const visitor = await db.insert(schema.visitors)
      .values(testDb.createTestVisitor())
      .returning();

    const lead = await db.insert(schema.leads)
      .values(testDb.createTestLead(visitor[0].id))
      .returning();

    // Assert
    expect(lead[0].visitorId).toBe(visitor[0].id);
  });
});
```

### Test Utilities API

#### Data Factories
```typescript
// Create test visitor
testDb.createTestVisitor(overrides);

// Create test lead
testDb.createTestLead(visitorId, overrides);

// Create test templates
testDb.createTestEmailTemplate(overrides);
testDb.createTestSmsTemplate(overrides);
```

#### Query Helpers
```typescript
// Find records
await testDb.findVisitorByEmail(email);
await testDb.findLeadById(leadId);
await testDb.countOutreachAttempts(visitorId);
```

#### Assertion Helpers
```typescript
// Assert email was sent
await testDb.assertEmailSent(to, subject);

// Assert SMS was sent
await testDb.assertSmsSent(phoneNumber, content);
```

## Best Practices

1. **Isolation**: Each test should reset or clean data as needed
2. **Use Factories**: Use provided factory methods for consistent test data
3. **Clean Up**: Always disconnect from database after tests
4. **Parallel Tests**: Be cautious with parallel tests sharing the same database

## Troubleshooting

### Database Connection Issues
```bash
# Check PostgreSQL is running
pg_isready

# Verify connection string
psql $DATABASE_URL -c "SELECT 1"
```

### Migration Issues
```bash
# Check migration status
ls -la migrations/

# Run migrations manually
NODE_ENV=test npx drizzle-kit push
```

### Permission Issues
Make sure your PostgreSQL user has permissions to:
- Create databases
- Create tables
- Insert/update/delete data

### Clean State
If tests are failing due to dirty state:
```bash
npm run test:db:reset
```

## CI/CD Integration

For CI environments, ensure:
1. PostgreSQL service is available
2. Test database can be created
3. Environment variables are set
4. Run `npm run test:db:setup` before tests

Example GitHub Actions:
```yaml
- name: Setup test database
  run: npm run test:db:setup
  env:
    DATABASE_URL: postgresql://postgres:postgres@localhost:5432/ccl3_test

- name: Run tests
  run: npm test
```
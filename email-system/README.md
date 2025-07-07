# CCL-3 Email Campaign System

This folder contains the complete email campaign system extracted from the CCL-3 archive project. The system provides comprehensive email marketing automation capabilities including multi-service support, drip campaigns, and tracking.

## Directory Structure

```
email-system/
├── services/           # Core email services
├── routes/            # API endpoints
├── workers/           # Background job processors
├── database/          # Database schemas and connections
└── types/             # TypeScript type definitions
```

## Core Components

### 1. Email Services (`/services`)

- **mailgun-service.ts** - Mailgun email provider integration
  - Single and bulk email sending
  - Rate limiting
  - XSS protection via DOMPurify
  - Template variable substitution

- **email-onerylie.ts** - Specialized email service for onerylie.com domain
  - Pre-built welcome and follow-up templates
  - Re-engagement campaigns
  - Return token generation

- **email-campaign-templates.ts** - Template management system
  - 6 pre-built campaign templates
  - Categories: welcome, followup, reminder, approval, custom
  - HTML and plain text versions
  - Variable substitution support

- **multi-attempt-scheduler.ts** - Drip campaign automation
  - Configurable delays between attempts
  - Conditional sending logic
  - Lead enrollment management
  - Campaign pause/resume functionality

### 2. API Routes (`/routes`)

- **email-campaigns.ts** - Main email campaign endpoints
  - Template CRUD operations
  - Campaign management
  - Test email sending
  - Bulk operations
  - Statistics and monitoring

- **campaigns.ts** - Campaign management routes
  - Campaign creation and updates
  - Status management

### 3. Background Workers (`/workers`)

- **campaign-sender.ts** - Scheduled email processor
  - Runs every minute
  - Processes due emails
  - Updates campaign progress
  - Marks completed campaigns

- **outreach-orchestrator.ts** - General outreach management
  - Handles both email and SMS
  - Retry logic
  - Error handling

### 4. Database (`/database`)

- **schema.ts** - Main database schema
  - `emailCampaigns` - Basic campaign tracking
  - `campaignSchedules` - Multi-attempt configurations
  - `campaignAttempts` - Individual attempt tracking
  - `outreachAttempts` - General outreach tracking

- **db.ts** - Database connection using Drizzle ORM
- **db-postgres.ts** - PostgreSQL configuration
- **database-storage.ts** - Storage abstraction layer

### 5. Types (`/types`)

- **tables.ts** - TypeScript interfaces for:
  - EmailTemplate
  - CampaignDraft

## Key Features

1. **Multi-Service Support**
   - Mailgun integration
   - Custom domain support (onerylie.com)

2. **Campaign Types**
   - Welcome sequences
   - Follow-up campaigns
   - Re-engagement campaigns
   - Credit challenge campaigns
   - Custom campaigns

3. **Automation Capabilities**
   - Drip campaigns with configurable delays
   - Conditional sending based on lead status
   - Automatic retry on failures
   - Batch processing

4. **Tracking & Analytics**
   - Email sent/delivered status
   - Open tracking
   - Click tracking
   - Opt-out management

5. **Security Features**
   - XSS protection via DOMPurify
   - Rate limiting for bulk sends
   - Secure token generation

## Environment Variables Required

```bash
# Mailgun Configuration
MAILGUN_API_KEY=your-api-key
MAILGUN_DOMAIN=your-domain.com
MAILGUN_WEBHOOK_SIGNING_KEY=your-webhook-key

# Database Configuration
DATABASE_URL=postgresql://user:password@host:port/database

# Email Settings
FROM_EMAIL=noreply@yourdomain.com
REPLY_TO_EMAIL=support@yourdomain.com
```

## Usage Example

```typescript
// Import services
import { MailgunService } from './services/mailgun-service';
import { EmailCampaignTemplates } from './services/email-campaign-templates';
import { MultiAttemptScheduler } from './services/multi-attempt-scheduler';

// Initialize services
const mailgun = new MailgunService();
const templates = new EmailCampaignTemplates();
const scheduler = new MultiAttemptScheduler();

// Send a single email
await mailgun.sendEmail({
  to: 'user@example.com',
  subject: 'Welcome!',
  html: '<h1>Welcome to our service</h1>',
  text: 'Welcome to our service'
});

// Create a drip campaign
const schedule = await scheduler.createSchedule({
  name: 'Welcome Series',
  attempts: [
    { delayHours: 0, templateId: 'welcome' },
    { delayHours: 24, templateId: 'followup-1' },
    { delayHours: 72, templateId: 'followup-2' }
  ]
});

// Enroll a lead
await scheduler.enrollLead(scheduleId, leadId);
```

## Dependencies

- `mailgun.js` - Mailgun API client
- `isomorphic-dompurify` - XSS sanitization
- `drizzle-orm` - Database ORM
- `pg` - PostgreSQL driver
- `zod` - Schema validation

## Database Schema

The system uses PostgreSQL with the following main tables:

1. **emailCampaigns** - Tracks basic email campaigns
2. **campaignSchedules** - Stores multi-attempt campaign configurations
3. **campaignAttempts** - Records individual email attempts
4. **outreachAttempts** - General outreach tracking (email/SMS)

## Notes

- All services use TypeScript for type safety
- Database operations use Drizzle ORM
- Background workers should be run as separate processes
- The system supports both transactional and marketing emails
- Rate limiting is implemented to prevent email provider throttling
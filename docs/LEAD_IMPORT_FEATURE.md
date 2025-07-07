# Lead Import Feature Documentation

## Overview
The Lead Import feature allows users to bulk import leads from CSV files into the CCL-3 SWARM system. The feature includes field mapping, data validation, and integration with the Overlord Agent for automatic lead routing.

## Components

### Backend Implementation

#### 1. Import Routes (`/server/routes/import.ts`)
- **POST /api/import/analyze**: Analyzes CSV file and suggests field mappings
- **POST /api/import/leads**: Imports leads with specified field mappings
- **GET /api/import/status/:importId**: Gets import job status (for future implementation)

#### Key Features:
- File size limit: 10MB
- Supported formats: CSV (.csv)
- Automatic field detection based on column headers
- Validation using Zod schemas
- Integration with Overlord Agent for lead routing
- Batch processing for performance

### Frontend Implementation

#### 1. LeadImport Component (`/client/src/components/lead-import/LeadImport.tsx`)
- Drag-and-drop file upload interface
- CSV file preview (first 5 rows)
- Field mapping configuration
- Campaign selection for defaults
- Progress tracking during import
- Import results summary with error reporting

#### 2. useCampaigns Hook (`/client/src/hooks/useCampaigns.ts`)
- Fetches available campaigns for lead assignment
- Provides campaign defaults for imported leads

## Usage Guide

### 1. Preparing Your CSV File
Your CSV file should include headers in the first row. Common fields include:
- Name (full name or first/last name)
- Email
- Phone
- Source (lead origin)
- Campaign
- Any custom fields

Example CSV:
```csv
Name,Email,Phone,Source,Notes
John Doe,john.doe@example.com,555-0123,Website,Interested in premium plan
Jane Smith,jane.smith@example.com,555-0124,Google Ads,Needs follow-up
```

### 2. Importing Leads

1. Navigate to the "Leads" tab in the application
2. Click "Import Leads" button
3. Drag and drop your CSV file or click to select
4. Review the suggested field mappings
5. Adjust mappings if needed (CSV columns → Lead fields)
6. Optionally select a campaign for default values
7. Click "Import Leads" to start the import

### 3. Field Mapping Options
- **Name**: Lead's full name
- **Email**: Email address (validated)
- **Phone**: Phone number
- **Source**: Lead source/origin
- **Campaign**: Campaign name
- **Custom Field**: Stored in metadata object

### 4. Import Process
1. Each lead is validated according to the schema
2. Valid leads are saved to the database
3. Overlord Agent makes routing decisions for each lead
4. Decisions are recorded in the agent_decisions table
5. Failed rows are reported with error messages

## API Examples

### Analyze CSV File
```bash
curl -X POST http://localhost:5000/api/import/analyze \
  -F "file=@leads.csv"
```

Response:
```json
{
  "headers": ["Name", "Email", "Phone", "Source"],
  "previewRows": [...],
  "suggestedMappings": [
    { "csvColumn": "Name", "leadField": "name" },
    { "csvColumn": "Email", "leadField": "email" },
    ...
  ],
  "totalRows": 100
}
```

### Import Leads
```bash
curl -X POST http://localhost:5000/api/import/leads \
  -F "file=@leads.csv" \
  -F 'mappings=[{"csvColumn":"Name","leadField":"name"},...]' \
  -F "campaignId=camp_123"
```

Response:
```json
{
  "total": 100,
  "successful": 95,
  "failed": 5,
  "errors": [
    { "row": 23, "error": "Invalid email format" },
    ...
  ]
}
```

## Error Handling

Common errors and their solutions:
1. **Invalid file type**: Only CSV files are accepted
2. **File too large**: Maximum file size is 10MB
3. **Invalid email**: Email addresses must be valid format
4. **Empty required fields**: Name or email may be required
5. **Duplicate detection**: Future enhancement for duplicate checking

## Future Enhancements

1. **Progress Tracking**: Real-time progress for large imports
2. **Duplicate Detection**: Check for existing leads before import
3. **Undo Import**: Ability to rollback an import
4. **Import Templates**: Save field mappings for reuse
5. **Excel Support**: Support for .xlsx files
6. **Scheduled Imports**: Automatic imports from external sources
7. **Import History**: View past imports and their results

## Integration with Lead Flow

After import, leads automatically flow through the system:
1. Overlord Agent evaluates each lead
2. Assigns appropriate channel (email/SMS/chat)
3. Creates routing decision record
4. Lead appears in appropriate agent queue
5. Agents begin outreach based on routing

This ensures imported leads are immediately processed according to your campaign rules and agent availability.

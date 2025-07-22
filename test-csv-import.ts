import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import { parse } from 'csv-parse';
import { Readable } from 'stream';

const app = express();
app.use(express.json());

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept common CSV MIME types and check by extension
    const validMimeTypes = [
      'text/csv',
      'application/csv',
      'application/vnd.ms-excel',
      'text/plain',
      'text/x-csv',
      'application/x-csv'
    ];
    
    const fileExtension = file.originalname.toLowerCase().split('.').pop();
    
    if (validMimeTypes.includes(file.mimetype) || fileExtension === 'csv') {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// Test CSV analyze endpoint
app.post('/api/import/analyze', upload.single('file'), async (req, res) => {
  console.log('📁 CSV Analysis Request Received');
  console.log('File:', req.file ? req.file.originalname : 'No file');
  
  try {
    if (!req.file) {
      console.log('❌ No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('📊 Analyzing file:', req.file.originalname);
    console.log('File size:', req.file.size, 'bytes');
    console.log('MIME type:', req.file.mimetype);

    const csvContent = req.file.buffer.toString('utf-8');
    console.log('Content preview:', csvContent.substring(0, 200));
    
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      console.log('❌ Empty CSV file');
      return res.status(400).json({ error: 'Empty CSV file' });
    }

    // Parse headers
    const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
    console.log('📋 Headers found:', headers);
    
    // Parse first few rows for preview
    const previewRows = [];
    const parser = parse({
      columns: headers,
      skip_empty_lines: true,
      trim: true,
      from_line: 2,
      to_line: 6 // Preview first 5 data rows
    });

    const stream = Readable.from(lines.slice(1).join('\n'));
    
    stream.pipe(parser)
      .on('data', (row) => {
        previewRows.push(row);
      })
      .on('end', () => {
        console.log('✅ Parsed preview rows:', previewRows.length);
        
        // Suggest field mappings based on header names
        const suggestedMappings = headers.map(header => {
          const lowerHeader = header.toLowerCase();
          let leadField = '';
          
          if (lowerHeader.includes('name') || lowerHeader === 'full name' || lowerHeader === 'fullname') {
            leadField = 'name';
          } else if (lowerHeader.includes('email') || lowerHeader.includes('e-mail')) {
            leadField = 'email';
          } else if (lowerHeader.includes('phone') || lowerHeader.includes('tel') || lowerHeader.includes('mobile')) {
            leadField = 'phone';
          } else if (lowerHeader.includes('source') || lowerHeader.includes('utm_source')) {
            leadField = 'source';
          } else if (lowerHeader.includes('campaign') || lowerHeader.includes('utm_campaign')) {
            leadField = 'campaign';
          }
          
          return {
            csvColumn: header,
            leadField: leadField || 'metadata'
          };
        });

        console.log('🎯 Suggested mappings:', suggestedMappings);

        res.json({
          headers,
          previewRows,
          suggestedMappings,
          totalRows: lines.length - 1
        });
      })
      .on('error', (error) => {
        console.error('❌ CSV Parse error:', error);
        res.status(400).json({ error: 'Failed to parse CSV: ' + error.message });
      });
  } catch (error) {
    console.error('❌ CSV analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze CSV file' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'CSV Import Test Server' });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('💥 Server error:', error);
  res.status(500).json({ error: 'Internal server error', message: error.message });
});

const port = 5003;
app.listen(port, () => {
  console.log(`🧪 CSV Import Test Server running on http://localhost:${port}`);
  console.log('📁 Test the CSV upload at: POST http://localhost:5003/api/import/analyze');
  console.log('🔧 Use a tool like curl or Postman to test file uploads');
  console.log('');
  console.log('Example curl command:');
  console.log(`curl -X POST -F "file=@your_file.csv" http://localhost:${port}/api/import/analyze`);
});

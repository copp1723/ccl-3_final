import { Router } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse';
import { Readable } from 'stream';
import { nanoid } from 'nanoid';
import { LeadsRepository, CampaignsRepository, AgentDecisionsRepository, ConversationsRepository, CommunicationsRepository } from '../db';
import { z } from 'zod';
import { getOverlordAgent, getAgentByType, getEmailAgent, getSMSAgent, getChatAgent } from '../agents';
import { validate } from '../middleware/validation';

const router = Router();

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

// Lead validation schema
const leadImportSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  source: z.string().optional(),
  campaign: z.string().optional(),
  // Allow additional fields in metadata
}).passthrough();

// Field mapping type
interface FieldMapping {
  csvColumn: string;
  leadField: string;
  defaultValue?: string;
}

// Parse CSV headers to detect field mappings
router.post('/api/import/analyze', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const csvContent = req.file.buffer.toString('utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      return res.status(400).json({ error: 'Empty CSV file' });
    }

    // Parse headers
    const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
    
    // Parse first few rows for preview
    const previewRows: any[] = [];
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
        // Suggest field mappings based on header names
        const suggestedMappings: FieldMapping[] = headers.map(header => {
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

        res.json({
          headers,
          previewRows,
          suggestedMappings,
          totalRows: lines.length - 1
        });
      })
      .on('error', (error) => {
        res.status(400).json({ error: 'Failed to parse CSV: ' + error.message });
      });
  } catch (error) {
    console.error('CSV analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze CSV file' });
  }
});

// Validation schema for import request
const importRequestSchema = z.object({
  mappings: z.string().transform((val) => {
    try {
      const parsed = JSON.parse(val);
      if (!Array.isArray(parsed)) throw new Error('Mappings must be an array');
      return parsed;
    } catch {
      throw new Error('Invalid mappings format');
    }
  }),
  campaignId: z.string().optional()
});

// Import leads with field mappings
router.post('/api/import/leads', 
  upload.single('file'), 
  async (req, res, next) => {
    // Manual validation since multer handles the request
    try {
      const validationResult = importRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: validationResult.error.errors 
        });
      }
      req.body = validationResult.data;
      next();
    } catch (error) {
      next(error);
    }
  },
  async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { mappings, campaignId } = req.body;

    const fieldMappings: FieldMapping[] = mappings;
    const csvContent = req.file.buffer.toString('utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      return res.status(400).json({ error: 'Empty CSV file' });
    }

    // Get campaign data if specified
    let campaign = null;
    if (campaignId) {
      campaign = await CampaignsRepository.findById(campaignId);
    }

    // Parse headers
    const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
    
    // Import results
    const results = {
      total: 0,
      successful: 0,
      failed: 0,
      errors: [] as any[]
    };

    // Parse CSV
    const parser = parse({
      columns: headers,
      skip_empty_lines: true,
      trim: true,
      from_line: 2
    });

    const overlord = getOverlordAgent();
    const leads: any[] = [];

    const stream = Readable.from(lines.slice(1).join('\n'));
    
    await new Promise((resolve, reject) => {
      stream.pipe(parser)
        .on('data', async (row) => {
          results.total++;
          
          try {
            // Map CSV columns to lead fields
            const leadData: any = {
              id: nanoid(),
              status: 'new',
              qualificationScore: 0,
              createdAt: new Date(),
              updatedAt: new Date(),
              metadata: {}
            };

            // Apply field mappings
            fieldMappings.forEach(mapping => {
              const value = row[mapping.csvColumn] || mapping.defaultValue || '';
              
              if (mapping.leadField === 'metadata') {
                // Store unmapped fields in metadata
                leadData.metadata[mapping.csvColumn] = value;
              } else {
                leadData[mapping.leadField] = value;
              }
            });

            // Apply campaign defaults if available
            if (campaign) {
              leadData.campaignId = campaign.id;
              leadData.source = leadData.source || campaign.defaultSource;
            }

            // Validate lead data
            const validatedLead = leadImportSchema.parse(leadData);
            
            // Store for batch processing
            leads.push(validatedLead);
            
          } catch (error: any) {
            results.failed++;
            results.errors.push({
              row: results.total,
              error: error.message
            });
          }
        })
        .on('end', async () => {
          // Batch insert leads
          try {
            for (const lead of leads) {
              const savedLead = await LeadsRepository.create(lead);
              
              // Make Overlord decision for lead routing
              const decision = await overlord.makeDecision({ lead: savedLead, campaign });
              
              // Record the decision
              await AgentDecisionsRepository.create(
                savedLead.id,
                'overlord',
                decision.action,
                decision.reasoning,
                decision.data
              );

              // Process the lead if a channel was assigned
              if (decision.action === 'assign_channel' && decision.data.channel) {
                const channel = decision.data.channel;
                console.log(`📨 Processing ${channel} for ${savedLead.name}`);
                
                // Generate initial message
                let messageContent = '';
                let subject = '';
                
                if (channel === 'email') {
                  const emailAgent = getEmailAgent();
                  messageContent = await emailAgent.generateInitialEmail(
                    { lead: savedLead, campaign },
                    decision.data.initialMessageFocus || 'general inquiry'
                  );
                  subject = `Thank you for your interest${savedLead.campaign ? ` in ${savedLead.campaign}` : ''}`;
                } else if (channel === 'sms') {
                  const smsAgent = getSMSAgent();
                  messageContent = await smsAgent.generateInitialSMS(
                    { lead: savedLead, campaign },
                    decision.data.initialMessageFocus || 'general inquiry'
                  );
                } else if (channel === 'chat') {
                  const chatAgent = getChatAgent();
                  messageContent = await chatAgent.generateInitialMessage(
                    { lead: savedLead, campaign },
                    decision.data.initialMessageFocus || 'general inquiry'
                  );
                }
                
                // Save conversation
                const conversation = await ConversationsRepository.create(
                  savedLead.id,
                  channel,
                  channel as any
                );
                
                // Add the initial message
                await ConversationsRepository.addMessage(conversation.id, {
                  role: 'agent',
                  content: messageContent,
                  timestamp: new Date().toISOString()
                });
                
                // Send the message
                let sendStatus = 'pending';
                let externalId = null;
                
                try {
                  if (channel === 'email' && savedLead.email) {
                    const emailAgent = getEmailAgent();
                    const emailResult = await emailAgent.sendEmail(
                      savedLead.email,
                      subject,
                      messageContent
                    );
                    externalId = emailResult.id;
                    sendStatus = 'sent';
                    console.log(`✅ Email sent to ${savedLead.email}`);
                  } else if (channel === 'sms' && savedLead.phone) {
                    const smsAgent = getSMSAgent();
                    const smsResult = await smsAgent.sendSMS(savedLead.phone, messageContent);
                    externalId = smsResult.sid;
                    sendStatus = 'sent';
                    console.log(`✅ SMS sent to ${savedLead.phone}`);
                  } else if (channel === 'chat') {
                    sendStatus = 'waiting_for_user';
                    console.log(`✅ Chat prepared for ${savedLead.name}`);
                  }
                  
                  // Record communication
                  if (externalId || channel === 'chat') {
                    await CommunicationsRepository.create(
                      savedLead.id,
                      channel,
                      'outbound',
                      messageContent,
                      sendStatus,
                      externalId,
                      { conversationId: conversation.id }
                    );
                  }
                } catch (sendError) {
                  console.error(`Failed to send ${channel}:`, sendError);
                  sendStatus = 'failed';
                  
                  await CommunicationsRepository.create(
                    savedLead.id,
                    channel,
                    'outbound',
                    messageContent,
                    'failed',
                    null,
                    { error: sendError.message, conversationId: conversation.id }
                  );
                }
                
                // Update qualification score
                await LeadsRepository.updateQualificationScore(savedLead.id, 10);
              }

              results.successful++;
            }
          } catch (error: any) {
            console.error('Batch insert error:', error);
            results.errors.push({
              error: 'Failed to save leads: ' + error.message
            });
          }
          
          resolve(results);
        })
        .on('error', (error) => {
          reject(error);
        });
    });

    res.json(results);
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: 'Failed to import leads' });
  }
});

// Get import status (for progress tracking)
router.get('/api/import/status/:importId', async (req, res) => {
  // TODO: Implement import job tracking for large files
  // For now, return a simple response
  res.json({
    importId: req.params.importId,
    status: 'completed',
    progress: 100
  });
});

export default router;

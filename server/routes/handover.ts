import { Router, Request, Response } from 'express';
import { HandoverService } from '../services/handover-service';
import { LeadDossierService } from '../services/lead-dossier-service';
import { conversationsRepository as ConversationsRepository } from '../db/wrapped-repositories';
import { leadsRepository as LeadsRepository } from '../db/wrapped-repositories';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Trigger manual handover for a conversation
 * POST /api/handover/trigger
 */
router.post('/trigger', async (req: Request, res: Response) => {
  try {
    const { conversationId, reason, humanAgentId } = req.body;

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        error: 'conversationId is required'
      });
    }

    // Verify conversation exists
    const conversation = await ConversationsRepository.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    // Execute handover with dossier generation
    const success = await HandoverService.executeHandover(
      conversationId,
      reason || 'Manual handover requested',
      humanAgentId
    );

    if (success) {
      res.json({
        success: true,
        message: 'Handover executed successfully with comprehensive dossier',
        conversationId
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to execute handover'
      });
    }

  } catch (error) {
    logger.error('Error triggering handover', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Evaluate handover criteria for a conversation without executing
 * GET /api/handover/evaluate/:conversationId
 */
router.get('/evaluate/:conversationId', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;

    // Verify conversation exists
    const conversation = await ConversationsRepository.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    // Evaluate handover criteria
    const evaluation = await HandoverService.evaluateHandover(conversationId);

    res.json({
      success: true,
      evaluation,
      conversationId
    });

  } catch (error) {
    logger.error('Error evaluating handover', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Generate dossier preview for a lead without executing handover
 * GET /api/handover/dossier/preview/:leadId
 */
router.get('/dossier/preview/:leadId', async (req: Request, res: Response) => {
  try {
    const { leadId } = req.params;

    // Verify lead exists
    const lead = await LeadsRepository.findById(leadId);
    if (!lead) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found'
      });
    }

    // Get most recent conversation for evaluation
    const conversations = await ConversationsRepository.findByLeadId(leadId);
    if (conversations.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No conversations found for this lead'
      });
    }

    const mostRecentConversation = conversations[0];
    
    // Generate handover evaluation
    const evaluation = await HandoverService.evaluateHandover(mostRecentConversation.id);
    
    // Generate dossier
    const dossier = await LeadDossierService.generateDossier(
      leadId,
      evaluation,
      mostRecentConversation.id
    );

    // Format for human consumption
    const formattedDossier = LeadDossierService.formatDossierForHandover(dossier);

    res.json({
      success: true,
      dossier,
      formattedDossier,
      evaluation,
      leadId
    });

  } catch (error) {
    logger.error('Error generating dossier preview', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get formatted dossier as HTML for email preview
 * GET /api/handover/dossier/email-preview/:leadId
 */
router.get('/dossier/email-preview/:leadId', async (req: Request, res: Response) => {
  try {
    const { leadId } = req.params;

    // Verify lead exists
    const lead = await LeadsRepository.findById(leadId);
    if (!lead) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found'
      });
    }

    // Get most recent conversation for evaluation
    const conversations = await ConversationsRepository.findByLeadId(leadId);
    if (conversations.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No conversations found for this lead'
      });
    }

    const mostRecentConversation = conversations[0];
    
    // Generate handover evaluation
    const evaluation = await HandoverService.evaluateHandover(mostRecentConversation.id);
    
    // Generate dossier
    const dossier = await LeadDossierService.generateDossier(
      leadId,
      evaluation,
      mostRecentConversation.id
    );

    // Generate HTML email content
    const { HandoverEmailService } = await import('../services/handover-email-service');
    const emailHtml = HandoverEmailService.generateEmailHtml(
      `${lead.firstName || ''} ${lead.lastName || ''}`.trim(),
      dossier,
      mostRecentConversation.id
    );

    // Return HTML for preview
    res.setHeader('Content-Type', 'text/html');
    res.send(emailHtml);

  } catch (error) {
    logger.error('Error generating email preview', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get cross-channel context for a lead
 * GET /api/handover/context/:leadId
 */
router.get('/context/:leadId', async (req: Request, res: Response) => {
  try {
    const { leadId } = req.params;

    // Verify lead exists
    const lead = await LeadsRepository.findById(leadId);
    if (!lead) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found'
      });
    }

    // Get cross-channel context
    const context = await HandoverService.getCrossChannelContext(leadId);

    res.json({
      success: true,
      context,
      leadId
    });

  } catch (error) {
    logger.error('Error getting cross-channel context', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Test endpoint to simulate a complete handover workflow
 * POST /api/handover/test/:leadId
 */
router.post('/test/:leadId', async (req: Request, res: Response) => {
  try {
    const { leadId } = req.params;
    const { simulateHighScore = false } = req.body;

    // Verify lead exists
    const lead = await LeadsRepository.findById(leadId);
    if (!lead) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found'
      });
    }

    // Get or create a conversation for testing
    let conversations = await ConversationsRepository.findByLeadId(leadId);
    if (conversations.length === 0) {
      // Create a test conversation
      const conversation = await ConversationsRepository.create(
        leadId,
        'email',
        'email'
      );
      
      // Add some test messages
      await ConversationsRepository.addMessage(conversation.id, {
        role: 'agent',
        content: 'Hello! I see you\'re interested in our services. How can I help you today?',
        timestamp: new Date().toISOString()
      });
      
      await ConversationsRepository.addMessage(conversation.id, {
        role: 'lead',
        content: 'Yes, I\'m looking for a solution for my business. Can you tell me about pricing?',
        timestamp: new Date().toISOString()
      });
      
      await ConversationsRepository.addMessage(conversation.id, {
        role: 'agent',
        content: 'I\'d be happy to discuss pricing with you. Can you tell me a bit about your business needs?',
        timestamp: new Date().toISOString()
      });
      
      await ConversationsRepository.addMessage(conversation.id, {
        role: 'lead',
        content: 'We have about 50 employees and need a solution that can scale. Budget is around $10k annually.',
        timestamp: new Date().toISOString()
      });

      // Update qualification score if simulating high score
      if (simulateHighScore) {
        await ConversationsRepository.updateQualificationScore(conversation.id, 8);
      }
      
      conversations = [conversation];
    }

    const conversation = conversations[0];

    // Evaluate handover
    const evaluation = await HandoverService.evaluateHandover(conversation.id);
    
    // Generate dossier
    const dossier = await LeadDossierService.generateDossier(
      leadId,
      evaluation,
      conversation.id
    );

    // Format dossier
    const formattedDossier = LeadDossierService.formatDossierForHandover(dossier);

    res.json({
      success: true,
      message: 'Test handover workflow completed',
      leadId,
      conversationId: conversation.id,
      evaluation,
      dossier,
      formattedDossier,
      testMode: true
    });

  } catch (error) {
    logger.error('Error running test handover', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;
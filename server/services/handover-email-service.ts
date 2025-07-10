import { LeadDossier } from './lead-dossier-service';
import { logger } from '../utils/logger';

export interface HandoverRecipient {
  email: string;
  name: string;
  role: string;
  priority: 'high' | 'medium' | 'low';
}

export class HandoverEmailService {
  /**
   * Send handover email with dossier to human representatives
   */
  static async sendHandoverNotification(
    leadName: string,
    dossier: LeadDossier,
    recipients: HandoverRecipient[],
    conversationId: string
  ): Promise<boolean> {
    try {
      logger.info('Sending handover notification emails', {
        leadName,
        conversationId,
        recipientCount: recipients.length
      });

      // Sort recipients by priority
      const sortedRecipients = recipients.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });

      // Generate email content
      const emailSubject = this.generateEmailSubject(leadName, dossier);
      const emailHtml = this.generateEmailHtml(leadName, dossier, conversationId);
      const emailText = this.generateEmailText(leadName, dossier, conversationId);

      // Send emails to each recipient
      const emailPromises = sortedRecipients.map(recipient => 
        this.sendEmailToRecipient(recipient, emailSubject, emailHtml, emailText)
      );

      const results = await Promise.allSettled(emailPromises);
      
      // Check if all emails were sent successfully
      const successCount = results.filter(result => result.status === 'fulfilled').length;
      const failureCount = results.length - successCount;

      if (failureCount > 0) {
        logger.warn('Some handover emails failed to send', {
          conversationId,
          successCount,
          failureCount,
          totalRecipients: recipients.length
        });
      }

      logger.info('Handover notification emails sent', {
        conversationId,
        successCount,
        failureCount,
        totalRecipients: recipients.length
      });

      return failureCount === 0; // Return true only if all emails succeeded

    } catch (error) {
      logger.error('Error sending handover notification emails', {
        conversationId,
        error: (error as Error).message
      });
      return false;
    }
  }

  /**
   * Generate email subject line
   */
  private static generateEmailSubject(leadName: string, dossier: LeadDossier): string {
    const urgencyPrefix = dossier.handoverTrigger.urgency === 'high' ? '🚨 URGENT' : 
                         dossier.handoverTrigger.urgency === 'medium' ? '⚡ PRIORITY' : '📋';
    
    return `${urgencyPrefix} Lead Handover: ${leadName} (Score: ${dossier.handoverTrigger.score}/10)`;
  }

  /**
   * Generate HTML email content
   */
  static generateEmailHtml(
    leadName: string,
    dossier: LeadDossier,
    conversationId: string
  ): string {
    const { leadSnapshot, communicationSummary, profileAnalysis, handoverTrigger, recommendations } = dossier;
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Lead Handover: ${leadName}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .urgency-high { border-left: 4px solid #dc3545; }
        .urgency-medium { border-left: 4px solid #ffc107; }
        .urgency-low { border-left: 4px solid #28a745; }
        .section { background: #f8f9fa; padding: 15px; margin: 15px 0; border-radius: 5px; border-left: 4px solid #007bff; }
        .section h3 { margin-top: 0; color: #007bff; }
        .lead-info { background: #e3f2fd; border-left-color: #2196f3; }
        .communication { background: #f3e5f5; border-left-color: #9c27b0; }
        .profile { background: #e8f5e8; border-left-color: #4caf50; }
        .recommendations { background: #fff3e0; border-left-color: #ff9800; }
        .highlight { background: #ffeb3b; padding: 2px 4px; border-radius: 3px; }
        .score { font-size: 1.2em; font-weight: bold; color: #007bff; }
        ul { padding-left: 20px; }
        li { margin: 5px 0; }
        .cta-button { background: #007bff; color: white; padding: 12px 24px; border: none; border-radius: 5px; text-decoration: none; display: inline-block; margin: 10px 0; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 0.9em; color: #6c757d; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🤝 Lead Handover Notification</h1>
        <p><strong>Lead:</strong> ${leadName}</p>
        <p><strong>Conversation ID:</strong> ${conversationId}</p>
        <p><strong>Handover Time:</strong> ${new Date().toLocaleString()}</p>
    </div>

    <div class="section urgency-${handoverTrigger.urgency}">
        <h3>🚨 Handover Summary</h3>
        <p><strong>Reason:</strong> ${handoverTrigger.reason}</p>
        <p><strong>Qualification Score:</strong> <span class="score">${handoverTrigger.score}/10</span></p>
        <p><strong>Urgency:</strong> <span class="highlight">${handoverTrigger.urgency.toUpperCase()}</span></p>
        <p><strong>Context:</strong> ${dossier.context}</p>
    </div>

    <div class="section lead-info">
        <h3>👤 Lead Information</h3>
        <ul>
            <li><strong>Name:</strong> ${leadSnapshot.name}</li>
            <li><strong>Email:</strong> ${leadSnapshot.contactInfo.email || 'Not provided'}</li>
            <li><strong>Phone:</strong> ${leadSnapshot.contactInfo.phone || 'Not provided'}</li>
            <li><strong>Origin:</strong> ${leadSnapshot.leadOrigin}</li>
            <li><strong>Purchase Timing:</strong> ${leadSnapshot.purchaseTiming}</li>
            ${leadSnapshot.interests.length > 0 ? `<li><strong>Interests:</strong> ${leadSnapshot.interests.join(', ')}</li>` : ''}
        </ul>
    </div>

    <div class="section communication">
        <h3>💬 Communication Analysis</h3>
        <h4>Interaction Highlights:</h4>
        <ul>
            ${communicationSummary.interactionHighlights.map(highlight => `<li>${highlight}</li>`).join('')}
        </ul>
        <h4>Tone & Style:</h4>
        <ul>
            ${communicationSummary.toneAndStyle.map(style => `<li>${style}</li>`).join('')}
        </ul>
        <h4>Engagement Pattern:</h4>
        <ul>
            ${communicationSummary.engagementPattern.map(pattern => `<li>${pattern}</li>`).join('')}
        </ul>
    </div>

    <div class="section profile">
        <h3>🎯 Lead Profile</h3>
        <h4>Buyer Type:</h4>
        <ul>
            ${profileAnalysis.buyerType.map(type => `<li>${type}</li>`).join('')}
        </ul>
        <h4>Key Hooks to Emphasize:</h4>
        <ul>
            ${profileAnalysis.keyHooks.map(hook => `<li>${hook}</li>`).join('')}
        </ul>
    </div>

    <div class="section recommendations">
        <h3>📋 Recommended Actions</h3>
        <p><strong>Approach Strategy:</strong> ${recommendations.approachStrategy}</p>
        <p><strong>Timeline:</strong> ${recommendations.timeline}</p>
        
        <h4>Next Steps:</h4>
        <ul>
            ${recommendations.nextSteps.map(step => `<li>${step}</li>`).join('')}
        </ul>
        
        ${recommendations.urgentActions.length > 0 ? `
        <h4>🚨 Urgent Actions:</h4>
        <ul>
            ${recommendations.urgentActions.map(action => `<li><strong>${action}</strong></li>`).join('')}
        </ul>
        ` : ''}
    </div>

    <div style="text-align: center; margin: 30px 0;">
        <a href="#" class="cta-button">Access Lead in Dashboard</a>
    </div>

    <div class="footer">
        <p>This handover was automatically generated by the CCL-3 AI Lead Management System.</p>
        <p>For technical support or questions about this handover, please contact the development team.</p>
    </div>
</body>
</html>
    `;
  }

  /**
   * Generate plain text email content
   */
  private static generateEmailText(
    leadName: string,
    dossier: LeadDossier,
    conversationId: string
  ): string {
    const formattedDossier = `
LEAD HANDOVER NOTIFICATION
==========================

Lead: ${leadName}
Conversation ID: ${conversationId}
Handover Time: ${new Date().toLocaleString()}

${dossier.context}

HANDOVER TRIGGER
================
Reason: ${dossier.handoverTrigger.reason}
Qualification Score: ${dossier.handoverTrigger.score}/10
Urgency: ${dossier.handoverTrigger.urgency.toUpperCase()}

LEAD INFORMATION
================
Name: ${dossier.leadSnapshot.name}
Email: ${dossier.leadSnapshot.contactInfo.email || 'Not provided'}
Phone: ${dossier.leadSnapshot.contactInfo.phone || 'Not provided'}
Origin: ${dossier.leadSnapshot.leadOrigin}
Purchase Timing: ${dossier.leadSnapshot.purchaseTiming}
${dossier.leadSnapshot.interests.length > 0 ? `Interests: ${dossier.leadSnapshot.interests.join(', ')}` : ''}

COMMUNICATION SUMMARY
=====================
Interaction Highlights:
${dossier.communicationSummary.interactionHighlights.map(h => `• ${h}`).join('\n')}

Tone & Style:
${dossier.communicationSummary.toneAndStyle.map(s => `• ${s}`).join('\n')}

Engagement Pattern:
${dossier.communicationSummary.engagementPattern.map(p => `• ${p}`).join('\n')}

LEAD PROFILE
============
Buyer Type:
${dossier.profileAnalysis.buyerType.map(t => `• ${t}`).join('\n')}

Key Hooks to Emphasize:
${dossier.profileAnalysis.keyHooks.map(h => `• ${h}`).join('\n')}

RECOMMENDED ACTIONS
===================
Approach Strategy: ${dossier.recommendations.approachStrategy}
Timeline: ${dossier.recommendations.timeline}

Next Steps:
${dossier.recommendations.nextSteps.map(s => `• ${s}`).join('\n')}

${dossier.recommendations.urgentActions.length > 0 ? `
URGENT ACTIONS:
${dossier.recommendations.urgentActions.map(a => `• ${a}`).join('\n')}
` : ''}

---
This handover was automatically generated by the CCL-3 AI Lead Management System.
    `;

    return formattedDossier.trim();
  }

  /**
   * Send email to individual recipient
   * This is a placeholder that would integrate with your email service (Mailgun)
   */
  private static async sendEmailToRecipient(
    recipient: HandoverRecipient,
    subject: string,
    htmlContent: string,
    textContent: string
  ): Promise<boolean> {
    try {
      // TODO: Integrate with Mailgun or your email service
      // This is where you would use your email service to send the actual email
      
      logger.info('Sending handover email', {
        recipient: recipient.email,
        recipientName: recipient.name,
        subject
      });

      // Simulated email sending - replace with actual email service integration
      // Example Mailgun integration:
      /*
      const mailgun = require('mailgun-js')({
        apiKey: process.env.MAILGUN_API_KEY,
        domain: process.env.MAILGUN_DOMAIN
      });

      const emailData = {
        from: 'CCL-3 System <noreply@yourcompany.com>',
        to: `${recipient.name} <${recipient.email}>`,
        subject: subject,
        text: textContent,
        html: htmlContent
      };

      await mailgun.messages().send(emailData);
      */

      // For now, just log the email content
      logger.info('Handover email content generated', {
        recipient: recipient.email,
        subject,
        contentLength: htmlContent.length
      });

      return true;

    } catch (error) {
      logger.error('Failed to send handover email', {
        recipient: recipient.email,
        error: (error as Error).message
      });
      return false;
    }
  }

  /**
   * Create Slack notification for urgent handovers
   */
  static async sendSlackNotification(
    leadName: string,
    dossier: LeadDossier,
    conversationId: string
  ): Promise<boolean> {
    // Only send Slack notifications for high urgency handovers
    if (dossier.handoverTrigger.urgency !== 'high') {
      return true;
    }

    try {
      // TODO: Integrate with Slack webhook
      const slackMessage = {
        text: `🚨 URGENT Lead Handover: ${leadName}`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*🚨 URGENT Lead Handover*\n*Lead:* ${leadName}\n*Score:* ${dossier.handoverTrigger.score}/10\n*Reason:* ${dossier.handoverTrigger.reason}`
            }
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Recommended Action:* ${dossier.recommendations.approachStrategy}\n*Timeline:* ${dossier.recommendations.timeline}`
            }
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "View Lead Dashboard"
                },
                url: `${process.env.FRONTEND_URL}/leads/${conversationId}`
              }
            ]
          }
        ]
      };

      logger.info('Slack notification sent for urgent handover', {
        leadName,
        conversationId,
        urgency: dossier.handoverTrigger.urgency
      });

      return true;

    } catch (error) {
      logger.error('Failed to send Slack notification', {
        conversationId,
        error: (error as Error).message
      });
      return false;
    }
  }
}
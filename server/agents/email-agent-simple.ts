// server/agents/email-agent-simple.ts
export class EmailAgentSimple {
  async processLead(lead: any, decision: any) {
    const message = this.generateMessage(lead, decision);
    return this.sendEmail(lead.email, message.subject, message.body);
  }
  
  generateMessage(lead: any, decision: any) {
    // Simple template-based generation
    const templates = {
      general: {
        subject: `Thank you for your interest`,
        body: `Hi ${lead.firstName || ''} ${lead.lastName || ''},\n\nThank you for reaching out. We'll be in touch soon.\n\nBest regards`
      },
      qualified: {
        subject: `Welcome ${lead.firstName || ''} ${lead.lastName || ''}!`,
        body: `Hi ${lead.firstName || ''} ${lead.lastName || ''},\n\nWe're excited to connect with you. Our team will reach out shortly.\n\nBest regards`
      }
    };
    
    const template = lead.qualificationScore > 50 ? templates.qualified : templates.general;
    return template;
  }
  
  async sendEmail(to: string, subject: string, body: string) {
    const response = await fetch(`https://api.mailgun.net/v3/${process.env.MAILGUN_DOMAIN}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString('base64')}`
      },
      body: new URLSearchParams({
        from: process.env.MAILGUN_FROM_EMAIL || 'noreply@example.com',
        to,
        subject,
        text: body
      })
    });
    
    return response.json();
  }
}

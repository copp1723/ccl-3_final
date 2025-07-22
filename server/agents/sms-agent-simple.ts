// server/agents/sms-agent-simple.ts
export class SMSAgentSimple {
  async processLead(lead: any, decision: any) {
    const message = this.generateMessage(lead);
    return this.sendSMS(lead.phone, message);
  }
  
  generateMessage(lead: any) {
    return `Hi ${lead.firstName || ''} ${lead.lastName || ''}, thanks for your interest! We'll contact you soon. Reply STOP to opt out.`;
  }
  
  async sendSMS(to: string, body: string) {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          From: process.env.TWILIO_PHONE_NUMBER || '',
          To: to,
          Body: body
        })
      }
    );
    
    return response.json();
  }
}

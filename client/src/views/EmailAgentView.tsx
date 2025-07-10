import { EmailAgent } from '@/components/email-agent';

export function EmailAgentView() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Email Agent</h2>
        <p className="text-gray-600">Configure and monitor email campaigns</p>
      </div>
      <EmailAgent />
    </div>
  );
}
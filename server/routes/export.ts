import { Router } from 'express';
import { 
  LeadsRepository, 
  CampaignsRepository,
  CommunicationsRepository,
  ConversationsRepository,
  EmailTemplatesRepository,
  AgentConfigurationsRepository,
  AuditLogRepository
} from '../db';
import { authenticate, authorize } from '../middleware/auth';
import { auditExport } from '../middleware/audit';
import { Parser } from 'json2csv';
import ExcelJS from 'exceljs';

const router = Router();

// Export leads
router.get('/api/export/leads',
  authenticate,
  auditExport('leads'),
  async (req, res) => {
    try {
      const { format = 'csv', status, source, campaign, startDate, endDate } = req.query;
      
      // Get leads with filters
      const leads = await LeadsRepository.findAll({
        status: status as any,
        source: source as string,
        campaign: campaign as string
      });
      
      // Filter by date if provided
      let filteredLeads = leads;
      if (startDate || endDate) {
        filteredLeads = leads.filter(lead => {
          const leadDate = lead.createdAt.getTime();
          if (startDate && leadDate < new Date(startDate as string).getTime()) return false;
          if (endDate && leadDate > new Date(endDate as string).getTime()) return false;
          return true;
        });
      }
      
      if (format === 'csv') {
        const fields = [
          'id', 'name', 'email', 'phone', 'source', 'campaign', 
          'status', 'assignedChannel', 'qualificationScore', 
          'boberdooId', 'createdAt', 'updatedAt'
        ];
        
        const parser = new Parser({ fields });
        const csv = parser.parse(filteredLeads);
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="leads_export.csv"');
        res.send(csv);
      } else if (format === 'excel') {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Leads');
        
        // Add headers
        worksheet.columns = [
          { header: 'ID', key: 'id', width: 20 },
          { header: 'Name', key: 'name', width: 25 },
          { header: 'Email', key: 'email', width: 30 },
          { header: 'Phone', key: 'phone', width: 20 },
          { header: 'Source', key: 'source', width: 15 },
          { header: 'Campaign', key: 'campaign', width: 25 },
          { header: 'Status', key: 'status', width: 15 },
          { header: 'Channel', key: 'assignedChannel', width: 10 },
          { header: 'Score', key: 'qualificationScore', width: 10 },
          { header: 'Boberdoo ID', key: 'boberdooId', width: 20 },
          { header: 'Created', key: 'createdAt', width: 20 },
          { header: 'Updated', key: 'updatedAt', width: 20 }
        ];
        
        // Add data
        worksheet.addRows(filteredLeads);
        
        // Style header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="leads_export.xlsx"');
        
        await workbook.xlsx.write(res);
      } else {
        res.json({ leads: filteredLeads });
      }
    } catch (error) {
      console.error('Export error:', error);
      res.status(500).json({ error: 'Failed to export leads' });
    }
  }
);

// Export communications
router.get('/api/export/communications',
  authenticate,
  auditExport('communications'),
  async (req, res) => {
    try {
      const { format = 'csv', leadId, channel, status, limit } = req.query;
      
      let communications;
      if (leadId) {
        communications = await CommunicationsRepository.findByLeadId(leadId as string);
      } else {
        communications = await CommunicationsRepository.getRecent(
          limit ? parseInt(limit as string) : 1000
        );
      }
      
      // Apply filters
      if (channel) {
        communications = communications.filter(c => c.channel === channel);
      }
      if (status) {
        communications = communications.filter(c => c.status === status);
      }
      
      if (format === 'csv') {
        const fields = [
          'id', 'leadId', 'channel', 'direction', 'status',
          'externalId', 'createdAt'
        ];
        
        const parser = new Parser({ fields });
        const csv = parser.parse(communications);
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="communications_export.csv"');
        res.send(csv);
      } else {
        res.json({ communications });
      }
    } catch (error) {
      console.error('Export error:', error);
      res.status(500).json({ error: 'Failed to export communications' });
    }
  }
);

// Export campaigns
router.get('/api/export/campaigns',
  authenticate,
  authorize('admin', 'manager'),
  auditExport('campaigns'),
  async (req, res) => {
    try {
      const { format = 'csv', active } = req.query;
      
      const campaigns = active === 'true'
        ? await CampaignsRepository.findActive()
        : await CampaignsRepository.findAll();
      
      if (format === 'csv') {
        const flattenedCampaigns = campaigns.map(c => ({
          id: c.id,
          name: c.name,
          goals: c.goals.join('; '),
          active: c.active,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt
        }));
        
        const parser = new Parser();
        const csv = parser.parse(flattenedCampaigns);
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="campaigns_export.csv"');
        res.send(csv);
      } else {
        res.json({ campaigns });
      }
    } catch (error) {
      console.error('Export error:', error);
      res.status(500).json({ error: 'Failed to export campaigns' });
    }
  }
);

// Export audit logs (admin only)
router.get('/api/export/audit-logs',
  authenticate,
  authorize('admin'),
  auditExport('audit_logs'),
  async (req, res) => {
    try {
      const { format = 'csv', userId, resource, action, startDate, endDate } = req.query;
      
      const logs = await AuditLogRepository.findAll({
        userId: userId as string,
        resource: resource as string,
        action: action as any,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: 10000
      });
      
      if (format === 'csv') {
        const fields = [
          'id', 'userId', 'action', 'resource', 'resourceId',
          'ipAddress', 'userAgent', 'createdAt'
        ];
        
        const parser = new Parser({ fields });
        const csv = parser.parse(logs);
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="audit_logs_export.csv"');
        res.send(csv);
      } else {
        res.json({ logs });
      }
    } catch (error) {
      console.error('Export error:', error);
      res.status(500).json({ error: 'Failed to export audit logs' });
    }
  }
);

// Export analytics report
router.get('/api/export/analytics-report',
  authenticate,
  authorize('admin', 'manager'),
  auditExport('analytics_report'),
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();
      
      // Get comprehensive analytics
      const { AnalyticsRepository } = await import('../db');
      
      const [
        dashboardStats,
        leadAnalytics,
        campaignPerformance,
        agentPerformance,
        communicationAnalytics,
        funnelAnalysis
      ] = await Promise.all([
        AnalyticsRepository.getDashboardStats(start, end),
        AnalyticsRepository.getLeadAnalytics({ startDate: start, endDate: end }),
        AnalyticsRepository.getCampaignPerformance(),
        AnalyticsRepository.getAgentPerformance(start, end),
        AnalyticsRepository.getCommunicationAnalytics({ startDate: start, endDate: end }),
        AnalyticsRepository.getFunnelAnalysis(start, end)
      ]);
      
      // Create Excel workbook with multiple sheets
      const workbook = new ExcelJS.Workbook();
      
      // Summary sheet
      const summarySheet = workbook.addWorksheet('Summary');
      summarySheet.addRow(['Analytics Report']);
      summarySheet.addRow(['Period:', `${start.toDateString()} - ${end.toDateString()}`]);
      summarySheet.addRow([]);
      summarySheet.addRow(['Total Leads:', dashboardStats.totalLeads]);
      summarySheet.addRow(['Active Campaigns:', dashboardStats.activeCampaigns]);
      summarySheet.addRow(['Conversion Rate:', `${dashboardStats.conversionRate}%`]);
      
      // Lead Analytics sheet
      const leadSheet = workbook.addWorksheet('Lead Analytics');
      leadSheet.columns = [
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Count', key: 'count', width: 10 }
      ];
      leadSheet.addRows(leadAnalytics.leadsOverTime);
      
      // Campaign Performance sheet
      const campaignSheet = workbook.addWorksheet('Campaign Performance');
      campaignSheet.columns = [
        { header: 'Campaign', key: 'campaignId', width: 20 },
        { header: 'Total Leads', key: 'totalLeads', width: 15 },
        { header: 'Qualified', key: 'qualifiedLeads', width: 15 },
        { header: 'Conversions', key: 'conversions', width: 15 },
        { header: 'Avg Score', key: 'avgQualificationScore', width: 15 }
      ];
      campaignSheet.addRows(campaignPerformance);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="analytics_report.xlsx"');
      
      await workbook.xlsx.write(res);
    } catch (error) {
      console.error('Export error:', error);
      res.status(500).json({ error: 'Failed to export analytics report' });
    }
  }
);

export default router;
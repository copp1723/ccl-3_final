import { Router } from 'express';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { leadsRepository as LeadsRepository } from '../db/wrapped-repositories';
import { authenticate } from '../middleware/auth';
import { auditView } from '../middleware/audit';
import { validateQuery } from '../middleware/validation';

const router = Router();

// Query validation schema
const leadsQuerySchema = z.object({
  limit: z.string().optional().transform(val => val ? parseInt(val) : 50),
  offset: z.string().optional().transform(val => val ? parseInt(val) : 0),
  status: z.enum(['new', 'contacted', 'qualified', 'converted', 'dead']).optional(),
  source: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional()
});

// Get all leads with filtering and pagination
router.get('/',
  // Skip authentication in development for easier testing
  process.env.NODE_ENV === 'development' ? (_req: any, _res: any, next: any) => next() : authenticate,
  validateQuery(leadsQuerySchema),
  auditView('leads_list'),
  async (req, res) => {
    try {
      const { limit, offset, status, source, startDate, endDate, search } = req.query as any;
      
      // Get leads with basic filtering
      const leads = await LeadsRepository.findAll({
        status,
        source,
        limit: Math.min((limit || 50) + (offset || 0), 1000) // Include offset in limit for pagination
      });
      
      // Apply offset manually since repository doesn't support it
      const paginatedLeads = leads.slice(offset || 0, (offset || 0) + (limit || 50));
      
      // Apply additional filters if needed
      let filteredLeads = leads;
      
      // Date filtering
      if (startDate || endDate) {
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;
        
        filteredLeads = paginatedLeads.filter(lead => {
          const leadDate = lead.createdAt;
          if (!leadDate) return false; // Skip leads without creation date
          if (start && leadDate < start) return false;
          if (end && leadDate > end) return false;
          return true;
        });
      } else {
        filteredLeads = paginatedLeads;
      }
      
      // Search filtering
      if (search) {
        const searchTerm = search.toLowerCase();
        filteredLeads = filteredLeads.filter(lead =>
          lead.name?.toLowerCase().includes(searchTerm) ||
          lead.email?.toLowerCase().includes(searchTerm) ||
          lead.phone?.includes(searchTerm) ||
          lead.source?.toLowerCase().includes(searchTerm)
        );
      }
      
      // Get total count using countByStatus for pagination approximation
      const statusCounts = await LeadsRepository.countByStatus();
      const totalCount = status ? (statusCounts[status] || 0) :
        Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
      
      res.json({
        success: true,
        leads: filteredLeads,
        pagination: {
          total: totalCount,
          limit: limit || 50,
          offset: offset || 0,
          pages: Math.ceil(totalCount / (limit || 50))
        }
      });
    } catch (error) {
      console.error('Error fetching leads:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch leads'
      });
    }
  }
);

// Get lead statistics
router.get('/stats',
  authenticate,
  auditView('leads_stats'),
  async (req, res) => {
    try {
      const statusCounts = await LeadsRepository.countByStatus();
      const recentLeads = await LeadsRepository.getRecentLeads(10);
      
      const stats = {
        total: Object.values(statusCounts).reduce((sum, count) => sum + count, 0),
        byStatus: statusCounts,
        recent: recentLeads.length,
        lastUpdated: new Date().toISOString()
      };
      
      res.json({
        success: true,
        stats
      });
    } catch (error) {
      console.error('Error fetching lead stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch lead statistics'
      });
    }
  }
);

export default router;
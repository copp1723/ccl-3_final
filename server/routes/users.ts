import { Router } from 'express';
import { UsersRepository, AuditLogRepository } from '../db';
import { authenticate, authorize } from '../middleware/auth';
import { z } from 'zod';
import { validate, validateQuery } from '../middleware/validation';
import { auditCreate, auditUpdate, auditDelete } from '../middleware/audit';

const router = Router();

// Validation schemas
const updateUserSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.enum(['admin', 'manager', 'agent', 'viewer']).optional(),
  active: z.boolean().optional(),
  metadata: z.record(z.any()).optional()
});

const userQuerySchema = z.object({
  role: z.enum(['admin', 'manager', 'agent', 'viewer']).optional(),
  active: z.enum(['true', 'false']).transform(val => val === 'true').optional(),
  search: z.string().optional()
});

// Get all users (admin/manager only)
router.get('/api/users',
  authenticate,
  authorize('admin', 'manager'),
  validateQuery(userQuerySchema),
  async (req, res) => {
    try {
      const { role, active, search } = req.query;
      
      const users = await UsersRepository.findAll({
        role: role as string,
        active: active as boolean,
        search: search as string
      });
      
      res.json({ users });
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  }
);

// Get single user
router.get('/api/users/:id',
  authenticate,
  async (req, res) => {
    try {
      // Users can view their own profile, managers/admins can view anyone
      if (req.user!.id !== req.params.id && 
          !['admin', 'manager'].includes(req.user!.role)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const user = await UsersRepository.findById(req.params.id);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json({ user });
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  }
);

// Update user
router.put('/api/users/:id',
  authenticate,
  validate(updateUserSchema),
  auditUpdate('user'),
  async (req, res) => {
    try {
      // Check permissions
      const isOwnProfile = req.user!.id === req.params.id;
      const isAdmin = req.user!.role === 'admin';
      const isManager = req.user!.role === 'manager';
      
      // Users can update their own profile (except role)
      // Managers can update agents and viewers
      // Admins can update anyone
      if (!isOwnProfile && !isAdmin && !isManager) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      // Only admins can change roles
      if (req.body.role && !isAdmin) {
        delete req.body.role;
      }
      
      // Only admins can deactivate users
      if (req.body.active !== undefined && !isAdmin) {
        delete req.body.active;
      }
      
      const user = await UsersRepository.update(req.params.id, req.body);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json({ success: true, user });
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ error: 'Failed to update user' });
    }
  }
);

// Toggle user active status (admin only)
router.patch('/api/users/:id/toggle',
  authenticate,
  authorize('admin'),
  auditUpdate('user'),
  async (req, res) => {
    try {
      const user = await UsersRepository.toggleActive(req.params.id);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json({ 
        success: true, 
        user,
        message: `User ${user.active ? 'activated' : 'deactivated'} successfully`
      });
    } catch (error) {
      console.error('Error toggling user status:', error);
      res.status(500).json({ error: 'Failed to toggle user status' });
    }
  }
);

// Get user activity/audit logs
router.get('/api/users/:id/activity',
  authenticate,
  async (req, res) => {
    try {
      // Check permissions
      if (req.user!.id !== req.params.id && 
          !['admin', 'manager'].includes(req.user!.role)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const { days = '30' } = req.query;
      
      const activity = await AuditLogRepository.getUserActivity(
        req.params.id,
        parseInt(days as string)
      );
      
      res.json({ activity });
    } catch (error) {
      console.error('Error fetching user activity:', error);
      res.status(500).json({ error: 'Failed to fetch user activity' });
    }
  }
);

// Get user's recent actions
router.get('/api/users/:id/audit-logs',
  authenticate,
  async (req, res) => {
    try {
      // Check permissions
      if (req.user!.id !== req.params.id && 
          !['admin', 'manager'].includes(req.user!.role)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const { limit = '100' } = req.query;
      
      const logs = await AuditLogRepository.findByUser(
        req.params.id,
        { limit: parseInt(limit as string) }
      );
      
      res.json({ logs });
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
  }
);

// Cleanup expired sessions (admin only)
router.post('/api/users/cleanup-sessions',
  authenticate,
  authorize('admin'),
  async (req, res) => {
    try {
      const cleaned = await UsersRepository.cleanupExpiredSessions();
      
      res.json({ 
        success: true,
        cleaned,
        message: `Cleaned up ${cleaned} expired sessions`
      });
    } catch (error) {
      console.error('Error cleaning sessions:', error);
      res.status(500).json({ error: 'Failed to cleanup sessions' });
    }
  }
);

export default router;
import { Router } from 'express';
import { feedbackService } from '../services/feedback-service';
import { z } from 'zod';
import { validate } from '../middleware/validation';

const router = Router();

// Get user notifications
router.get('/api/notifications', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const userId = (req.user as any).id;
  const unreadOnly = req.query.unread === 'true';
  
  const notifications = feedbackService.getUserNotifications(userId, unreadOnly);
  
  res.json({
    notifications,
    total: notifications.length,
    unread: notifications.filter(n => !n.read).length
  });
});

// Mark notification as read
router.patch('/api/notifications/:id/read', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const userId = (req.user as any).id;
  const success = feedbackService.markAsRead(userId, req.params.id);
  
  if (!success) {
    return res.status(404).json({ error: 'Notification not found' });
  }
  
  res.json({ success: true });
});

// Mark all notifications as read
router.patch('/api/notifications/read-all', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const userId = (req.user as any).id;
  const count = feedbackService.markAllAsRead(userId);
  
  res.json({ 
    success: true,
    markedAsRead: count
  });
});

// Delete notification
router.delete('/api/notifications/:id', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const userId = (req.user as any).id;
  const success = feedbackService.deleteNotification(userId, req.params.id);
  
  if (!success) {
    return res.status(404).json({ error: 'Notification not found' });
  }
  
  res.json({ success: true });
});

// Send test notification (development only)
const testNotificationSchema = z.object({
  type: z.enum(['success', 'error', 'warning', 'info']),
  message: z.string().min(1).max(500),
  duration: z.number().optional()
});

router.post('/api/notifications/test', 
  validate(testNotificationSchema),
  (req, res) => {
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({ error: 'Test notifications only available in development' });
    }
    
    const { type, message, duration } = req.body;
    const userId = req.isAuthenticated() ? (req.user as any).id : undefined;
    
    switch (type) {
      case 'success':
        feedbackService.success(message, userId, duration);
        break;
      case 'error':
        feedbackService.error(message, userId, duration);
        break;
      case 'warning':
        feedbackService.warning(message, userId, duration);
        break;
      case 'info':
        feedbackService.info(message, userId, duration);
        break;
    }
    
    res.json({ 
      success: true,
      message: 'Test notification sent'
    });
  }
);

export default router;
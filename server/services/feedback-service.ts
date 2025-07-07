import { WebSocketServer, WebSocket } from 'ws';
import { nanoid } from 'nanoid';

export interface FeedbackMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number; // milliseconds
  action?: {
    label: string;
    url?: string;
    callback?: string;
  };
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface Notification {
  id: string;
  userId?: string;
  type: 'lead' | 'campaign' | 'agent' | 'system';
  title: string;
  message: string;
  read: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  action?: {
    label: string;
    url?: string;
  };
  metadata?: Record<string, any>;
  createdAt: Date;
}

class FeedbackService {
  private wss: WebSocketServer | null = null;
  private notifications: Map<string, Notification[]> = new Map();
  private connections: Map<string, WebSocket> = new Map();

  initialize(wss: WebSocketServer) {
    this.wss = wss;
  }

  // Send toast/feedback message to specific user or broadcast
  sendFeedback(
    message: Omit<FeedbackMessage, 'id' | 'timestamp'>,
    userId?: string
  ) {
    const feedback: FeedbackMessage = {
      id: nanoid(),
      timestamp: new Date(),
      ...message
    };

    if (userId) {
      this.sendToUser(userId, {
        type: 'feedback',
        data: feedback
      });
    } else {
      this.broadcast({
        type: 'feedback',
        data: feedback
      });
    }

    return feedback;
  }

  // Create and store notification
  createNotification(
    notification: Omit<Notification, 'id' | 'createdAt' | 'read'>,
    userId?: string
  ): Notification {
    const newNotification: Notification = {
      id: nanoid(),
      read: false,
      createdAt: new Date(),
      ...notification
    };

    // Store notification
    if (userId) {
      const userNotifications = this.notifications.get(userId) || [];
      userNotifications.push(newNotification);
      this.notifications.set(userId, userNotifications);

      // Send real-time notification
      this.sendToUser(userId, {
        type: 'notification',
        data: newNotification
      });
    } else {
      // System-wide notification
      this.broadcast({
        type: 'notification',
        data: newNotification
      });
    }

    return newNotification;
  }

  // Get user notifications
  getUserNotifications(userId: string, unreadOnly = false): Notification[] {
    const notifications = this.notifications.get(userId) || [];
    if (unreadOnly) {
      return notifications.filter(n => !n.read);
    }
    return notifications;
  }

  // Mark notification as read
  markAsRead(userId: string, notificationId: string): boolean {
    const notifications = this.notifications.get(userId) || [];
    const notification = notifications.find(n => n.id === notificationId);
    
    if (notification) {
      notification.read = true;
      
      // Send update to user
      this.sendToUser(userId, {
        type: 'notification_update',
        data: {
          id: notificationId,
          read: true
        }
      });
      
      return true;
    }
    
    return false;
  }

  // Mark all notifications as read
  markAllAsRead(userId: string): number {
    const notifications = this.notifications.get(userId) || [];
    let count = 0;
    
    notifications.forEach(notification => {
      if (!notification.read) {
        notification.read = true;
        count++;
      }
    });
    
    if (count > 0) {
      this.sendToUser(userId, {
        type: 'notifications_marked_read',
        data: { count }
      });
    }
    
    return count;
  }

  // Delete notification
  deleteNotification(userId: string, notificationId: string): boolean {
    const notifications = this.notifications.get(userId) || [];
    const index = notifications.findIndex(n => n.id === notificationId);
    
    if (index !== -1) {
      notifications.splice(index, 1);
      
      this.sendToUser(userId, {
        type: 'notification_deleted',
        data: { id: notificationId }
      });
      
      return true;
    }
    
    return false;
  }

  // Register WebSocket connection for a user
  registerConnection(userId: string, ws: WebSocket) {
    this.connections.set(userId, ws);
    
    // Send any unread notifications
    const unreadNotifications = this.getUserNotifications(userId, true);
    if (unreadNotifications.length > 0) {
      ws.send(JSON.stringify({
        type: 'unread_notifications',
        data: unreadNotifications
      }));
    }
  }

  // Unregister connection
  unregisterConnection(userId: string) {
    this.connections.delete(userId);
  }

  // Send message to specific user
  private sendToUser(userId: string, message: any) {
    const ws = this.connections.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  // Broadcast message to all connected users
  private broadcast(message: any) {
    if (!this.wss) return;
    
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }

  // Helper methods for common feedback messages
  success(message: string, userId?: string, duration = 5000) {
    return this.sendFeedback({
      type: 'success',
      title: 'Success',
      message,
      duration
    }, userId);
  }

  error(message: string, userId?: string, duration = 8000) {
    return this.sendFeedback({
      type: 'error',
      title: 'Error',
      message,
      duration
    }, userId);
  }

  warning(message: string, userId?: string, duration = 6000) {
    return this.sendFeedback({
      type: 'warning',
      title: 'Warning',
      message,
      duration
    }, userId);
  }

  info(message: string, userId?: string, duration = 5000) {
    return this.sendFeedback({
      type: 'info',
      title: 'Info',
      message,
      duration
    }, userId);
  }

  // Lead-specific notifications
  leadCreated(lead: any, userId?: string) {
    return this.createNotification({
      type: 'lead',
      title: 'New Lead Created',
      message: `New lead "${lead.name}" has been added to the system`,
      priority: 'medium',
      action: {
        label: 'View Lead',
        url: `/leads/${lead.id}`
      },
      metadata: { leadId: lead.id }
    }, userId);
  }

  leadQualified(lead: any, userId?: string) {
    return this.createNotification({
      type: 'lead',
      title: 'Lead Qualified',
      message: `Lead "${lead.name}" has been qualified and sent to Boberdoo`,
      priority: 'high',
      action: {
        label: 'View Details',
        url: `/leads/${lead.id}`
      },
      metadata: { leadId: lead.id }
    }, userId);
  }

  // Campaign notifications
  campaignActivated(campaign: any, userId?: string) {
    return this.createNotification({
      type: 'campaign',
      title: 'Campaign Activated',
      message: `Campaign "${campaign.name}" is now active`,
      priority: 'medium',
      action: {
        label: 'View Campaign',
        url: `/campaigns/${campaign.id}`
      },
      metadata: { campaignId: campaign.id }
    }, userId);
  }

  // Agent notifications
  agentError(agent: any, error: string, userId?: string) {
    return this.createNotification({
      type: 'agent',
      title: 'Agent Error',
      message: `Agent "${agent.name}" encountered an error: ${error}`,
      priority: 'urgent',
      action: {
        label: 'View Agent',
        url: `/agents/${agent.id}`
      },
      metadata: { agentId: agent.id, error }
    }, userId);
  }

  // System notifications
  systemUpdate(message: string, priority: 'low' | 'medium' | 'high' = 'medium') {
    return this.createNotification({
      type: 'system',
      title: 'System Update',
      message,
      priority
    });
  }
}

// Export singleton instance
export const feedbackService = new FeedbackService();

// Export types
export type { FeedbackMessage, Notification };
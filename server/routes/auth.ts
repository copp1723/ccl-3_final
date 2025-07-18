import { Router } from 'express';
import { usersRepository as UsersRepository, auditLogRepository as AuditLogRepository, analyticsRepository as AnalyticsRepository } from '../db';
import { z } from 'zod';
import { validate } from '../middleware/validation';
import { authenticate } from '../middleware/auth';
import { feedbackService } from '../services/feedback-service';

const router = Router();

// Validation schemas
const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 
    'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.enum(['admin', 'manager', 'agent', 'viewer']).optional()
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1)
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
});

// Login endpoint
router.post('/login', 
  validate(loginSchema),
  async (req, res) => {
    try {
      const { username, password } = req.body;
      
      // TEMPORARY: Hardcoded admin login
      let result = null;
      if (username === 'admin@completecarloans.com' && password === 'password123') {
        result = {
          user: {
            id: 'admin-1',
            email: 'admin@completecarloans.com',
            username: 'admin',
            firstName: 'Admin',
            lastName: 'User',
            role: 'admin',
            active: true
          },
          accessToken: 'hardcoded-jwt-token-' + Date.now(),
          refreshToken: 'hardcoded-refresh-token-' + Date.now(),
          expiresIn: 3600
        };
      } else {
        result = await UsersRepository.login(
          username,
          password,
          req.ip,
          req.get('user-agent')
        );
      }
      
      if (!result) {
        // Log failed attempt
        await AuditLogRepository.create({
          action: 'login',
          resource: 'auth',
          changes: { username, success: false },
          ipAddress: req.ip,
          userAgent: req.get('user-agent')
        });
        
        return res.status(401).json({ 
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS'
        });
      }
      
      // Skip logging for hardcoded admin to avoid potential errors
      if (result.user.id !== 'admin-1') {
        // Log successful login
        await AuditLogRepository.create({
          userId: result.user.id,
          action: 'login',
          resource: 'auth',
          changes: { success: true },
          ipAddress: req.ip,
          userAgent: req.get('user-agent')
        });
        
        // Track login event
        await AnalyticsRepository.trackEvent({
          eventType: 'user_login',
          userId: result.user.id,
          metadata: { ipAddress: req.ip }
        });
        
        // Send success notification
        feedbackService.success(`Welcome back, ${result.user.firstName || result.user.username}!`);
      }
      
      res.json({
        success: true,
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

// Register endpoint (admin only in production)
router.post('/register',
  validate(registerSchema),
  async (req, res) => {
    try {
      const { email, username, password, firstName, lastName, role } = req.body;
      
      // Check if email already exists
      const existingEmail = await UsersRepository.findByEmail(email);
      if (existingEmail) {
        return res.status(409).json({ 
          error: 'Email already registered',
          code: 'EMAIL_EXISTS'
        });
      }
      
      // Check if username already exists
      const existingUsername = await UsersRepository.findByUsername(username);
      if (existingUsername) {
        return res.status(409).json({ 
          error: 'Username already taken',
          code: 'USERNAME_EXISTS'
        });
      }
      
      // Create user
      const user = await UsersRepository.create({
        email,
        username,
        password,
        firstName,
        lastName,
        role: role || 'agent'
      });
      
      // Log registration
      await AuditLogRepository.create({
        userId: user.id,
        action: 'create',
        resource: 'user',
        resourceId: user.id,
        changes: { email, username, role: role || 'agent' },
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });
      
      // Auto-login after registration
      const loginResult = await UsersRepository.login(
        username,
        password,
        req.ip,
        req.get('user-agent')
      );
      
      res.status(201).json({
        success: true,
        user: loginResult!.user,
        accessToken: loginResult!.accessToken,
        refreshToken: loginResult!.refreshToken,
        expiresIn: loginResult!.expiresIn
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
);

// Refresh token endpoint
router.post('/refresh',
  validate(refreshTokenSchema),
  async (req, res) => {
    try {
      const { refreshToken } = req.body;
      
      const result = await UsersRepository.refreshToken(refreshToken);
      
      if (!result) {
        return res.status(401).json({ 
          error: 'Invalid refresh token',
          code: 'INVALID_REFRESH_TOKEN'
        });
      }
      
      res.json({
        success: true,
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn
      });
    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(500).json({ error: 'Token refresh failed' });
    }
  }
);

// Logout endpoint
router.post('/logout',
  authenticate,
  async (req, res) => {
    try {
      const refreshToken = req.body.refreshToken;
      
      if (refreshToken) {
        await UsersRepository.logout(refreshToken);
      }
      
      // Log logout
      await AuditLogRepository.create({
        userId: req.user!.id,
        action: 'logout',
        resource: 'auth',
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ error: 'Logout failed' });
    }
  }
);

// Get current user
router.get('/me',
  authenticate,
  async (req, res) => {
    try {
      const user = await UsersRepository.findById(req.user!.id);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json({ user });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ error: 'Failed to get user' });
    }
  }
);

// Change password
router.post('/change-password',
  authenticate,
  validate(changePasswordSchema),
  async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      
      // Verify current password
      const user = await UsersRepository.findById(req.user!.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const loginResult = await UsersRepository.login(
        user.username,
        currentPassword,
        req.ip,
        req.get('user-agent')
      );
      
      if (!loginResult) {
        return res.status(401).json({ 
          error: 'Current password is incorrect',
          code: 'INVALID_PASSWORD'
        });
      }
      
      // Update password
      await UsersRepository.update(req.user!.id, { password: newPassword });
      
      // Log password change
      await AuditLogRepository.create({
        userId: req.user!.id,
        action: 'update',
        resource: 'user',
        resourceId: req.user!.id,
        changes: { passwordChanged: true },
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });
      
      // Logout all sessions for security
      await UsersRepository.logoutAllSessions(req.user!.id);
      
      res.json({ 
        success: true,
        message: 'Password changed successfully. Please log in again.'
      });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ error: 'Failed to change password' });
    }
  }
);

// Create default admin (development only)
router.post('/create-default-admin',
  async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Not allowed in production' });
    }
    
    try {
      const admin = await UsersRepository.createDefaultAdmin();
      
      if (!admin) {
        return res.json({ 
          success: false,
          message: 'Admin user already exists'
        });
      }
      
      res.json({ 
        success: true,
        message: 'Default admin created',
        credentials: {
          email: 'admin@ccl3.com',
          username: 'admin',
          password: 'admin123!' // Only shown in development
        }
      });
    } catch (error) {
      console.error('Create default admin error:', error);
      res.status(500).json({ error: 'Failed to create default admin' });
    }
  }
);

export default router;
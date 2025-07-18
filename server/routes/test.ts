import { Router } from 'express';
import { usersRepository as UsersRepository } from '../db';

const router = Router();

// Test endpoint to verify mock data
router.get('/mock-users', async (req, res) => {
  try {
    const users = await UsersRepository.findAll?.() || [];
    res.json({
      success: true,
      count: users.length,
      users: users.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role
      }))
    });
  } catch (error) {
    console.error('Test endpoint error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch users',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Test login credentials
router.get('/test-login', async (req, res) => {
  res.json({
    message: 'Use these credentials to login',
    endpoint: 'POST /api/auth/login',
    credentials: {
      username: 'admin@completecarloans.com',
      password: 'password123'
    }
  });
});

export default router;
import { Request, Response } from 'express';
import passport from 'passport';

export const authHandler = {
  login: [
    passport.authenticate('local'),
    (req: Request, res: Response) => {
      res.json({ success: true, user: req.user });
    }
  ],

  logout: (req: Request, res: Response) => {
    req.logout(() => {
      res.json({ success: true });
    });
  },

  me: (req: Request, res: Response) => {
    if (req.isAuthenticated()) {
      res.json({ user: req.user });
    } else {
      res.status(401).json({ error: 'Not authenticated' });
    }
  }
};
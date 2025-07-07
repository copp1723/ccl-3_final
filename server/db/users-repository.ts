import { db } from './client';
import { users, sessions } from './schema';
import { eq, and, gte, sql, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'ccl3-jwt-secret-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'ccl3-refresh-secret-change-in-production';

export interface UserData {
  email: string;
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role?: 'admin' | 'manager' | 'agent' | 'viewer';
  metadata?: Record<string, any>;
}

export interface LoginResult {
  user: any;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class UsersRepository {
  static async create(data: UserData) {
    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 10);
    
    const [user] = await db
      .insert(users)
      .values({
        id: nanoid(),
        email: data.email.toLowerCase(),
        username: data.username.toLowerCase(),
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role || 'agent',
        active: true,
        metadata: data.metadata || {},
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    
    // Remove password hash from response
    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  static async findById(id: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    
    if (!user) return null;
    
    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  static async findByEmail(email: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    
    return user;
  }

  static async findByUsername(username: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username.toLowerCase()))
      .limit(1);
    
    return user;
  }

  static async login(emailOrUsername: string, password: string, ipAddress?: string, userAgent?: string): Promise<LoginResult | null> {
    // Find user by email or username
    let user = await this.findByEmail(emailOrUsername);
    if (!user) {
      user = await this.findByUsername(emailOrUsername);
    }
    
    if (!user || !user.active) {
      return null;
    }
    
    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return null;
    }
    
    // Update last login
    await db
      .update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.id, user.id));
    
    // Generate tokens
    const accessToken = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: '15m' }
    );
    
    const refreshToken = jwt.sign(
      { userId: user.id },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );
    
    // Save refresh token
    await db
      .insert(sessions)
      .values({
        id: nanoid(),
        userId: user.id,
        refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        ipAddress,
        userAgent,
        createdAt: new Date()
      });
    
    const { passwordHash, ...userWithoutPassword } = user;
    
    return {
      user: userWithoutPassword,
      accessToken,
      refreshToken,
      expiresIn: 900 // 15 minutes in seconds
    };
  }

  static async refreshToken(refreshToken: string): Promise<LoginResult | null> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as { userId: string };
      
      // Find session
      const [session] = await db
        .select()
        .from(sessions)
        .where(
          and(
            eq(sessions.refreshToken, refreshToken),
            gte(sessions.expiresAt, new Date())
          )
        )
        .limit(1);
      
      if (!session) {
        return null;
      }
      
      // Get user
      const user = await this.findById(decoded.userId);
      if (!user || !user.active) {
        return null;
      }
      
      // Generate new access token
      const accessToken = jwt.sign(
        { 
          userId: user.id, 
          email: user.email, 
          role: user.role 
        },
        JWT_SECRET,
        { expiresIn: '15m' }
      );
      
      return {
        user,
        accessToken,
        refreshToken,
        expiresIn: 900
      };
    } catch (error) {
      return null;
    }
  }

  static async logout(refreshToken: string) {
    await db
      .delete(sessions)
      .where(eq(sessions.refreshToken, refreshToken));
  }

  static async logoutAllSessions(userId: string) {
    await db
      .delete(sessions)
      .where(eq(sessions.userId, userId));
  }

  static async update(id: string, data: Partial<UserData>) {
    const updateData: any = {
      ...data,
      updatedAt: new Date()
    };
    
    // Hash password if provided
    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 10);
      delete updateData.password;
    }
    
    if (data.email) {
      updateData.email = data.email.toLowerCase();
    }
    
    if (data.username) {
      updateData.username = data.username.toLowerCase();
    }
    
    const [user] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    
    if (!user) return null;
    
    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  static async toggleActive(id: string) {
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    
    if (!user[0]) return null;
    
    const [updated] = await db
      .update(users)
      .set({
        active: !user[0].active,
        updatedAt: new Date()
      })
      .where(eq(users.id, id))
      .returning();
    
    const { passwordHash, ...userWithoutPassword } = updated;
    return userWithoutPassword;
  }

  static async findAll(options?: {
    role?: string;
    active?: boolean;
    search?: string;
  }) {
    let query = db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        active: users.active,
        lastLogin: users.lastLogin,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt
      })
      .from(users);
    
    const conditions = [];
    
    if (options?.role) {
      conditions.push(eq(users.role, options.role as any));
    }
    
    if (options?.active !== undefined) {
      conditions.push(eq(users.active, options.active));
    }
    
    if (options?.search) {
      const searchLower = options.search.toLowerCase();
      conditions.push(
        sql`(
          LOWER(${users.email}) LIKE ${'%' + searchLower + '%'} OR
          LOWER(${users.username}) LIKE ${'%' + searchLower + '%'} OR
          LOWER(${users.firstName}) LIKE ${'%' + searchLower + '%'} OR
          LOWER(${users.lastName}) LIKE ${'%' + searchLower + '%'}
        )`
      );
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    return query.orderBy(desc(users.createdAt));
  }

  static async createDefaultAdmin() {
    // Check if admin exists
    const adminExists = await db
      .select()
      .from(users)
      .where(eq(users.role, 'admin'))
      .limit(1);
    
    if (adminExists.length > 0) {
      return null;
    }
    
    // Create default admin
    return this.create({
      email: 'admin@ccl3.com',
      username: 'admin',
      password: 'admin123!', // Change in production!
      firstName: 'System',
      lastName: 'Admin',
      role: 'admin',
      metadata: {
        isDefault: true,
        createdBy: 'system'
      }
    });
  }

  static async cleanupExpiredSessions() {
    const deleted = await db
      .delete(sessions)
      .where(sql`${sessions.expiresAt} < NOW()`)
      .returning();
    
    return deleted.length;
  }
}
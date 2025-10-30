import { HashedPassword } from "../hash.utils/hash.utils.js";
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../models/model.js';
import redis from '../config/redis.js';
import { publishVerificationEmail } from '../messageBroker/publisher.js';
import { JWT_SECRET, REFRESH_JWT_SECRET, VERIFICATION_TTL } from '../config/env.Validation.js'
import logger from '../logger.js'


/**
 * User Registration controller
 */

export const registerUser = async (req, res) => {
  try {
    console.log('received data from frontend',req.body);
    const { email,password,first_name,last_name,phone_number,role} = req.body;

    if (!email || !password || !first_name || !last_name || !phone_number) {
      return res.status(400).json({ message: 'Required fields missing'});
    }
    
    const validRoles = ['user','admin']
    let userRole = 'user';
    if(role){
      if(!validRoles.includes(role.toLowerCase())){
        return res.status(400).json({ message: 'Invalid Role' });
      }
      userRole = role.toLowerCase();
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }
    if (password.length < 8){
      return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    }

    const existing = await prisma.users.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const hashed = await HashedPassword(password, 10);
    const user = await prisma.users.create({
      data: { email, password_hash: hashed,first_name,last_name,phone_number},
    });
   await prisma.role.create({
    data:{
      id:user.id,
      name:userRole,
      is_active:true
    }
  })
    
    const token = jwt.sign({ userId: user.id, email }, JWT_SECRET, { expiresIn: `${VERIFICATION_TTL}s` });

    
    await redis.set(`verify:${token}`, user.id, 'EX', VERIFICATION_TTL);

    
    await publishVerificationEmail({ email, token });

    res.status(201).json({ message: 'Registration successful, verification email sent.',
      token: token
     });
  } catch (err) {
    logger.error('RegisterError:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Email verification controller
 */
export const verifyEmail = async (req, res) => {
  const { token } = req.params;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = await redis.get(`verify:${token}`);
    if (!userId || userId !== decoded.userId) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    await prisma.users.update({
      where: { id: userId },
      data: { is_verified: true },
    });
    await redis.del(`verify:${token}`);

    res.status(200).json({ message: 'Email verified successfully.' });
  } catch (err) {
    logger.error('VerifyError:', err.message);
    res.status(400).json({ message: 'Invalid or expired token' });
  }
};

const RATE_LIMIT_WINDOW = 10 * 60; // 10 minutes in seconds
const RATE_LIMIT_MAX_ATTEMPTS = 5;

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate inputs
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Rate limiting
    const rateLimitKey = `login:attempts:${email}`;
    try {
      const attempts = await redis.incr(rateLimitKey);
      if (attempts === 1) await redis.expire(rateLimitKey, RATE_LIMIT_WINDOW);
      if (attempts > RATE_LIMIT_MAX_ATTEMPTS) {
        return res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
      }
    } catch (redisErr) {
      logger.error('Redis error during rate limiting:', redisErr.message);
      // Fail open: allow login attempt even if Redis is down
    }

    // User lookup
    const user = await prisma.users.findUnique({ where: { email } });
    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const role = await prisma.role.findUnique({where:{id:user.id}})

    // Password check
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if(!user.is_verified){
      return res.status(403).json(
        { error: 'Email not verified. Please verify your email before logging in.',
          verified:false,
          email:user.email
         });
    }

    // Update last login time
    await prisma.users.update({
      where: { id: user.id },
      data: { last_login_at: new Date() }
    });

    // Issue tokens
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email,role:role.name },
      JWT_SECRET,
      { expiresIn: '15m' }
    );
    const refreshToken = jwt.sign(
      { userId: user.id, email: user.email },
      REFRESH_JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Store refresh token in Redis
    try {
      await redis.set(`refresh:${user.id}`, refreshToken, 'EX', 7 * 24 * 60 * 60);
    } catch (redisErr) {
      logger.error('Redis error storing refresh token:', redisErr.message);
      // Not fatal: user can still log in
    }

    // Optionally, reset rate limit on successful login
    try {
      await redis.del(rateLimitKey);
    } catch (redisErr) {
      logger.warn('Redis error resetting rate limit:', redisErr.message);
    }

    // Set tokens as httpOnly cookies (fix: secure only in production)
    res
      .cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000 // 15 minutes
      })
      .cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      })
      .status(200)
      .json({ message: 'Login successful',
        accessToken: accessToken,
        refreshToken: refreshToken
       });

  } catch (err) {
    logger.error('LoginUser Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Refresh Token Controller
export const refreshAccessToken = async (req, res) => {

  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
    if (!refreshToken)
      return res.status(400).json({ error: 'Refresh token required' });
    // Verify refresh token
    const payload = jwt.verify(refreshToken, REFRESH_JWT_SECRET);

    // Check if refresh token is in Redis
    const storedToken = await redis.get(`refresh:${payload.userId}`);
    if (storedToken !== refreshToken)
      return res.status(401).json({ error: 'Invalid refresh token' });
    const role = await prisma.role.findUnique({where:{id:payload.userId}});
    // Issue new access token
    const newAccessToken = jwt.sign(
      { userId: payload.userId, email: payload.email,role:role.name },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Set new access token as cookie
    res
      .cookie('accessToken', newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000 // 15 minutes
      })
      .status(200)
      .json({ message: 'Access token refreshed',
        accessToken: newAccessToken
       });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const users = await prisma.users.findMany({
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        phone_number: true,
        is_verified: true,
        is_active: true,
        last_login_at: true,
        created_at: true,
        updated_at: true,
      }
    });
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get user by ID
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.users.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        phone_number: true,
        is_verified: true,
        is_active: true,
        last_login_at: true,
        created_at: true,
        updated_at: true,
      }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update user by ID
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updates  = {...req.body};
    
    // Prevent email updates (company email should not be changed)
    if (updates.email !== undefined) {
      return res.status(400).json({ 
        error: 'Email cannot be updated. Please contact administrator for email changes.' 
      });
    }
    
    // Validate that only allowed fields are being updated
    const allowedFields = {};
    if (updates.first_name !== undefined) allowedFields.first_name = updates.first_name;
    if (updates.last_name !== undefined) allowedFields.last_name = updates.last_name;
    if (updates.phone_number !== undefined) allowedFields.phone_number = updates.phone_number;
    
    // Add updated_at timestamp
    allowedFields.updated_at = new Date();
    
    const user = await prisma.users.update({
      where: { id },
      data: allowedFields,
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        phone_number: true,
        is_verified: true,
        is_active: true,
        last_login_at: true,
        created_at: true,
        updated_at: true,
      }
    });
    res.status(200).json(user);
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    logger.error('UpdateUser Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete user by ID
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Use transaction to delete both user and role
    await prisma.$transaction(async (tx) => {
      // Delete role first (foreign key constraint)
      await tx.role.delete({ 
        where: { id: id }  // Since id in role table = user id
      });
      
      // Then delete user
      await tx.users.delete({ 
        where: { id } 
      });
    });
    
    // Clean up Redis data for this user
    try {
      await redis.del(`refresh:${id}`);
      // Clean up any verification tokens for this user
      const verifyKeys = await redis.keys(`verify:*`);
      for (const key of verifyKeys) {
        const userId = await redis.get(key);
        if (userId === id) {
          await redis.del(key);
        }
      }
      logger.info('✅ Cleaned up Redis data for user:', id);
    } catch (redisErr) {
      logger.warn('⚠️ Failed to clean up Redis data:', redisErr.message);
      // Not critical, continue
    }
    res.clearCookie('accessToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });
    
    res.status(204).json({ message: 'Account deleted successfully' });
  } catch (err) {
    logger.error('❌ DeleteUser Error:', err.message);
    logger.error('Error code:', err.code);
    
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    if (err.code === 'P2003') {
      return res.status(400).json({ error: 'Cannot delete user due to existing dependencies' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Logout Controller
export const logoutUser = async (req, res) => {
  try {
    // Get user info from refresh token (if present)
    const refreshToken = req.cookies.refreshToken;
    if (refreshToken) {
      try {
        const payload = jwt.verify(refreshToken, REFRESH_JWT_SECRET);
        // Remove refresh token from Redis
        await redis.del(`refresh:${payload.userId}`);
      } catch (err) {
        // Token might be expired or invalid, ignore
      }
    }

    // Clear cookies
    res
      .clearCookie('accessToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
      })
      .clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
      })
      .status(200)
      .json({ message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
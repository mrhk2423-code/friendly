import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cookieParser from 'cookie-parser';
import db from './src/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { GoogleGenAI } from "@google/genai";
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';

// Ensure uploads directory exists
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  console.log('Creating uploads directory...');
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Helper to create notifications
const createNotification = (userId: number, type: string, senderId?: number, postId?: number, content?: string) => {
  const stmt = db.prepare('INSERT INTO notifications (user_id, type, sender_id, post_id, content) VALUES (?, ?, ?, ?, ?)');
  stmt.run(userId, type, senderId || null, postId || null, content || null);
};

// Helper to notify all users except one
const notifyAllUsers = (type: string, senderId: number, postId?: number, content?: string) => {
  const users = db.prepare('SELECT id FROM users WHERE id != ?').all(senderId);
  users.forEach((user: any) => {
    createNotification(user.id, type, senderId, postId, content);
  });
};

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Auth Middleware
const authenticateToken = (req: any, res: any, next: any) => {
  const token = req.cookies.token;
  
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      console.log('Token verification failed:', err.message);
      return res.status(403).json({ error: 'Forbidden' });
    }
    req.user = user;
    next();
  });
};

app.use(express.json());
app.use(cookieParser());
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});
app.use('/uploads', express.static(uploadDir)); // Serve uploaded files

// Upload Avatar Endpoint
app.post('/api/users/avatar', authenticateToken, upload.single('avatar'), (req: any, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  const avatarUrl = `/uploads/${req.file.filename}`;
  const stmt = db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?');
  stmt.run(avatarUrl, req.user.id);
  
  res.json({ success: true, avatar_url: avatarUrl });
});

// Upload Chat Media Endpoint
app.post('/api/chat/upload', authenticateToken, upload.single('file'), (req: any, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  const mediaUrl = `/uploads/${req.file.filename}`;
  const mediaType = req.file.mimetype.startsWith('image/') ? 'image' : 
                    req.file.mimetype.startsWith('video/') ? 'video' : 
                    req.file.mimetype.startsWith('audio/') ? 'audio' : 'file';
  
  res.json({ success: true, media_url: mediaUrl, media_type: mediaType });
});

// Mark notifications as read
app.post('/api/notifications/read', authenticateToken, (req: any, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ success: true });
});

// Get notifications
app.get('/api/notifications', authenticateToken, (req: any, res) => {
  const notifications = db.prepare(`
    SELECT n.*, u.username as sender_username, u.avatar_url as sender_avatar, u.is_verified as sender_verified
    FROM notifications n
    LEFT JOIN users u ON n.sender_id = u.id
    WHERE n.user_id = ?
    ORDER BY n.created_at DESC
    LIMIT 50
  `).all(req.user.id);
  res.json(notifications);
});

// Get videos (TV section)
app.get('/api/videos', authenticateToken, (req: any, res) => {
  const videos = db.prepare(`
    SELECT 
      posts.*, users.username, users.avatar_url, users.is_verified,
      (SELECT COUNT(*) FROM likes WHERE post_id = posts.id) as likes_count,
      (SELECT COUNT(*) FROM comments WHERE post_id = posts.id) as comments_count,
      EXISTS (SELECT 1 FROM likes WHERE post_id = posts.id AND user_id = ?) as is_liked
    FROM posts
    JOIN users ON posts.user_id = users.id
    WHERE media_type = 'video'
    ORDER BY created_at DESC
  `).all(req.user.id);
  res.json(videos);
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log('A user connected');
  
  socket.on('join_room', (room) => {
    socket.join(room);
    console.log(`User joined room: ${room}`);
  });

  socket.on('send_message', (data) => {
    // Save to DB
    const stmt = db.prepare('INSERT INTO messages (sender_id, receiver_id, content, media_url, media_type) VALUES (?, ?, ?, ?, ?)');
    stmt.run(data.senderId, data.receiverId, data.content, data.mediaUrl, data.mediaType || 'text');
    
    // Emit to the specific chat room
    io.to(data.roomId).emit('receive_message', data);
    
    // Also emit to the receiver's personal room so they get a notification/update their list
    io.to(`user_${data.receiverId}`).emit('receive_message', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Get all posts
app.get('/api/posts', authenticateToken, (req: any, res) => {
  const posts = db.prepare(`
    SELECT 
      posts.id, posts.user_id, posts.content, posts.media_url, posts.media_type, posts.created_at, users.username, users.avatar_url, users.is_verified,
      (SELECT COUNT(*) FROM likes WHERE post_id = posts.id) as likes_count,
      (SELECT COUNT(*) FROM comments WHERE post_id = posts.id) as comments_count,
      EXISTS (SELECT 1 FROM likes WHERE post_id = posts.id AND user_id = ?) as is_liked
    FROM posts 
    JOIN users ON posts.user_id = users.id 
    ORDER BY posts.created_at DESC
  `).all(req.user.id);
  res.json(posts);
});

// Toggle Like
app.post('/api/posts/:id/like', authenticateToken, (req: any, res) => {
  const postId = req.params.id;
  const userId = req.user.id;
  
  try {
    const exists = db.prepare('SELECT 1 FROM likes WHERE user_id = ? AND post_id = ?').get(userId, postId);
    if (exists) {
      db.prepare('DELETE FROM likes WHERE user_id = ? AND post_id = ?').run(userId, postId);
      res.json({ liked: false });
    } else {
      db.prepare('INSERT INTO likes (user_id, post_id) VALUES (?, ?)').run(userId, postId);
      
      // Notify post owner
      const post: any = db.prepare('SELECT user_id FROM posts WHERE id = ?').get(postId);
      if (post && post.user_id !== userId) {
        createNotification(post.user_id, 'like', userId, Number(postId), 'liked your post');
      }
      
      res.json({ liked: true });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

// Add Comment
app.post('/api/posts/:id/comment', authenticateToken, (req: any, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Content is required' });
  
  const stmt = db.prepare('INSERT INTO comments (user_id, post_id, content) VALUES (?, ?, ?)');
  stmt.run(req.user.id, req.params.id, content);

  // Notify post owner
  const post: any = db.prepare('SELECT user_id FROM posts WHERE id = ?').get(req.params.id);
  if (post && post.user_id !== req.user.id) {
    createNotification(post.user_id, 'comment', req.user.id, Number(req.params.id), `commented: ${content.substring(0, 30)}`);
  }

  res.json({ success: true });
});

// Get Comments
app.get('/api/posts/:id/comments', authenticateToken, (req: any, res) => {
  const comments = db.prepare(`
    SELECT comments.id, comments.content, comments.created_at, users.username, users.avatar_url, users.is_verified
    FROM comments
    JOIN users ON comments.user_id = users.id
    WHERE post_id = ?
    ORDER BY comments.created_at ASC
  `).all(req.params.id);
  res.json(comments);
});

// Get all users for chat
app.get('/api/users', authenticateToken, (req: any, res) => {
  const users = db.prepare('SELECT id, username, avatar_url, bio, is_verified FROM users WHERE id != ?').all(req.user.id);
  res.json(users);
});

// Search users
app.get('/api/users/search', authenticateToken, (req: any, res) => {
  const query = req.query.q;
  if (!query) return res.json([]);
  
  const users = db.prepare('SELECT id, username, avatar_url, bio, is_verified FROM users WHERE username LIKE ? AND id != ?')
    .all(`%${query}%`, req.user.id);
  res.json(users);
});

// Get specific user profile
app.get('/api/users/:id', authenticateToken, (req: any, res) => {
  const user = db.prepare('SELECT id, username, avatar_url, bio, is_verified FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// Toggle Verification (Only hkahad can do this)
app.post('/api/users/:id/verify', authenticateToken, (req: any, res) => {
  const targetUserId = req.params.id;
  const currentUser: any = db.prepare('SELECT username FROM users WHERE id = ?').get(req.user.id);
  
  if (!currentUser || currentUser.username !== 'hkahad') {
    return res.status(403).json({ error: 'Only hkahad can verify users' });
  }

  const user: any = db.prepare('SELECT is_verified FROM users WHERE id = ?').get(targetUserId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const newStatus = user.is_verified ? 0 : 1;
  db.prepare('UPDATE users SET is_verified = ? WHERE id = ?').run(newStatus, targetUserId);
  
  res.json({ success: true, is_verified: newStatus });
});

// Admin Password Reset (Only hkahad can do this)
app.post('/api/admin/reset-password', authenticateToken, async (req: any, res) => {
  const { targetUserId, newPassword } = req.body;
  
  if (!targetUserId || !newPassword) {
    return res.status(400).json({ error: 'Target user ID and new password are required' });
  }

  const currentUser: any = db.prepare('SELECT username FROM users WHERE id = ?').get(req.user.id);
  
  if (!currentUser || currentUser.username !== 'hkahad') {
    return res.status(403).json({ error: 'Only hkahad can reset passwords' });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  const stmt = db.prepare('UPDATE users SET password = ? WHERE id = ?');
  const result = stmt.run(hashedPassword, targetUserId);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ success: true, message: 'Password reset successfully' });
});

// Create a post
app.post('/api/posts', authenticateToken, upload.single('file'), (req: any, res) => {
  const { content } = req.body;
  if (!content && !req.file) return res.status(400).json({ error: 'Content or file is required' });

  let mediaUrl = null;
  let mediaType = 'text';

  if (req.file) {
    mediaUrl = `/uploads/${req.file.filename}`;
    mediaType = req.file.mimetype.startsWith('image/') ? 'image' : 
                req.file.mimetype.startsWith('video/') ? 'video' : 
                req.file.mimetype.startsWith('audio/') ? 'audio' : 'file';
  }

  const stmt = db.prepare('INSERT INTO posts (user_id, content, media_url, media_type) VALUES (?, ?, ?, ?)');
  const info = stmt.run(req.user.id, content || '', mediaUrl, mediaType);
  
  const postId = info.lastInsertRowid;
  
  // Notify others about the new post
  notifyAllUsers('new_post', req.user.id, Number(postId), content ? content.substring(0, 50) : 'Shared a file');

  const newPost = db.prepare(`
    SELECT posts.id, posts.content, posts.media_url, posts.media_type, posts.created_at, users.username, users.avatar_url 
    FROM posts 
    JOIN users ON posts.user_id = users.id 
    WHERE posts.id = ?
  `).get(postId);
  
  res.json(newPost);
});

// Register
app.post('/api/auth/register', async (req, res) => {
  const schema = z.object({
    username: z.string().min(3).trim(),
    email: z.string().email().trim(),
    password: z.string().min(6),
    real_name: z.string().min(1).trim(),
    date_of_birth: z.string().min(1),
  });

  const result = schema.safeParse(req.body);
  if (!result.success) return res.status(400).json(result.error);

  let { username, email, password, real_name, date_of_birth } = result.data;
  email = email.toLowerCase(); // Normalize email
  username = username.toLowerCase(); // Normalize username
  
  // Explicit check for existing username
  const existingUser = db.prepare('SELECT 1 FROM users WHERE username = ? OR email = ?').get(username, email);
  if (existingUser) {
    return res.status(400).json({ error: 'Username or email already exists' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const stmt = db.prepare('INSERT INTO users (username, email, password, real_name, date_of_birth) VALUES (?, ?, ?, ?, ?)');
    const info = stmt.run(username, email, hashedPassword, real_name, date_of_birth);
    const userId = info.lastInsertRowid;
    
    // Notify others about the new user
    notifyAllUsers('new_user', Number(userId), undefined, `New user ${username} joined!`);
    
    // Auto-login: Create token and set cookie
    const token = jwt.sign({ id: userId, username: username }, JWT_SECRET, { expiresIn: '30d' });
    res.cookie('token', token, { 
      httpOnly: true, 
      secure: true, 
      sameSite: 'none',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    console.log('User registered and logged in:', email);
    res.json({ id: userId, username, email });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(400).json({ error: 'Username or email already exists' });
  }
});

// Get chat history
app.get('/api/chat/:roomId', authenticateToken, (req: any, res) => {
  const messages = db.prepare(`
    SELECT * FROM messages 
    WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
    ORDER BY created_at ASC
  `).all(
    req.user.id, req.query.otherUserId, 
    req.query.otherUserId, req.user.id
  );
  res.json(messages);
});

// Get user's posts
app.get('/api/users/:id/posts', authenticateToken, (req: any, res) => {
  const posts = db.prepare(`
    SELECT 
      posts.id, posts.content, posts.created_at, users.username, users.avatar_url,
      (SELECT COUNT(*) FROM likes WHERE post_id = posts.id) as likes_count,
      (SELECT COUNT(*) FROM comments WHERE post_id = posts.id) as comments_count,
      EXISTS (SELECT 1 FROM likes WHERE post_id = posts.id AND user_id = ?) as is_liked
    FROM posts 
    JOIN users ON posts.user_id = users.id 
    WHERE posts.user_id = ?
    ORDER BY posts.created_at DESC
  `).all(req.user.id, req.params.id);
  res.json(posts);
});

// Login
app.post('/api/auth/login', async (req, res) => {
  let { email, password } = req.body;
  if (typeof email === 'string') email = email.trim().toLowerCase();
  
  console.log('Login attempt for:', email);
  
  const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
  const user: any = stmt.get(email);

  if (!user) {
    console.log('User not found');
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    console.log('Invalid password');
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // 30 days expiry
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
  
  // Set cookie with SameSite=None and Secure=true for iframe compatibility
  res.cookie('token', token, { 
    httpOnly: true, 
    secure: true, 
    sameSite: 'none',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  });
  
  console.log('Login successful, token set');
  res.json({ id: user.id, username: user.username, bio: user.bio, avatar_url: user.avatar_url });
});

// Get user's conversations sorted by latest message
app.get('/api/chats/conversations', authenticateToken, (req: any, res) => {
  const conversations = db.prepare(`
    SELECT 
      users.id, users.username, users.avatar_url, users.is_verified,
      MAX(messages.created_at) as last_message_time,
      (SELECT content FROM messages m2 
       WHERE (m2.sender_id = users.id AND m2.receiver_id = ?) 
          OR (m2.sender_id = ? AND m2.receiver_id = users.id)
       ORDER BY m2.created_at DESC LIMIT 1) as last_message
    FROM users
    JOIN messages ON (messages.sender_id = users.id AND messages.receiver_id = ?)
                  OR (messages.sender_id = ? AND messages.receiver_id = users.id)
    WHERE users.id != ?
    GROUP BY users.id
    ORDER BY last_message_time DESC
  `).all(req.user.id, req.user.id, req.user.id, req.user.id, req.user.id);
  res.json(conversations);
});

// Get Current User
app.get('/api/auth/me', authenticateToken, (req: any, res) => {
  try {
    const stmt = db.prepare('SELECT id, username, email, bio, avatar_url, real_name, date_of_birth, is_verified FROM users WHERE id = ?');
    const user = stmt.get(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error in /api/auth/me:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update Profile
app.put('/api/users/profile', authenticateToken, (req: any, res) => {
  const { username, bio, avatar_url, real_name, date_of_birth } = req.body;
  const stmt = db.prepare('UPDATE users SET username = ?, bio = ?, avatar_url = ?, real_name = ?, date_of_birth = ? WHERE id = ?');
  stmt.run(username, bio, avatar_url, real_name, date_of_birth, req.user.id);
  res.json({ success: true });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: true,
    sameSite: 'none'
  });
  res.json({ success: true });
});

// Vite Middleware
if (process.env.NODE_ENV !== 'production') {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

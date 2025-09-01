const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST"]
  }
});

// Security middleware
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/flare-social', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// In-memory storage for demo (will switch to MongoDB once connected)
const users = new Map();
const posts = [];
const messages = [];
let userIdCounter = 1;

// Demo user
const demoUser = {
  id: userIdCounter++,
  username: 'demo',
  password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3ZxQQxq6Hy', // "password123"
  profilePicture: 'https://api.dicebear.com/7.x/avataaars/svg?seed=demo',
  bio: 'Demo user',
  isAdmin: true,
  joinDate: new Date(),
  isOnline: false
};
users.set('demo', demoUser);

// Authentication Routes
app.post('/api/auth/verify-access', (req, res) => {
  const { password } = req.body;
  const GATEKEEPER_PASSWORD = process.env.GATEKEEPER_PASSWORD || 'flare2024';

  if (password === GATEKEEPER_PASSWORD) {
    res.json({ success: true, message: 'Access granted' });
  } else {
    res.status(401).json({ success: false, message: 'Incorrect password. Please try again.' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, bio } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password required' });
    }

    if (users.has(username.toLowerCase())) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = {
      id: userIdCounter++,
      username: username.toLowerCase(),
      password: hashedPassword,
      profilePicture: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
      bio: bio || '',
      isAdmin: false,
      joinDate: new Date(),
      isOnline: true
    };

    users.set(username.toLowerCase(), user);

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET || 'flare-secret-key',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: user.id,
        username: user.username,
        profilePicture: user.profilePicture,
        bio: user.bio,
        isAdmin: user.isAdmin,
        joinDate: user.joinDate
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password required' });
    }

    const user = users.get(username.toLowerCase());
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    user.isOnline = true;
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET || 'flare-secret-key',
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        profilePicture: user.profilePicture,
        bio: user.bio,
        isAdmin: user.isAdmin,
        joinDate: user.joinDate,
        isOnline: user.isOnline
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// Posts route
app.get('/api/posts', (req, res) => {
  res.json({ posts: [] });
});

// Users route
app.get('/api/users', (req, res) => {
  const usersList = Array.from(users.values()).map(u => ({
    id: u.id,
    username: u.username,
    profilePicture: u.profilePicture,
    bio: u.bio,
    isAdmin: u.isAdmin,
    isOnline: u.isOnline,
    joinDate: u.joinDate
  }));
  res.json({ users: usersList });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Flare Backend is running!',
    timestamp: new Date().toISOString()
  });
});

// Simple Socket.io handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Flare Backend running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

const jwt = require('jsonwebtoken');
const User = require('../models/User');

const socketHandler = (io) => {
  // Socket authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      const user = await User.findById(decoded.userId);
      
      if (!user) {
        return next(new Error('User not found'));
      }

      socket.userId = user._id.toString();
      socket.username = user.username;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`✅ User connected: ${socket.username} (${socket.userId})`);

    // Join user to their personal room for direct messages
    socket.join(`user_${socket.userId}`);

    // Update user online status
    User.findByIdAndUpdate(socket.userId, { 
      isOnline: true, 
      lastSeen: new Date() 
    }).exec();

    // Broadcast user online status
    socket.broadcast.emit('userOnline', {
      userId: socket.userId,
      username: socket.username,
      isOnline: true
    });

    // Handle typing indicators for messages
    socket.on('typing', (data) => {
      socket.to(`user_${data.recipientId}`).emit('userTyping', {
        userId: socket.userId,
        username: socket.username,
        isTyping: true
      });
    });

    socket.on('stopTyping', (data) => {
      socket.to(`user_${data.recipientId}`).emit('userTyping', {
        userId: socket.userId,
        username: socket.username,
        isTyping: false
      });
    });

    // Handle real-time post interactions
    socket.on('joinPostRoom', (postId) => {
      socket.join(`post_${postId}`);
    });

    socket.on('leavePostRoom', (postId) => {
      socket.leave(`post_${postId}`);
    });

    // Handle real-time hotspot interactions
    socket.on('joinHotspotRoom', (hotspotId) => {
      socket.join(`hotspot_${hotspotId}`);
    });

    socket.on('leaveHotspotRoom', (hotspotId) => {
      socket.leave(`hotspot_${hotspotId}`);
    });

    // Handle user disconnect
    socket.on('disconnect', async () => {
      console.log(`❌ User disconnected: ${socket.username} (${socket.userId})`);

      // Update user offline status
      await User.findByIdAndUpdate(socket.userId, { 
        isOnline: false, 
        lastSeen: new Date() 
      });

      // Broadcast user offline status
      socket.broadcast.emit('userOffline', {
        userId: socket.userId,
        username: socket.username,
        isOnline: false,
        lastSeen: new Date()
      });
    });

    // Handle connection errors
    socket.on('error', (error) => {
      console.error(`Socket error for user ${socket.username}:`, error);
    });
  });

  // Add io instance to request object for use in routes
  return (req, res, next) => {
    req.io = io;
    next();
  };
};

module.exports = socketHandler;

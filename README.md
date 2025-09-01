# 🔥 Flare Backend API

A robust Node.js backend for the Flare social media platform with real-time features.

## 🚀 Features

- **Authentication**: JWT-based auth with gatekeeper password
- **Real-time Chat**: Socket.io powered messaging system
- **Social Feed**: Posts with likes, replies, and real-time updates
- **Hotspots**: Location-based social features
- **User Management**: Profiles, online status, admin controls
- **Real-time Updates**: Live notifications for all interactions

## 📡 API Endpoints

### Authentication
```
POST /api/auth/verify-access    # Verify gatekeeper password
POST /api/auth/register         # User registration
POST /api/auth/login           # User login
POST /api/auth/logout          # User logout
```

### Users
```
GET  /api/users                # Get all users (People page)
GET  /api/users/:userId        # Get user profile
PUT  /api/users/profile        # Update own profile
DELETE /api/users/:userId      # Delete user (admin only)
```

### Posts (Feed)
```
GET  /api/posts                # Get feed posts
POST /api/posts                # Create new post
POST /api/posts/:id/like       # Like/unlike post
POST /api/posts/:id/reply      # Add reply to post
DELETE /api/posts/:id          # Delete post
```

### Hotspots
```
GET  /api/hotspots             # Get all hotspots
POST /api/hotspots             # Create new hotspot
POST /api/hotspots/:id/join    # Join/leave hotspot
DELETE /api/hotspots/:id       # Delete hotspot
```

### Messages
```
GET  /api/messages/conversations     # Get conversation list
GET  /api/messages/conversation/:id  # Get messages with user
POST /api/messages/send             # Send message
PUT  /api/messages/read/:id         # Mark messages as read
```

## 🔌 Socket.io Events

### Client → Server
```javascript
socket.emit('typing', { recipientId })
socket.emit('stopTyping', { recipientId })
socket.emit('joinPostRoom', postId)
socket.emit('joinHotspotRoom', hotspotId)
```

### Server → Client
```javascript
// Real-time updates
socket.on('newPost', postData)
socket.on('postLikeUpdate', { postId, likeCount, isLiked })
socket.on('newReply', { postId, reply })
socket.on('newHotspot', hotspotData)
socket.on('hotspotJoinUpdate', { hotspotId, joinedUsers })

// Messages
socket.on('newMessage', messageData)
socket.on('messageSent', messageData)
socket.on('userTyping', { userId, isTyping })
socket.on('messagesRead', { readBy })

// User status
socket.on('userOnline', { userId, isOnline })
socket.on('userOffline', { userId, isOnline, lastSeen })
socket.on('userProfileUpdate', { userId, profilePicture, bio })
```

## 🔐 Authentication

All protected routes require JWT token in header:
```javascript
headers: {
  'Authorization': 'Bearer your-jwt-token'
}
```

## 🌍 Environment Variables

```env
MONGODB_URI=your-mongodb-connection-string
JWT_SECRET=your-jwt-secret-key
GATEKEEPER_PASSWORD=flare2024
FRONTEND_URL=https://your-v0-app-url.com
PORT=5000
NODE_ENV=production
```

## 🔧 Setup & Deployment

### Local Development
```bash
npm install
npm run dev
```

### Production Deployment
Ready for deployment to:
- Railway
- Heroku
- Render
- DigitalOcean

## 📱 Frontend Integration

### Initialize Socket Connection
```javascript
import io from 'socket.io-client';

const socket = io('YOUR_BACKEND_URL', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

### API Calls Example
```javascript
// Login
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, password })
});

// Get posts
const posts = await fetch('/api/posts', {
  headers: { 'Authorization': `Bearer ${token}` }
});

// Send message
const message = await fetch('/api/messages/send', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({ recipientId, content })
});
```

## 🎯 Perfect Match for Your v0 Frontend

This backend provides all the endpoints and real-time features your v0 app needs:

✅ **Gatekeeper Password**: `/api/auth/verify-access`  
✅ **User Auth**: Register/Login with JWT tokens  
✅ **Feed System**: Posts, likes, replies with real-time updates  
✅ **People Page**: All users with online status  
✅ **Messaging**: Real-time chat with typing indicators  
✅ **Hotspots**: Location-based social features  
✅ **Admin Controls**: Content and user management  

Just connect your beautiful v0 frontend to this API and you'll have a fully functional social media platform! 🚀

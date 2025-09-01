const express = require('express');
const { body, validationResult } = require('express-validator');
const Message = require('../models/Message');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Get conversations list
router.get('/conversations', auth, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get all messages where user is sender or recipient
    const messages = await Message.find({
      $or: [
        { sender: userId },
        { recipient: userId }
      ]
    })
    .populate('sender', 'username profilePicture isOnline')
    .populate('recipient', 'username profilePicture isOnline')
    .sort({ createdAt: -1 });

    // Group messages by conversation partner
    const conversationsMap = new Map();
    
    messages.forEach(message => {
      const partnerId = message.sender._id.equals(userId) 
        ? message.recipient._id.toString()
        : message.sender._id.toString();
      
      if (!conversationsMap.has(partnerId)) {
        const partner = message.sender._id.equals(userId) 
          ? message.recipient 
          : message.sender;
        
        conversationsMap.set(partnerId, {
          partner,
          lastMessage: message,
          unreadCount: 0
        });
      }
      
      // Count unread messages
      if (message.recipient._id.equals(userId) && !message.isRead) {
        conversationsMap.get(partnerId).unreadCount++;
      }
    });

    const conversations = Array.from(conversationsMap.values());

    res.json({ conversations });

  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ message: 'Error fetching conversations' });
  }
});

// Get messages with a specific user
router.get('/conversation/:userId', auth, async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    const otherUserId = req.params.userId;

    const messages = await Message.find({
      $or: [
        { sender: currentUserId, recipient: otherUserId },
        { sender: otherUserId, recipient: currentUserId }
      ]
    })
    .populate('sender', 'username profilePicture')
    .populate('recipient', 'username profilePicture')
    .sort({ createdAt: 1 });

    // Mark messages as read
    await Message.updateMany(
      {
        sender: otherUserId,
        recipient: currentUserId,
        isRead: false
      },
      {
        isRead: true,
        readAt: new Date()
      }
    );

    res.json({ messages });

  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ message: 'Error fetching conversation' });
  }
});

// Send a message
router.post('/send', [
  auth,
  body('recipientId').notEmpty().withMessage('Recipient ID is required'),
  body('content')
    .isLength({ min: 1, max: 1000 })
    .withMessage('Message must be between 1 and 1000 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { recipientId, content } = req.body;
    const senderId = req.user.userId;

    // Check if recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ message: 'Recipient not found' });
    }

    // Create message
    const message = new Message({
      sender: senderId,
      recipient: recipientId,
      content
    });

    await message.save();
    await message.populate('sender', 'username profilePicture');
    await message.populate('recipient', 'username profilePicture');

    // Emit real-time event to recipient
    req.io?.to(`user_${recipientId}`).emit('newMessage', message);

    // Also emit to sender for their own UI update
    req.io?.to(`user_${senderId}`).emit('messageSent', message);

    res.status(201).json({
      message: 'Message sent successfully',
      messageData: message
    });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Error sending message' });
  }
});

// Mark messages as read
router.put('/read/:conversationUserId', auth, async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    const otherUserId = req.params.conversationUserId;

    const result = await Message.updateMany(
      {
        sender: otherUserId,
        recipient: currentUserId,
        isRead: false
      },
      {
        isRead: true,
        readAt: new Date()
      }
    );

    // Emit read receipt to sender
    req.io?.to(`user_${otherUserId}`).emit('messagesRead', {
      readBy: currentUserId,
      conversationWith: currentUserId
    });

    res.json({
      message: 'Messages marked as read',
      updatedCount: result.modifiedCount
    });

  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ message: 'Error marking messages as read' });
  }
});

module.exports = router;

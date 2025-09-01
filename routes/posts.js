const express = require('express');
const { body, validationResult } = require('express-validator');
const Post = require('../models/Post');
const auth = require('../middleware/auth');

const router = express.Router();

// Get all posts (feed)
router.get('/', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const posts = await Post.find()
      .populate('author', 'username profilePicture isAdmin')
      .populate('replies.author', 'username profilePicture')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Add user-specific like status
    const postsWithLikeStatus = posts.map(post => {
      const postObj = post.toJSON();
      postObj.isLikedByUser = post.likes.includes(req.user.userId);
      return postObj;
    });

    res.json({
      posts: postsWithLikeStatus,
      currentPage: page,
      totalPages: Math.ceil(await Post.countDocuments() / limit)
    });

  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ message: 'Error fetching posts' });
  }
});

// Create a new post
router.post('/', [
  auth,
  body('content')
    .isLength({ min: 1, max: 2000 })
    .withMessage('Content must be between 1 and 2000 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { content, images } = req.body;

    const post = new Post({
      author: req.user.userId,
      content,
      images: images || []
    });

    await post.save();
    await post.populate('author', 'username profilePicture isAdmin');

    // Emit real-time event
    req.io?.emit('newPost', {
      ...post.toJSON(),
      isLikedByUser: false
    });

    res.status(201).json({
      message: 'Post created successfully',
      post: {
        ...post.toJSON(),
        isLikedByUser: false
      }
    });

  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ message: 'Error creating post' });
  }
});

// Like/unlike a post
router.post('/:postId/like', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const userId = req.user.userId;
    const isLiked = post.likes.includes(userId);

    if (isLiked) {
      // Unlike
      post.likes = post.likes.filter(id => !id.equals(userId));
    } else {
      // Like
      post.likes.push(userId);
    }

    await post.save();

    // Emit real-time event
    req.io?.emit('postLikeUpdate', {
      postId: post._id,
      likeCount: post.likes.length,
      isLiked: !isLiked
    });

    res.json({
      message: isLiked ? 'Post unliked' : 'Post liked',
      likeCount: post.likes.length,
      isLiked: !isLiked
    });

  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ message: 'Error updating like status' });
  }
});

// Add reply to post
router.post('/:postId/reply', [
  auth,
  body('content')
    .isLength({ min: 1, max: 1000 })
    .withMessage('Reply must be between 1 and 1000 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const reply = {
      author: req.user.userId,
      content: req.body.content
    };

    post.replies.push(reply);
    await post.save();
    
    await post.populate('replies.author', 'username profilePicture');

    // Get the newly added reply
    const newReply = post.replies[post.replies.length - 1];

    // Emit real-time event
    req.io?.emit('newReply', {
      postId: post._id,
      reply: newReply
    });

    res.status(201).json({
      message: 'Reply added successfully',
      reply: newReply
    });

  } catch (error) {
    console.error('Add reply error:', error);
    res.status(500).json({ message: 'Error adding reply' });
  }
});

// Delete post (author or admin only)
router.delete('/:postId', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId).populate('author');
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Check if user is author or admin
    const user = await User.findById(req.user.userId);
    if (!post.author._id.equals(req.user.userId) && !user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized to delete this post' });
    }

    await Post.findByIdAndDelete(req.params.postId);

    // Emit real-time event
    req.io?.emit('postDeleted', {
      postId: req.params.postId
    });

    res.json({ message: 'Post deleted successfully' });

  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ message: 'Error deleting post' });
  }
});

module.exports = router;

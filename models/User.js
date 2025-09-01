const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  profilePicture: {
    type: String,
    default: 'https://api.dicebear.com/7.x/avataaars/svg?seed=default'
  },
  bio: {
    type: String,
    maxlength: 500,
    default: ''
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  joinDate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Generate avatar URL based on username
userSchema.pre('save', function(next) {
  if (this.isNew && !this.profilePicture) {
    this.profilePicture = `https://api.dicebear.com/7.x/avataaars/svg?seed=${this.username}`;
  }
  next();
});

module.exports = mongoose.model('User', userSchema);

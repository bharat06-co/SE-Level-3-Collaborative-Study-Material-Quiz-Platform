const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    materialId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Material',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: true,
      minlength: 1,
      maxlength: 1000,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'comments',
  },
);

commentSchema.index({ materialId: 1, createdAt: 1 });

module.exports = mongoose.model('Comment', commentSchema);

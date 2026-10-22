const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  text: { type: String, required: true, trim: true },
  type: { type: String, required: true, enum: ['mcq', 'true_false'] },
  options: { type: [String], default: undefined },
  answerKey: { type: mongoose.Schema.Types.Mixed, required: true },
}, { _id: true });

const quizSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, minlength: 3, maxlength: 120 },
  topic: { type: String, required: true, trim: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  allowRetake: { type: Boolean, default: true },
  questions: { type: [questionSchema], default: [] },
}, { timestamps: true });

quizSchema.index({ topic: 1, status: 1 });
quizSchema.index({ authorId: 1 });

const Quiz = mongoose.models.Quiz || mongoose.model('Quiz', quizSchema);
module.exports = { Quiz };

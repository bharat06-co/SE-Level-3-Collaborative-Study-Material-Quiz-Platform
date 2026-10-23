const mongoose = require('mongoose');
const answerSchema = new mongoose.Schema({
  questionId: { type: String, required: true },
  response: { type: mongoose.Schema.Types.Mixed, default: null },
  isCorrect: { type: Boolean, required: true },
  unanswered: { type: Boolean, required: true },
  correctAnswer: { type: mongoose.Schema.Types.Mixed, required: true },
}, { _id: false, strict: 'throw' });
const attemptSchema = new mongoose.Schema({
  quizId: { type: mongoose.Schema.Types.ObjectId, required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, required: true },
  answers: { type: [answerSchema], required: true },
  score: { type: Number, required: true, min: 0 },
  maxScore: { type: Number, required: true, min: 1 },
  submittedAt: { type: Date, required: true },
  // Internal race guard only on a submission made while allowRetake=false.
  // This is not a unique quiz/student index: unrestricted retakes remain possible.
  retakeGuard: { type: String },
}, { collection: 'attempts', strict: 'throw', versionKey: false, bufferCommands: false });
attemptSchema.index({ quizId: 1, studentId: 1, score: -1 });
attemptSchema.index({ studentId: 1, submittedAt: -1 });
attemptSchema.index({ retakeGuard: 1 }, { name: 'attempt_no_retake_guard', unique: true, partialFilterExpression: { retakeGuard: { $type: 'string' } } });
function getAttemptModel(connection = mongoose.connection) {
  return connection.models.Attempt || connection.model('Attempt', attemptSchema);
}
module.exports = { getAttemptModel };

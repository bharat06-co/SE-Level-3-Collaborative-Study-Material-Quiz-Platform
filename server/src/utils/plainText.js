const { AppError } = require('./AppError');

// Plain-text fields are NOT HTML. Preserve markup literally in storage; the UI
// must insert it as a text node, never as HTML. Do not apply this to passwords.
function validatePlainText(value, { field = 'text', minLength = 1, maxLength = 1000 } = {}) {
  if (typeof value !== 'string') return invalid();
  const text = value.trim();
  if (text.length < minLength || text.length > maxLength || text.includes('\0')) return invalid();
  return text;
  function invalid() {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid plain-text input.', [
      { field, message: `Must be plain text of ${minLength}–${maxLength} characters without null bytes.` },
    ]);
  }
}
module.exports = { validatePlainText };

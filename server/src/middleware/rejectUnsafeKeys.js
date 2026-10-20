const { AppError } = require('../utils/AppError');
const MAX_INPUT_DEPTH = 64;
const MAX_INPUT_NODES = 20000;
const reservedKeys = new Set(['__proto__', 'prototype', 'constructor']);

// Iterative traversal avoids stack overflow on deeply nested parsed JSON.
// Fail closed on excessive complexity as well as operator/prototype keys.
function hasUnsafeKeys(value) {
  const pending = [{ value, depth: 0 }];
  let visited = 0;
  while (pending.length) {
    const { value: current, depth } = pending.pop();
    if (++visited > MAX_INPUT_NODES || depth > MAX_INPUT_DEPTH) return true;
    if (!current || typeof current !== 'object') continue;
    for (const key of Object.keys(current)) {
      if (key.startsWith('$') || key.includes('.') || reservedKeys.has(key)) return true;
      pending.push({ value: current[key], depth: depth + 1 });
    }
  }
  return false;
}
function assertSafeInput(value) {
  if (hasUnsafeKeys(value)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Unsupported or overly complex input.', [
      { field: 'request', message: 'Operator, dotted and prototype keys, or excessive nesting/size, are not allowed.' },
    ]);
  }
  return value;
}
function rejectUnsafeKeys(req, res, next) {
  try {
    assertSafeInput(req.body);
    assertSafeInput(req.query);
    assertSafeInput(req.params);
    next();
  } catch (error) { next(error); }
}
module.exports = { rejectUnsafeKeys, hasUnsafeKeys, assertSafeInput, MAX_INPUT_DEPTH, MAX_INPUT_NODES };

export function validateEmail(value) {
  const email = String(value ?? '').trim();
  if (!email) return 'Email is required.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address.';
  return null;
}

export function validatePassword(value) {
  return String(value ?? '').length ? null : 'Password is required.';
}

export function validateObjectId(value, label = 'ID') {
  const id = String(value ?? '').trim();
  if (!id) return `${label} is required.`;
  if (!/^[a-f\d]{24}$/i.test(id)) return `${label} must be 24 hexadecimal characters.`;
  return null;
}

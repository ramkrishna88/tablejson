export function isNotMultipartError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = 'code' in error ? String(error.code) : '';
  const message = 'message' in error ? String(error.message) : '';

  return code === 'FST_INVALID_MULTIPART_CONTENT_TYPE' || /not multipart/i.test(message);
}

export function isFileTooLargeError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'FST_REQ_FILE_TOO_LARGE');
}

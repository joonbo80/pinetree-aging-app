export const UPLOAD_LIMITS = {
  maxFiles: 10,
  maxFileBytes: 25 * 1024 * 1024,
  maxRequestBytes: 100 * 1024 * 1024,
  allowedExtensions: ['.xls', '.xlsx'] as const,
  allowedMimeTypes: new Set([
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream',
    '',
  ]),
};

export type AllowedWorkbookExtension = (typeof UPLOAD_LIMITS.allowedExtensions)[number];


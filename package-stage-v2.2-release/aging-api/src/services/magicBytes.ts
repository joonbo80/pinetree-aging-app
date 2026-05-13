import { extname } from 'node:path';
import { UploadError } from './uploadErrors.js';
import type { AllowedWorkbookExtension } from './uploadLimits.js';

const XLS_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

export function workbookExtension(filename: string): AllowedWorkbookExtension | null {
  const ext = extname(filename).toLowerCase();
  if (ext === '.xls' || ext === '.xlsx') return ext;
  return null;
}

export function assertWorkbookMagic(extension: AllowedWorkbookExtension, firstBytes: Buffer, originalName: string) {
  if (extension === '.xls' && firstBytes.subarray(0, XLS_MAGIC.length).equals(XLS_MAGIC)) return;
  if (extension === '.xlsx' && firstBytes.subarray(0, ZIP_MAGIC.length).equals(ZIP_MAGIC)) return;
  throw new UploadError(
    'INVALID_FILE_SIGNATURE',
    `${originalName} does not look like a real ${extension} workbook`,
    415,
  );
}


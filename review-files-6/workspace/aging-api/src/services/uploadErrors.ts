export class UploadError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = 'UploadError';
    this.code = code;
    this.status = status;
  }
}


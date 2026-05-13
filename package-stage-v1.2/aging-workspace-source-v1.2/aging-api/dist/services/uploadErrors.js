export class UploadError extends Error {
    code;
    status;
    constructor(code, message, status = 400) {
        super(message);
        this.name = 'UploadError';
        this.code = code;
        this.status = status;
    }
}

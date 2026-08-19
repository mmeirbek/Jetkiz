declare module 'multer' {
  export interface MulterFile {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    size: number;
    destination: string;
    filename: string;
    path: string;
    buffer: Buffer;
  }

  export interface MulterStorageEngine {
    _handleFile(
      req: unknown,
      file: MulterFile,
      callback: (error: Error | null, info: Partial<MulterFile>) => void,
    ): void;
    _removeFile(
      req: unknown,
      file: MulterFile,
      callback: (error: Error | null) => void,
    ): void;
  }

  export interface MulterDiskStorageOptions {
    destination?: (
      req: unknown,
      file: MulterFile,
      callback: (error: Error | null, destination: string) => void,
    ) => void;
    filename?: (
      req: unknown,
      file: MulterFile,
      callback: (error: Error | null, filename: string) => void,
    ) => void;
  }

  export function diskStorage(
    options: MulterDiskStorageOptions,
  ): MulterStorageEngine;
}

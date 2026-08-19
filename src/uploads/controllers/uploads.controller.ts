import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import type { MulterFile } from 'multer';
import type { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ErrorResponseDto } from '../../common/dto/error-response.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthUser } from '../../common/types/auth-user.type';
import {
  UploadAvatarResponseDto,
  UploadOrderMediaFormDto,
  UploadOrderMediaResponseDto,
} from '../dto/upload-file.dto';
import { UploadsService } from '../services/uploads.service';

const UPLOADS_ROOT = join(process.cwd(), 'uploads');
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const IMAGE_EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};
const MAX_FILE_SIZE = 8 * 1024 * 1024;

function ensureDirectory(path: string) {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

function fileFilter(
  _req: Request,
  file: MulterFile,
  callback: (error: Error | null, acceptFile: boolean) => void,
) {
  if (!IMAGE_MIME_TYPES.has(file.mimetype)) {
    callback(
      new BadRequestException('Only JPG, PNG, and WEBP files are allowed'),
      false,
    );
    return;
  }

  callback(null, true);
}

function createStorage(subdir: string) {
  return diskStorage({
    destination: (_req, _file, callback) => {
      const target = join(UPLOADS_ROOT, subdir);
      ensureDirectory(target);
      callback(null, target);
    },
    filename: (_req, file, callback) => {
      const mappedExt = IMAGE_EXT_BY_MIME[file.mimetype];
      const originalExt = extname(file.originalname).toLowerCase();
      const ext = mappedExt || originalExt || '.bin';
      callback(null, `${Date.now()}-${randomUUID()}${ext}`);
    },
  });
}

function createFileInterceptor(subdir: string) {
  return FileInterceptor('file', {
    storage: createStorage(subdir),
    fileFilter,
    limits: {
      fileSize: MAX_FILE_SIZE,
    },
  });
}

function requireFile(file: MulterFile | undefined): asserts file is MulterFile {
  if (!file) {
    throw new BadRequestException('Image file is required');
  }
}

function buildPublicFileUrl(request: Request, relativePath: string) {
  const explicitBase = process.env.PUBLIC_BASE_URL?.replace(/\/$/, '');
  if (explicitBase) {
    return `${explicitBase}/uploads/${relativePath}`;
  }

  const forwardedProto = request.headers['x-forwarded-proto'];
  const protocol =
    typeof forwardedProto === 'string'
      ? forwardedProto.split(',')[0].trim()
      : request.protocol;

  return `${protocol}://${request.get('host')}/uploads/${relativePath}`;
}

@Controller('uploads')
@ApiTags('Uploads')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@ApiUnauthorizedResponse({
  type: ErrorResponseDto,
  description: 'Unauthorized',
})
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('avatar')
  @UseInterceptors(createFileInterceptor('avatars'))
  @ApiOperation({ summary: 'Upload current user avatar and update avatarUrl' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiCreatedResponse({ type: UploadAvatarResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Invalid image type, size, or missing file',
  })
  uploadAvatar(
    @CurrentUser() authUser: AuthUser,
    @UploadedFile() file: MulterFile | undefined,
    @Req() request: Request,
  ) {
    requireFile(file);

    const relativePath = `avatars/${file.filename}`;
    return this.uploadsService.attachAvatar(
      authUser,
      buildPublicFileUrl(request, relativePath),
    );
  }

  @Post('cargo')
  @UseInterceptors(createFileInterceptor('cargo'))
  @ApiOperation({
    summary: 'Upload cargo image and update order cargoPhotoUrl',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['orderId', 'file'],
      properties: {
        orderId: {
          type: 'string',
          example: 'cmmi83qoc00000kirq90ord',
        },
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiCreatedResponse({ type: UploadOrderMediaResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Invalid image type, size, payload, or missing file',
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: 'Order is not available for this user',
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Order not found',
  })
  uploadCargoPhoto(
    @CurrentUser() authUser: AuthUser,
    @Body() dto: UploadOrderMediaFormDto,
    @UploadedFile() file: MulterFile | undefined,
    @Req() request: Request,
  ) {
    requireFile(file);

    const relativePath = `cargo/${file.filename}`;
    return this.uploadsService.attachCargoPhoto(
      authUser,
      dto.orderId,
      buildPublicFileUrl(request, relativePath),
    );
  }

  @Post('product')
  @UseInterceptors(createFileInterceptor('products'))
  @ApiOperation({
    summary: 'Upload product image and append it to order productPhotoUrls',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['orderId', 'file'],
      properties: {
        orderId: {
          type: 'string',
          example: 'cmmi83qoc00000kirq90ord',
        },
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiCreatedResponse({ type: UploadOrderMediaResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Invalid image type, size, payload, or missing file',
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: 'Order is not available for this user',
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Order not found',
  })
  uploadProductPhoto(
    @CurrentUser() authUser: AuthUser,
    @Body() dto: UploadOrderMediaFormDto,
    @UploadedFile() file: MulterFile | undefined,
    @Req() request: Request,
  ) {
    requireFile(file);

    const relativePath = `products/${file.filename}`;
    return this.uploadsService.attachProductPhoto(
      authUser,
      dto.orderId,
      buildPublicFileUrl(request, relativePath),
    );
  }
}

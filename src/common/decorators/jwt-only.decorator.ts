import { SetMetadata } from '@nestjs/common';

export const JWT_ONLY = 'jwtOnly';
export const JwtOnly = () => SetMetadata(JWT_ONLY, true);

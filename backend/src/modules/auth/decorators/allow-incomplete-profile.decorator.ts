import { SetMetadata } from '@nestjs/common';

export const ALLOW_INCOMPLETE_PROFILE_KEY = 'allowIncompleteProfile';
export const AllowIncompleteProfile = () => SetMetadata(ALLOW_INCOMPLETE_PROFILE_KEY, true);

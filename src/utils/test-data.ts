import { randomUUID } from 'node:crypto';
import type { CreateUserRequest } from '../models/user.model';

export function newUser(): CreateUserRequest {
  const suffix = randomUUID();
  return {
    email: `pw-${suffix}@example.test`,
    displayName: `Automation ${suffix.slice(0, 8)}`,
    password: `Pw!${randomUUID()}a9`,
  };
}

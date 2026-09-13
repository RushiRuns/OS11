import { v4 as uuidv4, validate as uuidValidate, version as uuidVersion } from 'uuid';

export function generateUUID(): string {
  return uuidv4();
}

export function isValidUUID(id: string): boolean {
  return typeof id === 'string' && uuidValidate(id) && uuidVersion(id) === 4;
}

export { uuidv4 };

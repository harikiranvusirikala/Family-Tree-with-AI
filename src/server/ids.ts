import { ObjectId } from "mongodb";

/** Thrown for ids that can't be valid; callers treat it like "not found". */
export class InvalidIdError extends Error {
  constructor(id: string) {
    super(`Not a valid id: ${JSON.stringify(id)}`);
  }
}

export function toObjectId(id: string): ObjectId {
  if (!/^[a-f\d]{24}$/i.test(id)) throw new InvalidIdError(id);
  return new ObjectId(id);
}

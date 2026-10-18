import { ObjectId } from "mongodb";
import type { PersonDoc, SheetDoc, UnionDoc } from "../repositories/documents";
import type { Operation } from "./schema";

/** A rejected batch. `index` is the position of the failing operation (-1 for the whole batch). */
export class OperationError extends Error {
  constructor(
    message: string,
    readonly index: number,
  ) {
    super(index >= 0 ? `Change ${index + 1}: ${message}` : message);
  }
}

/** Everything in the group, including soft-deleted people (so they can be restored). */
export interface GroupState {
  persons: PersonDoc[];
  unions: UnionDoc[];
  sheets: SheetDoc[];
}

interface Changes<T> {
  inserted: T[];
  updated: T[];
}

export interface Plan {
  persons: Changes<PersonDoc>;
  unions: Changes<UnionDoc>;
  sheets: Changes<SheetDoc>;
  /** Temporary id ("new:1") → the real id it became. */
  idMap: Record<string, string>;
}

type Kind = "person" | "union" | "sheet";

/**
 * Validates a batch of operations against the group's current state and works out the writes.
 * Pure: nothing is saved here, and the input state is not modified. Throws OperationError on the
 * first invalid operation, so a batch is applied completely or not at all.
 */
export function planOperations(groupId: ObjectId, state: GroupState, ops: Operation[], actor: string, now: Date): Plan {
  const docs = {
    person: new Map(state.persons.map((d) => [d._id.toHexString(), d])),
    union: new Map(state.unions.map((d) => [d._id.toHexString(), d])),
    sheet: new Map(state.sheets.map((d) => [d._id.toHexString(), d])),
  };
  const created = { person: new Set<string>(), union: new Set<string>(), sheet: new Set<string>() };
  const changed = { person: new Set<string>(), union: new Set<string>(), sheet: new Set<string>() };
  const temp = new Map<string, { kind: Kind; id: string }>();

  // child id → id of the couple they are a child of (a person has at most one)
  const parentUnionOf = new Map<string, string>();
  for (const u of state.unions) {
    if (!u.deletedAt) for (const c of u.childIds) parentUnionOf.set(c.toHexString(), u._id.toHexString());
  }

  const audit = () => ({ createdBy: actor, createdAt: now, updatedBy: actor, updatedAt: now });

  ops.forEach((op, index) => {
    const fail = (message: string) => new OperationError(message, index);

    const resolve = (ref: string, kind: Kind): string => {
      if (!ref.startsWith("new:")) return ref.toLowerCase();
      const t = temp.get(ref);
      if (!t) throw fail(`${ref} is not created earlier in this batch`);
      if (t.kind !== kind) throw fail(`${ref} is a ${t.kind}, not a ${kind}`);
      return t.id;
    };

    const create = (kind: Kind, tempId: string | undefined): ObjectId => {
      const oid = new ObjectId();
      if (tempId) {
        if (temp.has(tempId)) throw fail(`${tempId} is used twice`);
        temp.set(tempId, { kind, id: oid.toHexString() });
      }
      created[kind].add(oid.toHexString());
      return oid;
    };

    // Copy-on-write, so the caller's state is never modified.
    function edit<T extends { _id: ObjectId }>(kind: Kind, doc: T): T {
      const copy = { ...doc, updatedBy: actor, updatedAt: now };
      (docs[kind] as Map<string, unknown>).set(doc._id.toHexString(), copy);
      changed[kind].add(doc._id.toHexString());
      return copy;
    }

    const person = (ref: string, opts: { deleted?: boolean } = {}): PersonDoc => {
      const p = docs.person.get(resolve(ref, "person"));
      if (!p || (!!p.deletedAt && !opts.deleted)) throw fail(`person ${ref} not found`);
      return p;
    };
    const union = (ref: string): UnionDoc => {
      const u = docs.union.get(resolve(ref, "union"));
      if (!u || u.deletedAt) throw fail(`couple ${ref} not found`);
      return u;
    };
    const sheet = (ref: string): SheetDoc => {
      const s = docs.sheet.get(resolve(ref, "sheet"));
      if (!s) throw fail(`sheet ${ref} not found`);
      return s;
    };
    const checkYears = (p: Pick<PersonDoc, "birthYear" | "deathYear" | "name">) => {
      if (p.birthYear !== undefined && p.deathYear !== undefined && p.deathYear < p.birthYear) {
        throw fail(`${p.name}'s death year is before their birth year`);
      }
    };
    const isAncestor = (candidate: string, personId: string): boolean => {
      const seen = new Set<string>();
      const stack = [personId];
      while (stack.length) {
        const unionId = parentUnionOf.get(stack.pop()!);
        if (!unionId || seen.has(unionId)) continue;
        seen.add(unionId);
        for (const p of docs.union.get(unionId)!.partnerIds) {
          const hex = p.toHexString();
          if (hex === candidate) return true;
          stack.push(hex);
        }
      }
      return false;
    };

    switch (op.op) {
      case "createPerson": {
        const doc: PersonDoc = {
          _id: create("person", op.tempId),
          groupId,
          name: op.name,
          gender: op.gender,
          ...(op.birthYear !== undefined && { birthYear: op.birthYear }),
          ...(op.deathYear !== undefined && { deathYear: op.deathYear }),
          ...audit(),
        };
        checkYears(doc);
        docs.person.set(doc._id.toHexString(), doc);
        break;
      }
      case "updatePerson": {
        const p = edit("person", person(op.personId));
        if (op.set.name !== undefined) p.name = op.set.name;
        if (op.set.gender !== undefined) p.gender = op.set.gender;
        for (const key of ["birthYear", "deathYear"] as const) {
          const value = op.set[key];
          if (value === null) delete p[key];
          else if (value !== undefined) p[key] = value;
        }
        checkYears(p);
        break;
      }
      case "createUnion": {
        const partners = op.partnerIds.map((ref) => person(ref)._id);
        const key = partners.map((p) => p.toHexString()).sort().join("+");
        if (partners.length === 2 && partners[0].equals(partners[1])) throw fail("a couple needs two different people");
        for (const u of docs.union.values()) {
          if (!u.deletedAt && u.partnerIds.map((p) => p.toHexString()).sort().join("+") === key) {
            throw fail("these people are already a couple");
          }
        }
        const doc: UnionDoc = { _id: create("union", op.tempId), groupId, partnerIds: partners, status: op.status, childIds: [], ...audit() };
        docs.union.set(doc._id.toHexString(), doc);
        break;
      }
      case "updateUnion": {
        edit("union", union(op.unionId)).status = op.status;
        break;
      }
      case "addChild": {
        const u = union(op.unionId);
        const child = person(op.childId);
        const childHex = child._id.toHexString();
        const unionHex = u._id.toHexString();
        const existing = parentUnionOf.get(childHex);
        if (existing === unionHex) break; // already their child
        if (existing) throw fail(`${child.name} already has parents`);
        for (const p of u.partnerIds) {
          if (p.equals(child._id)) throw fail(`${child.name} can't be their own child`);
          if (isAncestor(childHex, p.toHexString())) throw fail(`${child.name} is an ancestor of their parent`);
        }
        const copy = edit("union", u);
        copy.childIds = [...copy.childIds, child._id];
        parentUnionOf.set(childHex, unionHex);
        break;
      }
      case "createSheet": {
        const root = person(op.rootPersonId);
        const order = Math.max(-1, ...[...docs.sheet.values()].map((s) => s.order)) + 1;
        const doc: SheetDoc = {
          _id: create("sheet", op.tempId),
          groupId,
          title: op.title,
          rootPersonId: root._id,
          pinned: op.pinned ?? false,
          order,
          extraPersonIds: [],
          ...audit(),
        };
        docs.sheet.set(doc._id.toHexString(), doc);
        break;
      }
      case "addToSheet": {
        const s = sheet(op.sheetId);
        const p = person(op.personId);
        if (s.extraPersonIds.some((x) => x.equals(p._id))) break;
        const copy = edit("sheet", s);
        copy.extraPersonIds = [...copy.extraPersonIds, p._id];
        break;
      }
      case "setPhoto": {
        edit("person", person(op.personId)).photoId = op.photoId;
        break;
      }
      case "deletePerson": {
        edit("person", person(op.personId)).deletedAt = now;
        break;
      }
      case "restorePerson": {
        const p = person(op.personId, { deleted: true });
        if (!p.deletedAt) throw fail(`${p.name} is not deleted`);
        delete edit("person", p).deletedAt;
        break;
      }
    }
  });

  function changes<T>(kind: Kind): Changes<T> {
    const map = docs[kind] as Map<string, unknown>;
    return {
      inserted: [...created[kind]].map((id) => map.get(id) as T),
      updated: [...changed[kind]].filter((id) => !created[kind].has(id)).map((id) => map.get(id) as T),
    };
  }

  return {
    persons: changes<PersonDoc>("person"),
    unions: changes<UnionDoc>("union"),
    sheets: changes<SheetDoc>("sheet"),
    idMap: Object.fromEntries([...temp].map(([t, { id }]) => [t, id])),
  };
}

import { ObjectId } from "mongodb";
import type { PersonDoc, SheetDoc, UnionDoc } from "../repositories/documents";
import { DATE_FIELDS, datesProblem, lifeDates, MARRIAGE_FIELDS, marriageDate, marriageProblem } from "@/tree/years";
import type { Operation } from "./schema";

/**
 * A rejected batch. `index` is the position of the failing operation (-1 for the whole batch);
 * `reason` is the message without "Change N:", for a form that sends one batch.
 */
export class OperationError extends Error {
  constructor(
    readonly reason: string,
    readonly index: number,
  ) {
    super(index >= 0 ? `Change ${index + 1}: ${reason}` : reason);
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
  /** Photos replaced or removed by this batch that no person in the group uses any more (F8). */
  unusedPhotoIds: string[];
}

type Kind = "person" | "union" | "sheet";

type Crop = { x: number; y: number; w: number; h: number };
const sameCrop = (a: Crop | null, b: Crop | null) => (a && b ? a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h : a === b);

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
  const replacedPhotos = new Set<string>();

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
      if (!u || u.deletedAt || alivePartners(u).length === 0) throw fail(`couple ${ref} not found`);
      return u;
    };
    const sheet = (ref: string): SheetDoc => {
      const s = docs.sheet.get(resolve(ref, "sheet"));
      if (!s || s.deletedAt) throw fail(`sheet ${ref} not found`);
      return s;
    };
    const liveSheets = () => [...docs.sheet.values()].filter((s) => !s.deletedAt);
    // The dates' rules, the form's too: a day and month together and with their year, real dates, no
    // death before the birth.
    const checkDates = (p: PersonDoc) => {
      const problem = datesProblem(p);
      if (problem) throw fail(`${p.name}: ${problem.charAt(0).toLowerCase()}${problem.slice(1)}`);
    };
    // A marriage date's rules (a birth date's), and only for a couple of two: a single parent has none.
    const checkMarriage = (u: UnionDoc, settingDate: boolean) => {
      const partners = alivePartners(u);
      if (settingDate && partners.length < 2) throw fail("a single parent has no marriage date");
      const problem = marriageProblem(u);
      if (problem) throw fail(`${partners.map((p) => docs.person.get(p.toHexString())!.name).join(" and ")}: ${problem.charAt(0).toLowerCase()}${problem.slice(1)}`);
    };
    // Deleted people are kept (for Undo) but treated as absent, as the browser shows them (toGroupTree):
    // a couple whose partners are all deleted doesn't count, and a deleted partner's place can be taken.
    const alivePartners = (u: UnionDoc) => u.partnerIds.filter((p) => !docs.person.get(p.toHexString())?.deletedAt);
    /** The couple a person is a child of, unless all its partners are deleted. */
    const parentsOf = (childHex: string): UnionDoc | undefined => {
      const id = parentUnionOf.get(childHex);
      const u = id ? docs.union.get(id) : undefined;
      return u && alivePartners(u).length > 0 ? u : undefined;
    };
    // A couple can't be created twice (in either order).
    const checkNewCouple = (partners: ObjectId[]) => {
      if (partners.length === 2 && partners[0].equals(partners[1])) throw fail("a couple needs two different people");
      const key = partners.map((p) => p.toHexString()).sort().join("+");
      for (const u of docs.union.values()) {
        if (!u.deletedAt && u.partnerIds.map((p) => p.toHexString()).sort().join("+") === key) {
          throw fail("these people are already a couple");
        }
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
          ...lifeDates(op),
          ...audit(),
        };
        checkDates(doc);
        docs.person.set(doc._id.toHexString(), doc);
        break;
      }
      case "updatePerson": {
        const p = edit("person", person(op.personId));
        if (op.set.name !== undefined) p.name = op.set.name;
        if (op.set.gender !== undefined) p.gender = op.set.gender;
        for (const key of DATE_FIELDS) {
          const value = op.set[key];
          if (value === null) delete p[key];
          else if (value !== undefined) p[key] = value;
        }
        checkDates(p);
        break;
      }
      case "createUnion": {
        const partners = op.partnerIds.map((ref) => person(ref)._id);
        checkNewCouple(partners);
        const married = marriageDate(op);
        const doc: UnionDoc = { _id: create("union", op.tempId), groupId, partnerIds: partners, status: op.status, ...married, childIds: [], ...audit() };
        checkMarriage(doc, Object.keys(married).length > 0);
        docs.union.set(doc._id.toHexString(), doc);
        break;
      }
      case "updateUnion": {
        const u = edit("union", union(op.unionId));
        if (op.set.status !== undefined) u.status = op.set.status;
        for (const key of MARRIAGE_FIELDS) {
          const value = op.set[key];
          if (value === null) delete u[key];
          else if (value !== undefined) u[key] = value;
        }
        checkMarriage(u, MARRIAGE_FIELDS.some((key) => typeof op.set[key] === "number"));
        break;
      }
      case "addPartner": {
        const u = union(op.unionId);
        const partner = person(op.personId);
        const [alive, ...others] = alivePartners(u);
        if (others.length) throw fail("this couple already has two partners");
        checkNewCouple([alive, partner._id]);
        // The new partner becomes a parent of the couple's children, so they can't be one of their descendants.
        const partnerHex = partner._id.toHexString();
        if (u.childIds.some((c) => c.equals(partner._id) || isAncestor(c.toHexString(), partnerHex))) {
          throw fail(`${partner.name} is a descendant of this couple`);
        }
        edit("union", u).partnerIds = [alive, partner._id]; // takes a deleted partner's place, if any
        break;
      }
      case "addChild": {
        const u = union(op.unionId);
        const child = person(op.childId);
        const childHex = child._id.toHexString();
        const unionHex = u._id.toHexString();
        const existing = parentUnionOf.get(childHex);
        if (existing === unionHex) break; // already their child
        if (parentsOf(childHex)) throw fail(`${child.name} already has parents`);
        for (const p of u.partnerIds) {
          if (p.equals(child._id)) throw fail(`${child.name} can't be their own child`);
          if (isAncestor(childHex, p.toHexString())) throw fail(`${child.name} is an ancestor of their parent`);
        }
        if (existing) {
          // Their parents were all deleted: they leave that couple, so restoring those parents later
          // can't give them two sets of parents.
          const old = edit("union", docs.union.get(existing)!);
          old.childIds = old.childIds.filter((c) => !c.equals(child._id));
        }
        const copy = edit("union", u);
        copy.childIds = [...copy.childIds, child._id];
        parentUnionOf.set(childHex, unionHex);
        break;
      }
      case "createSheet": {
        const root = person(op.rootPersonId);
        const hidden = op.hideChildrenOf === undefined ? undefined : union(op.hideChildrenOf);
        if (hidden && !hidden.partnerIds.some((p) => p.equals(root._id))) throw fail(`${root.name} isn't in the couple whose children the sheet leaves out`);
        const order = Math.max(-1, ...[...docs.sheet.values()].map((s) => s.order)) + 1;
        const doc: SheetDoc = {
          _id: create("sheet", op.tempId),
          groupId,
          title: op.title,
          rootPersonId: root._id,
          pinned: op.pinned ?? false,
          order,
          extraPersonIds: [],
          ...(hidden && { hideChildrenOf: hidden._id }),
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
      case "updateSheet": {
        const copy = edit("sheet", sheet(op.sheetId));
        if (op.set.title !== undefined) copy.title = op.set.title;
        if (op.set.pinned !== undefined) copy.pinned = op.set.pinned;
        break;
      }
      case "deleteSheet": {
        // The father's and mother's sheets are pinned; a partner's sheet goes before the partner can.
        const s = sheet(op.sheetId);
        if (s.pinned) throw fail(`${s.title} is pinned: unpin it first`);
        if (liveSheets().length === 1) throw fail("a group needs at least one sheet");
        edit("sheet", s).deletedAt = now;
        break;
      }
      case "reorderSheets": {
        const ids = op.sheetIds.map((ref) => sheet(ref)._id.toHexString());
        if (new Set(ids).size !== ids.length) throw fail("a sheet is listed twice");
        if (ids.length !== liveSheets().length) throw fail("every sheet must be listed once");
        ids.forEach((id, order) => {
          const s = docs.sheet.get(id)!;
          if (s.order !== order) edit("sheet", s).order = order;
        });
        break;
      }
      case "setPhoto": {
        const p = person(op.personId);
        if (op.photoId !== null && !op.photoId.startsWith(`groups/${groupId.toHexString()}/`)) {
          throw fail("that photo isn't in this group's folder");
        }
        const crop = op.crop ?? null;
        if (op.photoId === null && crop) throw fail("a rectangle in a photo needs the photo");
        if ((p.photoId ?? null) === op.photoId && sameCrop(p.photoCrop ?? null, crop)) break;
        const copy = edit("person", p);
        if (op.photoId === null) delete copy.photoId;
        else copy.photoId = op.photoId;
        if (crop) copy.photoCrop = { x: crop.x, y: crop.y, w: crop.w, h: crop.h };
        else delete copy.photoCrop;
        // A new rectangle in the same photo (Adjust photo) frees nothing.
        if (p.photoId && p.photoId !== op.photoId) replacedPhotos.add(p.photoId);
        break;
      }
      case "deletePerson": {
        const p = person(op.personId);
        // A sheet shows its root's family, so it would be left empty. Delete the sheet first.
        const rooted = liveSheets().find((s) => s.rootPersonId.equals(p._id));
        if (rooted) throw fail(`${p.name} is the root of the sheet ${rooted.title}`);
        edit("person", p).deletedAt = now;
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
    // Deleted people count as users: Undo brings their photo back.
    unusedPhotoIds: [...replacedPhotos].filter((id) => ![...docs.person.values()].some((p) => p.photoId === id)),
  };
}

import type { FamilyData, Gender, Person, Sheet, Union } from "@/tree/types";

/**
 * A synthetic family of at least `size` people for performance tests: every couple has
 * three children, and every child but the youngest marries someone from outside.
 */
export function generateFamily(size: number): { data: FamilyData; sheet: Sheet } {
  const persons: Person[] = [];
  const unions: Union[] = [];
  const addPerson = (gender: Gender, birthYear: number) => {
    const p: Person = { id: `p${persons.length}`, name: `Person ${persons.length}`, gender, birthYear };
    persons.push(p);
    return p;
  };

  const first = addPerson("male", 1900);
  const queue: { union: Union; year: number }[] = [];
  const marry = (a: Person, b: Person, year: number) => {
    const union: Union = { id: `u${unions.length}`, partnerIds: [a.id, b.id], status: "married", childIds: [] };
    unions.push(union);
    queue.push({ union, year });
  };
  marry(first, addPerson("female", 1902), 1900);

  while (persons.length < size) {
    const { union, year } = queue.shift()!;
    for (let i = 0; i < 3 && persons.length < size; i++) {
      const child = addPerson(i % 2 ? "female" : "male", year + 25 + i * 2);
      union.childIds.push(child.id);
      if (i < 2 && persons.length < size) {
        marry(child, addPerson(child.gender === "male" ? "female" : "male", child.birthYear!), child.birthYear!);
      }
    }
  }
  return { data: { persons, unions }, sheet: { rootPersonId: first.id, extraPersonIds: [] } };
}

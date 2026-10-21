// The chat's tools (ARCHITECTURE.md §10), offered by role: Viewers get the two read tools only. Every
// tool is strict, so its input always matches the schema: every field is required, and optional
// ones take null. The handlers (handlers.ts) check the input again.
import type Anthropic from "@anthropic-ai/sdk";
import { hasRole, type Role } from "../roles";

const id = (description: string) => ({ type: "string", description });
const nullable = (type: "string" | "integer", description: string) => ({ type: [type, "null"], description });
const gender = { type: "string", enum: ["male", "female"] };

function tool(name: string, description: string, properties: Record<string, unknown>): Anthropic.Tool {
  return {
    name,
    description,
    strict: true,
    input_schema: { type: "object", properties, required: Object.keys(properties), additionalProperties: false },
  };
}

export const READ_TOOLS: Anthropic.Tool[] = [
  tool("search_people", "Find people in this family by name, optionally with a birth or death year. Use it before referring to anyone by id.", {
    name: { type: "string", description: "A name or part of one, e.g. \"Ravi\" or \"Ravi Kumar\"" },
    year: nullable("integer", "A birth or death year to narrow it down, or null"),
  }),
  tool("get_person", "One person's details: years, parents, partners (with the couple's id, status and marriage date), children, and the sheets that show them.", {
    personId: id("The person's id, from the family list or search_people"),
  }),
];

export const PROPOSAL_TOOLS: Anthropic.Tool[] = [
  tool("add_person", "Propose a new person. Returns a temporary id such as new:1 to use in later proposal calls.", {
    name: { type: "string" },
    gender,
    birthYear: nullable("integer", "Year of birth, or null if not known"),
    birthMonth: nullable("integer", "Month of birth, 1 to 12, only with the day and year; or null"),
    birthDay: nullable("integer", "Day of the month of birth, only with the month and year; or null"),
    deathYear: nullable("integer", "Year of death, or null if living or not known"),
    deathMonth: nullable("integer", "Month of death, 1 to 12, only with the day and year; or null"),
    deathDay: nullable("integer", "Day of the month of death, only with the month and year; or null"),
  }),
  tool("update_person", "Propose changes to someone's name, gender or dates, e.g. recording a death year or a full birth date. Null leaves a field as it is.", {
    personId: id("The person's id, or a temporary id from this proposal"),
    name: nullable("string", "The new name, or null"),
    gender: { type: ["string", "null"], enum: ["male", "female", null] },
    birthYear: nullable("integer", "The new year of birth, or null"),
    birthMonth: nullable("integer", "The new month of birth (1 to 12), with the day; or null"),
    birthDay: nullable("integer", "The new day of the month of birth, with the month; or null"),
    deathYear: nullable("integer", "The new year of death, or null"),
    deathMonth: nullable("integer", "The new month of death (1 to 12), with the day; or null"),
    deathDay: nullable("integer", "The new day of the month of death, with the month; or null"),
  }),
  tool("add_marriage", "Propose that two people are a couple, married or divorced, with the date they married if known. Returns the couple's temporary id.", {
    personId: id("One partner's id (or temporary id)"),
    partnerId: id("The other partner's id (or temporary id)"),
    status: { type: "string", enum: ["married", "divorced"] },
    marriageYear: nullable("integer", "Year they married, or null if not known"),
    marriageMonth: nullable("integer", "Month they married, 1 to 12, only with the day and year; or null"),
    marriageDay: nullable("integer", "Day of the month they married, only with the month and year; or null"),
  }),
  tool("update_couple", "Propose the date an existing couple married, or only the year. Null leaves a field as it is.", {
    coupleId: id("The couple's id, from get_person, or a temporary id from this proposal"),
    marriageYear: nullable("integer", "The year they married, or null"),
    marriageMonth: nullable("integer", "The month they married (1 to 12), with the day; or null"),
    marriageDay: nullable("integer", "The day of the month they married, with the month; or null"),
  }),
  tool("add_child", "Propose a child for a couple, or for a single parent. Give the parents' ids; their couple is found, or proposed if it doesn't exist yet.", {
    parentIds: { type: "array", items: { type: "string" }, description: "One or two parent ids (or temporary ids)" },
    childId: id("The child's id (or temporary id)"),
  }),
  tool("create_sheet", "Propose a new sheet (tab) showing a person's own family, e.g. for someone who married in. The title is usually \"<Name>'s family\".", {
    rootPersonId: id("The person the sheet is about (id or temporary id)"),
    title: { type: "string" },
  }),
  tool("add_to_sheet", "Propose showing a person on a sheet they aren't shown on.", {
    sheetId: id("The sheet's id, from the family list or get_person"),
    personId: id("The person's id (or temporary id)"),
  }),
];

/** What this role may use: Maintain and up also get the proposal tools. Always in the same order. */
export function toolsFor(role: Role): Anthropic.Tool[] {
  return hasRole(role, "maintain") ? [...READ_TOOLS, ...PROPOSAL_TOOLS] : READ_TOOLS;
}

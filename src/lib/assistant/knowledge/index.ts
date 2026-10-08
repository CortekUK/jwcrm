// Aggregates every knowledge file into one list for the help assistant.
// Add a new area by creating its file (exporting a KnowledgeSection[]) and
// spreading it in here.

import type { KnowledgeSection } from "./types";
import { hrSections } from "./hr";
import { leadsSections } from "./leads";
import { adminSections } from "./admin";

export const ALL_SECTIONS: KnowledgeSection[] = [
  ...hrSections,
  ...leadsSections,
  ...adminSections,
];

export type { KnowledgeSection, AssistantRole } from "./types";
export { ALL_STAFF } from "./types";

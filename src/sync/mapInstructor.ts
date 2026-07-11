import type { InstructorRow } from "../db/instructorsRepository.js";
import type { Instructor } from "../peloton/types.js";

export function mapInstructor(instructor: Instructor, syncedAt: number): InstructorRow {
  return {
    id: instructor.id,
    name: instructor.name ?? null,
    raw_json: JSON.stringify(instructor),
    synced_at: syncedAt,
  };
}

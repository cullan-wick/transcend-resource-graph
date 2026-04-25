export type { Resource } from "../../types/resource";
export type { StudentProfile } from "../../types/profile";

export type ScoredResource = {
  resource: import("../../types/resource").Resource;
  score: number;
};

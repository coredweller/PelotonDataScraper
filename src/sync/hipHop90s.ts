import type { RideSummary } from "../peloton/types.js";

// Matches every spelling Peloton has used: "90s Hip Hop", "90s Hip-Hop", and a
// defensive "90's". Not "90s Ride" or "90s Pop Ride".
const HIP_HOP_90S_TITLE = /\b90'?s\s+hip[\s-]?hop\b/i;

export function isHipHop90sTitle(title: string | undefined): boolean {
  return title !== undefined && HIP_HOP_90S_TITLE.test(title);
}

/** The "90s Hip Hop" rides from a class-library listing that the user hasn't favorited. */
export function selectUnfavoritedHipHop90s(rides: RideSummary[]): RideSummary[] {
  return rides.filter((ride) => isHipHop90sTitle(ride.title) && ride.is_favorite !== true);
}

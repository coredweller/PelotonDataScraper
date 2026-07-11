import { logger } from "../logger.js";
import type { AuthState } from "./auth.js";
import type { Instructor, Paginated, RideSummary, UserProfile, WorkoutDetail, WorkoutSummary } from "./types.js";

const BASE_URL = "https://api.onepeloton.com";

export class PelotonClient {
  constructor(private readonly auth: AuthState) {}

  private async request<T>(path: string): Promise<T> {
    const url = `${BASE_URL}${path}`;
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.auth.accessToken}`,
          "peloton-platform": "web",
        },
      });
    } catch (error) {
      logger.error({ err: error, url }, "Peloton API request failed");
      throw error;
    }

    if (!response.ok) {
      logger.error({ status: response.status, url }, "Peloton API returned an error status");
      throw new Error(`Peloton API request to ${path} failed with status ${response.status}`);
    }

    return (await response.json()) as T;
  }

  getProfile(): Promise<UserProfile> {
    return this.request<UserProfile>(`/api/user/${this.auth.userId}`);
  }

  getWorkouts(page: number, limit: number): Promise<Paginated<WorkoutSummary>> {
    return this.request<Paginated<WorkoutSummary>>(
      `/api/user/${this.auth.userId}/workouts?joins=ride,ride.instructor&limit=${limit}&page=${page}`,
    );
  }

  getWorkoutDetail(workoutId: string): Promise<WorkoutDetail> {
    return this.request<WorkoutDetail>(`/api/workout/${workoutId}`);
  }

  getFavoriteRides(page: number, limit: number): Promise<Paginated<RideSummary>> {
    return this.request<Paginated<RideSummary>>(
      `/api/v2/ride/archived?is_favorite_ride=true&limit=${limit}&page=${page}&sort_by=original_air_time`,
    );
  }

  getInstructors(page: number, limit: number): Promise<Paginated<Instructor>> {
    return this.request<Paginated<Instructor>>(`/api/instructor?page=${page}&limit=${limit}`);
  }
}

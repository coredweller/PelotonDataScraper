import { logger } from "../logger.js";
import type { AuthState } from "./auth.js";
import type { Instructor, Paginated, RideSummary, UserProfile, WorkoutDetail, WorkoutSummary } from "./types.js";

const BASE_URL = "https://api.onepeloton.com";
const GRAPHQL_URL = "https://gql-graphql-gateway.prod.k8s.onepeloton.com/graphql";

export interface StackResponse {
  numClasses: number;
  totalTime: number;
}

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

  // The Stack feature lives on Peloton's GraphQL gateway, not the REST host, but
  // accepts the same bearer auth. Operations discovered by probing the schema
  // (introspection is disabled): viewUserStack / addClassToStack.
  private async graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    let response: Response;
    try {
      response = await fetch(GRAPHQL_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.auth.accessToken}`,
          "peloton-platform": "web",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, variables }),
      });
    } catch (error) {
      logger.error({ err: error }, "Peloton GraphQL request failed");
      throw error;
    }

    if (!response.ok) {
      logger.error({ status: response.status }, "Peloton GraphQL returned an error status");
      throw new Error(`Peloton GraphQL request failed with status ${response.status}`);
    }

    const body = (await response.json()) as { data?: T; errors?: { message: string }[] };
    if (body.errors?.length) {
      const message = body.errors.map((e) => e.message).join("; ");
      logger.error({ errors: body.errors }, "Peloton GraphQL returned errors");
      throw new Error(`Peloton GraphQL error: ${message}`);
    }
    if (!body.data) {
      throw new Error("Peloton GraphQL response contained no data");
    }
    return body.data;
  }

  getStack(): Promise<StackResponse> {
    return this.graphql<{ viewUserStack: StackResponse }>(
      `query ViewUserStack { viewUserStack { numClasses totalTime } }`,
      {},
    ).then((data) => data.viewUserStack);
  }

  // pelotonClassId is the class join token (favorite_rides.raw_json.join_tokens.on_demand),
  // NOT the legacy ride id — the gateway silently ignores an unrecognized id.
  addToStack(joinToken: string): Promise<StackResponse> {
    return this.graphql<{ addClassToStack: StackResponse }>(
      `mutation AddClassToStack($input: AddClassToStackInput!) {
        addClassToStack(input: $input) { numClasses totalTime }
      }`,
      { input: { pelotonClassId: joinToken } },
    ).then((data) => data.addClassToStack);
  }
}

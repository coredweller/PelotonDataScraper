export interface LoginResponse {
  session_id: string;
  user_id: string;
}

export interface Instructor {
  id: string;
  name?: string;
}

export interface Ride {
  id: string;
  title?: string;
  instructor?: Instructor;
}

export interface WorkoutSummary {
  id: string;
  created_at?: number;
  start_time?: number;
  end_time?: number;
  status?: string;
  fitness_discipline?: string;
  ride?: Ride;
}

export interface WorkoutDetail extends WorkoutSummary {
  total_work?: number;
  distance?: number;
  calories?: number;
  device_type?: string;
  ride_summary?: {
    difficulty_rating_avg?: number;
  };
  metrics_summary?: {
    max_heart_rate?: number;
    avg_heart_rate?: number;
  };
}

export interface Paginated<T> {
  data: T[];
  count?: number;
  page_count?: number;
  total?: number;
}

export interface RideSummary {
  id: string;
  title?: string;
  instructor_id?: string;
  fitness_discipline?: string;
  duration?: number;
  difficulty_rating_avg?: number;
  original_air_time?: number;
}

export interface UserProfile {
  id: string;
  username?: string;
  email?: string;
}

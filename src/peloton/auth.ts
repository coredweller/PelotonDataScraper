import { logger } from "../logger.js";
import { loginWithOAuth, refreshOAuthToken, type Token } from "./oauthFlow.js";

const BASE_URL = "https://api.onepeloton.com";
const REFRESH_SAFETY_MARGIN_SECONDS = 300;

export interface AuthState {
  accessToken: string;
  refreshToken: string | null;
  userId: string;
  expiresAt: number;
}

async function getUserId(accessToken: string): Promise<string> {
  const response = await fetch(`${BASE_URL}/api/me`, {
    headers: { Authorization: `Bearer ${accessToken}`, "peloton-platform": "web" },
  });

  if (!response.ok) {
    logger.error({ status: response.status }, "Failed to fetch Peloton user id");
    throw new Error(`Failed to fetch Peloton user id (status ${response.status})`);
  }

  const body = (await response.json()) as { id?: string };
  if (!body.id) {
    throw new Error("Peloton /api/me response did not include an id");
  }
  return body.id;
}

function toAuthState(token: Token, userId: string): AuthState {
  return {
    accessToken: token.accessToken,
    refreshToken: token.refreshToken ?? null,
    userId,
    expiresAt: Math.floor(Date.now() / 1000) + token.expiresIn,
  };
}

/**
 * Returns a valid session, reusing a stored token/refresh token when possible so a daily
 * sync doesn't have to re-scrape Auth0's hosted login form on every run.
 */
export async function authenticate(
  email: string,
  password: string,
  stored: AuthState | null,
): Promise<AuthState> {
  const now = Math.floor(Date.now() / 1000);

  if (stored && stored.expiresAt - REFRESH_SAFETY_MARGIN_SECONDS > now) {
    logger.info("Reusing cached Peloton access token");
    return stored;
  }

  if (stored?.refreshToken) {
    try {
      logger.info("Refreshing Peloton access token");
      const token = await refreshOAuthToken(stored.refreshToken);
      return toAuthState(token, stored.userId);
    } catch (error) {
      logger.warn({ err: error }, "Peloton refresh token rejected, falling back to full login");
    }
  }

  logger.info("Performing full Peloton OAuth login");
  const token = await loginWithOAuth(email, password);
  const userId = await getUserId(token.accessToken);
  return toAuthState(token, userId);
}

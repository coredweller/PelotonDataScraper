import { createHash, randomBytes } from "node:crypto";
import { logger } from "../logger.js";
import { CookieJar } from "./cookieJar.js";

// Constants reverse-engineered from Peloton's web client (Auth0-hosted OAuth2/PKCE login).
// The old cookie-session POST /auth/login endpoint was permanently disabled by Peloton;
// this replicates the flow used by the actively-maintained peloton-to-garmin project.
const AUTH_DOMAIN = "auth.onepeloton.com";
const CLIENT_ID = "WVoJxVDdPoFx4RNewvvg6ch2mZ7bwnsM";
const AUDIENCE = "https://api.onepeloton.com/";
const SCOPE = "offline_access openid peloton-api.members:default";
const REDIRECT_URI = "https://members.onepeloton.com/callback";
const AUTH0_CLIENT_PAYLOAD = "eyJuYW1lIjoiYXV0aDAuanMtdWxwIiwidmVyc2lvbiI6IjkuMTQuMyJ9";
const AUTHORIZE_PATH = "/authorize";
const TOKEN_PATH = "/oauth/token";
const MAX_REDIRECT_HOPS = 10;

// Node's fetch sends no User-Agent by default, which trips Auth0's bot/anomaly detection.
// These headers make the login flow look like a real browser request.
const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0",
  "Accept-Language": "en-US,en;q=0.9",
};

export interface Token {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

function base64Url(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function generateRandomString(length: number): string {
  return base64Url(randomBytes(length)).slice(0, length);
}

function generateCodeChallenge(verifier: string): string {
  return base64Url(createHash("sha256").update(verifier).digest());
}

function extractQueryParam(url: string, name: string): string | undefined {
  return new URL(url).searchParams.get(name) ?? undefined;
}

function parseHiddenForm(html: string): { action: string; fields: Record<string, string> } {
  const actionMatch = /<form[^>]*action="([^"]*)"/i.exec(html);
  if (!actionMatch) {
    throw new Error("Auth0 login response contained no form action");
  }

  const fields: Record<string, string> = {};
  const inputRegex = /<input[^>]*type="hidden"[^>]*>/gi;
  for (const inputTag of html.match(inputRegex) ?? []) {
    const name = /name="([^"]*)"/i.exec(inputTag)?.[1];
    const value = /value="([^"]*)"/i.exec(inputTag)?.[1] ?? "";
    if (name) {
      fields[name] = value.replace(/&quot;/g, '"').replace(/&#34;/g, '"').replace(/&amp;/g, "&");
    }
  }

  return { action: actionMatch[1], fields };
}

interface OAuthConfig {
  state: string;
  nonce: string;
  codeVerifier: string;
  codeChallenge: string;
}

function generateOAuthConfig(): OAuthConfig {
  const codeVerifier = generateRandomString(64);
  return {
    state: generateRandomString(32),
    nonce: generateRandomString(32),
    codeVerifier,
    codeChallenge: generateCodeChallenge(codeVerifier),
  };
}

function buildAuthorizeUrl(config: OAuthConfig): string {
  const url = new URL(`https://${AUTH_DOMAIN}${AUTHORIZE_PATH}`);
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("audience", AUDIENCE);
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("state", config.state);
  url.searchParams.set("nonce", config.nonce);
  url.searchParams.set("code_challenge", config.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("auth0Client", AUTH0_CLIENT_PAYLOAD);
  return url.toString();
}

/**
 * Follows the Auth0 hosted-login redirect chain, collecting cookies (including the login-form
 * CSRF cookie). Auth0 rewrites `state` on this hop, so the value from the first redirect must be
 * reused in the credential submission below or Auth0's anomaly detection rejects it as invalid.
 */
async function initiateAuthFlow(authorizeUrl: string, jar: CookieJar): Promise<{ loginUrl: string; state?: string }> {
  let currentUrl = authorizeUrl;
  let rewrittenState: string | undefined;

  for (let hop = 0; hop < MAX_REDIRECT_HOPS; hop++) {
    const response = await fetch(currentUrl, {
      redirect: "manual",
      headers: { ...BROWSER_HEADERS, Cookie: jar.toHeader() },
    });
    jar.addFromResponse(response);
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      currentUrl = new URL(location, currentUrl).toString();
      if (rewrittenState === undefined) {
        rewrittenState = extractQueryParam(currentUrl, "state");
      }
      continue;
    }
    return { loginUrl: currentUrl, state: rewrittenState };
  }
  throw new Error("Auth0 authorize step exceeded maximum redirect hops");
}

/** Chases a redirect chain (GET only) looking for `code` in the URL query, stopping before actually fetching the redirect_uri callback page. */
async function chaseRedirectsForCode(startUrl: string, jar: CookieJar): Promise<string> {
  let currentUrl = startUrl;
  for (let hop = 0; hop < MAX_REDIRECT_HOPS; hop++) {
    const code = extractQueryParam(currentUrl, "code");
    if (code) return code;

    const response = await fetch(currentUrl, {
      redirect: "manual",
      headers: { ...BROWSER_HEADERS, Cookie: jar.toHeader() },
    });
    jar.addFromResponse(response);
    const location = response.headers.get("location");
    if (!(response.status >= 300 && response.status < 400) || !location) {
      throw new Error(`Auth0 login flow did not produce an authorization code (stopped at status ${response.status})`);
    }
    currentUrl = new URL(location, currentUrl).toString();
  }
  throw new Error("Auth0 login flow exceeded maximum redirect hops while searching for an authorization code");
}

async function submitCredentials(
  loginUrl: string,
  config: OAuthConfig,
  jar: CookieJar,
  email: string,
  password: string,
): Promise<string> {
  const csrfToken = jar.get("_csrf");
  if (!csrfToken) {
    throw new Error("Auth0 login page did not set a _csrf cookie");
  }

  const payload = {
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    tenant: "peloton-prod",
    response_type: "code",
    scope: SCOPE,
    audience: AUDIENCE,
    _csrf: csrfToken,
    state: config.state,
    _intstate: "deprecated",
    nonce: config.nonce,
    username: email,
    password,
    connection: "pelo-user-password",
    code_challenge: config.codeChallenge,
    code_challenge_method: "S256",
  };

  const response = await fetch(`https://${AUTH_DOMAIN}/usernamepassword/login`, {
    method: "POST",
    redirect: "manual",
    headers: {
      ...BROWSER_HEADERS,
      "Content-Type": "application/json",
      Accept: "*/*",
      Origin: `https://${AUTH_DOMAIN}`,
      Referer: loginUrl,
      "Auth0-Client": AUTH0_CLIENT_PAYLOAD,
      Cookie: jar.toHeader(),
    },
    body: JSON.stringify(payload),
  });
  jar.addFromResponse(response);

  const location = response.headers.get("location");
  if (location) {
    return new URL(location, response.url || `https://${AUTH_DOMAIN}/usernamepassword/login`).toString();
  }

  if (!response.ok) {
    const body = await response.text();
    logger.debug({ status: response.status, body: body.slice(0, 1000) }, "Peloton credential submission failed");
    throw new Error(`Peloton rejected login credentials (status ${response.status})`);
  }

  const html = await response.text();
  const { action, fields } = parseHiddenForm(html);
  const actionUrl = new URL(action, `https://${AUTH_DOMAIN}`).toString();

  const formResponse = await fetch(actionUrl, {
    method: "POST",
    redirect: "manual",
    headers: {
      ...BROWSER_HEADERS,
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: jar.toHeader(),
    },
    body: new URLSearchParams(fields).toString(),
  });
  jar.addFromResponse(formResponse);

  const formLocation = formResponse.headers.get("location");
  if (!formLocation) {
    throw new Error("Auth0 hidden-form submission did not redirect toward an authorization code");
  }
  return new URL(formLocation, actionUrl).toString();
}

async function exchangeCodeForToken(code: string, config: OAuthConfig): Promise<Token> {
  const response = await fetch(`https://${AUTH_DOMAIN}${TOKEN_PATH}`, {
    method: "POST",
    headers: { ...BROWSER_HEADERS, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      code_verifier: config.codeVerifier,
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    logger.error({ status: response.status, body: body.slice(0, 500) }, "Peloton token exchange failed");
    throw new Error(`Peloton token exchange failed with status ${response.status}`);
  }

  const body = (await response.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!body.access_token) {
    throw new Error("Peloton token exchange response missing access_token");
  }

  return { accessToken: body.access_token, refreshToken: body.refresh_token, expiresIn: body.expires_in ?? 172_800 };
}

export async function loginWithOAuth(email: string, password: string): Promise<Token> {
  const config = generateOAuthConfig();
  const jar = new CookieJar();

  const authorizeUrl = buildAuthorizeUrl(config);
  const { loginUrl, state } = await initiateAuthFlow(authorizeUrl, jar);
  if (state) {
    config.state = state;
  }
  const nextUrl = await submitCredentials(loginUrl, config, jar, email, password);
  const code = await chaseRedirectsForCode(nextUrl, jar);

  return exchangeCodeForToken(code, config);
}

export async function refreshOAuthToken(refreshToken: string): Promise<Token> {
  const response = await fetch(`https://${AUTH_DOMAIN}${TOKEN_PATH}`, {
    method: "POST",
    headers: { ...BROWSER_HEADERS, "Content-Type": "application/x-www-form-urlencoded; charset=utf-8" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: CLIENT_ID,
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!response.ok) {
    const body = await response.text();
    logger.warn({ status: response.status, body: body.slice(0, 500) }, "Peloton refresh token exchange failed");
    throw new Error(`Peloton refresh token exchange failed with status ${response.status}`);
  }

  const body = (await response.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!body.access_token) {
    throw new Error("Peloton refresh response missing access_token");
  }

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? refreshToken,
    expiresIn: body.expires_in ?? 172_800,
  };
}

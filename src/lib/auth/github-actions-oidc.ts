import "server-only";
import { createRemoteJWKSet, jwtVerify } from "jose";

const GITHUB_ACTIONS_ISSUER = "https://token.actions.githubusercontent.com";
const GITHUB_ACTIONS_JWKS = createRemoteJWKSet(new URL(`${GITHUB_ACTIONS_ISSUER}/.well-known/jwks`));

export type GitHubActionsOidcVerification =
  | { ok: true }
  | { ok: false; reason: "missing-bearer-token" | "invalid-token" | "unexpected-repository" | "unexpected-workflow" };

/**
 * Verifies a short-lived GitHub Actions OpenID Connect token. This is the
 * worker's preferred authentication path: it removes the duplicated static
 * CRON_SECRET that previously had to agree between GitHub Actions and Vercel.
 *
 * The token is accepted only when it was issued for this application audience,
 * repository, and scheduled workflow on main. None of those checks depend on
 * request-controlled values. Signature verification uses GitHub's rotating
 * public JWK set via jose's remote-JWK cache.
 */
export async function verifyGitHubActionsOidc(request: Request): Promise<GitHubActionsOidcVerification> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return { ok: false, reason: "missing-bearer-token" };

  const token = authorization.slice("Bearer ".length);
  if (!token) return { ok: false, reason: "missing-bearer-token" };

  const audience = process.env.GITHUB_ACTIONS_OIDC_AUDIENCE?.trim() || "roni-analysis-worker";
  const repository = process.env.GITHUB_ACTIONS_OIDC_REPOSITORY?.trim() || "demontelau-pixel/Roni-app";
  const workflowRef =
    process.env.GITHUB_ACTIONS_OIDC_WORKFLOW_REF?.trim() || `${repository}/.github/workflows/process-analysis-jobs.yml@refs/heads/main`;

  try {
    const { payload } = await jwtVerify(token, GITHUB_ACTIONS_JWKS, {
      issuer: GITHUB_ACTIONS_ISSUER,
      audience,
    });

    if (payload.repository !== repository) return { ok: false, reason: "unexpected-repository" };
    if (payload.workflow_ref !== workflowRef) return { ok: false, reason: "unexpected-workflow" };

    return { ok: true };
  } catch {
    // Never echo a JWT, claim, or verifier error. It may include untrusted
    // identity data and none of it is useful to a caller.
    return { ok: false, reason: "invalid-token" };
  }
}

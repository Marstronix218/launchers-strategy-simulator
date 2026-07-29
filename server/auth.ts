import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { VercelRequest } from "./types";

export interface AuthenticatedRequest {
  user: User;
  admin: SupabaseClient;
  token: string;
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing server environment variable: ${name}`);
  return value;
}

export async function authenticateRequest(
  request: VercelRequest,
): Promise<AuthenticatedRequest> {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    throw new AuthError("Authentication required.", 401);
  }
  const token = authorization.slice("Bearer ".length).trim();
  const supabaseUrl = requiredEnvironment("SUPABASE_URL");
  const publishableKey = requiredEnvironment("SUPABASE_PUBLISHABLE_KEY");
  const secretKey = requiredEnvironment("SUPABASE_SECRET_KEY");

  const verifier = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error,
  } = await verifier.auth.getUser(token);
  if (error || !user) throw new AuthError("Invalid or expired session.", 401);

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { user, admin, token };
}

export async function requireProjectAccess(
  auth: AuthenticatedRequest,
  projectId: string,
  roles: string[] = ["owner", "admin", "consultant", "editor"],
): Promise<{ organizationId: string; companyId: string }> {
  const { data: project, error: projectError } = await auth.admin
    .from("projects")
    .select("organization_id, company_id")
    .eq("id", projectId)
    .single();
  if (projectError || !project) {
    throw new AuthError("Project not found.", 404);
  }
  const { data: membership, error: membershipError } = await auth.admin
    .from("organization_members")
    .select("role")
    .eq("organization_id", project.organization_id)
    .eq("user_id", auth.user.id)
    .single();
  if (
    membershipError ||
    !membership ||
    !roles.includes(String(membership.role))
  ) {
    throw new AuthError("You do not have permission for this project.", 403);
  }
  return {
    organizationId: String(project.organization_id),
    companyId: String(project.company_id),
  };
}

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

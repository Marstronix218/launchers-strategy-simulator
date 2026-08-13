import type {
  CompanyBaseline,
  CompanyProfile,
  GoalTargets,
  IndiaInputs,
  Scenario,
  ValidationIssue,
} from "../types";
import type { DataOrigin } from "../onboarding";
import { requireSupabase } from "./supabase";

export interface WorkspaceIdentity {
  organizationId: string;
  companyId: string;
  projectId: string;
}

export interface StoredWorkspace extends WorkspaceIdentity {
  profile?: CompanyProfile;
  baseline?: CompanyBaseline;
  scenarios?: Scenario[];
  selectedScenarioId?: string;
  organizationName?: string;
  role?: string;
  goalTargets?: GoalTargets;
  indiaInputs?: IndiaInputs;
  dataOrigin?: DataOrigin;
}

interface BootstrapResponse {
  organization_id: string;
  company_id: string;
  project_id: string;
}

export async function loadOrCreateWorkspace(
  fallbackProfile: CompanyProfile,
): Promise<StoredWorkspace> {
  const client = requireSupabase();
  const { data: bootstrap, error: bootstrapError } = await client.rpc(
    "bootstrap_workspace",
    {
      p_organization_name: `${fallbackProfile.name} Workspace`,
      p_company_name: fallbackProfile.name,
      p_industry: fallbackProfile.industry,
      p_base_year: fallbackProfile.baseYear,
      p_horizon: fallbackProfile.horizon,
    },
  );
  if (bootstrapError) throw bootstrapError;
  const identity = bootstrap as BootstrapResponse;
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) {
    throw userError ?? new Error("Authenticated user not found.");
  }

  const [companyResponse, projectResponse, scenarioResponse, membershipResponse] =
    await Promise.all([
      client
        .from("companies")
        .select("name, industry, profile, baseline")
        .eq("id", identity.company_id)
        .single(),
      client
        .from("projects")
        .select("selected_scenario_external_id, settings")
        .eq("id", identity.project_id)
        .single(),
      client
        .from("scenarios")
        .select(
          "external_id, name, short_name, kind, description, color, drivers, annual_overrides, assumption_meta",
        )
        .eq("project_id", identity.project_id)
        .order("created_at"),
      client
        .from("organization_members")
        .select("role, organizations(name)")
        .eq("organization_id", identity.organization_id)
        .eq("user_id", userData.user.id)
        .single(),
    ]);

  if (companyResponse.error) throw companyResponse.error;
  if (projectResponse.error) throw projectResponse.error;
  if (scenarioResponse.error) throw scenarioResponse.error;
  if (membershipResponse.error) throw membershipResponse.error;

  const company = companyResponse.data;
  const hasStoredProfile =
    company.profile &&
    typeof company.profile === "object" &&
    Object.keys(company.profile as object).length > 0;
  const scenarios = (scenarioResponse.data ?? []).map(
    (row): Scenario => ({
      id: row.external_id,
      name: row.name,
      shortName: row.short_name,
      kind: row.kind as Scenario["kind"],
      description: row.description,
      color: row.color,
      drivers: row.drivers as Scenario["drivers"],
      annualOverrides: row.annual_overrides as Scenario["annualOverrides"],
      meta: row.assumption_meta as Scenario["meta"],
    }),
  );
  const organizationRelation = membershipResponse.data.organizations as
    | { name?: string }
    | Array<{ name?: string }>
    | null;
  const organizationName = Array.isArray(organizationRelation)
    ? organizationRelation[0]?.name
    : organizationRelation?.name;

  return {
    organizationId: identity.organization_id,
    companyId: identity.company_id,
    projectId: identity.project_id,
    profile: hasStoredProfile
      ? (company.profile as unknown as CompanyProfile)
      : undefined,
    baseline: hasStoredProfile
      ? (company.baseline as unknown as CompanyBaseline)
      : undefined,
    scenarios: scenarios.length ? scenarios : undefined,
    selectedScenarioId:
      projectResponse.data.selected_scenario_external_id ?? undefined,
    goalTargets: (
      projectResponse.data.settings as {
        goalTargets?: GoalTargets;
      } | null
    )?.goalTargets,
    indiaInputs: (
      projectResponse.data.settings as {
        indiaInputs?: IndiaInputs;
      } | null
    )?.indiaInputs,
    dataOrigin: (
      projectResponse.data.settings as {
        dataOrigin?: DataOrigin;
      } | null
    )?.dataOrigin,
    organizationName,
    role: membershipResponse.data.role,
  };
}

export async function saveWorkspace(
  identity: WorkspaceIdentity,
  profile: CompanyProfile,
  baseline: CompanyBaseline,
  scenarios: Scenario[],
  selectedScenarioId: string,
  goalTargets: GoalTargets,
  indiaInputs: IndiaInputs,
  dataOrigin: DataOrigin,
): Promise<{ savedAt: string; scenarioCount: number }> {
  const client = requireSupabase();
  const { data, error } = await client.rpc("save_workspace_snapshot", {
    p_project_id: identity.projectId,
    p_company_profile: profile,
    p_baseline: baseline,
    p_selected_scenario_external_id: selectedScenarioId,
    p_scenarios: scenarios,
    p_project_settings: { goalTargets, indiaInputs, dataOrigin },
  });
  if (error) throw error;
  const response = data as {
    saved_at: string;
    scenario_count: number;
  };
  return {
    savedAt: response.saved_at,
    scenarioCount: response.scenario_count,
  };
}

export async function uploadSourceFile(
  identity: WorkspaceIdentity,
  file: File,
  issues: ValidationIssue[],
): Promise<string> {
  const client = requireSupabase();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${identity.organizationId}/${identity.projectId}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await client.storage
    .from("strategy-files")
    .upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadError) throw uploadError;

  const { data: userData } = await client.auth.getUser();
  const { error: metadataError } = await client.from("uploaded_files").insert({
    organization_id: identity.organizationId,
    project_id: identity.projectId,
    storage_path: storagePath,
    original_name: file.name,
    content_type: file.type,
    size_bytes: file.size,
    validation_status: issues.some((issue) => issue.severity === "error")
      ? "invalid"
      : "valid",
    validation_result: { issues },
    uploaded_by: userData.user?.id,
  });
  if (metadataError) {
    await client.storage.from("strategy-files").remove([storagePath]);
    throw metadataError;
  }
  return storagePath;
}

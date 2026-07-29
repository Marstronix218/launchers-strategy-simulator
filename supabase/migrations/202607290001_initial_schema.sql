-- Launchers Strategy Simulator: multi-tenant production schema
-- Apply with `supabase db push` or paste into the Supabase SQL editor.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer'
    check (role in ('owner', 'admin', 'consultant', 'editor', 'approver', 'viewer')),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (organization_id, user_id)
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  industry text not null default '',
  currency text not null default 'JPY',
  profile jsonb not null default '{}'::jsonb,
  baseline jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, organization_id)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  base_year integer not null,
  horizon integer not null check (horizon in (5, 10)),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'approved', 'archived')),
  selected_scenario_external_id text,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, organization_id),
  foreign key (company_id, organization_id)
    references public.companies(id, organization_id) on delete cascade
);

create table if not exists public.business_units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  unique (company_id, name),
  foreign key (company_id, organization_id)
    references public.companies(id, organization_id) on delete cascade
);

create table if not exists public.scenarios (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  external_id text not null,
  name text not null,
  short_name text not null,
  kind text not null
    check (kind in ('as-is', 'downside', 'domestic', 'india', 'target')),
  description text not null default '',
  color text not null default '#a7222b',
  drivers jsonb not null,
  annual_overrides jsonb not null default '{}'::jsonb,
  assumption_meta jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (project_id, external_id),
  unique (id, organization_id),
  foreign key (project_id, organization_id)
    references public.projects(id, organization_id) on delete cascade
);

create table if not exists public.strategic_targets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  target_year integer not null,
  targets jsonb not null,
  status text not null default 'draft'
    check (status in ('draft', 'approved', 'rejected')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  foreign key (project_id, organization_id)
    references public.projects(id, organization_id) on delete cascade
);

create table if not exists public.forecast_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  scenario_id uuid not null references public.scenarios(id) on delete cascade,
  model_version text not null,
  input_hash text not null,
  inputs jsonb not null,
  result jsonb not null,
  status text not null default 'completed'
    check (status in ('queued', 'running', 'completed', 'failed')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (id, organization_id),
  foreign key (project_id, organization_id)
    references public.projects(id, organization_id) on delete cascade,
  foreign key (scenario_id, organization_id)
    references public.scenarios(id, organization_id) on delete cascade
);

create table if not exists public.forecast_values (
  id bigint generated always as identity primary key,
  forecast_run_id uuid not null references public.forecast_runs(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  scenario_id uuid not null references public.scenarios(id) on delete cascade,
  fiscal_year integer not null,
  metric text not null,
  value numeric(24, 6) not null,
  unit text not null default 'JPY',
  formula_key text,
  unique (forecast_run_id, fiscal_year, metric),
  foreign key (forecast_run_id, organization_id)
    references public.forecast_runs(id, organization_id) on delete cascade,
  foreign key (scenario_id, organization_id)
    references public.scenarios(id, organization_id) on delete cascade
);

create table if not exists public.source_references (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  variable_name text not null,
  source_name text not null,
  source_publication_date date,
  retrieved_date date,
  confidence text check (confidence in ('high', 'medium', 'low')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  foreign key (project_id, organization_id)
    references public.projects(id, organization_id) on delete cascade
);

create table if not exists public.uploaded_files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  storage_path text not null unique,
  original_name text not null,
  content_type text,
  size_bytes bigint,
  validation_status text not null default 'pending'
    check (validation_status in ('pending', 'valid', 'invalid', 'processing')),
  validation_result jsonb not null default '{}'::jsonb,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  foreign key (project_id, organization_id)
    references public.projects(id, organization_id) on delete cascade
);

create table if not exists public.ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  scenario_id uuid references public.scenarios(id) on delete cascade,
  suggestion_type text not null,
  model text not null,
  prompt_version text not null,
  input_summary jsonb not null default '{}'::jsonb,
  output jsonb not null,
  status text not null default 'suggested'
    check (status in ('suggested', 'reviewed', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  foreign key (project_id, organization_id)
    references public.projects(id, organization_id) on delete cascade,
  foreign key (scenario_id, organization_id)
    references public.scenarios(id, organization_id) on delete cascade
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_value jsonb,
  after_value jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  foreign key (project_id, organization_id)
    references public.projects(id, organization_id) on delete cascade
);

create index if not exists idx_members_user on public.organization_members(user_id);
create index if not exists idx_projects_org on public.projects(organization_id);
create index if not exists idx_scenarios_project on public.scenarios(project_id);
create index if not exists idx_forecast_runs_project on public.forecast_runs(project_id, created_at desc);
create index if not exists idx_audit_logs_project on public.audit_logs(project_id, created_at desc);
create index if not exists idx_ai_suggestions_project on public.ai_suggestions(project_id, created_at desc);

drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

drop trigger if exists companies_set_updated_at on public.companies;
create trigger companies_set_updated_at
before update on public.companies
for each row execute function public.set_updated_at();

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

drop trigger if exists scenarios_set_updated_at on public.scenarios;
create trigger scenarios_set_updated_at
before update on public.scenarios
for each row execute function public.set_updated_at();

drop trigger if exists targets_set_updated_at on public.strategic_targets;
create trigger targets_set_updated_at
before update on public.strategic_targets
for each row execute function public.set_updated_at();

create or replace function public.is_org_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = p_organization_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.has_org_role(
  p_organization_id uuid,
  p_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = p_organization_id
      and user_id = auth.uid()
      and role = any(p_roles)
  );
$$;

revoke all on function public.is_org_member(uuid) from public, anon;
revoke all on function public.has_org_role(uuid, text[]) from public, anon;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, text[]) to authenticated;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.companies enable row level security;
alter table public.projects enable row level security;
alter table public.business_units enable row level security;
alter table public.scenarios enable row level security;
alter table public.strategic_targets enable row level security;
alter table public.forecast_runs enable row level security;
alter table public.forecast_values enable row level security;
alter table public.source_references enable row level security;
alter table public.uploaded_files enable row level security;
alter table public.ai_suggestions enable row level security;
alter table public.audit_logs enable row level security;

create policy "members can view organizations"
on public.organizations for select
to authenticated
using (public.is_org_member(id));

create policy "admins can update organizations"
on public.organizations for update
to authenticated
using (public.has_org_role(id, array['owner', 'admin']))
with check (public.has_org_role(id, array['owner', 'admin']));

create policy "members can view memberships"
on public.organization_members for select
to authenticated
using (public.is_org_member(organization_id));

create policy "admins can manage memberships"
on public.organization_members for all
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin']))
with check (public.has_org_role(organization_id, array['owner', 'admin']));

create policy "members can view companies"
on public.companies for select
to authenticated
using (public.is_org_member(organization_id));

create policy "editors can manage companies"
on public.companies for all
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'consultant', 'editor']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'consultant', 'editor']));

create policy "members can view projects"
on public.projects for select
to authenticated
using (public.is_org_member(organization_id));

create policy "editors can manage projects"
on public.projects for all
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'consultant', 'editor']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'consultant', 'editor']));

create policy "members can view business units"
on public.business_units for select
to authenticated
using (public.is_org_member(organization_id));

create policy "editors can manage business units"
on public.business_units for all
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'consultant', 'editor']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'consultant', 'editor']));

create policy "members can view scenarios"
on public.scenarios for select
to authenticated
using (public.is_org_member(organization_id));

create policy "editors can manage scenarios"
on public.scenarios for all
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'consultant', 'editor']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'consultant', 'editor']));

create policy "members can view targets"
on public.strategic_targets for select
to authenticated
using (public.is_org_member(organization_id));

create policy "editors can manage targets"
on public.strategic_targets for all
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'consultant', 'editor', 'approver']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'consultant', 'editor', 'approver']));

create policy "members can view forecast runs"
on public.forecast_runs for select
to authenticated
using (public.is_org_member(organization_id));

create policy "members can view forecast values"
on public.forecast_values for select
to authenticated
using (public.is_org_member(organization_id));

create policy "members can view sources"
on public.source_references for select
to authenticated
using (public.is_org_member(organization_id));

create policy "editors can manage sources"
on public.source_references for all
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'consultant', 'editor']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'consultant', 'editor']));

create policy "members can view uploaded files"
on public.uploaded_files for select
to authenticated
using (public.is_org_member(organization_id));

create policy "editors can manage uploaded files"
on public.uploaded_files for all
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'consultant', 'editor']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'consultant', 'editor']));

create policy "members can view AI suggestions"
on public.ai_suggestions for select
to authenticated
using (public.is_org_member(organization_id));

create policy "reviewers can update AI suggestions"
on public.ai_suggestions for update
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'consultant', 'editor', 'approver']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'consultant', 'editor', 'approver']));

create policy "members can view audit logs"
on public.audit_logs for select
to authenticated
using (public.is_org_member(organization_id));

create policy "members can create audit logs"
on public.audit_logs for insert
to authenticated
with check (public.is_org_member(organization_id) and actor_id = auth.uid());

create or replace function public.bootstrap_workspace(
  p_organization_name text,
  p_company_name text,
  p_industry text,
  p_base_year integer,
  p_horizon integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
  v_company_id uuid;
  v_project_id uuid;
  v_slug text;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select organization_id
  into v_organization_id
  from public.organization_members
  where user_id = v_user_id
  order by created_at
  limit 1;

  if v_organization_id is null then
    v_slug := lower(regexp_replace(coalesce(nullif(trim(p_organization_name), ''), 'workspace'), '[^a-zA-Z0-9]+', '-', 'g'))
      || '-' || substr(gen_random_uuid()::text, 1, 8);

    insert into public.organizations (name, slug)
    values (coalesce(nullif(trim(p_organization_name), ''), 'Launchers Workspace'), v_slug)
    returning id into v_organization_id;

    insert into public.organization_members (organization_id, user_id, role)
    values (v_organization_id, v_user_id, 'owner');
  end if;

  select id
  into v_company_id
  from public.companies
  where organization_id = v_organization_id
  order by created_at
  limit 1;

  if v_company_id is null then
    insert into public.companies (organization_id, name, industry)
    values (v_organization_id, p_company_name, p_industry)
    returning id into v_company_id;
  end if;

  select id
  into v_project_id
  from public.projects
  where organization_id = v_organization_id
    and company_id = v_company_id
  order by created_at
  limit 1;

  if v_project_id is null then
    insert into public.projects (
      organization_id,
      company_id,
      name,
      base_year,
      horizon,
      created_by
    )
    values (
      v_organization_id,
      v_company_id,
      p_company_name || ' Strategy Plan',
      p_base_year,
      p_horizon,
      v_user_id
    )
    returning id into v_project_id;
  end if;

  return jsonb_build_object(
    'organization_id', v_organization_id,
    'company_id', v_company_id,
    'project_id', v_project_id
  );
end;
$$;

revoke all on function public.bootstrap_workspace(text, text, text, integer, integer)
from public, anon;
grant execute on function public.bootstrap_workspace(text, text, text, integer, integer)
to authenticated;

create or replace function public.save_workspace_snapshot(
  p_project_id uuid,
  p_company_profile jsonb,
  p_baseline jsonb,
  p_selected_scenario_external_id text,
  p_scenarios jsonb,
  p_project_settings jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_project public.projects%rowtype;
  v_scenario jsonb;
  v_saved_count integer := 0;
begin
  select *
  into v_project
  from public.projects
  where id = p_project_id;

  if v_project.id is null or not public.has_org_role(
    v_project.organization_id,
    array['owner', 'admin', 'consultant', 'editor']
  ) then
    raise exception 'Project not found or edit access denied';
  end if;

  update public.companies
  set
    name = coalesce(p_company_profile->>'name', name),
    industry = coalesce(p_company_profile->>'industry', industry),
    currency = coalesce(p_company_profile->>'currency', currency),
    profile = p_company_profile,
    baseline = p_baseline
  where id = v_project.company_id;

  update public.projects
  set
    base_year = coalesce((p_company_profile->>'baseYear')::integer, base_year),
    horizon = coalesce((p_company_profile->>'horizon')::integer, horizon),
    selected_scenario_external_id = p_selected_scenario_external_id,
    settings = coalesce(p_project_settings, '{}'::jsonb)
  where id = p_project_id;

  delete from public.business_units
  where company_id = v_project.company_id;

  insert into public.business_units (
    organization_id,
    company_id,
    name,
    sort_order
  )
  select
    v_project.organization_id,
    v_project.company_id,
    unit_name,
    ordinality - 1
  from jsonb_array_elements_text(
    coalesce(p_company_profile->'businessUnits', '[]'::jsonb)
  ) with ordinality as units(unit_name, ordinality);

  for v_scenario in select * from jsonb_array_elements(p_scenarios)
  loop
    insert into public.scenarios (
      organization_id,
      project_id,
      external_id,
      name,
      short_name,
      kind,
      description,
      color,
      drivers,
      annual_overrides,
      assumption_meta,
      created_by
    )
    values (
      v_project.organization_id,
      p_project_id,
      v_scenario->>'id',
      v_scenario->>'name',
      v_scenario->>'shortName',
      v_scenario->>'kind',
      coalesce(v_scenario->>'description', ''),
      coalesce(v_scenario->>'color', '#a7222b'),
      v_scenario->'drivers',
      coalesce(v_scenario->'annualOverrides', '{}'::jsonb),
      coalesce(v_scenario->'meta', '{}'::jsonb),
      auth.uid()
    )
    on conflict (project_id, external_id)
    do update set
      name = excluded.name,
      short_name = excluded.short_name,
      kind = excluded.kind,
      description = excluded.description,
      color = excluded.color,
      drivers = excluded.drivers,
      annual_overrides = excluded.annual_overrides,
      assumption_meta = excluded.assumption_meta,
      version = public.scenarios.version + 1;

    v_saved_count := v_saved_count + 1;
  end loop;

  insert into public.audit_logs (
    organization_id,
    project_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    after_value,
    metadata
  )
  values (
    v_project.organization_id,
    p_project_id,
    auth.uid(),
    'workspace.saved',
    'project',
    p_project_id::text,
    jsonb_build_object(
      'profile', p_company_profile,
      'selectedScenarioId', p_selected_scenario_external_id
    ),
    jsonb_build_object('scenarioCount', v_saved_count)
  );

  return jsonb_build_object(
    'project_id', p_project_id,
    'scenario_count', v_saved_count,
    'saved_at', timezone('utc', now())
  );
end;
$$;

revoke all on function public.save_workspace_snapshot(uuid, jsonb, jsonb, text, jsonb, jsonb)
from public, anon;
grant execute on function public.save_workspace_snapshot(uuid, jsonb, jsonb, text, jsonb, jsonb)
to authenticated;

create or replace function public.record_forecast_run(
  p_organization_id uuid,
  p_project_id uuid,
  p_scenario_id uuid,
  p_model_version text,
  p_input_hash text,
  p_inputs jsonb,
  p_result jsonb,
  p_values jsonb,
  p_created_by uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_run_id uuid;
begin
  if not exists (
    select 1
    from public.scenarios s
    join public.projects p on p.id = s.project_id
    where s.id = p_scenario_id
      and s.project_id = p_project_id
      and s.organization_id = p_organization_id
      and p.organization_id = p_organization_id
  ) then
    raise exception 'Forecast scope validation failed';
  end if;

  insert into public.forecast_runs (
    organization_id,
    project_id,
    scenario_id,
    model_version,
    input_hash,
    inputs,
    result,
    status,
    created_by
  )
  values (
    p_organization_id,
    p_project_id,
    p_scenario_id,
    p_model_version,
    p_input_hash,
    p_inputs,
    p_result,
    'completed',
    p_created_by
  )
  returning id into v_run_id;

  insert into public.forecast_values (
    forecast_run_id,
    organization_id,
    scenario_id,
    fiscal_year,
    metric,
    value,
    unit,
    formula_key
  )
  select
    v_run_id,
    p_organization_id,
    p_scenario_id,
    value_row.fiscal_year,
    value_row.metric,
    value_row.value,
    value_row.unit,
    value_row.formula_key
  from jsonb_to_recordset(p_values) as value_row(
    fiscal_year integer,
    metric text,
    value numeric,
    unit text,
    formula_key text
  );

  insert into public.audit_logs (
    organization_id,
    project_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    p_organization_id,
    p_project_id,
    p_created_by,
    'forecast.completed',
    'forecast_run',
    v_run_id::text,
    jsonb_build_object(
      'modelVersion', p_model_version,
      'inputHash', p_input_hash,
      'balanceValid', true
    )
  );

  return v_run_id;
end;
$$;

revoke all on function public.record_forecast_run(
  uuid, uuid, uuid, text, text, jsonb, jsonb, jsonb, uuid
) from public, anon, authenticated;
grant execute on function public.record_forecast_run(
  uuid, uuid, uuid, text, text, jsonb, jsonb, jsonb, uuid
) to service_role;

create or replace function public.record_ai_suggestion(
  p_organization_id uuid,
  p_project_id uuid,
  p_scenario_id uuid,
  p_suggestion_type text,
  p_model text,
  p_prompt_version text,
  p_input_summary jsonb,
  p_output jsonb,
  p_created_by uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_suggestion_id uuid;
begin
  if not exists (
    select 1
    from public.projects
    where id = p_project_id
      and organization_id = p_organization_id
  ) then
    raise exception 'AI suggestion scope validation failed';
  end if;

  if p_scenario_id is not null and not exists (
    select 1
    from public.scenarios
    where id = p_scenario_id
      and project_id = p_project_id
      and organization_id = p_organization_id
  ) then
    raise exception 'AI scenario scope validation failed';
  end if;

  insert into public.ai_suggestions (
    organization_id,
    project_id,
    scenario_id,
    suggestion_type,
    model,
    prompt_version,
    input_summary,
    output,
    status,
    created_by
  )
  values (
    p_organization_id,
    p_project_id,
    p_scenario_id,
    p_suggestion_type,
    p_model,
    p_prompt_version,
    p_input_summary,
    p_output,
    'suggested',
    p_created_by
  )
  returning id into v_suggestion_id;

  insert into public.audit_logs (
    organization_id,
    project_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    p_organization_id,
    p_project_id,
    p_created_by,
    'ai_suggestion.created',
    'ai_suggestion',
    v_suggestion_id::text,
    jsonb_build_object(
      'suggestionType', p_suggestion_type,
      'model', p_model,
      'promptVersion', p_prompt_version
    )
  );

  return v_suggestion_id;
end;
$$;

revoke all on function public.record_ai_suggestion(
  uuid, uuid, uuid, text, text, text, jsonb, jsonb, uuid
) from public, anon, authenticated;
grant execute on function public.record_ai_suggestion(
  uuid, uuid, uuid, text, text, text, jsonb, jsonb, uuid
) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'strategy-files',
  'strategy-files',
  false,
  52428800,
  array[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "members can read organization files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'strategy-files'
  and public.is_org_member(((storage.foldername(name))[1])::uuid)
);

create policy "editors can upload organization files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'strategy-files'
  and public.has_org_role(
    ((storage.foldername(name))[1])::uuid,
    array['owner', 'admin', 'consultant', 'editor']
  )
);

create policy "editors can update organization files"
on storage.objects for update
to authenticated
using (
  bucket_id = 'strategy-files'
  and public.has_org_role(
    ((storage.foldername(name))[1])::uuid,
    array['owner', 'admin', 'consultant', 'editor']
  )
)
with check (
  bucket_id = 'strategy-files'
  and public.has_org_role(
    ((storage.foldername(name))[1])::uuid,
    array['owner', 'admin', 'consultant', 'editor']
  )
);

create policy "editors can delete organization files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'strategy-files'
  and public.has_org_role(
    ((storage.foldername(name))[1])::uuid,
    array['owner', 'admin', 'consultant', 'editor']
  )
);

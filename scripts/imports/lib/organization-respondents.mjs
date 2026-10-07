function normalizePersonName(value) {
  return String(value ?? "").trim().toLocaleLowerCase("pt-BR");
}

function selectOrganizationRespondent(acronym, profiles, preferredName) {
  if (profiles.length === 0) {
    throw new Error(`${acronym}: nenhum respondente vinculado à organização.`);
  }
  if (profiles.length === 1) return profiles[0];

  const preferred = normalizePersonName(preferredName);
  const matches = profiles.filter(
    (profile) => normalizePersonName(profile.full_name) === preferred,
  );
  if (matches.length === 1) return matches[0];

  throw new Error(
    `${acronym}: a organização tem ${profiles.length} pessoas cadastradas; o diagnóstico precisa corresponder ao nome de exatamente uma delas.`,
  );
}

export async function loadOrganizationsAndRespondents(supabase, manifest, accounts) {
  const { data: organizations, error: organizationError } = await supabase
    .from("organizations")
    .select("id,name,acronym");
  if (organizationError) throw organizationError;
  const organizationByAcronym = new Map(
    (organizations ?? []).map((organization) => [organization.acronym.toUpperCase(), organization]),
  );

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("user_id,organization_id,full_name")
    .eq("role", "respondent");
  if (profileError) throw profileError;
  const respondentsByOrganization = new Map();
  for (const profile of profiles ?? []) {
    const current = respondentsByOrganization.get(profile.organization_id) ?? [];
    current.push(profile);
    respondentsByOrganization.set(profile.organization_id, current);
  }

  const organizationIds = [];
  const seenOrganizationIds = new Set();
  const accountsByAcronym = new Map();
  for (const account of accounts) {
    const organization = organizationByAcronym.get(account.organizationAcronym.toUpperCase());
    if (!organization) throw new Error(`Organização ${account.organizationAcronym} não cadastrada.`);
    if (!seenOrganizationIds.has(organization.id)) {
      seenOrganizationIds.add(organization.id);
      organizationIds.push(organization.id);
    }
    const key = account.organizationAcronym.toUpperCase();
    const current = accountsByAcronym.get(key) ?? [];
    current.push(account);
    accountsByAcronym.set(key, current);
  }

  const targets = new Map();
  for (const record of manifest.records) {
    const acronym = record.organization_acronym.toUpperCase();
    if (!accountsByAcronym.has(acronym)) {
      throw new Error(`${record.organization_acronym}: órgão não consta no seed oficial.`);
    }
    const organization = organizationByAcronym.get(acronym);
    if (!organization) {
      throw new Error(`${record.organization_acronym}: órgão não consta no seed oficial.`);
    }
    const profilesForOrganization = respondentsByOrganization.get(organization.id) ?? [];
    targets.set(record.organization_acronym, {
      organization,
      profile: selectOrganizationRespondent(
        record.organization_acronym,
        profilesForOrganization,
        record.respondent.full_name,
      ),
    });
  }

  return {
    targets,
    allOrganizationIds: organizationIds,
  };
}

import { randomBytes } from "node:crypto";

export const RESPONDENT_SEED_HEADERS = [
  "organization_name",
  "organization_acronym",
  "email",
  "full_name",
];

export const RESPONDENT_CREDENTIAL_HEADERS = [
  "organization_acronym",
  "email",
  "temporary_password",
];

const COMMON_WEAK_PASSWORDS = new Set([
  "password",
  "senha123",
  "senha1234",
  "qwerty123",
]);

export function parseCsv(csv) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    if (quoted) {
      if (char === '"' && csv[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
      continue;
    }

    if (char === '"') {
      if (value.length > 0) {
        throw new Error("CSV inválido: aspas devem iniciar o campo.");
      }
      quoted = true;
    } else if (char === ",") {
      row.push(value.trim());
      value = "";
    } else if (char === "\n") {
      row.push(value.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = "";
    } else if (char !== "\r") {
      value += char;
    }
  }

  if (quoted) throw new Error("CSV inválido: campo com aspas não foi fechado.");
  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function assertHeaders(headers) {
  const normalized = headers.map((header) => header.trim().toLowerCase());
  if (
    normalized.length !== RESPONDENT_SEED_HEADERS.length
    || normalized.some((header, index) => header !== RESPONDENT_SEED_HEADERS[index])
  ) {
    throw new Error(
      `Cabeçalho inválido. Use: ${RESPONDENT_SEED_HEADERS.join(",")}`,
    );
  }
}

function assertEmail(email, lineNumber) {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error(`Linha ${lineNumber}: e-mail inválido.`);
  }
}

function assertAcronym(acronym, lineNumber) {
  if (!/^[A-Z0-9]+(?:\/[A-Z0-9]+)*$/.test(acronym)) {
    throw new Error(
      `Linha ${lineNumber}: sigla inválida; use letras, números e barras internas.`,
    );
  }
}

export function parseRespondentSeed(csv) {
  const rows = parseCsv(csv);
  if (rows.length < 2) throw new Error("O arquivo não contém respondentes.");
  assertHeaders(rows[0]);

  const emails = new Set();
  const acronyms = new Set();
  const result = [];

  for (let index = 1; index < rows.length; index += 1) {
    const lineNumber = index + 1;
    const row = rows[index];
    if (row.length !== RESPONDENT_SEED_HEADERS.length) {
      throw new Error(
        `Linha ${lineNumber}: esperado ${RESPONDENT_SEED_HEADERS.length} campos.`,
      );
    }

    const organizationName = row[0].trim();
    const organizationAcronym = row[1].trim().toUpperCase();
    const email = row[2].trim().toLowerCase();
    const fullName = row[3].trim();

    if (!organizationName) {
      throw new Error(`Linha ${lineNumber}: nome da organização é obrigatório.`);
    }
    assertAcronym(organizationAcronym, lineNumber);
    assertEmail(email, lineNumber);

    if (emails.has(email)) {
      throw new Error(`Linha ${lineNumber}: e-mail duplicado no arquivo.`);
    }
    if (acronyms.has(organizationAcronym)) {
      throw new Error(`Linha ${lineNumber}: sigla duplicada no arquivo.`);
    }

    emails.add(email);
    acronyms.add(organizationAcronym);
    result.push({ organizationName, organizationAcronym, email, fullName });
  }

  return result;
}

export function emailDeliveryWarning(email) {
  const [localPart = "", domain = ""] = email.toLowerCase().split("@");
  if (domain === "gmail.com" && localPart.includes("/")) {
    return "endereços Gmail normalmente não aceitam barra no nome da conta; recuperação por e-mail pode não funcionar";
  }
  if (["gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "yahoo.com.br"].includes(domain)) {
    return "endereço em provedor público: confirme a titularidade antes de liberar a conta em produção";
  }
  return null;
}

export function generateTemporaryPassword() {
  // Prefixo garante explicitamente as quatro classes exigidas pela plataforma:
  // maiúscula, minúscula, número e símbolo. A parte aleatória evita repetição.
  return `Ori!7${randomBytes(18).toString("base64url")}`;
}

export function isWeakPassword(password) {
  const normalized = password.trim().toLowerCase();
  if (password.length < 12 || COMMON_WEAK_PASSWORDS.has(normalized)) return true;
  if (/^\d+$/.test(password) || /^(.)\1+$/.test(password)) return true;

  const classes = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;
  return classes < 4;
}


export function parseRespondentCredentials(csv) {
  const rows = parseCsv(csv);
  if (rows.length < 2) throw new Error("O arquivo não contém credenciais.");

  const headers = rows[0].map((header) => header.trim().toLowerCase());
  if (
    headers.length !== RESPONDENT_CREDENTIAL_HEADERS.length
    || headers.some((header, index) => header !== RESPONDENT_CREDENTIAL_HEADERS[index])
  ) {
    throw new Error(
      `Cabeçalho de credenciais inválido. Use: ${RESPONDENT_CREDENTIAL_HEADERS.join(",")}`,
    );
  }

  const emails = new Set();
  const acronyms = new Set();
  const result = [];

  for (let index = 1; index < rows.length; index += 1) {
    const lineNumber = index + 1;
    const row = rows[index];
    if (row.length !== RESPONDENT_CREDENTIAL_HEADERS.length) {
      throw new Error(
        `Linha ${lineNumber}: esperado ${RESPONDENT_CREDENTIAL_HEADERS.length} campos de credencial.`,
      );
    }

    const organizationAcronym = row[0].trim().toUpperCase();
    const email = row[1].trim().toLowerCase();
    const temporaryPassword = row[2];

    assertAcronym(organizationAcronym, lineNumber);
    assertEmail(email, lineNumber);
    if (isWeakPassword(temporaryPassword)) {
      throw new Error(
        `Linha ${lineNumber}: a senha temporária deve ter ao menos 12 caracteres com maiúscula, minúscula, número e símbolo.`,
      );
    }
    if (emails.has(email)) {
      throw new Error(`Linha ${lineNumber}: e-mail duplicado no arquivo de credenciais.`);
    }
    if (acronyms.has(organizationAcronym)) {
      throw new Error(`Linha ${lineNumber}: sigla duplicada no arquivo de credenciais.`);
    }

    emails.add(email);
    acronyms.add(organizationAcronym);
    result.push({ organizationAcronym, email, temporaryPassword });
  }

  return result;
}

export function credentialPasswordResolver(credentials, respondents) {
  const byEmail = new Map(credentials.map((item) => [item.email, item]));
  const respondentEmails = new Set(respondents.map((item) => item.email));

  for (const respondent of respondents) {
    const credential = byEmail.get(respondent.email);
    if (!credential) {
      throw new Error(`Credencial ausente para ${respondent.organizationAcronym} / ${respondent.email}.`);
    }
    if (credential.organizationAcronym !== respondent.organizationAcronym) {
      throw new Error(
        `A credencial de ${respondent.email} pertence à sigla ${credential.organizationAcronym}, não ${respondent.organizationAcronym}.`,
      );
    }
  }

  const extras = credentials.filter((item) => !respondentEmails.has(item.email));
  if (extras.length > 0) {
    throw new Error(
      `Há ${extras.length} credencial(is) sem respondente correspondente: ${extras.map((item) => item.email).join(", ")}.`,
    );
  }

  return (respondent) => {
    const credential = byEmail.get(respondent.email);
    if (!credential) throw new Error(`Credencial ausente para ${respondent.email}.`);
    return credential.temporaryPassword;
  };
}

export function resolvePasswordFactory({ mode, fixedPassword }) {
  if (mode === "unique") return () => generateTemporaryPassword();
  if (mode !== "fixed") {
    throw new Error("Modo de senha inválido. Use 'unique' ou 'fixed'.");
  }
  if (!fixedPassword) {
    throw new Error(
      "Modo fixed exige a variável indicada em --password-env.",
    );
  }
  if (fixedPassword.length < 12) {
    throw new Error("A senha fixa precisa ter ao menos 12 caracteres.");
  }
  if (isWeakPassword(fixedPassword)) {
    throw new Error(
      "A senha fixa não atende à política de segurança. Use ao menos 12 caracteres com maiúscula, minúscula, número e símbolo.",
    );
  }
  return () => fixedPassword;
}

function escapeCsvValue(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export function serializeCredentials(credentials) {
  const header = ["organization_acronym", "email", "temporary_password", "operation"];
  const lines = [header.map(escapeCsvValue).join(",")];
  for (const item of credentials) {
    lines.push([
      item.organizationAcronym,
      item.email,
      item.password,
      item.operation,
    ].map(escapeCsvValue).join(","));
  }
  return `${lines.join("\n")}\n`;
}

export function normalizeOrganizationName(name) {
  return name.trim().toLocaleLowerCase("pt-BR");
}

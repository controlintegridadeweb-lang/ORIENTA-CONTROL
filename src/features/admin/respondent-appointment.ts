export const RESPONDENT_APPOINTMENTS = ["titular", "suplente"] as const;

export type RespondentAppointment = (typeof RESPONDENT_APPOINTMENTS)[number];

export const respondentAppointmentLabels: Record<RespondentAppointment, string> = {
  titular: "Titular",
  suplente: "Suplente",
};

export function isRespondentAppointment(value: string): value is RespondentAppointment {
  return (RESPONDENT_APPOINTMENTS as readonly string[]).includes(value);
}

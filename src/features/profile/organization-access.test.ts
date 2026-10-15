import { describe, expect, it } from "vitest";
import {
  groupOrganizationAccess,
  organizationAccessDisplayName,
  type OrganizationAccessMember,
} from "./organization-access";

function member(
  partial: Partial<OrganizationAccessMember> & Pick<OrganizationAccessMember, "userId">,
): OrganizationAccessMember {
  return {
    fullName: null,
    email: null,
    appointment: null,
    ...partial,
  };
}

describe("acesso do órgão no perfil", () => {
  it("separa titular, suplente e cargo ainda não definido, em ordem alfabética", () => {
    const groups = groupOrganizationAccess([
      member({ userId: "3", fullName: "Carla", appointment: "suplente" }),
      member({ userId: "1", fullName: "Bruno", appointment: "titular" }),
      member({ userId: "4", fullName: "Ana", appointment: "titular" }),
      member({ userId: "2", fullName: "Davi", appointment: null }),
    ]);

    expect(groups.titulares.map((item) => item.fullName)).toEqual(["Ana", "Bruno"]);
    expect(groups.suplentes.map((item) => item.fullName)).toEqual(["Carla"]);
    expect(groups.unassigned.map((item) => item.fullName)).toEqual(["Davi"]);
  });

  it("usa o e-mail quando o nome não foi preenchido", () => {
    expect(
      organizationAccessDisplayName(
        member({ userId: "1", email: "ana@org.gov.br" }),
      ),
    ).toBe("ana@org.gov.br");
  });
});

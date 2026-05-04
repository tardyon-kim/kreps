import type { Role } from "@kreps/shared";
import type { Dictionary } from "../../i18n/dictionaries.js";
import { useI18n } from "../../i18n/I18nProvider.js";

type DirectoryRole = Extract<Role, "system_admin" | "organization_admin" | "work_manager" | "employee">;

const organizationRows = [
  { name: "\ubcf8\uc0ac", code: "HQ", depth: 0 },
  { name: "\uc81c\ud488\ud300", code: "PRODUCT", depth: 1 },
];

const userRows: { name: string; organization: string; roles: DirectoryRole[] }[] = [
  { name: "System Admin", organization: "\ubcf8\uc0ac", roles: ["system_admin"] },
  { name: "Organization Lead", organization: "\uc81c\ud488\ud300", roles: ["organization_admin", "work_manager"] },
  { name: "Employee", organization: "\uc81c\ud488\ud300", roles: ["employee"] },
];

const roleLabelKeys = {
  system_admin: "systemAdmin",
  organization_admin: "organizationAdmin",
  work_manager: "workManager",
  employee: "employee",
} as const satisfies Record<DirectoryRole, keyof Dictionary["roles"]>;

export function OrganizationPage() {
  const { dictionary } = useI18n();

  return (
    <section className="directory-page">
      <div className="work-home-header">
        <span className="eyebrow">{dictionary.organizationPage.treeTitle}</span>
        <h1>{dictionary.organizationPage.title}</h1>
        <p>{dictionary.organizationPage.subtitle}</p>
      </div>

      <div className="directory-grid">
        <section className="content-panel">
          <h2>{dictionary.organizationPage.treeTitle}</h2>
          <table className="work-table">
            <thead>
              <tr>
                <th>{dictionary.organizationPage.organizationColumn}</th>
                <th>{dictionary.organizationPage.codeColumn}</th>
              </tr>
            </thead>
            <tbody>
              {organizationRows.map((row) => (
                <tr key={row.code}>
                  <td>
                    <span className="tree-cell" style={{ paddingLeft: `${row.depth * 18}px` }}>
                      {row.name}
                    </span>
                  </td>
                  <td>{row.code}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="content-panel">
          <h2>{dictionary.organizationPage.usersTitle}</h2>
          <table className="work-table">
            <thead>
              <tr>
                <th>{dictionary.organizationPage.userColumn}</th>
                <th>{dictionary.organizationPage.organizationColumn}</th>
                <th>{dictionary.organizationPage.roleColumn}</th>
              </tr>
            </thead>
            <tbody>
              {userRows.map((row) => (
                <tr key={row.name}>
                  <td>{row.name}</td>
                  <td>{row.organization}</td>
                  <td>
                    <span className="role-badge-list">
                      {row.roles.map((role) => (
                        <span className="status-badge" data-tone="waiting" key={role}>
                          {dictionary.roles[roleLabelKeys[role]]}
                        </span>
                      ))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </section>
  );
}

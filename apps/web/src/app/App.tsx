import { I18nProvider, useI18n } from "../i18n/I18nProvider.js";
import { ThemeProvider } from "../theme/ThemeProvider.js";
import { AppShell } from "../components/AppShell.js";
import { StatusBadge } from "../components/primitives/StatusBadge.js";
import "../theme/theme.css";

export function App() {
  return (
    <I18nProvider initialLocale="ko">
      <ThemeProvider initialTheme="system">
        <AppShell>
          <MyWorkHome />
        </AppShell>
      </ThemeProvider>
    </I18nProvider>
  );
}

function MyWorkHome() {
  const { dictionary } = useI18n();
  const rows = [
    {
      work: dictionary.nav.newWork,
      owner: "Work Manager",
      status: dictionary.status.registered,
      tone: "waiting" as const,
      due: "Today",
    },
    {
      work: dictionary.home.review,
      owner: "Employee",
      status: dictionary.status.reviewNeeded,
      tone: "review" as const,
      due: "D+1",
    },
    {
      work: dictionary.home.today,
      owner: "Product",
      status: dictionary.status.inProgress,
      tone: "active" as const,
      due: "D+3",
    },
  ];

  return (
    <section className="work-home">
      <div className="work-home-header">
        <span className="eyebrow">{dictionary.home.eyebrow}</span>
        <h1>{dictionary.home.title}</h1>
        <p>{dictionary.home.subtitle}</p>
      </div>

      <div className="metric-grid" aria-label={dictionary.home.eyebrow}>
        <Metric value="12" label={dictionary.home.today} />
        <Metric value="4" label={dictionary.home.review} />
        <Metric value="2" label={dictionary.home.overdue} />
        <Metric value="7" label={dictionary.home.unassigned} />
      </div>

      <div className="home-grid">
        <section className="content-panel">
          <h2>{dictionary.home.tableTitle}</h2>
          <table className="work-table">
            <thead>
              <tr>
                <th>{dictionary.home.columnWork}</th>
                <th>{dictionary.home.columnOwner}</th>
                <th>{dictionary.home.columnStatus}</th>
                <th>{dictionary.home.columnDue}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.work}-${row.status}`}>
                  <td>{row.work}</td>
                  <td>{row.owner}</td>
                  <td>
                    <StatusBadge tone={row.tone}>{row.status}</StatusBadge>
                  </td>
                  <td>{row.due}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <aside className="content-panel">
          <h2>{dictionary.home.focusTitle}</h2>
          <p className="focus-copy">{dictionary.home.focusBody}</p>
        </aside>
      </div>
    </section>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="metric-card">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

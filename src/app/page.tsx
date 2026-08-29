import { InboxRow } from "@/components/InboxRow";
import { RefreshBanner } from "@/components/RefreshBanner";
import { pinnedSearches } from "@/config/pinned-searches";
import { listInbox, listLatestRuns } from "@/lib/db/queries";

export default async function Home() {
  let jobs;
  let runs;

  try {
    [jobs, runs] = await Promise.all([listInbox(), listLatestRuns()]);
  } catch {
    return <p>Database unavailable.</p>;
  }

  return (
    <main className="page">
      <header className="page-header">
        <h1>Inbox</h1>
        <nav className="pinned-searches" aria-label="Pinned searches">
          {pinnedSearches.map((search) => (
            <a
              key={search.id}
              href={search.href}
              target="_blank"
              rel="noreferrer"
            >
              {search.label}
            </a>
          ))}
        </nav>
        <RefreshBanner runs={runs} />
      </header>

      {jobs.length === 0 ? (
        <p className="empty-state">No jobs in inbox.</p>
      ) : (
        <ul className="job-list">
          {jobs.map((job) => (
            <li key={job.id}>
              <InboxRow job={job} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

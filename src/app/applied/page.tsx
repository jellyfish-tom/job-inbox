import { AppliedRow } from "@/components/AppliedRow";
import { listApplied } from "@/lib/db/queries";

export default async function AppliedPage() {
  const jobs = await listApplied();

  return (
    <main className="page">
      <header className="page-header">
        <h1>Applied ({jobs.length})</h1>
      </header>

      {jobs.length === 0 ? (
        <p className="empty-state">No applied jobs yet.</p>
      ) : (
        <ul className="job-list">
          {jobs.map((job) => (
            <AppliedRow key={job.id} job={job} />
          ))}
        </ul>
      )}
    </main>
  );
}

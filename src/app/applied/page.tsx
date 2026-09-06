import { SemanticHeader, SemanticMain, TextH1, TextP } from "@proteus-ui/core";
import { AppliedRow } from "@/components/AppliedRow";
import { listApplied } from "@/lib/db/queries";

export default async function AppliedPage() {
  const jobs = await listApplied();

  return (
    <SemanticMain className="page">
      <SemanticHeader className="page-header">
        <TextH1>{`Applied (${jobs.length})`}</TextH1>
      </SemanticHeader>

      {jobs.length === 0 ? (
        <TextP className="empty-state">No applied jobs yet.</TextP>
      ) : (
        <ul className="job-list">
          {jobs.map((job) => (
            <AppliedRow key={job.id} job={job} />
          ))}
        </ul>
      )}
    </SemanticMain>
  );
}

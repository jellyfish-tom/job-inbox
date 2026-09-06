import { Semantic, Text } from "@proteus-ui/core";
import { AppliedRow } from "@/components/AppliedRow";
import { listApplied } from "@/lib/db/queries";

export default async function AppliedPage() {
  const jobs = await listApplied();

  return (
    <Semantic.Main className="page">
      <Semantic.Header className="page-header">
        <Text.H1>{`Applied (${jobs.length})`}</Text.H1>
      </Semantic.Header>

      {jobs.length === 0 ? (
        <Text.P className="empty-state">No applied jobs yet.</Text.P>
      ) : (
        <ul className="job-list">
          {jobs.map((job) => (
            <AppliedRow key={job.id} job={job} />
          ))}
        </ul>
      )}
    </Semantic.Main>
  );
}

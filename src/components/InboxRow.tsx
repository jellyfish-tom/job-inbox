import { Button, Card } from "@proteus-ui/core";
import { rejectJobAction } from "@/app/actions/jobs";
import { ApplyButton } from "@/components/ApplyButton";
import type { JobRow } from "@/lib/db/queries";
import { formatSalary } from "@/lib/salary";

function SkillDetails({
  label,
  skills,
}: {
  label: string;
  skills: string[];
}) {
  if (skills.length === 0) return null;
  return (
    <details>
      <summary>{label}</summary>
      <ul>
        {skills.map((skill) => (
          <li key={skill}>{skill}</li>
        ))}
      </ul>
    </details>
  );
}

export function InboxRow({ job }: { job: JobRow }) {
  const salary = formatSalary(job);
  const hasSkills =
    job.hardRequired.length > 0 ||
    job.hardNice.length > 0 ||
    job.softRequired.length > 0 ||
    job.softNice.length > 0;

  return (
    <Card
      title={
        <div className="job-heading">
          <div>
            <a href={job.url} target="_blank" rel="noreferrer">
              {job.title}
            </a>
            <span className="job-meta">
              {job.company} · {job.source}
            </span>
          </div>
          <span className="job-salary">{salary}</span>
        </div>
      }
      footer={
        <div className="job-actions">
          <ApplyButton id={job.id} url={job.url} />
          <form action={rejectJobAction.bind(null, job.id)}>
            <Button type="submit" intent="danger">
              Reject
            </Button>
          </form>
        </div>
      }
    >
      {hasSkills ? (
        <div className="job-details">
          <SkillDetails label="Hard required" skills={job.hardRequired} />
          <SkillDetails label="Hard nice" skills={job.hardNice} />
          <SkillDetails label="Soft required" skills={job.softRequired} />
          <SkillDetails label="Soft nice" skills={job.softNice} />
        </div>
      ) : null}
    </Card>
  );
}

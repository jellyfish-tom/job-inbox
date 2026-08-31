import { Button, Card } from "@proteus-ui/core";
import { rejectJobAction } from "@/app/actions/jobs";
import { ApplyButton } from "@/components/ApplyButton";
import type { JobRow } from "@/lib/db/queries";

function formatSalary(job: JobRow): string | null {
  if (job.salaryRaw) return job.salaryRaw;
  if (job.salaryMin != null || job.salaryMax != null) {
    const min = job.salaryMin ?? "";
    const max = job.salaryMax ?? "";
    const currency = job.salaryCurrency ?? "";
    return `${min}–${max} ${currency}`.trim();
  }
  return null;
}

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
  const hasDetails =
    salary != null ||
    job.hardRequired.length > 0 ||
    job.hardNice.length > 0 ||
    job.softRequired.length > 0 ||
    job.softNice.length > 0;

  return (
    <Card
      title={
        <>
          <a href={job.url} target="_blank" rel="noreferrer">
            {job.title}
          </a>
          <span className="job-meta">
            {job.company} · {job.source} · Track {job.track}
          </span>
        </>
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
      {hasDetails ? (
        <div className="job-details">
          {salary ? (
            <details>
              <summary>Salary</summary>
              <p>{salary}</p>
            </details>
          ) : null}
          <SkillDetails label="Hard required" skills={job.hardRequired} />
          <SkillDetails label="Hard nice" skills={job.hardNice} />
          <SkillDetails label="Soft required" skills={job.softRequired} />
          <SkillDetails label="Soft nice" skills={job.softNice} />
        </div>
      ) : null}
    </Card>
  );
}

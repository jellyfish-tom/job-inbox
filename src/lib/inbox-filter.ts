import type { JobRow } from "@/lib/db/queries";
import type { SourceId } from "@/types/job";

export type ViewQuery = {
  text: string;
  sources: SourceId[];
};

function jobText(job: JobRow): string {
  return [job.title, job.company, ...job.hardRequired, ...job.hardNice]
    .join(" ")
    .toLowerCase();
}

export function filterJobs(jobs: JobRow[], query: ViewQuery): JobRow[] {
  const text = query.text.trim().toLowerCase();
  return jobs.filter((job) => {
    if (query.sources.length > 0 && !query.sources.includes(job.source)) {
      return false;
    }
    if (text !== "" && !jobText(job).includes(text)) return false;
    return true;
  });
}

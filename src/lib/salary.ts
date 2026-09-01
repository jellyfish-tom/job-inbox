export function formatSalary(job: {
  salaryRaw: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
}): string {
  if (job.salaryRaw && !isZeroRange(job.salaryRaw)) {
    return job.salaryRaw;
  }
  if (isPositive(job.salaryMin) || isPositive(job.salaryMax)) {
    const min = isPositive(job.salaryMin) ? job.salaryMin : "";
    const max = isPositive(job.salaryMax) ? job.salaryMax : "";
    const range = [min, max].filter((part) => part !== "").join("–");
    return `${range} ${job.salaryCurrency ?? ""}`.trim();
  }
  return "undisclosed";
}

function isPositive(value: number | null): value is number {
  return value != null && value > 0;
}

function isZeroRange(raw: string): boolean {
  const nums = raw.match(/\d+(?:\.\d+)?/g);
  if (!nums || nums.length === 0) return false;
  return nums.every((n) => Number(n) === 0);
}

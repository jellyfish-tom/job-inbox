"use client";

import { Card, Checkbox, Semantic, Text } from "@proteus-ui/core";
import { applyJobAction } from "@/app/actions/jobs";
import { ApplyButton } from "@/components/ApplyButton";
import { useOfferExit } from "@/hooks/use-offer-exit";
import type { JobRow } from "@/lib/db/queries";
import { formatSalary } from "@/lib/salary";

const REQUIRED_PREVIEW = 5;

function SkillDetails({
  label,
  skills,
}: {
  label: string;
  skills: string[];
}) {
  if (skills.length === 0) return null;
  return (
    <Semantic.Details>
      <Semantic.Summary>
        <Text.Span>{label}</Text.Span>
      </Semantic.Summary>
      <ul>
        {skills.map((skill) => (
          <li key={skill}>
            <Text.Span>{skill}</Text.Span>
          </li>
        ))}
      </ul>
    </Semantic.Details>
  );
}

function RequiredSkills({ skills }: { skills: string[] }) {
  if (skills.length === 0) return null;
  const preview = skills.slice(0, REQUIRED_PREVIEW).join(", ");
  if (skills.length <= REQUIRED_PREVIEW) {
    return <Text.P className="job-requireds">{preview}</Text.P>;
  }
  return (
    <Semantic.Details>
      <Semantic.Summary>
        <Text.Span>{preview}</Text.Span>
      </Semantic.Summary>
      <ul>
        {skills.slice(REQUIRED_PREVIEW).map((skill) => (
          <li key={skill}>
            <Text.Span>{skill}</Text.Span>
          </li>
        ))}
      </ul>
    </Semantic.Details>
  );
}

export function InboxRow({
  job,
  selected,
  onSelectedChange,
  exiting,
  selectDisabled,
}: {
  job: JobRow;
  selected: boolean;
  onSelectedChange: (selected: boolean) => void;
  exiting?: boolean;
  selectDisabled?: boolean;
}) {
  const salary = formatSalary(job);
  const { phase, which, minWidth, run } = useOfferExit();
  const busy = phase !== "idle";
  const leaving = exiting || phase === "exiting";
  const hasSkills =
    job.hardRequired.length > 0 ||
    job.hardNice.length > 0 ||
    job.softRequired.length > 0 ||
    job.softNice.length > 0;

  if (phase === "gone") return null;

  return (
    <li className={`offer-exit${leaving ? " offer-exit--out" : ""}`}>
      <div className="offer-exit-inner">
        <Card>
          <Card.Title>
            <div className="job-heading">
              <div className="job-heading-main">
                <Checkbox
                  checked={selected}
                  disabled={selectDisabled}
                  onCheckedChange={onSelectedChange}
                  aria-label={`Select ${job.title}`}
                />
                <div>
                  <Text.A href={job.url} target="_blank" rel="noreferrer">
                    {job.title}
                  </Text.A>
                  <Text.Span className="job-meta">
                    {job.company} · {job.source}
                  </Text.Span>
                </div>
              </div>
              <Text.Span className="job-salary">{salary}</Text.Span>
            </div>
          </Card.Title>
          {hasSkills ? (
            <Card.Body>
              <div className="job-details">
                <RequiredSkills skills={job.hardRequired} />
                <SkillDetails label="Hard nice" skills={job.hardNice} />
                <SkillDetails label="Soft required" skills={job.softRequired} />
                <SkillDetails label="Soft nice" skills={job.softNice} />
              </div>
            </Card.Body>
          ) : null}
          <Card.Footer>
            <div className="job-actions">
              <ApplyButton
                url={job.url}
                pending={which === "apply"}
                disabled={busy}
                minWidth={which === "apply" ? minWidth : undefined}
                onApply={(button) => {
                  void run(
                    "apply",
                    button,
                    () => applyJobAction(job.id),
                    `Applied ${job.title}`,
                    `Could not apply ${job.title}`,
                  );
                }}
              />
            </div>
          </Card.Footer>
        </Card>
      </div>
    </li>
  );
}

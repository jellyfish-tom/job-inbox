"use client";

import {
  Card,
  Checkbox,
  SemanticDetails,
  SemanticSummary,
  Text,
  TextA,
  TextP,
  TextSpan,
} from "@proteus-ui/core";
import { applyJobAction } from "@/app/actions/jobs";
import { ApplyButton } from "@/components/ApplyButton";
import { useOfferExit } from "@/hooks/use-offer-exit";
import type { JobRow } from "@/lib/db/queries";
import { formatSalary } from "@/lib/salary";

const REQUIRED_PREVIEW = 5;

function SkillDetails({ label, skills }: { label: string; skills: string[] }) {
  if (skills.length === 0) return null;
  return (
    <SemanticDetails>
      <SemanticSummary>
        <TextSpan>{label}</TextSpan>
      </SemanticSummary>
      <ul>
        {skills.map((skill) => (
          <li key={skill}>
            <TextSpan>{skill}</TextSpan>
          </li>
        ))}
      </ul>
    </SemanticDetails>
  );
}

function RequiredSkills({ skills }: { skills: string[] }) {
  if (skills.length === 0) return null;
  const preview = skills.slice(0, REQUIRED_PREVIEW).join(", ");
  if (skills.length <= REQUIRED_PREVIEW) {
    return <TextP className="job-requireds">{preview}</TextP>;
  }
  return (
    <SemanticDetails>
      <SemanticSummary>
        <TextSpan>{preview}</TextSpan>
      </SemanticSummary>
      <ul>
        {skills.slice(REQUIRED_PREVIEW).map((skill) => (
          <li key={skill}>
            <TextSpan>{skill}</TextSpan>
          </li>
        ))}
      </ul>
    </SemanticDetails>
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
                <Text.H3>
                  <TextA href={job.url} target="_blank" rel="noreferrer">
                    {job.title}
                  </TextA>
                </Text.H3>
                <TextSpan className="job-meta">
                  {job.company} · {job.source}
                </TextSpan>
              </div>
              <TextSpan className="job-salary">{salary}</TextSpan>
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

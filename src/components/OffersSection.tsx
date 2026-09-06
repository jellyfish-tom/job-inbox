"use client";

import { Section, TextP, TextSpan } from "@proteus-ui/core";
import { InboxFilter } from "@/components/InboxFilter";
import type { JobRow } from "@/lib/db/queries";

export function OffersSection({ jobs }: { jobs: JobRow[] }) {
  return (
    <Section>
      <Section.Title>
        <TextSpan>{`Offers (${jobs.length})`}</TextSpan>
      </Section.Title>
      <Section.Body>
        {jobs.length === 0 ? (
          <TextP className="empty-state">No jobs in inbox.</TextP>
        ) : (
          <InboxFilter jobs={jobs} />
        )}
      </Section.Body>
    </Section>
  );
}

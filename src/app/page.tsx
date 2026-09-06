import { Section, Semantic, Text } from "@proteus-ui/core";
import { InboxFilter } from "@/components/InboxFilter";
import { RefreshBanner } from "@/components/RefreshBanner";
import { pinnedSearches } from "@/config/pinned-searches";
import { listInbox, listLatestRuns } from "@/lib/db/queries";

export default async function Home() {
  let jobs;
  let runs;

  try {
    [jobs, runs] = await Promise.all([listInbox(), listLatestRuns()]);
  } catch {
    return <Text.P>Database unavailable.</Text.P>;
  }

  return (
    <Semantic.Main className="page">
      <Semantic.Header className="page-header">
        <Text.H1>Inbox</Text.H1>
        <Semantic.Nav className="pinned-searches" aria-label="Pinned searches">
          {pinnedSearches.map((search) => (
            <Text.A
              key={search.id}
              href={search.href}
              target="_blank"
              rel="noreferrer"
            >
              {search.label}
            </Text.A>
          ))}
        </Semantic.Nav>
        <RefreshBanner runs={runs} />
      </Semantic.Header>

      <Section>
        <Section.Title>
          <Text.Span>{`Offers (${jobs.length})`}</Text.Span>
        </Section.Title>
        <Section.Body>
          {jobs.length === 0 ? (
            <Text.P className="empty-state">No jobs in inbox.</Text.P>
          ) : (
            <InboxFilter jobs={jobs} />
          )}
        </Section.Body>
      </Section>
    </Semantic.Main>
  );
}

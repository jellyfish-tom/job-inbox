import {
  SemanticHeader,
  SemanticMain,
  SemanticNav,
  TextA,
  TextH1,
  TextP,
} from "@proteus-ui/core";
import { OffersSection } from "@/components/OffersSection";
import { RefreshBanner } from "@/components/RefreshBanner";
import { pinnedSearches } from "@/config/pinned-searches";
import { listInbox, listLatestRuns } from "@/lib/db/queries";

export default async function Home() {
  let jobs;
  let runs;

  try {
    [jobs, runs] = await Promise.all([listInbox(), listLatestRuns()]);
  } catch {
    return <TextP>Database unavailable.</TextP>;
  }

  return (
    <SemanticMain className="page">
      <SemanticHeader className="page-header">
        <TextH1>Inbox</TextH1>
        <SemanticNav className="pinned-searches" aria-label="Pinned searches">
          {pinnedSearches.map((search) => (
            <TextA
              key={search.id}
              href={search.href}
              target="_blank"
              rel="noreferrer"
            >
              {search.label}
            </TextA>
          ))}
        </SemanticNav>
        <RefreshBanner runs={runs} />
      </SemanticHeader>

      <OffersSection jobs={jobs} />
    </SemanticMain>
  );
}

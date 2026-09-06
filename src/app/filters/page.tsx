import { SemanticHeader, SemanticMain, TextH1, TextP } from "@proteus-ui/core";
import { FiltersEditor } from "@/components/FiltersEditor";
import { getAllSourceFilters } from "@/lib/db/queries";
import { getAdapter } from "@/lib/sources/registry";
import { SOURCE_IDS } from "@/types/job";

export default async function FiltersPage() {
  let configs;
  try {
    configs = await getAllSourceFilters();
  } catch {
    return <TextP>Database unavailable.</TextP>;
  }

  return (
    <SemanticMain className="page">
      <SemanticHeader className="page-header">
        <TextH1>Filters</TextH1>
      </SemanticHeader>
      {SOURCE_IDS.map((source) => (
        <FiltersEditor
          key={source}
          source={source}
          capabilities={getAdapter(source).capabilities}
          initial={configs[source]}
        />
      ))}
    </SemanticMain>
  );
}

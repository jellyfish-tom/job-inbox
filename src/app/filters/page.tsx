import { Semantic, Text } from "@proteus-ui/core";
import { FiltersEditor } from "@/components/FiltersEditor";
import { getAllSourceFilters } from "@/lib/db/queries";
import { getAdapter } from "@/lib/sources/registry";
import { SOURCE_IDS } from "@/types/job";

export default async function FiltersPage() {
  let configs;
  try {
    configs = await getAllSourceFilters();
  } catch {
    return <Text.P>Database unavailable.</Text.P>;
  }

  return (
    <Semantic.Main className="page">
      <Semantic.Header className="page-header">
        <Text.H1>Filters</Text.H1>
      </Semantic.Header>
      {SOURCE_IDS.map((source) => (
        <FiltersEditor
          key={source}
          source={source}
          capabilities={getAdapter(source).capabilities}
          initial={configs[source]}
        />
      ))}
    </Semantic.Main>
  );
}

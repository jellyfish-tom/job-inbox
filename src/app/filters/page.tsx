import { FiltersEditor } from "@/components/FiltersEditor";
import { getAllSourceFilters } from "@/lib/db/queries";
import { getAdapter } from "@/lib/sources/registry";
import { SOURCE_IDS } from "@/types/job";

export default async function FiltersPage() {
  let configs;
  try {
    configs = await getAllSourceFilters();
  } catch {
    return <p>Database unavailable.</p>;
  }

  return (
    <main className="page">
      <header className="page-header">
        <h1>Filters</h1>
      </header>
      {SOURCE_IDS.map((source) => (
        <FiltersEditor
          key={source}
          source={source}
          capabilities={getAdapter(source).capabilities}
          initial={configs[source]}
        />
      ))}
    </main>
  );
}

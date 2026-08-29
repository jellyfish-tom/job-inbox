import { FiltersEditor } from "@/components/FiltersEditor";
import { getAllFilterConfigs } from "@/lib/db/queries";

export default async function FiltersPage() {
  let configs;
  try {
    configs = await getAllFilterConfigs();
  } catch {
    return <p>Database unavailable.</p>;
  }

  return (
    <main className="page">
      <header className="page-header">
        <h1>Filters</h1>
      </header>
      <FiltersEditor track="A" initial={configs.A} />
      <FiltersEditor track="B" initial={configs.B} />
    </main>
  );
}

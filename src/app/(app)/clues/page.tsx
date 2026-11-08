import { getDashboardDataAction } from "@/app/actions/clues";
import { CluesWorkbench } from "@/components/clues/clues-workbench";

export default async function CluesPage() {
  const data = await getDashboardDataAction();
  const clues = data.clues || [];
  const regions = data.allRegions || [];
  const types = data.allTypes || [];

  return (
    <CluesWorkbench
      initialClues={clues}
      regions={regions}
      types={types}
    />
  );
}

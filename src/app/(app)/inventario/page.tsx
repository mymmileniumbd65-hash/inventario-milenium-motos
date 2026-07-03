import Header from '@/components/Header';
import { getGroups, getPartsWithMovements } from '@/db/queries';
import { computeParts, buildAlerts } from '@/lib/inventory';
import InventarioView from './InventarioView';

export default async function InventarioPage() {
  const [groups, partsInput] = await Promise.all([getGroups(), getPartsWithMovements()]);
  const parts = computeParts(partsInput);
  const alertCount = buildAlerts(parts).length;

  return (
    <>
      <Header title="Inventario" subtitle="Repuestos clasificados por grupo y SKU" alertCount={alertCount} />
      <main style={{ flex: 1, overflow: 'auto' }}>
        <InventarioView groups={groups} parts={parts} />
      </main>
    </>
  );
}

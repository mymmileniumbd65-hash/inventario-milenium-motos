import Header from '@/components/Header';
import { getRecentMovements, getPartsWithMovements } from '@/db/queries';
import { computeParts, buildAlerts } from '@/lib/inventory';
import MovimientosView from './MovimientosView';

export default async function MovimientosPage() {
  const [movements, partsInput] = await Promise.all([getRecentMovements(500), getPartsWithMovements()]);
  const alertCount = buildAlerts(computeParts(partsInput)).length;

  return (
    <>
      <Header title="Trazabilidad de movimientos" subtitle="Ingresos, salidas y ajustes" alertCount={alertCount} />
      <main style={{ flex: 1, overflow: 'auto', padding: '26px 28px 40px' }}>
        <MovimientosView movements={movements} />
      </main>
    </>
  );
}

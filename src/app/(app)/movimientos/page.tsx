import Header from '@/components/Header';
import { getMovementsForMonth, getPartsWithMovements } from '@/db/queries';
import { computeParts, buildAlerts } from '@/lib/inventory';
import MovimientosView from './MovimientosView';

export default async function MovimientosPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = Number(params.month) || now.getMonth() + 1;

  const [movements, partsInput] = await Promise.all([
    getMovementsForMonth(year, month),
    getPartsWithMovements(),
  ]);
  const alertCount = buildAlerts(computeParts(partsInput)).length;

  return (
    <>
      <Header title="Trazabilidad de movimientos" subtitle="Ingresos, salidas y ajustes" alertCount={alertCount} />
      <main style={{ flex: 1, overflow: 'auto', padding: '26px 28px 40px' }}>
        <MovimientosView movements={movements} year={year} month={month} currentYear={now.getFullYear()} />
      </main>
    </>
  );
}

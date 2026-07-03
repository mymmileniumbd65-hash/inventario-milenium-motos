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
  const currentYear = now.getFullYear();

  // Clamp to the range the year/month <select>s actually offer, so a stale
  // bookmark or hand-edited URL can't desync the dropdowns from the data shown.
  const rawYear = Number(params.year) || currentYear;
  const rawMonth = Number(params.month) || now.getMonth() + 1;
  const year = Math.min(Math.max(rawYear, currentYear - 2), currentYear);
  const month = Math.min(Math.max(rawMonth, 1), 12);

  const [movements, partsInput] = await Promise.all([
    getMovementsForMonth(year, month),
    getPartsWithMovements(),
  ]);
  const alertCount = buildAlerts(computeParts(partsInput)).length;

  return (
    <>
      <Header title="Trazabilidad de movimientos" subtitle="Ingresos, salidas y ajustes" alertCount={alertCount} />
      <main style={{ flex: 1, overflow: 'auto' }}>
        <MovimientosView movements={movements} year={year} month={month} currentYear={currentYear} />
      </main>
    </>
  );
}

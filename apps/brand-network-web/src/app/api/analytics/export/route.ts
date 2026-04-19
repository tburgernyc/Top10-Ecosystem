import { NextResponse } from 'next/server';
import { requireDashboardSession } from '@/lib/auth';
import { getNetworkKPISnapshot, getTenantKPITable } from '@/lib/analytics/network-queries';
import { renderToBuffer } from '@react-pdf/renderer';
import { NetworkReportDocument } from '@/components/pdf/NetworkReportDocument';

export async function GET(): Promise<NextResponse> {
  let session: Awaited<ReturnType<typeof requireDashboardSession>>;
  try {
    session = await requireDashboardSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!['super_admin', 'owner'].includes(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const tenantFilter = session.role === 'super_admin' ? undefined : session.tenant_id ?? undefined;

  const [kpi, tenantRows] = await Promise.all([
    getNetworkKPISnapshot(),
    getTenantKPITable(tenantFilter),
  ]);

  const generatedAt = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const buffer = await renderToBuffer(
    NetworkReportDocument({ kpi, tenantRows, generatedAt, isSuperAdmin: session.role === 'super_admin' })
  );

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="toptenprom-analytics-${generatedAt.replace(/\s/g, '-')}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}

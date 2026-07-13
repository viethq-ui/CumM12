import { verifyToken, readCookie, COOKIE_NAME } from '@/lib/session';
import { warehouseFor } from '@/lib/warehouses';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

// TẠM để chẩn đoán đọc Sheet trên Cloudflare. XÓA sau khi xong.
export async function GET(req) {
  const session = await verifyToken(process.env.NEXTAUTH_SECRET, readCookie(req, COOKIE_NAME));
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const wh = warehouseFor(new URL(req.url).searchParams.get('wh'));
  const url = `https://docs.google.com/spreadsheets/d/${wh.sheetId}/gviz/tq?tqx=out:csv&sheet=LEADTIME&_cb=${Date.now()}`;
  try {
    const res = await fetch(url, { redirect: 'follow' });
    const text = await res.text();
    return Response.json({
      key: wh.key,
      sheetId: wh.sheetId,
      status: res.status,
      finalUrl: res.url,
      contentType: res.headers.get('content-type'),
      len: text.length,
      snippet: text.slice(0, 300),
    });
  } catch (e) {
    return Response.json({ key: wh.key, error: String((e && e.message) || e) });
  }
}

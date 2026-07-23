import { buildDashboardData } from '@/lib/transform';
import { listWarehouses, warehouseFor } from '@/lib/warehouses';
import { computeSla } from '@/lib/sla';
import { tgSend } from '@/lib/telegram';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

function line(name, val, unit, ok, tgt) {
  return `${ok ? '✅' : '❌'} ${name}: <b>${val}${unit}</b> <i>(MT ${tgt})</i>`;
}

function fmtWarehouse(s, wh) {
  return [
    `🏭 <b>${wh.name}</b>`,
    line('Leadtime', s.leadtime, 'h', s.ok.leadtime, '≤' + wh.sla.leadtimeH + 'h'),
    line('Cost/kg', s.costKg, 'đ', s.ok.costKg, '≤' + wh.sla.costKg + 'đ'),
    line('Năng suất Đơn/h', s.donH, '', s.ok.donH, '≥' + wh.sla.prodDonH),
    line('Năng suất W/h', s.wH, '', s.ok.wH, '≥' + wh.sla.prodWH),
    line('Tỷ lệ FL/NVCT', s.flnvct, '%', s.ok.flnvct, '≤' + wh.sla.flnvct + '%'),
  ].join('\n');
}

async function buildReport() {
  const parts = [];
  for (const w of listWarehouses()) {
    const wh = warehouseFor(w.key);
    try {
      const data = await buildDashboardData(wh);
      parts.push(fmtWarehouse(computeSla(data, wh.sla || {}), wh));
    } catch {
      parts.push(`🏭 <b>${wh.name}</b>\n⚠️ Không đọc được dữ liệu`);
    }
  }
  let now = '';
  try { now = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }); } catch { now = new Date().toISOString(); }
  return `📊 <b>TRẠNG THÁI MỤC TIÊU (SLA)</b>\n🕒 ${now}\n\n` + parts.join('\n\n') + `\n\n🔗 https://cumm12.pages.dev`;
}

export async function POST(req) {
  // Xác thực webhook (nếu có đặt secret).
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && req.headers.get('x-telegram-bot-api-secret-token') !== secret) {
    return new Response('unauthorized', { status: 401 });
  }
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return Response.json({ ok: false });

  let update;
  try { update = await req.json(); } catch { return Response.json({ ok: true }); }

  let chatId = null, threadId = null;
  if (update.my_chat_member) {
    const st = update.my_chat_member.new_chat_member && update.my_chat_member.new_chat_member.status;
    if (st === 'member' || st === 'administrator') chatId = update.my_chat_member.chat.id; // bot vừa được add
  } else if (update.message) {
    const m = update.message;
    const txt = (m.text || '').trim();
    const added = (m.new_chat_members || []).some((u) => u.is_bot);
    if (added || /^\/(sla|baocao|start)(@\w+)?/i.test(txt)) {
      chatId = m.chat.id;
      threadId = m.message_thread_id || null; // trả lời đúng topic
    }
  }

  if (chatId != null) {
    try {
      const text = await buildReport();
      await tgSend(token, chatId, text, threadId);
    } catch {
      /* nuốt lỗi để Telegram không retry dồn dập */
    }
  }
  return Response.json({ ok: true });
}

export async function GET() {
  return Response.json({ ok: true, info: 'Telegram webhook endpoint' });
}

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram';

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

  const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY');
  if (!TELEGRAM_API_KEY) throw new Error('TELEGRAM_API_KEY is not configured');

  const response = await fetch(`${GATEWAY_URL}/sendMessage`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'X-Connection-Api-Key': TELEGRAM_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(`Telegram API failed [${response.status}]: ${JSON.stringify(data)}`);
  }
}

Deno.serve(async () => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const channelId = Deno.env.get('TELEGRAM_CHANNEL_ID');
    
    if (!channelId) {
      return new Response(JSON.stringify({ error: 'TELEGRAM_CHANNEL_ID not set' }), { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const today = new Date().toISOString().split('T')[0];

    // Get today's events
    const { data: todayEvents } = await supabase
      .from('events')
      .select('*')
      .eq('event_date', today)
      .eq('status', 'upcoming')
      .order('event_time', { ascending: true });

    // Get upcoming events this week
    const weekLater = new Date();
    weekLater.setDate(weekLater.getDate() + 7);
    const weekEnd = weekLater.toISOString().split('T')[0];

    const { data: weekEvents } = await supabase
      .from('events')
      .select('*')
      .gt('event_date', today)
      .lte('event_date', weekEnd)
      .eq('status', 'upcoming')
      .order('event_date', { ascending: true })
      .limit(20);

    // Get total stats
    const { count: totalEvents } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'upcoming');

    let msg = `📅 <b>NextChain Radar — Daily Digest</b>\n`;
    msg += `📆 ${today}\n\n`;

    if (todayEvents && todayEvents.length > 0) {
      msg += `🔥 <b>Today's Web3 Events in Nigeria (${todayEvents.length})</b>\n\n`;
      for (const ev of todayEvents) {
        const loc = ev.is_online ? '🌐 Online' : `📍 ${[ev.city, ev.state].filter(Boolean).join(', ')}`;
        msg += `• <b>${escapeHtml(ev.title)}</b>\n`;
        msg += `  ${ev.event_time || 'TBA'} | ${loc} | ${ev.event_type}\n`;
        if (ev.registration_link) msg += `  🔗 ${ev.registration_link}\n`;
        msg += `\n`;
      }
    } else {
      msg += `📭 No Web3 events scheduled for today.\n\n`;
    }

    if (weekEvents && weekEvents.length > 0) {
      msg += `📆 <b>Coming This Week (${weekEvents.length})</b>\n\n`;
      for (const ev of weekEvents.slice(0, 10)) {
        const loc = ev.is_online ? '🌐 Online' : `📍 ${ev.state}`;
        msg += `• <b>${escapeHtml(ev.title)}</b> — ${ev.event_date} ${loc}\n`;
      }
      if (weekEvents.length > 10) {
        msg += `  ...and ${weekEvents.length - 10} more\n`;
      }
      msg += `\n`;
    }

    msg += `📊 <b>Total Upcoming Events:</b> ${totalEvents || 0}\n`;
    msg += `\n🤖 <i>Powered by NextChain Radar</i>`;

    await sendTelegramMessage(channelId, msg);

    console.log(`Daily summary sent: ${todayEvents?.length || 0} today, ${weekEvents?.length || 0} this week`);
    return new Response(JSON.stringify({ ok: true, today: todayEvents?.length, week: weekEvents?.length }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Daily summary error:', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

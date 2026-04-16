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

function formatEventLine(ev: any, showDate = true): string {
  const loc = ev.is_online ? '🌐 Online' : `📍 ${[ev.city, ev.state].filter(Boolean).join(', ') || ev.state}`;
  let line = `• <b>${escapeHtml(ev.title)}</b>\n`;
  if (showDate) line += `  📅 ${ev.event_date || 'TBA'} `;
  line += `🕐 ${ev.event_time || 'TBA'} | ${loc} | ${ev.event_type}\n`;
  if (ev.registration_link) line += `  🔗 ${ev.registration_link}\n`;
  return line;
}

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const channelId = Deno.env.get('TELEGRAM_CHANNEL_ID');

    if (!channelId) {
      return new Response(JSON.stringify({ error: 'TELEGRAM_CHANNEL_ID not set' }), { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const today = new Date().toISOString().split('T')[0];

    // Determine digest type from request body or default to daily
    let digestType = 'daily';
    try {
      const body = await req.json();
      if (body?.type) digestType = body.type;
    } catch { /* default to daily */ }

    const dayOfWeek = new Date().getDay(); // 0=Sun
    const dayOfMonth = new Date().getDate();

    // Auto-detect: Sunday = weekly, 1st/15th = monthly
    if (digestType === 'daily') {
      if (dayOfWeek === 0) digestType = 'weekly';
      if (dayOfMonth === 1 || dayOfMonth === 15) digestType = 'monthly';
    }

    let msg = '';

    if (digestType === 'daily') {
      // ---- DAILY DIGEST ----
      const { data: todayEvents } = await supabase
        .from('events')
        .select('*')
        .eq('event_date', today)
        .eq('status', 'upcoming')
        .order('popularity_score', { ascending: false });

      const weekEnd = new Date();
      weekEnd.setDate(weekEnd.getDate() + 3);
      const { data: upcomingEvents } = await supabase
        .from('events')
        .select('*')
        .gt('event_date', today)
        .lte('event_date', weekEnd.toISOString().split('T')[0])
        .eq('status', 'upcoming')
        .order('event_date', { ascending: true })
        .limit(10);

      msg = `📅 <b>NextChain Radar — Daily Digest</b>\n📆 ${today}\n\n`;

      if (todayEvents && todayEvents.length > 0) {
        msg += `🔥 <b>Today's Events (${todayEvents.length})</b>\n\n`;
        for (const ev of todayEvents) {
          msg += formatEventLine(ev, false);
          msg += `\n`;
        }
      } else {
        msg += `📭 No events scheduled for today.\n\n`;
      }

      // Highlight top event
      const topEvent = todayEvents?.[0] || upcomingEvents?.[0];
      if (topEvent) {
        msg += `⭐ <b>Featured:</b> ${escapeHtml(topEvent.title)}`;
        if (topEvent.registration_link) msg += `\n🔗 ${topEvent.registration_link}`;
        msg += `\n\n`;
      }

      if (upcomingEvents && upcomingEvents.length > 0) {
        msg += `📆 <b>Coming Up Next (${upcomingEvents.length})</b>\n\n`;
        for (const ev of upcomingEvents.slice(0, 5)) {
          msg += formatEventLine(ev);
          msg += `\n`;
        }
      }

    } else if (digestType === 'weekly') {
      // ---- WEEKLY DIGEST ----
      const weekEnd = new Date();
      weekEnd.setDate(weekEnd.getDate() + 7);
      const { data: weekEvents } = await supabase
        .from('events')
        .select('*')
        .gte('event_date', today)
        .lte('event_date', weekEnd.toISOString().split('T')[0])
        .eq('status', 'upcoming')
        .order('popularity_score', { ascending: false })
        .limit(30);

      msg = `📊 <b>NextChain Radar — Weekly Digest</b>\n📆 Week of ${today}\n\n`;
      msg += `📈 <b>${weekEvents?.length || 0} Web3 events this week</b>\n\n`;

      if (weekEvents && weekEvents.length > 0) {
        // Group by date
        const byDate: Record<string, any[]> = {};
        for (const ev of weekEvents) {
          const d = ev.event_date || 'TBA';
          if (!byDate[d]) byDate[d] = [];
          byDate[d].push(ev);
        }

        for (const [date, evs] of Object.entries(byDate).sort()) {
          msg += `<b>📅 ${date}</b>\n`;
          for (const ev of evs.slice(0, 5)) {
            msg += formatEventLine(ev, false);
          }
          msg += `\n`;
        }
      } else {
        msg += `📭 No events found for this week.\n\n`;
      }

    } else if (digestType === 'monthly') {
      // ---- MONTHLY / BIG RADAR ----
      const monthEnd = new Date();
      monthEnd.setDate(monthEnd.getDate() + 30);
      const { data: monthEvents } = await supabase
        .from('events')
        .select('*')
        .gte('event_date', today)
        .lte('event_date', monthEnd.toISOString().split('T')[0])
        .eq('status', 'upcoming')
        .order('popularity_score', { ascending: false })
        .limit(50);

      msg = `🔭 <b>NextChain Radar — Big Radar 🇳🇬</b>\n📆 ${today}\n\n`;

      const conferences = monthEvents?.filter(e => ['conference', 'summit'].includes(e.event_type)) || [];
      const hackathons = monthEvents?.filter(e => e.event_type === 'hackathon') || [];
      const meetups = monthEvents?.filter(e => !['conference', 'summit', 'hackathon'].includes(e.event_type)) || [];

      if (conferences.length > 0) {
        msg += `🏛 <b>Major Conferences & Summits (${conferences.length})</b>\n\n`;
        for (const ev of conferences.slice(0, 10)) {
          msg += formatEventLine(ev);
          msg += `\n`;
        }
      }

      if (hackathons.length > 0) {
        msg += `💻 <b>Hackathons (${hackathons.length})</b>\n\n`;
        for (const ev of hackathons.slice(0, 10)) {
          msg += formatEventLine(ev);
          msg += `\n`;
        }
      }

      if (meetups.length > 0) {
        msg += `🤝 <b>Meetups & Workshops (${meetups.length})</b>\n\n`;
        for (const ev of meetups.slice(0, 10)) {
          msg += formatEventLine(ev);
          msg += `\n`;
        }
      }

      msg += `📊 <b>Total upcoming:</b> ${monthEvents?.length || 0} events in next 30 days\n`;
    }

    // Stats footer
    const { count: totalEvents } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'upcoming');

    msg += `\n📊 <b>Total Tracked:</b> ${totalEvents || 0} upcoming events\n`;
    msg += `\n🤖 <i>Powered by NextChain Radar</i>`;

    await sendTelegramMessage(channelId, msg);

    console.log(`${digestType} digest sent`);
    return new Response(JSON.stringify({ ok: true, type: digestType }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Digest error:', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

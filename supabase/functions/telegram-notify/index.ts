import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram';

function formatEventMessage(event: any): string {
  const confidence = Math.round((event.confidence_score || 0) * 100);
  const format = event.is_online ? '🌐 Online' : '📍 Physical';
  const date = event.event_date || 'TBA';
  const time = event.event_time || 'TBA';
  const location = [event.city, event.state].filter(Boolean).join(', ') || 'TBA';

  let msg = `🚀 <b>New Web3 Event Detected</b>\n\n`;
  msg += `📌 <b>Title:</b> ${escapeHtml(event.title)}\n`;
  msg += `📅 <b>Date:</b> ${date}\n`;
  msg += `🕐 <b>Time:</b> ${time}\n`;
  msg += `📍 <b>Location:</b> ${escapeHtml(location)}\n`;
  msg += `🏷 <b>Type:</b> ${event.event_type || 'other'}\n`;
  msg += `${format}\n`;
  if (event.organizer) msg += `👤 <b>Organizer:</b> ${escapeHtml(event.organizer)}\n`;
  msg += `📊 <b>Confidence:</b> ${confidence}%\n`;
  if (event.submission_count > 0) msg += `🔥 <b>Submitted by ${event.submission_count} people</b>\n`;
  if (event.registration_link) msg += `\n🔗 <b>Register:</b> ${event.registration_link}\n`;
  if (event.source_platform) msg += `\n📡 <b>Source:</b> ${event.source_platform}`;

  return msg;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function sendTelegramMessage(chatId: string, text: string): Promise<any> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

  const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY');
  if (!TELEGRAM_API_KEY) throw new Error('TELEGRAM_API_KEY is not configured');

  console.log(`Posting to channel: ${chatId}`);

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

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Telegram API failed [${response.status}]: ${JSON.stringify(data)}`);
  }
  return data;
}

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const channelId = Deno.env.get('TELEGRAM_CHANNEL_ID');

    if (!channelId) {
      return new Response(JSON.stringify({ error: 'TELEGRAM_CHANNEL_ID not set' }), { status: 500 });
    }

    console.log(`Channel ID configured: ${channelId}`);
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get already posted event IDs
    const { data: postedRows, error: postedErr } = await supabase
      .from('telegram_posted_events')
      .select('event_id');

    if (postedErr) {
      console.error('Error fetching posted events:', postedErr);
      return new Response(JSON.stringify({ error: postedErr.message }), { status: 500 });
    }

    const postedSet = new Set((postedRows || []).map(p => p.event_id));
    console.log(`Already posted: ${postedSet.size} events`);

    // Get upcoming events, ordered by popularity
    const { data: events, error: evError } = await supabase
      .from('events')
      .select('*')
      .eq('status', 'upcoming')
      .order('popularity_score', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(20);

    if (evError) {
      console.error('Query error:', evError);
      return new Response(JSON.stringify({ error: evError.message }), { status: 500 });
    }

    // Filter out already posted
    const toPost = (events || []).filter(e => !postedSet.has(e.id));
    console.log(`Events to post: ${toPost.length} (total upcoming: ${events?.length || 0})`);

    let posted = 0;
    const errors: string[] = [];

    for (const event of toPost.slice(0, 10)) {
      try {
        const msg = formatEventMessage(event);
        const result = await sendTelegramMessage(channelId, msg);

        await supabase.from('telegram_posted_events').insert({
          event_id: event.id,
          message_id: result.result?.message_id || null,
        });

        posted++;
        console.log(`Posted: "${event.title}" (msg_id: ${result.result?.message_id})`);

        // Rate limit: 1 message per second
        await new Promise(r => setTimeout(r, 1100));
      } catch (e) {
        const errMsg = `Failed to post "${event.title}": ${String(e)}`;
        console.error(errMsg);
        errors.push(errMsg);
      }
    }

    console.log(`Posted ${posted} events to Telegram`);
    return new Response(JSON.stringify({
      ok: true,
      posted,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Notify error:', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

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

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get events not yet posted to Telegram
    const { data: events, error: evError } = await supabase
      .from('events')
      .select('*')
      .eq('status', 'upcoming')
      .not('id', 'in', `(SELECT event_id FROM telegram_posted_events)`)
      .order('created_at', { ascending: false })
      .limit(10);

    if (evError) {
      console.error('Query error:', evError);
      return new Response(JSON.stringify({ error: evError.message }), { status: 500 });
    }

    // Also check posted table directly for dedup
    const eventIds = (events || []).map(e => e.id);
    const { data: alreadyPosted } = await supabase
      .from('telegram_posted_events')
      .select('event_id')
      .in('event_id', eventIds);

    const postedSet = new Set((alreadyPosted || []).map(p => p.event_id));
    const toPost = (events || []).filter(e => !postedSet.has(e.id));

    let posted = 0;
    for (const event of toPost) {
      try {
        const msg = formatEventMessage(event);
        const result = await sendTelegramMessage(channelId, msg);
        
        await supabase.from('telegram_posted_events').insert({
          event_id: event.id,
          message_id: result.result?.message_id || null,
        });
        
        posted++;
        
        // Rate limit: 1 message per second
        await new Promise(r => setTimeout(r, 1000));
      } catch (e) {
        console.error(`Failed to post event ${event.id}:`, e);
      }
    }

    console.log(`Posted ${posted} events to Telegram`);
    return new Response(JSON.stringify({ ok: true, posted }), {
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

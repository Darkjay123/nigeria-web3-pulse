import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram';
const MAX_RUNTIME_MS = 55_000;
const MIN_REMAINING_MS = 5_000;

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
  const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY')!;

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
    console.error(`Send failed [${response.status}]:`, data);
  }
}

async function generateDedupHash(title: string, date: string | null, state: string): Promise<string> {
  const raw = `${title.toLowerCase().trim()}|${date || ''}|${state}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
}

async function handleCommand(command: string, args: string, chatId: number, username: string, supabase: any): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  switch (command) {
    case '/events': {
      const { data: events } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'upcoming')
        .gte('event_date', today)
        .order('popularity_score', { ascending: false })
        .order('event_date', { ascending: true })
        .limit(10);

      if (!events || events.length === 0) {
        await sendTelegramMessage(chatId, '📭 No upcoming events found.');
        return;
      }

      let msg = `📋 <b>Next 10 Upcoming Web3 Events</b>\n\n`;
      for (const ev of events) {
        const loc = ev.is_online ? '🌐 Online' : `📍 ${ev.state}`;
        msg += `• <b>${escapeHtml(ev.title)}</b>\n  📅 ${ev.event_date} | ${loc}`;
        if (ev.submission_count > 0) msg += ` | 🔥 ${ev.submission_count}`;
        msg += `\n`;
        if (ev.registration_link) msg += `  🔗 ${ev.registration_link}\n`;
        msg += `\n`;
      }
      await sendTelegramMessage(chatId, msg);
      break;
    }

    case '/today': {
      const { data: events } = await supabase
        .from('events')
        .select('*')
        .eq('event_date', today)
        .eq('status', 'upcoming')
        .order('event_time', { ascending: true });

      if (!events || events.length === 0) {
        await sendTelegramMessage(chatId, '📭 No events scheduled for today.');
        return;
      }

      let msg = `📅 <b>Today's Web3 Events (${events.length})</b>\n\n`;
      for (const ev of events) {
        const loc = ev.is_online ? '🌐 Online' : `📍 ${[ev.city, ev.state].filter(Boolean).join(', ')}`;
        msg += `• <b>${escapeHtml(ev.title)}</b>\n  🕐 ${ev.event_time || 'TBA'} | ${loc}\n`;
        if (ev.registration_link) msg += `  🔗 ${ev.registration_link}\n`;
        msg += `\n`;
      }
      await sendTelegramMessage(chatId, msg);
      break;
    }

    case '/state': {
      const stateName = args.trim();
      if (!stateName) {
        await sendTelegramMessage(chatId, '⚠️ Please specify a state. Example: /state Lagos');
        return;
      }

      const { data: events } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'upcoming')
        .ilike('state', `%${stateName}%`)
        .gte('event_date', today)
        .order('event_date', { ascending: true })
        .limit(10);

      if (!events || events.length === 0) {
        await sendTelegramMessage(chatId, `📭 No upcoming events found in ${escapeHtml(stateName)}.`);
        return;
      }

      let msg = `📍 <b>Events in ${escapeHtml(stateName)} (${events.length})</b>\n\n`;
      for (const ev of events) {
        msg += `• <b>${escapeHtml(ev.title)}</b>\n  📅 ${ev.event_date} | ${ev.event_type}\n`;
        if (ev.registration_link) msg += `  🔗 ${ev.registration_link}\n`;
        msg += `\n`;
      }
      await sendTelegramMessage(chatId, msg);
      break;
    }

    case '/online': {
      const { data: events } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'upcoming')
        .eq('is_online', true)
        .gte('event_date', today)
        .order('event_date', { ascending: true })
        .limit(10);

      if (!events || events.length === 0) {
        await sendTelegramMessage(chatId, '📭 No upcoming online events found.');
        return;
      }

      let msg = `🌐 <b>Online Web3 Events (${events.length})</b>\n\n`;
      for (const ev of events) {
        msg += `• <b>${escapeHtml(ev.title)}</b>\n  📅 ${ev.event_date} | ${ev.event_type}\n`;
        if (ev.registration_link) msg += `  🔗 ${ev.registration_link}\n`;
        msg += `\n`;
      }
      await sendTelegramMessage(chatId, msg);
      break;
    }

    case '/submit': {
      const link = args.trim();
      if (!link) {
        await sendTelegramMessage(chatId, '⚠️ Please provide a link.\n\nExample: /submit https://lu.ma/my-event');
        return;
      }

      // Extract title from link (basic)
      let normalizedTitle = link;
      try {
        const url = new URL(link);
        const pathParts = url.pathname.split('/').filter(Boolean);
        normalizedTitle = pathParts[pathParts.length - 1]?.replace(/[-_]/g, ' ') || link;
        normalizedTitle = normalizedTitle.charAt(0).toUpperCase() + normalizedTitle.slice(1);
      } catch {
        normalizedTitle = link.substring(0, 100);
      }

      const hash = await generateDedupHash(normalizedTitle, null, 'Unknown');

      // Check for existing submission
      const { data: existing } = await supabase
        .from('user_submitted_events')
        .select('id, submission_count, submitted_by')
        .eq('dedup_hash', hash)
        .maybeSingle();

      if (existing) {
        // Increment submission count
        const newBy = [...(existing.submitted_by || []), username].slice(-20);
        await supabase.from('user_submitted_events')
          .update({
            submission_count: existing.submission_count + 1,
            submitted_by: newBy,
          })
          .eq('id', existing.id);

        await sendTelegramMessage(chatId,
          `✅ This event has already been submitted! Your vote has been counted.\n🔥 Now submitted by ${existing.submission_count + 1} people.`
        );
      } else {
        await supabase.from('user_submitted_events').insert({
          link,
          raw_text: args,
          normalized_title: normalizedTitle,
          dedup_hash: hash,
          submission_count: 1,
          submitted_by: [username],
          processed: false,
        });

        await sendTelegramMessage(chatId,
          `✅ Event submitted! It will be reviewed and added to NextChain Radar.\n\n📌 <b>${escapeHtml(normalizedTitle)}</b>\n🔗 ${escapeHtml(link)}`
        );
      }
      break;
    }

    case '/start':
    case '/help': {
      const msg = `🤖 <b>NextChain Radar Bot</b>\n\n` +
        `Available commands:\n\n` +
        `/events — Next 10 upcoming events\n` +
        `/today — Today's events\n` +
        `/state &lt;name&gt; — Events in a specific state\n` +
        `/online — Online events only\n` +
        `/submit &lt;link&gt; — Submit an event\n` +
        `/help — Show this message\n\n` +
        `<i>Powered by NextChain Radar 🇳🇬</i>`;
      await sendTelegramMessage(chatId, msg);
      break;
    }

    default: {
      await sendTelegramMessage(chatId, '❓ Unknown command. Type /help for available commands.');
    }
  }
}

Deno.serve(async () => {
  const startTime = Date.now();

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) return new Response('LOVABLE_API_KEY missing', { status: 500 });

  const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY');
  if (!TELEGRAM_API_KEY) return new Response('TELEGRAM_API_KEY missing', { status: 500 });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  let totalProcessed = 0;

  const { data: state, error: stateErr } = await supabase
    .from('telegram_bot_state')
    .select('update_offset')
    .eq('id', 1)
    .single();

  if (stateErr) {
    return new Response(JSON.stringify({ error: stateErr.message }), { status: 500 });
  }

  let currentOffset = state.update_offset;

  while (true) {
    const elapsed = Date.now() - startTime;
    const remainingMs = MAX_RUNTIME_MS - elapsed;
    if (remainingMs < MIN_REMAINING_MS) break;

    const timeout = Math.min(50, Math.floor(remainingMs / 1000) - 5);
    if (timeout < 1) break;

    const response = await fetch(`${GATEWAY_URL}/getUpdates`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': TELEGRAM_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        offset: currentOffset,
        timeout,
        allowed_updates: ['message'],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return new Response(JSON.stringify({ error: data }), { status: 502 });
    }

    const updates = data.result ?? [];
    if (updates.length === 0) continue;

    const rows = updates
      .filter((u: any) => u.message)
      .map((u: any) => ({
        update_id: u.update_id,
        chat_id: u.message.chat.id,
        text: u.message.text ?? null,
        raw_update: u,
      }));

    if (rows.length > 0) {
      await supabase
        .from('telegram_messages')
        .upsert(rows, { onConflict: 'update_id' });
    }

    for (const update of updates) {
      if (update.message?.text?.startsWith('/')) {
        const parts = update.message.text.split(' ');
        const command = parts[0].split('@')[0];
        const args = parts.slice(1).join(' ');
        const username = update.message.from?.username || update.message.from?.first_name || 'anonymous';
        await handleCommand(command, args, update.message.chat.id, username, supabase);
      }
    }

    totalProcessed += updates.length;

    const newOffset = Math.max(...updates.map((u: any) => u.update_id)) + 1;
    await supabase
      .from('telegram_bot_state')
      .update({ update_offset: newOffset, updated_at: new Date().toISOString() })
      .eq('id', 1);

    currentOffset = newOffset;
  }

  return new Response(JSON.stringify({ ok: true, processed: totalProcessed, finalOffset: currentOffset }));
});

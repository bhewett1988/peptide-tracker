// /api/send-reminders.js
// Vercel Serverless Function — checks every user's stack against today's
// date, builds a list of what's due, and emails them via Resend.
//
// Triggered two ways:
//   1. Vercel Cron (see vercel.json) — once daily, no auth needed from cron itself
//   2. Manually from the app's "Send Test Reminder" button — calls this URL directly
//
// Required environment variables (set in Vercel → Settings → Environment Variables):
//   SUPABASE_URL              (same as VITE_SUPABASE_URL)
//   SUPABASE_SERVICE_ROLE_KEY (the SECRET key — server-side only, never in frontend code)
//   RESEND_API_KEY            (from resend.com)

import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

function pad(n) { return String(n).padStart(2, '0'); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Same due-today logic as the app's isDueToday(), reimplemented here
// since this runs server-side and can't import the frontend file directly.
function isDueToday(p, dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const jsDay = new Date(y, m - 1, d).getDay(); // 0=Sun..6=Sat

  if (p.freq === 'Daily' || p.freq === 'Twice daily' || p.freq === 'Every other day') return true;
  if (p.freq === 'As needed') return false;

  if (p.freq === 'Once weekly' || p.freq === 'Twice weekly') {
    return (p.days || []).includes(jsDay);
  }

  if (p.freq === 'Every N days') {
    const n = parseInt(p.interval_days) || 1;
    const sy = parseInt(p.start_year) || y;
    const sm = parseInt(p.start_month) || m;
    const sd = parseInt(p.start_day) || d;
    const start = Date.UTC(sy, sm - 1, sd);
    const target = Date.UTC(y, m - 1, d);
    const diff = Math.round((target - start) / 86400000);
    return diff >= 0 && diff % n === 0;
  }
  return true;
}

export default async function handler(req, res) {
  try {
    const today = todayStr();

    // Get every user's profile (email) — service role key bypasses RLS so this sees everyone.
    const { data: profiles, error: profileErr } = await supabase
      .from('profiles')
      .select('id, email');
    if (profileErr) throw profileErr;

    const results = [];

    for (const profile of profiles) {
      const { data: stack, error: stackErr } = await supabase
        .from('stack')
        .select('*')
        .eq('user_id', profile.id);
      if (stackErr) { results.push({ email: profile.email, error: stackErr.message }); continue; }

      const due = (stack || []).filter(p => isDueToday(p, today));

      if (due.length === 0) {
        results.push({ email: profile.email, sent: false, reason: 'nothing due today' });
        continue;
      }

      const listHtml = due.map(p =>
        `<li><strong>${p.name}</strong> — ${p.dose || ''} ${p.unit || ''} (${p.freq}${p.time ? ' · ' + p.time : ''})</li>`
      ).join('');

      const { error: sendErr } = await resend.emails.send({
        from: 'Peptide Tracker <onboarding@resend.dev>', // sandbox sender for testing
        to: profile.email,
        subject: `Your peptides for today (${today})`,
        html: `
          <div style="font-family: -apple-system, sans-serif; max-width: 480px;">
            <h2 style="color:#0D1220;">Today's doses</h2>
            <ul style="line-height:1.6;">${listHtml}</ul>
            <p style="color:#5B7499; font-size:13px;">Sent by Peptide Tracker — log them in the app once taken.</p>
          </div>
        `,
      });

      results.push({
        email: profile.email,
        sent: !sendErr,
        due: due.map(p => p.name),
        error: sendErr ? sendErr.message : null,
      });
    }

    return res.status(200).json({ ok: true, date: today, results });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}

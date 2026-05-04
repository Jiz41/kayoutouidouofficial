import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// @ts-ignore
import webpush from 'npm:web-push';

const VAPID_PUBLIC_KEY  = 'BBn5SfhmMo1w9AQfnfgkkjbfzbpnZ7yFRJyqODCiNdBejwmDh1MYKgqVifvycND6JGm2CX05dZiQBBZhtLOiHOE';
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_KEY      = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;

webpush.setVapidDetails(
  'mailto:fakestarcompany@gmail.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
);

serve(async (req) => {
  try {
    const body   = await req.json();
    const record = body.record ?? {};

    // discord_posts の venue / race_num を使用。なければ title にフォールバック
    const venue   = record.venue ?? '';
    const raceNum = record.race_num != null ? `${record.race_num}R ` : '';
    const subject = venue ? `${venue} ${raceNum}` : (record.title ?? '新着予想');

    const notifPayload = JSON.stringify({
      title: '👁 真自在律A.L.L',
      body:  `大衛星より入電──\n${subject}の予想完了、確認されたし`,
    });

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth');

    if (error) throw error;
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
    }

    const failed: string[] = [];

    await Promise.all(subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          notifPayload,
        );
      } catch (err: any) {
        // 410 Gone / 404 = 無効な購読 → 削除対象
        if (err.statusCode === 410 || err.statusCode === 404) {
          failed.push(sub.endpoint);
        }
      }
    }));

    if (failed.length > 0) {
      await supabase.from('push_subscriptions').delete().in('endpoint', failed);
    }

    return new Response(
      JSON.stringify({ sent: subs.length - failed.length, removed: failed.length }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(String(err), { status: 500 });
  }
});

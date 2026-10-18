import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const expoPushUrl = "https://exp.host/--/api/v2/push/send";
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (request) => {
  if (request.method !== "POST")
    return Response.json({ error: "Method not allowed." }, { status: 405 });
  if (!supabaseUrl || !anonKey || !serviceRoleKey)
    return Response.json(
      { error: "Push delivery is not configured." },
      { status: 503 },
    );

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer "))
    return Response.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  const accessToken = authorization.slice("Bearer ".length);
  const trustedDatabaseWebhook = accessToken === serviceRoleKey;

  let body: {
    notification_ids?: unknown;
    table?: unknown;
    type?: unknown;
    record?: { id?: unknown };
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  let actorId: string | null = null;
  if (trustedDatabaseWebhook) {
    if (body.table !== "notifications" || body.type !== "INSERT")
      return Response.json(
        { error: "Unsupported database webhook event." },
        { status: 400 },
      );
  } else {
    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(accessToken);
    if (authError || !user)
      return Response.json({ error: "Invalid session." }, { status: 401 });
    actorId = user.id;
  }

  const ids = trustedDatabaseWebhook
    ? [body.record?.id]
    : body.notification_ids;
  if (
    !Array.isArray(ids) ||
    ids.length < 1 ||
    ids.length > 100 ||
    !ids.every((id) => typeof id === "string" && uuidPattern.test(id))
  ) {
    return Response.json(
      { error: "Provide between 1 and 100 notification IDs." },
      { status: 400 },
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let notificationQuery = admin
    .from("notifications")
    .select(
      "id, recipient_id, tournament_id, actor_id, title, body, entity_type, entity_id",
    )
    .in("id", ids);
  if (actorId) notificationQuery = notificationQuery.eq("actor_id", actorId);
  const { data: notifications, error: notificationError } =
    await notificationQuery;
  if (notificationError)
    return Response.json(
      { error: "Could not load authorized notifications." },
      { status: 500 },
    );
  if (!notifications?.length)
    return Response.json({ sent: 0, skipped: ids.length });

  const recipientIds = [
    ...new Set(notifications.map((notification) => notification.recipient_id)),
  ];
  const [
    { data: preferences, error: preferenceError },
    { data: devices, error: deviceError },
  ] = await Promise.all([
    admin
      .from("notification_preferences")
      .select("user_id, push_enabled")
      .in("user_id", recipientIds),
    admin
      .from("push_devices")
      .select("id, user_id, expo_push_token")
      .in("user_id", recipientIds),
  ]);
  if (preferenceError || deviceError)
    return Response.json(
      { error: "Could not load notification preferences." },
      { status: 500 },
    );
  const enabledUsers = new Set(
    (preferences ?? [])
      .filter((preference) => preference.push_enabled)
      .map((preference) => preference.user_id),
  );
  const enabledDevices = (devices ?? []).filter((device) =>
    enabledUsers.has(device.user_id),
  );
  const deviceById = new Map(
    enabledDevices.map((device) => [device.id, device]),
  );
  const deliveryRows = notifications.flatMap((notification) =>
    enabledDevices
      .filter((device) => device.user_id === notification.recipient_id)
      .map((device) => ({
        notification_id: notification.id,
        device_id: device.id,
      })),
  );
  if (!deliveryRows.length)
    return Response.json({ sent: 0, skipped: ids.length });

  const { data: claimed, error: claimError } = await admin
    .from("push_deliveries")
    .upsert(deliveryRows, {
      onConflict: "notification_id,device_id",
      ignoreDuplicates: true,
    })
    .select("notification_id, device_id");
  if (claimError)
    return Response.json(
      { error: "Could not reserve push deliveries." },
      { status: 500 },
    );
  const notificationsById = new Map(
    notifications.map((notification) => [notification.id, notification]),
  );
  const claimedRows = claimed ?? [];
  const messages = claimedRows.flatMap((delivery) => {
    const device = deviceById.get(delivery.device_id);
    const notification = notificationsById.get(delivery.notification_id);
    if (!device || !notification) return [];
    return [
      {
        to: device.expo_push_token,
        title: notification.title,
        body: notification.body,
        sound: "default",
        data: {
          url: `/tournament/${notification.tournament_id}`,
          entity_type: notification.entity_type,
          entity_id: notification.entity_id,
        },
      },
    ];
  });

  let sent = 0;
  for (let offset = 0; offset < claimedRows.length; offset += 100) {
    const batchRows = claimedRows.slice(offset, offset + 100);
    const batchMessages = messages.slice(offset, offset + 100);
    try {
      const response = await fetch(expoPushUrl, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(batchMessages),
      });
      const payload = await response.json();
      const tickets = Array.isArray(payload.data) ? payload.data : [];
      for (let index = 0; index < batchRows.length; index += 1) {
        const row = batchRows[index];
        const ticket = tickets[index];
        const ok = response.ok && ticket?.status === "ok";
        const update = await admin
          .from("push_deliveries")
          .update({
            status: ok ? "sent" : "failed",
            provider_ticket: ticket?.id ?? null,
            error_message: ok
              ? null
              : String(
                  ticket?.details?.error ??
                    ticket?.message ??
                    "Expo push request failed",
                ).slice(0, 300),
            attempted_at: new Date().toISOString(),
          })
          .eq("notification_id", row.notification_id)
          .eq("device_id", row.device_id);
        if (update.error) continue;
        if (ok) sent += 1;
        if (ticket?.details?.error === "DeviceNotRegistered") {
          await admin.from("push_devices").delete().eq("id", row.device_id);
        }
      }
    } catch (error) {
      await Promise.all(
        batchRows.map((row) =>
          admin
            .from("push_deliveries")
            .update({
              status: "failed",
              error_message: String(error).slice(0, 300),
              attempted_at: new Date().toISOString(),
            })
            .eq("notification_id", row.notification_id)
            .eq("device_id", row.device_id),
        ),
      );
    }
  }

  return Response.json({
    sent,
    skipped: ids.length - notifications.length,
    attempted: claimedRows.length,
  });
});

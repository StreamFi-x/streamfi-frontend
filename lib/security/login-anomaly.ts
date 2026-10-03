import { sql } from "@vercel/postgres";
import { locateIp } from "@/lib/security/ip-geolocation";
import { writeNotification } from "@/lib/notifications";

const WINDOW_DAYS = 30;
export const ALERT_SPEED_KMH = 900;

export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isImpossibleTravel(distance: number, elapsedMinutes: number): boolean {
  return elapsedMinutes >= 1 && distance / (elapsedMinutes / 60) > ALERT_SPEED_KMH;
}

export async function recordLoginAndCheckTravel(userId: string, ip: string | null): Promise<boolean> {
  const location = await locateIp(ip);
  await sql`DELETE FROM login_sessions WHERE expires_at <= now() OR created_at < now() - make_interval(days => ${WINDOW_DAYS})`;
  await sql`DELETE FROM login_anomaly_alerts WHERE created_at < now() - interval '365 days'`;
  const { rows: priorRows } = await sql`
    SELECT id, created_at, latitude, longitude
    FROM login_sessions
    WHERE user_id = ${userId} AND created_at > now() - make_interval(days => ${WINDOW_DAYS})
      AND latitude IS NOT NULL AND longitude IS NOT NULL
    ORDER BY created_at DESC LIMIT 10
  `;
  const inserted = await sql`
    INSERT INTO login_sessions (user_id, ip_address, country_code, city, latitude, longitude, expires_at)
    VALUES (${userId}, ${ip}, ${location.countryCode}, ${location.city}, ${location.latitude}, ${location.longitude}, now() + make_interval(days => ${WINDOW_DAYS}))
    RETURNING id, created_at
  `;

  let alertCreated = false;
  if (location.latitude !== null && location.longitude !== null) {
    const currentTime = new Date(inserted.rows[0].created_at).getTime();
    for (const previous of priorRows) {
      const elapsedMinutes = (currentTime - new Date(previous.created_at).getTime()) / 60_000;
      if (elapsedMinutes < 1) {continue;}
      const distance = distanceKm(location.latitude, location.longitude, Number(previous.latitude), Number(previous.longitude));
      const speed = distance / (elapsedMinutes / 60);
      if (!isImpossibleTravel(distance, elapsedMinutes)) {continue;}
      await sql`
        INSERT INTO login_anomaly_alerts
          (user_id, previous_session_id, new_session_id, distance_km, elapsed_minutes, estimated_speed_kmh)
        VALUES (${userId}, ${previous.id}, ${inserted.rows[0].id}, ${Math.round(distance)}, ${Math.round(elapsedMinutes)}, ${Math.round(speed)})
      `;
      alertCreated = true;
      break;
    }
  }

  if (alertCreated) {
    await writeNotification(userId, "security", "New sign-in location", "A recent sign-in appeared to come from a location unusually far from your previous sign-in. If this was not you, review your account security.");
  }
  return alertCreated;
}

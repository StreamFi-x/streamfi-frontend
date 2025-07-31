import { sql } from "@vercel/postgres";

/* eslint-disable @typescript-eslint/no-explicit-any */
export function validateEmail(email: any) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export async function checkExistingTableDetail(
  table: any,
  key: any,
  value: any,
) {
  const query = await sql.query(`SELECT * FROM ${table} WHERE ${key} = $1`, [
    value,
  ]);

  return query.rows.length > 0;
}

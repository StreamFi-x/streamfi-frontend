import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { withCorsResponse } from "@/lib/with-cors-response";
import { resolve } from "path/posix";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet");
  const email = searchParams.get("email");

  if (!wallet && !email) {
    return withCorsResponse(
      { error: "Please provide wallet or email to fetch username" },
      400
    );
  }

  try {
    const result = wallet
      ? await sql`SELECT username FROM users WHERE wallet = ${wallet}`
      : await sql`SELECT username FROM users WHERE email = ${email}`;

    if (result.rows.length === 0) {
      return withCorsResponse({ error: "User not found" }, 404);
    }

    return withCorsResponse({ username: result.rows[0].username });
  } catch (err) {
    console.error("Error fetching username:", err);
    return withCorsResponse({ error: "Internal server error" }, 500);
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

// async function handler(req: Request) {
//   const { searchParams } = new URL(req.url);
//   const wallet = searchParams.get("wallet");
//   const email = searchParams.get("email");

//   if (req.method === "GET") {
//     try {
//       if (!wallet && !email) {
//         return withCorsResponse(
//           { error: "Please provide wallet or email to fetch username" },
//           400
//         );
//       }

//       const result = wallet
//         ? await sql`SELECT username FROM users WHERE wallet = ${wallet}`
//         : await sql`SELECT username FROM users WHERE email = ${email}`;

//       if (result.rows.length === 0) {
//         return withCorsResponse(
//           { error: "User not found" },
//           404
//         );
//       }

//       return withCorsResponse(
//         { username: result.rows[0].username },
//         200
//       );
//     } catch (err) {
//       console.error("Error fetching username:", err);
//       return withCorsResponse(
//         { error: "Internal server error" },
//         500
//       );
//     }
//   }

//   return withCorsResponse(
//     { error: "Method not allowed" },
//     405
//   );
// }

//   return withCorsResponse(
//     { error: "Method not allowed" },
//     405
//   );
// }

// export { handler as GET };

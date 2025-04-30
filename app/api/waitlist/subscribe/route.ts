import { NextRequest } from 'next/server'
import dbConnect from '@/utils/mongodb'
import Waitlist from '@/utils/models/waitlist'
// import { rateLimit } from "../../../../utils/rate-limit";
import { validateEmail } from "../../../../utils/validators";
import { sendWelcomeEmail } from "../../../../utils/send-email";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    await dbConnect()

    if (!validateEmail(body.email)) {
      return new Response(JSON.stringify({ message: 'Invalid email address' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const newEntry = await Waitlist.create(body)

    await sendWelcomeEmail(body.email, body.name);

    return new Response(JSON.stringify(newEntry), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error('Error subscribing:', error.message)
    } else {
      console.error('Error subscribing:', error)
    }

    return new Response(JSON.stringify({ message: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
import { NextRequest } from 'next/server';
import dbConnect from '@/utils/mongodb';
import Waitlist from '@/utils/models/waitlist';
import { validateEmail } from "../../../../utils/validators";
import { sendWelcomeEmail } from "../../../../utils/send-email";

export async function POST(req: NextRequest) {
  console.log('==== API ROUTE CALLED ====');
  
  try {
    // Step 1: Connect to MongoDB with detailed error handling
    try {
      console.log('Attempting to connect to MongoDB...');
      await dbConnect();
      console.log('MongoDB connected successfully');
    } catch (dbConnectError) {
      console.error('MongoDB connection error:', dbConnectError);
      return new Response(JSON.stringify({ 
        error: 'Database connection failed', 
        details: dbConnectError instanceof Error ? dbConnectError.message : 'Unknown error' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Step 2: Parse the request body
    let body;
    try {
      console.log('Parsing request body...');
      body = await req.json();
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return new Response(JSON.stringify({ error: 'Invalid request format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Step 3: Validate the email
    if (!body.email) {
      console.log('Email missing in request');
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    if (!validateEmail(body.email)) {
      console.log('Invalid email format:', body.email);
      return new Response(JSON.stringify({ error: 'Invalid email format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Step 4: Check for existing entry and create or update
    try {
      console.log('Checking if waitlist model is available...');
      console.log('Waitlist model:', typeof Waitlist, Object.keys(Waitlist));
      
      // Verify the Waitlist model is properly initialized
      if (!Waitlist || typeof Waitlist.findOne !== 'function') {
        console.error('Waitlist model not properly initialized:', Waitlist);
        return new Response(JSON.stringify({ error: 'Database model initialization failed' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      // Check if the user already exists
      console.log('Checking if email already exists:', body.email);
      let existingEntry;
      
      try {
        existingEntry = await Waitlist.findOne({ email: body.email }).exec();
        console.log('Existing entry check result:', existingEntry ? 'Found' : 'Not found');
      } catch (findError) {
        console.error('Error checking for existing email:', findError);
        return new Response(JSON.stringify({ 
          error: 'Failed to check for existing email', 
          details: findError instanceof Error ? findError.message : 'Unknown error' 
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      if (existingEntry) {
        console.log('Email already exists:', body.email);
        
        // If already subscribed and not unsubscribed
        if (!existingEntry.unsubscribed_at) {
          return new Response(JSON.stringify({ 
            message: 'Already subscribed', 
            alreadySubscribed: true 
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        
        // If previously unsubscribed, resubscribe them
        console.log('Resubscribing previously unsubscribed user');
        try {
          existingEntry.unsubscribed_at = null;
          existingEntry.updated_at = new Date();
          
          if (body.name) {
            existingEntry.name = body.name;
          }
          
          await existingEntry.save();
          console.log('User resubscribed successfully');
        } catch (updateError) {
          console.error('Error resubscribing user:', updateError);
          return new Response(JSON.stringify({ 
            error: 'Failed to update subscription', 
            details: updateError instanceof Error ? updateError.message : 'Unknown error' 
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      } else {
        // Create new entry
        console.log('Creating new waitlist entry for:', body.email);
        try {
          await Waitlist.create({
            email: body.email,
            name: body.name || null,
            created_at: new Date(),
            updated_at: new Date()
          });
          console.log('New waitlist entry created successfully');
        } catch (createError) {
          console.error('Error creating waitlist entry:', createError);
          return new Response(JSON.stringify({ 
            error: 'Failed to create subscription', 
            details: createError instanceof Error ? createError.message : 'Unknown error' 
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
      
      // Step 5: Send welcome email
      try {
        console.log('Sending welcome email to:', body.email);
        await sendWelcomeEmail(body.email, body.name);
        console.log('Welcome email sent successfully');
      } catch (emailError) {
        console.error('Error sending welcome email:', emailError);
        // Continue with success response even if email fails
      }
      
      return new Response(JSON.stringify({ 
        success: true,
        message: 'Successfully subscribed to waitlist'
      }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
      
    } catch (dbError) {
      console.error('Unhandled database error:', dbError);
      return new Response(JSON.stringify({ 
        error: 'Failed to process subscription', 
        details: dbError instanceof Error ? dbError.message : 'Unknown database error' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
  } catch (error) {
    console.error('Unhandled global error in API route:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
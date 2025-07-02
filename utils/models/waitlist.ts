import mongoose, { Schema, Document, Model } from "mongoose";

export interface IWaitlist extends Document {
  email: string;
  name?: string;
  unsubscribed_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

// Define schema
const WaitlistSchema = new Schema<IWaitlist>({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  name: {
    type: String,
    trim: true,
  },
  unsubscribed_at: {
    type: Date,
    default: null,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
});

// Create or get model - prevents "Cannot overwrite model once compiled" error
const Waitlist: Model<IWaitlist> =
  (mongoose.models.Waitlist as Model<IWaitlist>) ||
  mongoose.model<IWaitlist>("Waitlist", WaitlistSchema);

// Add TypeScript type guard to ensure the model is properly initialized
if (!Waitlist || typeof Waitlist.findOne !== "function") {
  console.error("Waitlist model initialization failed:", Waitlist);
  throw new Error("Waitlist model not properly initialized");
}

export default Waitlist;

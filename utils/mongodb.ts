import mongoose from 'mongoose';

const WaitlistSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: { type: String },
  unsubscribed_at: { type: Date, default: null },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

export default mongoose.models.Waitlist || mongoose.model('Waitlist', WaitlistSchema);
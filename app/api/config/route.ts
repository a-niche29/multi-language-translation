import { NextResponse } from 'next/server';

export async function GET() {
  const providers = [];
  
  if (process.env.OPENAI_API_KEY) {
    providers.push('openai');
  }
  
  if (process.env.ANTHROPIC_API_KEY) {
    providers.push('anthropic');
  }
  
  if (process.env.GOOGLE_API_KEY) {
    providers.push('google');
  }
  
  return NextResponse.json({ providers });
}
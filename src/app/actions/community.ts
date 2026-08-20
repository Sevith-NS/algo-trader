'use server';

import { storage } from '@/lib/storage';
import { getServerSession } from 'next-auth';
import { authOptions } from '../api/auth/[...nextauth]/route';
import { revalidatePath } from 'next/cache';
import { API_BASE } from '../../lib/api';

export async function createCommunityPost(formData: FormData) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    throw new Error('You must be logged in to post an idea');
  }

  const title = formData.get('title') as string;
  const content = formData.get('content') as string;
  const ticker = (formData.get('ticker') as string).toUpperCase();
  const sentiment = formData.get('sentiment') as string; // BULLISH or BEARISH

  if (!title || !content || !ticker || !sentiment) {
    throw new Error('Missing required fields');
  }

  // Make a call to our Python backend to analyze this idea text
  let aiRiskAnalysis = "Standard Risk";
  let aiConfidenceScore = 50;

  try {
    const aiRes = await fetch(`${API_BASE}/api/analyze-idea`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content, ticker, sentiment }),
    });
    const aiData = await aiRes.json();
    if (!aiData.error) {
      aiRiskAnalysis = aiData.risk_analysis;
      aiConfidenceScore = aiData.confidence_score;
    }
  } catch (e) {
    console.error('AI Analysis failed, using defaults', e);
  }

  await storage.post.create({
    data: {
      title,
      content,
      ticker,
      sentiment,
      aiConfidenceScore,
      aiRiskAnalysis,
      authorId: session.user.id
    }
  });

  revalidatePath('/community');
}

export async function getCommunityPosts() {
  return await storage.post.findMany();
}

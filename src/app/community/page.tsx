import { getCommunityPosts, createCommunityPost } from '../actions/community';
import Navigation from '../../components/Navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '../api/auth/[...nextauth]/route';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, ThumbsUp, Activity, ShieldAlert, Award } from 'lucide-react';

export default async function CommunityPage() {
  const session = await getServerSession(authOptions);
  const posts = await getCommunityPosts();

  return (
    <div className="min-h-screen bg-bgPrimary flex flex-col">
      <Navigation />
      
      <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Community Ideas</h1>
            <p className="text-textSecondary mt-1">Hedge-Fund Grade AI Analysis on crowdsourced trade setups.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Feed Column */}
          <div className="lg:col-span-2 space-y-6">
            {posts.length === 0 ? (
              <div className="glass-panel p-12 text-center text-textSecondary italic">
                No ideas have been posted yet. Be the first to share your analysis!
              </div>
            ) : (
              posts.map(post => (
                <article key={post.id} className="glass-panel p-6 group hover:border-accentBlue/30 transition-colors">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="text-xl font-bold">{post.title}</h2>
                      <div className="flex items-center gap-2 mt-2 text-sm text-textSecondary">
                        <span>@{post.author.name}</span>
                        <span>•</span>
                        <span>{formatDistanceToNow(new Date(post.createdAt))} ago</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-3 py-1 rounded text-sm font-bold ${post.sentiment === 'BULLISH' ? 'bg-green-500/20 text-accentGreen' : 'bg-red-500/20 text-accentRed'}`}>
                        {post.ticker} • {post.sentiment}
                      </span>
                    </div>
                  </div>

                  <p className="text-gray-300 leading-relaxed mb-6">
                    {post.content}
                  </p>

                  {/* AI Analysis Block */}
                  <div className="bg-black/40 border border-borderSubtle rounded-lg p-4 mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Activity size={18} className="text-accentBlue" />
                      <h3 className="font-semibold text-accentBlue">AI Trade Analysis</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-textSecondary uppercase tracking-wider mb-1 flex items-center gap-1">
                          <Award size={14} /> Confidence Score
                        </div>
                        <div className="flex items-end gap-2">
                          <span className="text-2xl font-bold text-white">{post.aiConfidenceScore}</span>
                          <span className="text-sm text-textSecondary pb-1">/ 100</span>
                        </div>
                        {/* Progress bar */}
                        <div className="w-full bg-gray-800 h-1.5 mt-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${post.aiConfidenceScore && post.aiConfidenceScore > 70 ? 'bg-accentGreen' : post.aiConfidenceScore && post.aiConfidenceScore > 40 ? 'bg-yellow-500' : 'bg-accentRed'}`}
                            style={{ width: `${post.aiConfidenceScore}%` }}
                          />
                        </div>
                      </div>
                      
                      <div>
                        <div className="text-xs text-textSecondary uppercase tracking-wider mb-1 flex items-center gap-1">
                          <ShieldAlert size={14} /> Risk Profile
                        </div>
                        <div className="text-sm text-gray-300">
                          {post.aiRiskAnalysis}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Interaction Footer */}
                  <div className="flex items-center gap-6 border-t border-borderSubtle pt-4">
                    <button className="flex items-center gap-2 text-textSecondary hover:text-accentBlue transition-colors text-sm">
                      <ThumbsUp size={18} /> 
                      <span>{post._count.likes} Likes</span>
                    </button>
                    <button className="flex items-center gap-2 text-textSecondary hover:text-white transition-colors text-sm">
                      <MessageSquare size={18} />
                      <span>{post._count.comments} Comments</span>
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>

          {/* New Post Sidebar Column */}
          <aside>
            <div className="glass-panel p-6 sticky top-24">
              <h2 className="text-lg font-bold mb-4 border-b border-borderSubtle pb-2">Share Trade Idea</h2>
              
              {!session ? (
                <div className="text-center py-6">
                  <p className="text-textSecondary mb-4 text-sm">Sign in to publish your analysis and receive AI feedback.</p>
                  <a href="/login" className="bg-accentBlue text-white px-4 py-2 rounded font-medium shadow-[0_0_10px_rgba(59,130,246,0.3)] hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] transition-all">
                    Sign In to Post
                  </a>
                </div>
              ) : (
                <form action={createCommunityPost} className="space-y-4">
                  <div>
                    <input 
                      name="title" 
                      placeholder="Idea Title (e.g., TSLA Breakout)" 
                      required 
                      className="w-full bg-black/30 border border-borderSubtle rounded p-3 text-sm focus:outline-none focus:border-accentBlue text-white"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <input 
                      name="ticker" 
                      placeholder="Ticker (AAPL)" 
                      required 
                      className="w-full bg-black/30 border border-borderSubtle rounded p-3 text-sm focus:outline-none focus:border-accentBlue uppercase text-white"
                    />
                    <select 
                      name="sentiment" 
                      className="w-full bg-black/30 border border-borderSubtle rounded p-3 text-sm focus:outline-none focus:border-accentBlue text-white appearance-none"
                    >
                      <option value="BULLISH" className="bg-bgSecondary text-accentGreen">📈 BULLISH</option>
                      <option value="BEARISH" className="bg-bgSecondary text-accentRed">📉 BEARISH</option>
                    </select>
                  </div>

                  <div>
                    <textarea 
                      name="content" 
                      placeholder="Provide your fundamental or technical rationale..." 
                      rows={5}
                      required 
                      className="w-full bg-black/30 border border-borderSubtle rounded p-3 text-sm focus:outline-none focus:border-accentBlue text-white resize-none"
                    />
                  </div>

                  <button 
                    type="submit" 
                    className="w-full bg-accentBlue hover:bg-blue-500 text-white font-bold py-3 px-4 rounded transition-all shadow-[0_0_10px_rgba(59,130,246,0.2)]"
                  >
                    Publish Analysis
                  </button>
                </form>
              )}
            </div>
          </aside>

        </div>
      </main>
    </div>
  );
}

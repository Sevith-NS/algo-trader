import { getCommunityPosts, createCommunityPost } from '../actions/community';
import Navigation from '../../components/Navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '../api/auth/[...nextauth]/route';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, ThumbsUp, Activity, ShieldAlert, Award, ChevronDown } from 'lucide-react';
import { PageShell, PageHeader } from '../../components/PageHeader';

export default async function CommunityPage() {
  const session = await getServerSession(authOptions);
  const posts = await getCommunityPosts();

  return (
    <div className="min-h-screen bg-bgPrimary flex flex-col">
      <Navigation />
      
      <PageShell className="flex-1">
        <PageHeader
          title="Community Ideas"
          description="Crowdsourced trade setups, each scored by the same sentiment and confidence model the desk uses. Descriptive, not advice."
        />

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

                  <p className="text-textSecondary leading-relaxed mb-6">
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
                        <div className="text-xs text-textSecondary font-mono uppercase tracking-wider mb-1 flex items-center gap-1">
                          <Award size={14} /> Confidence Score
                        </div>
                        <div className="flex items-end gap-2">
                          <span className="text-2xl font-bold text-textPrimary">{post.aiConfidenceScore}</span>
                          <span className="text-sm text-textSecondary pb-1">/ 100</span>
                        </div>
                        {/* Progress bar */}
                        <div className="w-full bg-white/[0.08] h-1.5 mt-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${post.aiConfidenceScore && post.aiConfidenceScore > 70 ? 'bg-accentGreen' : post.aiConfidenceScore && post.aiConfidenceScore > 40 ? 'bg-accentAmber' : 'bg-accentRed'}`}
                            style={{ width: `${post.aiConfidenceScore}%` }}
                          />
                        </div>
                      </div>
                      
                      <div>
                        <div className="text-xs text-textSecondary font-mono uppercase tracking-wider mb-1 flex items-center gap-1">
                          <ShieldAlert size={14} /> Risk Profile
                        </div>
                        <div className="text-sm text-textSecondary">
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
                    <button className="flex items-center gap-2 text-textSecondary hover:text-textPrimary transition-colors text-sm">
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
                  <a href="/login" className="bg-accentBlue text-textPrimary px-4 py-2 rounded font-medium shadow-[0_0_10px_rgba(96,165,250,0.3)] hover:shadow-[0_0_20px_rgba(96,165,250,0.5)] transition-shadow duration-200">
                    Sign In to Post
                  </a>
                </div>
              ) : (
                <form action={createCommunityPost} className="space-y-4">
                  {/* Every field carries a real label, not a placeholder standing
                      in for one. A placeholder disappears the moment you type, so
                      a half-filled form stops saying what its fields are — and it
                      is never read as the field's name by assistive tech. The
                      placeholder stays, demoted to what it is good at: an example. */}
                  <div>
                    <label htmlFor="post-title" className="mb-1.5 block text-sm font-medium text-textSecondary">
                      Idea title
                    </label>
                    <input
                      id="post-title"
                      name="title"
                      placeholder="TSLA breakout"
                      required
                      className="min-h-11 w-full rounded-lg border border-borderSubtle bg-black/30 px-3 text-sm text-textPrimary transition-colors duration-150 hover:border-borderStrong focus:border-accentBlue"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="post-ticker" className="mb-1.5 block text-sm font-medium text-textSecondary">
                        Ticker
                      </label>
                      <input
                        id="post-ticker"
                        name="ticker"
                        placeholder="AAPL"
                        required
                        className="ticker min-h-11 w-full rounded-lg border border-borderSubtle bg-black/30 px-3 text-sm uppercase text-textPrimary transition-colors duration-150 hover:border-borderStrong focus:border-accentBlue"
                      />
                    </div>
                    <div>
                      <label htmlFor="post-sentiment" className="mb-1.5 block text-sm font-medium text-textSecondary">
                        Sentiment
                      </label>
                      {/* appearance-none strips the native chevron, which left
                          the control looking exactly like the text input beside
                          it. If we take the affordance away we owe one back. */}
                      <div className="relative">
                        <select
                          id="post-sentiment"
                          name="sentiment"
                          className="min-h-11 w-full appearance-none rounded-lg border border-borderSubtle bg-black/30 pl-3 pr-9 text-sm text-textPrimary transition-colors duration-150 hover:border-borderStrong focus:border-accentBlue"
                        >
                          <option value="BULLISH" className="bg-bgSecondary">Bullish</option>
                          <option value="BEARISH" className="bg-bgSecondary">Bearish</option>
                        </select>
                        <ChevronDown
                          size={14}
                          aria-hidden
                          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-textMuted"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="post-content" className="mb-1.5 block text-sm font-medium text-textSecondary">
                      Rationale
                    </label>
                    <textarea
                      id="post-content"
                      name="content"
                      placeholder="The fundamental or technical case, and what would prove it wrong."
                      rows={5}
                      required
                      className="w-full resize-none rounded-lg border border-borderSubtle bg-black/30 p-3 text-sm leading-relaxed text-textPrimary transition-colors duration-150 hover:border-borderStrong focus:border-accentBlue"
                    />
                  </div>

                  <button 
                    type="submit" 
                    className="min-h-11 w-full rounded-lg bg-accentBlue px-4 font-bold text-bgPrimary shadow-[0_0_10px_rgba(96,165,250,0.2)] transition-colors duration-150 hover:bg-blue-300 active:bg-blue-400"
                  >
                    Publish Analysis
                  </button>
                </form>
              )}
            </div>
          </aside>

        </div>
      </PageShell>
    </div>
  );
}

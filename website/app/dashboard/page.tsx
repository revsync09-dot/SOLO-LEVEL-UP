'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('Overview');
  const [loading, setLoading] = useState(true);
  const [player, setPlayer] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const tabs = ['Overview', 'Inventory', 'Shadows', 'Cards'];

  useEffect(() => {
    // In a real app, you might get the ID from a session or URL
    // For now, let's try to fetch the top player as a "Live Demo" 
    // or use a specific ID if provided in URL
    const searchParams = new URLSearchParams(window.location.search);
    const id = searchParams.get('id');
    
    const fetchPlayerData = async (targetId: string | null) => {
      setLoading(true);
      try {
        let query = supabase.from('hunters').select('*');
        
        if (targetId) {
          query = query.eq('user_id', targetId);
        } else {
          // Default to top player if no ID
          query = query.order('xp', { ascending: false }).limit(1);
        }

        const { data, error } = await query.single();
        if (error) throw error;
        if (data) {
          setPlayer(data);
          setUserId(data.user_id);
        }
      } catch (err) {
        console.error('Error fetching player:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPlayerData(id);

    // LIVE REALTIME UPDATES for this specific player
    if (userId || !id) {
       const channel = supabase
        .channel('dashboard-updates')
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'hunters' },
          (payload) => {
            if (!id || payload.new.user_id === id) {
              setPlayer(payload.new);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [userId]);

  if (loading && !player) {
    return (
      <div className="pt-32 pb-24 px-6 min-h-screen bg-background flex items-center justify-center">
        <div className="text-primary font-black animate-pulse text-2xl uppercase tracking-widest">Loading Hunter Data...</div>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="pt-32 pb-24 px-6 min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted font-black text-2xl uppercase tracking-widest text-center">
           Hunter not found <br />
           <span className="text-sm font-medium mt-4 block">Please check the Hunter ID</span>
        </div>
      </div>
    );
  }

  const max_xp = player.level * 1000 * (player.level / 10 + 1); // Mock formula
  const xp_percent = Math.min(100, (player.xp / max_xp) * 100);

  return (
    <div className="pt-32 pb-24 px-6 relative z-10 min-h-screen bg-background">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-12">
        
        {/* Left Sidebar: Hero Card */}
        <div className="lg:w-1/3 flex flex-col gap-8 h-fit lg:sticky lg:top-32">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass relative p-12 text-center group overflow-hidden border border-primary/20 bg-primary/5 transition-all hover:bg-primary/10"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 blur-[60px]" />
            <div className="flex justify-center mb-8 relative">
              <div className="w-40 h-40 rounded-full border-2 border-primary/40 bg-gradient-to-br from-primary via-background to-accent p-2 shadow-2xl shadow-primary/20 group-hover:scale-105 transition-transform duration-500 overflow-hidden relative">
                <div className="absolute inset-0 bg-primary/20 blur-xl opacity-50" />
                <div className="w-full h-full bg-background rounded-full flex items-center justify-center font-black text-6xl text-primary text-shadow-glow">
                  {player.username ? player.username[0] : '?'}
                </div>
              </div>
              <div className="absolute -bottom-2 bg-primary px-6 py-1 rounded-full text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/40 group-hover:scale-115 transition-transform">
                Lv. {player.level}
              </div>
            </div>

            <h2 className="text-3xl font-black mb-2 uppercase tracking-tight title-glow">
              {player.username}
            </h2>
            <div className="text-muted text-sm font-bold uppercase tracking-widest mb-8 text-primary italic">
              {player.rank || 'E-Rank'}
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex justify-between text-xs font-bold text-muted px-2 lowercase uppercase tracking-widest">
                <span>XP Progress</span>
                <span className="text-white">{xp_percent.toFixed(1)}%</span>
              </div>
              <div className="w-full h-3 bg-white/5 border border-white/10 rounded-full overflow-hidden shadow-inner">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${xp_percent}%` }}
                  transition={{ duration: 1.2 }}
                  className="h-full bg-gradient-to-r from-primary to-accent shadow-lg shadow-primary/30"
                />
              </div>
            </div>

            <div className="flex items-center justify-between bg-white/5 rounded-xl p-4 border border-white/5">
               <div className="flex flex-col items-start px-2">
                  <div className="text-[10px] text-muted font-black uppercase tracking-widest">Gold Balance</div>
                  <div className="text-lg font-black text-yellow-500">{(player.gold || 0).toLocaleString()}</div>
               </div>
               <div className="w-10 h-10 bg-yellow-500/10 rounded-lg flex items-center justify-center text-yellow-500">💰</div>
            </div>
          </motion.div>

          {/* Stat Grid */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-2 gap-4"
          >
            {[
              { label: 'STR', val: player.strength || 10 },
              { label: 'AGI', val: player.agility || 10 },
              { label: 'INT', val: player.intelligence || 10 },
              { label: 'VIT', val: player.vitality || 10 },
            ].map((stat, i) => (
              <div key={stat.label} className="glass p-6 text-center group hover:bg-white/5 transition-all">
                <div className="text-muted text-[10px] font-black uppercase tracking-widest mb-1 group-hover:text-primary transition-colors">{stat.label}</div>
                <div className="text-2xl font-black text-white group-hover:text-shadow-glow transition-all">{stat.val}</div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Right Content Area */}
        <div className="lg:w-2/3 flex flex-col gap-8">
          <div className="flex gap-4 flex-wrap">
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 min-w-[120px] py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${
                  activeTab === tab 
                  ? 'bg-primary text-white shadow-xl shadow-primary/20 border-primary border scale-105' 
                  : 'bg-white/5 border border-white/5 text-muted hover:bg-white/10'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <motion.div 
            key={activeTab}
            layout
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass p-10 min-h-[500px]"
          >
            {activeTab === 'Overview' && (
              <div className="space-y-12">
                <h3 className="text-2xl font-black border-l-4 border-primary pl-4 uppercase tracking-tight">Hunter Overview</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="bg-white/5 p-8 rounded-3xl border border-white/5">
                      <div className="text-muted text-xs font-black uppercase tracking-widest mb-4">Class Specialization</div>
                      <div className="text-2xl font-black text-primary uppercase">{player.class || 'Unknown'}</div>
                   </div>
                   <div className="bg-white/5 p-8 rounded-3xl border border-white/5">
                      <div className="text-muted text-xs font-black uppercase tracking-widest mb-4">Assigned Race</div>
                      <div className="text-2xl font-black text-accent uppercase">{player.race || 'Human'}</div>
                   </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-black text-muted uppercase tracking-widest">Recent Activity</h4>
                  <div className="p-12 text-center bg-white/5 rounded-3xl border border-dashed border-white/10 italic text-muted">
                    No recent activities recorded for this hunter session.
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'Shadows' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {(player.shadows || []).length > 0 ? player.shadows.map((shadow: any, i: number) => (
                  <div key={i} className="glass p-8 flex items-center gap-6 group hover:translate-x-2 transition-all">
                    <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center text-3xl shadow-lg shadow-primary/10 group-hover:shadow-primary/30 transition-all">✨</div>
                    <div>
                      <div className="text-xl font-black uppercase text-white tracking-widest group-hover:text-primary transition-colors">{typeof shadow === 'string' ? shadow : shadow.name}</div>
                      <div className="text-xs text-muted font-bold">Shadow Soldier • Extracted</div>
                    </div>
                  </div>
                )) : (
                   <div className="col-span-2 py-20 text-center text-muted italic">No shadows extracted yet.</div>
                )}
              </div>
            )}

            {activeTab === 'Inventory' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {(player.inventory || []).length > 0 ? player.inventory.map((item: string, i: number) => (
                  <div key={i} className="glass p-8 flex items-center gap-6 group hover:bg-white/10 transition-all cursor-pointer">
                    <div className="w-16 h-16 rounded-2xl bg-accent/20 flex items-center justify-center text-3xl shadow-lg border border-accent/20 group-hover:border-accent group-hover:bg-accent/30 transition-all">⚔️</div>
                    <div>
                      <div className="text-lg font-black uppercase text-white tracking-tight group-hover:text-accent transition-colors">{item}</div>
                      <div className="text-xs text-muted font-bold">Legendary Item</div>
                    </div>
                  </div>
                )) : (
                  <div className="col-span-2 py-20 text-center text-muted italic">Inventory is empty.</div>
                )}
              </div>
            )}

            {activeTab === 'Cards' && (
               <div className="py-20 text-center text-muted italic">Card system integration coming soon.</div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

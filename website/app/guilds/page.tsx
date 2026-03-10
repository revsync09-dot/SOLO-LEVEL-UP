'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { LOCKED_GUILD_ID, EMOJIS, getEmojiUrl } from '../../lib/constants';

const GuildPage = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalMembers: 0,
    totalPower: 0,
    topRank: 'N/A',
    guildName: 'Monarch Alliance' // Default
  });

  useEffect(() => {
    const fetchGuildData = async () => {
      setLoading(true);
      try {
        const { data, count, error } = await supabase
          .from('hunters')
          .select('*', { count: 'exact' })
          .eq('guild_id', LOCKED_GUILD_ID);

        if (error) throw error;
        if (data) {
          const power = data.reduce((acc, h) => acc + (h.xp || 0), 0);
          setStats({
            totalMembers: count || 0,
            totalPower: power,
            topRank: data[0]?.rank || 'S-Rank',
            guildName: 'Solo Level Up Official'
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchGuildData();
  }, []);

  return (
    <div className="pt-32 pb-24 px-6 relative z-10 min-h-screen bg-background text-white">
      <div className="max-w-7xl mx-auto">
        <header className="mb-16">
          <h1 className="text-6xl font-black mb-6 uppercase tracking-tighter title-glow">
            Guild <span className="text-primary italic">Stats</span>
          </h1>
          <p className="text-muted text-lg max-w-2xl leading-relaxed">
            Live status of our main alliance. Tracking members, power, 
            and global standing in real-time.
          </p>
        </header>

        <div className="glass p-12 overflow-hidden relative">
           <div className="absolute top-0 right-0 p-12 opacity-5">
              <img src={getEmojiUrl(EMOJIS.RANK)} className="w-64 h-64 grayscale" alt="" />
           </div>

           <div className="flex flex-col md:flex-row items-center gap-12 mb-16 relative z-10">
              <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-primary to-accent shadow-2xl shadow-primary/20 flex items-center justify-center font-black text-6xl border border-white/10 uppercase">
                 {stats.guildName[0]}
              </div>
              <div className="text-center md:text-left">
                 <h2 className="text-4xl font-black uppercase tracking-tight mb-2 tracking-tighter">{stats.guildName}</h2>
                 <div className="text-primary font-black text-sm uppercase tracking-widest flex items-center justify-center md:justify-start gap-2">
                    <img src={getEmojiUrl(EMOJIS.SUCCESS)} className="w-4 h-4" alt="" /> Official Server Guild
                 </div>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
              <div className="bg-white/5 border border-white/5 p-10 rounded-3xl hover:border-primary/30 transition-all">
                 <div className="text-muted text-xs font-black uppercase tracking-widest mb-4">Total Members</div>
                 <div className="text-4xl font-black flex items-center gap-4">
                    {stats.totalMembers} <span className="text-lg text-primary opacity-50">/ 100</span>
                 </div>
              </div>
              <div className="bg-white/5 border border-white/5 p-10 rounded-3xl hover:border-accent/30 transition-all">
                 <div className="text-muted text-xs font-black uppercase tracking-widest mb-4">Combat Power</div>
                 <div className="text-4xl font-black text-accent">{(stats.totalPower / 1000).toFixed(1)}K</div>
              </div>
              <div className="bg-white/5 border border-white/5 p-10 rounded-3xl hover:border-primary/30 transition-all">
                 <div className="text-muted text-xs font-black uppercase tracking-widest mb-4">Main Rank</div>
                 <div className="text-4xl font-black title-glow">{stats.topRank}</div>
              </div>
           </div>
        </div>

        <div className="mt-12 text-center">
           <p className="text-muted text-sm font-medium">Want to join our guild? Reach out on our Discord server.</p>
        </div>
      </div>
    </div>
  );
};

export default GuildPage;

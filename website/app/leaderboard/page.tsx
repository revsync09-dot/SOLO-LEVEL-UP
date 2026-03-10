'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { LOCKED_GUILD_ID, EMOJIS, getEmojiUrl } from '../../lib/constants';

const Leaderboard = () => {
  const [activeTab, setActiveTab] = useState('Global');
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState<any[]>([]);

  const tabs = ['Global', 'Power', 'Dungeons', 'Damage'];

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const GID = LOCKED_GUILD_ID || '1425973312588091394';
        
        // Fetch hunter usernames for mapping
        const { data: hMap, error: mError } = await supabase
          .from('hunters')
          .select('user_id, username, rank')
          .eq('guild_id', GID);
        
        const userMap = new Map((hMap || []).map(h => [h.user_id, h]));

        let categoryField = 'xp';
        let table = 'hunters';

        switch (activeTab) {
          case 'Global':
            table = 'hunters';
            categoryField = 'xp';
            break;
          case 'Power':
            table = 'event_user_stats';
            categoryField = 'combat_power';
            break;
          case 'Dungeons':
            table = 'event_user_stats';
            categoryField = 'dungeon_clears';
            break;
          case 'Damage':
            table = 'event_user_stats';
            categoryField = 'highest_damage';
            break;
          case 'Gold':
            table = 'event_user_stats';
            categoryField = 'top_gold';
            break;
          default:
            table = 'hunters';
            categoryField = 'xp';
        }

        const { data, error } = await supabase
          .from(table)
          .select('*')
          .eq('guild_id', GID)
          .order(categoryField, { ascending: false })
          .limit(50);

        if (error) {
          console.error('Supabase Query Error:', error);
          throw error;
        }

        if (data) {
          const processed = data.map(row => ({
            ...row,
            username: row.username || userMap.get(row.user_id)?.username || `Hunter_${row.user_id?.slice(-4)}`,
            rank: row.rank || userMap.get(row.user_id)?.rank || 'E-Rank',
            displayValue: row[categoryField] || 0
          }));
          setPlayers(processed);
        }
      } catch (err) {
        console.error('Fatal fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [activeTab]);

  return (
    <div className="pt-32 pb-24 px-6 relative z-10 min-h-screen bg-background">
      <div className="max-w-7xl mx-auto">
        <header className="mb-12 text-center md:text-left">
          <h1 className="text-5xl md:text-6xl font-black mb-6 uppercase tracking-tighter title-glow">
            Hunter <span className="text-primary">Ranking</span>
          </h1>
          <p className="text-muted text-lg max-w-2xl">
            See who stands at the top of the world. Data is updated <span className="text-accent underline decoration-accent/30 decoration-2 underline-offset-4">live</span> as hunters complete dungeons.
          </p>
        </header>

        {/* Tabs */}
        <div className="flex gap-4 mb-12 flex-wrap justify-center md:justify-start">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-8 py-3 rounded-full font-black text-sm uppercase tracking-widest transition-all ${
                activeTab === tab 
                ? 'bg-primary text-white shadow-lg shadow-primary/30 scale-110' 
                : 'bg-white/5 border border-white/10 text-muted hover:bg-white/10'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Leaderboard Table */}
        <div className="glass overflow-hidden border border-white/5">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5 bg-white/5">
                  <th className="px-8 py-6 text-xs text-muted font-bold uppercase tracking-widest w-20">No.</th>
                  <th className="px-8 py-6 text-xs text-muted font-bold uppercase tracking-widest">Hunter</th>
                  <th className="px-8 py-6 text-xs text-muted font-bold uppercase tracking-widest flex items-center gap-2">
                    <img src={getEmojiUrl(EMOJIS.RANK)} className="w-4 h-4" alt="Rank" /> Rank
                  </th>
                  <th className="px-8 py-6 text-xs text-muted font-bold uppercase tracking-widest text-right">
                    <div className="flex justify-end items-center gap-2">
                      <img src={getEmojiUrl(EMOJIS.LEVEL)} className="w-4 h-4" alt="LVL" /> LVL
                    </div>
                  </th>
                  <th className="px-8 py-6 text-xs text-muted font-bold uppercase tracking-widest text-right">XP Total</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="popLayout">
                  {loading && players.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-20 text-center text-muted italic">Loading hunters...</td>
                    </tr>
                  ) : (
                    players.map((player, index) => (
                      <motion.tr
                        key={player.user_id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="border-b border-white/5 hover:bg-white/5 transition-colors group cursor-pointer"
                      >
                        <td className="px-8 py-6">
                          <span className={`w-8 h-8 flex items-center justify-center rounded-lg font-black text-sm ${
                            index === 0 ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' :
                            index === 1 ? 'bg-gray-400 text-black' :
                            index === 2 ? 'bg-amber-700 text-white' : 'bg-white/10 text-muted'
                          }`}>
                            {index + 1}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent opacity-80" />
                            <div>
                              <div className="font-black text-lg group-hover:text-primary transition-colors">{player.username}</div>
                              <div className="text-xs text-muted font-bold">{player.guild || 'No Guild'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-md text-[10px] font-black uppercase tracking-tighter text-muted group-hover:text-white transition-colors flex items-center gap-1 w-fit">
                            <img src={getEmojiUrl(EMOJIS.RANK)} className="w-3 h-3" alt="" />
                            {player.rank || 'E-Rank'}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-right font-black text-white group-hover:text-accent transition-colors">
                          {player.level}
                        </td>
                        <td className="px-8 py-6 text-right font-black text-primary text-lg">
                          {(player.displayValue || 0).toLocaleString()}
                        </td>
                      </motion.tr>
                    ))
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>

        {players.length === 0 && !loading && (
          <div className="py-24 text-center">
            <div className="text-6xl mb-6 opacity-30">💀</div>
            <p className="text-muted text-xl font-bold uppercase tracking-widest">No Hunters Found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;

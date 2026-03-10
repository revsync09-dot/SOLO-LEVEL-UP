'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';

// Mock data for initial fill
const mockPlayers = [
  { user_id: '1', username: 'SungJinWoo', level: 120, rank: 'Shadow Monarch', xp: 9500000, guild: 'Solo' },
  { user_id: '2', username: 'ChaHaeIn', level: 95, rank: 'S-Rank', xp: 450000, guild: 'Hunters' },
  { user_id: '3', username: 'BaekYoonho', level: 88, rank: 'S-Rank', xp: 320000, guild: 'White Tiger' },
  { user_id: '4', username: 'ThomasAndre', level: 105, rank: 'National Level', xp: 750000, guild: 'Scavenger' },
  { user_id: '5', username: 'GoGunHee', level: 100, rank: 'Chairman', xp: 600000, guild: 'Association' },
];

const Leaderboard = () => {
  const [activeTab, setActiveTab] = useState('Global');
  const [loading, setLoading] = useState(false);
  const [players, setPlayers] = useState(mockPlayers);

  const tabs = ['Global', 'Monthly', 'Weekly', 'Guild'];

  // In a real scenario, this would trigger a query
  useEffect(() => {
    // fetchData();
  }, [activeTab]);

  return (
    <div className="pt-32 pb-24 px-6 relative z-10 min-h-screen bg-background">
      <div className="max-w-7xl mx-auto">
        <header className="mb-12 text-center md:text-left">
          <h1 className="text-5xl md:text-6xl font-black mb-6 uppercase tracking-tighter title-glow">
            Hunter <span className="text-primary">Ranking</span>
          </h1>
          <p className="text-muted text-lg max-w-2xl">
            See who stands at the top of the world. Only the strongest 
            survive in the path of the monarchs.
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
                  <th className="px-8 py-6 text-xs text-muted font-bold uppercase tracking-widest">Rank</th>
                  <th className="px-8 py-6 text-xs text-muted font-bold uppercase tracking-widest text-right">LVL</th>
                  <th className="px-8 py-6 text-xs text-muted font-bold uppercase tracking-widest text-right">XP Total</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="popLayout">
                  {players.map((player, index) => (
                    <motion.tr
                      key={player.user_id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ delay: index * 0.05 }}
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
                        <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-md text-[10px] font-black uppercase tracking-tighter text-muted group-hover:text-white transition-colors">
                          {player.rank}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right font-black text-white group-hover:text-accent transition-colors">
                        {player.level}
                      </td>
                      <td className="px-8 py-6 text-right font-black text-primary text-lg">
                        {player.xp.toLocaleString()}
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile View / Empty State */}
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

'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { LOCKED_GUILD_ID } from '../../lib/constants';

const StatsPage = () => {
  const [stats, setStats] = useState({
    hunts: 0,
    bosses: 0,
    dungeons: 0,
    shadows: 0,
    gold: 0,
    hunters: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGlobalStats = async () => {
      setLoading(true);
      try {
        // Fetch hunter aggregates
        const { data: huntersData, error: hError } = await supabase
          .from('hunters')
          .select('xp, gold, level')
          .eq('guild_id', LOCKED_GUILD_ID);

        // Fetch event stats aggregates
        const { data: eventData, error: eError } = await supabase
          .from('event_user_stats')
          .select('dungeon_clears, damage_dealt, extreme_gate_clears')
          .eq('guild_id', LOCKED_GUILD_ID);

        // Fetch shadows count
        const { count: shadowsCount, error: sError } = await supabase
          .from('shadows')
          .select('*', { count: 'exact', head: true })
          .eq('guild_id', LOCKED_GUILD_ID);

        // Fetch loot box count as proxy for activity
        const { count: lootsCount } = await supabase
          .from('loot_box_opens')
          .select('*', { count: 'exact', head: true });

        if (!hError && !eError) {
          const totalGold = (huntersData || []).reduce((acc, curr) => acc + (Number(curr.gold) || 0), 0);
          const totalDungeons = (eventData || []).reduce((acc, curr) => acc + (Number(curr.dungeon_clears) || 0), 0);
          const totalExtreme = (eventData || []).reduce((acc, curr) => acc + (Number(curr.extreme_gate_clears) || 0), 0);
          
          setStats({
            hunters: (huntersData || []).length,
            gold: totalGold,
            dungeons: totalDungeons,
            bosses: totalExtreme,
            shadows: shadowsCount || 0,
            hunts: lootsCount || 0 // Use loots as proxy until we have a hunt_history
          });
        }
      } catch (err) {
        console.error('Error fetching global stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchGlobalStats();
  }, []);

  const statItems = [
    { label: 'Total Activities', value: stats.hunts.toLocaleString(), trend: 'Real-time', icon: '⚔️' },
    { label: 'Elite Bosses', value: stats.bosses.toLocaleString(), trend: 'High Priority', icon: '👑' },
    { label: 'Dungeons Cleared', value: stats.dungeons.toLocaleString(), trend: 'Active Hunts', icon: '🏰' },
    { label: 'Shadows Extracted', value: stats.shadows.toLocaleString(), trend: 'Summon Level', icon: '✨' },
    { label: 'Gold in Circulation', value: stats.gold.toLocaleString(), trend: 'Economy', icon: '💰' },
    { label: 'Registered Hunters', value: stats.hunters.toLocaleString(), trend: 'Guild Strength', icon: '👥' },
  ];

  return (
    <div className="pt-32 pb-24 px-6 relative z-10 min-h-screen bg-background">
      <div className="max-w-7xl mx-auto">
        <header className="mb-16 text-center">
          <h1 className="text-6xl font-black mb-6 uppercase tracking-tighter title-glow">
            Global <span className="text-primary italic">Intelligence</span>
          </h1>
          <p className="text-muted text-lg max-w-2xl mx-auto leading-relaxed">
            Every move in the hunters' world is recorded. This live intelligence report 
            shows the collective impact our guild has on the world of monarchs.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {statItems.map((stat, idx) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="glass p-10 border border-white/5 hover:border-primary/40 transition-all hover:bg-white/5 group"
            >
              <div className="flex justify-between items-start mb-8">
                <div className="text-5xl group-hover:scale-110 transition-transform">{stat.icon}</div>
                <div className="text-accent text-[10px] font-black bg-accent/10 px-3 py-1 rounded-full uppercase tracking-tighter shadow-lg shadow-accent/5">
                  {stat.trend}
                </div>
              </div>
              <div className="text-4xl font-black mb-2 tracking-tighter text-white group-hover:text-shadow-glow transition-all">
                {loading ? '...' : stat.value}
              </div>
              <div className="text-muted text-xs font-bold uppercase tracking-widest opacity-80 group-hover:opacity-100 transition-opacity">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-12 glass p-12 text-center border-dashed border-white/10 border-2">
           <div className="text-muted italic mb-4 text-sm font-medium">Real-time Data Stream Enabled</div>
           <div className="w-full h-8 bg-primary/20 rounded-full overflow-hidden relative">
              <div className="absolute inset-0 bg-primary/40 animate-[loading_2s_infinite]" style={{ width: '40%' }}></div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default StatsPage;

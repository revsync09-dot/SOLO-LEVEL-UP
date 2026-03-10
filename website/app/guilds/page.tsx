'use client';

import React from 'react';
import { motion } from 'framer-motion';

const guilds = [
  { name: 'Solo Levelers', power: '24.5M', members: 48, level: 15, boss: 'Kamish Defeated' },
  { name: 'Hunters', power: '18.2M', members: 40, level: 12, boss: 'High Orc King' },
  { name: 'White Tiger', power: '15.1M', members: 35, level: 10, boss: 'Ice Elf Chieftain' },
  { name: 'Scavenger', power: '22.8M', members: 45, level: 14, boss: 'Magma Beast' },
];

const GuildsPage = () => {
  return (
    <div className="pt-32 pb-24 px-6 relative z-10 min-h-screen bg-background text-white">
      <div className="max-w-7xl mx-auto">
        <header className="mb-16 flex flex-col md:flex-row justify-between items-end gap-8">
          <div className="flex-1">
            <h1 className="text-6xl font-black mb-6 uppercase tracking-tighter title-glow">
              <span className="text-primary italic">Guild</span> Rankings
            </h1>
            <p className="text-muted text-lg max-w-2xl leading-relaxed">
              Powerful alliances fighting for supremacy. Joint forces to conquer 
              S-Rank dungeons and dominated the world guilds leaderboard.
            </p>
          </div>
          <button className="bg-white/5 border border-white/10 hover:bg-white/10 px-8 py-4 rounded-full font-black text-sm uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-xl shadow-white/5">
            Create Guild
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {guilds.map((guild, idx) => (
            <motion.div
              key={guild.name}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="glass p-12 group hover:border-primary/50 hover:bg-white/5 transition-all overflow-hidden relative"
            >
              <div className="absolute top-0 right-0 p-8 text-4xl opacity-10 font-black italic">{idx + 1}</div>
              <div className="flex items-center gap-8 mb-10">
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary to-accent-dim shadow-xl shadow-primary/20 flex items-center justify-center font-black text-5xl group-hover:scale-110 transition-transform duration-500 border border-white/5">
                  {guild.name[0]}
                </div>
                <div>
                  <h3 className="text-3xl font-black uppercase tracking-tight group-hover:text-primary transition-colors">{guild.name}</h3>
                  <div className="text-accent font-black text-xs uppercase tracking-widest">Level {guild.level} Alliance</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-6 mb-10">
                <div className="bg-white/5 p-6 rounded-2xl border border-white/5 text-center group-hover:border-primary/30 transition-all">
                  <div className="text-muted text-[10px] uppercase font-black tracking-widest mb-1">Total Power</div>
                  <div className="text-xl font-black title-glow">{guild.power}</div>
                </div>
                <div className="bg-white/5 p-6 rounded-2xl border border-white/5 text-center group-hover:border-primary/30 transition-all">
                  <div className="text-muted text-[10px] uppercase font-black tracking-widest mb-1">Members</div>
                  <div className="text-xl font-black">{guild.members}</div>
                </div>
                <div className="bg-white/5 p-6 rounded-2xl border border-white/5 text-center group-hover:border-primary/30 transition-all">
                  <div className="text-muted text-[10px] uppercase font-black tracking-widest mb-1">Rank</div>
                  <div className="text-xl font-black text-primary">#{idx + 1}</div>
                </div>
              </div>

              <div className="flex justify-between items-center py-6 px-8 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all group-hover:border-accent shadow-inner">
                <div className="flex gap-4 items-center">
                  <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center text-sm shadow-inner group-hover:bg-accent group-hover:text-white transition-all">⚔️</div>
                  <div className="text-sm font-bold text-muted group-hover:text-white transition-colors">Latest Conquest: <span className="text-white font-black">{guild.boss}</span></div>
                </div>
                <div className="text-accent text-xs font-black uppercase tracking-widest">Details →</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GuildsPage;

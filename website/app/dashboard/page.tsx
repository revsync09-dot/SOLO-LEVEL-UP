'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const player = {
  username: 'SungJinWoo',
  rank: 'Shadow Monarch',
  level: 120,
  xp: 9500000,
  max_xp: 10000000,
  gold: 245000,
  stats: { str: 280, agi: 310, int: 215, vit: 240 },
  inventory: ['Kamish\'s Wrath', 'Demon King\'s Longsword', 'Shadow Dagger'],
  shadows: ['Igris', 'Beru', 'Tusk', 'Tank', 'Greed'],
  cards: ['Epic SJW', 'Legendary Monarch Armor'],
};

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('Overview');

  const tabs = ['Overview', 'Inventory', 'Shadows', 'Cards'];

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
                  {player.username[0]}
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
              {player.rank}
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex justify-between text-xs font-bold text-muted px-2 lowercase uppercase tracking-widest">
                <span>XP Progress</span>
                <span className="text-white">{(player.xp / player.max_xp * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full h-3 bg-white/5 border border-white/10 rounded-full overflow-hidden shadow-inner">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(player.xp / player.max_xp * 100)}%` }}
                  transition={{ duration: 1.2, delay: 0.4 }}
                  className="h-full bg-gradient-to-r from-primary to-accent shadow-lg shadow-primary/30"
                />
              </div>
            </div>

            <button className="w-full bg-primary hover:bg-primary/80 text-white font-bold py-4 rounded-xl transition-all shadow-xl shadow-primary/20 active:scale-95">
              Rank Up Exam
            </button>
          </motion.div>

          {/* Stat Grid */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-2 gap-4"
          >
            {Object.entries(player.stats).map(([stat, val], i) => (
              <div key={stat} className="glass p-6 text-center group hover:bg-white/5 transition-all">
                <div className="text-muted text-[10px] font-black uppercase tracking-widest mb-1 group-hover:text-primary transition-colors">{stat}</div>
                <div className="text-2xl font-black text-white group-hover:text-shadow-glow transition-all">{val}</div>
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
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass p-10 min-h-[500px]"
          >
            {activeTab === 'Overview' && (
              <div className="space-y-12">
                <h3 className="text-2xl font-black border-l-4 border-primary pl-4 uppercase tracking-tight">Recent Activity</h3>
                <div className="space-y-4">
                  {[
                    { action: 'Defeated Vulcan', time: '2 hours ago', reward: '+12,500 XP' },
                    { action: 'Raid: Jeju Island', time: '5 hours ago', reward: '+45,000 Gold' },
                    { action: 'Shadow Extracted: Beru', time: '1 day ago', reward: 'New SS-Rank Shadow' },
                  ].map((act, i) => (
                    <div key={i} className="flex justify-between items-center p-6 bg-white/5 rounded-2xl border border-white/5 hover:border-primary/30 transition-all hover:bg-white/10 group">
                      <div className="flex gap-4 items-center">
                        <div className="w-10 h-10 flex border-2 border-white/5 rounded-xl border items-center justify-center font-black group-hover:border-primary/50 transition-colors">🔥</div>
                        <div>
                          <div className="font-bold text-white group-hover:text-primary transition-colors">{act.action}</div>
                          <div className="text-xs text-muted leading-relaxed font-medium">{act.time}</div>
                        </div>
                      </div>
                      <div className="text-accent font-black text-sm">{act.reward}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'Shadows' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {player.shadows.map((shadow, i) => (
                  <div key={i} className="glass p-8 flex items-center gap-6 group hover:translate-x-2 transition-all">
                    <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center text-3xl shadow-lg shadow-primary/10 group-hover:shadow-primary/30 transition-all">✨</div>
                    <div>
                      <div className="text-xl font-black uppercase text-white tracking-widest group-hover:text-primary transition-colors">{shadow}</div>
                      <div className="text-xs text-muted font-bold">Shadow Soldier • Rank S</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'Inventory' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {player.inventory.map((item, i) => (
                  <div key={i} className="glass p-8 flex items-center gap-6 group hover:bg-white/10 transition-all cursor-pointer">
                    <div className="w-16 h-16 rounded-2xl bg-accent/20 flex items-center justify-center text-3xl shadow-lg border border-accent/20 group-hover:border-accent group-hover:bg-accent/30 transition-all">⚔️</div>
                    <div>
                      <div className="text-lg font-black uppercase text-white tracking-tight group-hover:text-accent transition-colors">{item}</div>
                      <div className="text-xs text-muted font-bold">Mythic Weapon • ATK +240</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'Cards' && (
               <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                 {player.cards.map((card, i) => (
                   <div key={i} className="aspect-[2/3] glass bg-gradient-to-t from-primary/30 via-primary/5 to-transparent p-6 flex flex-col justify-end border-primary/20 hover:border-primary/60 transition-all hover:scale-105 group relative group">
                     <div className="absolute top-4 left-4 text-xs font-black px-2 py-1 bg-primary text-white uppercase tracking-tighter shadow-lg shadow-primary/40">Legendary</div>
                     <div className="font-black text-xl uppercase tracking-tighter leading-none group-hover:text-primary transition-colors">
                       {card.split(' ')[1] || card} <br />
                       <span className="text-primary/50 group-hover:text-primary transition-colors">{card.split(' ')[0]}</span>
                     </div>
                   </div>
                 ))}
               </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

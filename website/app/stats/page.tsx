'use client';

import React from 'react';
import { motion } from 'framer-motion';

const globalStats = [
  { label: 'Total Hunts', value: '412,892', trend: '+12% this week', icon: '⚔️' },
  { label: 'Bosses Defeated', value: '18,221', trend: '+5% this week', icon: '👑' },
  { label: 'Dungeons Cleared', value: '92,110', trend: '+24% this week', icon: '🏰' },
  { label: 'Shadows Extracted', value: '1.4M', trend: '+8% this week', icon: '✨' },
  { label: 'Market Transactions', value: '8.2M Gold', trend: '+15% this week', icon: '💰' },
  { label: 'Active Hunters', value: '45,000+', trend: '+2% this week', icon: '👥' },
];

const StatsPage = () => {
  return (
    <div className="pt-32 pb-24 px-6 relative z-10 min-h-screen bg-background">
      <div className="max-w-7xl mx-auto">
        <header className="mb-16 text-center">
          <h1 className="text-6xl font-black mb-6 uppercase tracking-tighter title-glow">
            Global <span className="text-primary">Statistics</span>
          </h1>
          <p className="text-muted text-lg max-w-2xl mx-auto">
            A real-time overview of the Solo Level Up ecosystem. 
            Tracking every hunt, every kill, and every shadow extracted.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {globalStats.map((stat, idx) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="glass p-10 border border-white/5 hover:border-primary/40 transition-all hover:bg-white/5"
            >
              <div className="flex justify-between items-start mb-8">
                <div className="text-5xl">{stat.icon}</div>
                <div className="text-accent text-xs font-black bg-accent/10 px-3 py-1 rounded-full">
                  {stat.trend}
                </div>
              </div>
              <div className="text-4xl font-black mb-2 tracking-tighter text-white">
                {stat.value}
              </div>
              <div className="text-muted text-sm font-bold uppercase tracking-widest">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Placeholder for Charts */}
        <div className="mt-12 glass p-12 text-center border-dashed border-white/10 border-2">
           <div className="text-muted italic mb-4">Activity Graphs (Powered by Chart.js)</div>
           <div className="w-full h-64 bg-white/5 rounded-3xl animate-pulse" />
        </div>
      </div>
    </div>
  );
};

export default StatsPage;

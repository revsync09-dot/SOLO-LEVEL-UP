'use client';

import React from 'react';
import { motion } from 'framer-motion';

const stats = [
  { label: 'Hunters', value: '12,451', icon: '⚔️', color: '#7c3aed' },
  { label: 'Dungeons', value: '87,122', icon: '🏰', color: '#22c55e' },
  { label: 'Boss Kills', value: '9,221', icon: '👑', color: '#f59e0b' },
  { label: 'Total XP', value: '1.2B', icon: '🔥', color: '#ef4444' },
];

const StatsSection = () => {
  return (
    <section className="py-24 px-6 relative z-10">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, idx) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="glass p-8 group hover:border-primary/50 hover:bg-primary/5 transition-all duration-300"
            >
              <div className="text-4xl mb-6 transform group-hover:scale-110 transition-transform">
                {stat.icon}
              </div>
              <div className="text-3xl font-black mb-1 group-hover:title-glow transition-all text-white">
                {stat.value}
              </div>
              <div className="text-muted text-sm font-bold uppercase tracking-widest">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsSection;

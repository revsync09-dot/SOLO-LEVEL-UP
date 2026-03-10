'use client';

import React from 'react';
import { motion } from 'framer-motion';

const features = [
  { icon: '⚔️', title: 'Intense Combat', desc: 'Face legendary bosses and clear high-difficulty dungeons.' },
  { icon: '👑', title: 'Rank Progression', desc: 'From E-Rank to National Level and beyond. Reawaken your power.' },
  { icon: '✨', title: 'Shadow Army', desc: 'Arise! Extract shadows from fallen enemies and build your legion.' },
  { icon: '💎', title: 'Epic Gear', desc: 'Collect mythic weapons and armor sets for massive hidden boosts.' },
];

const FeaturesSection = () => {
  return (
    <section className="py-24 px-6 relative z-10 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-black mb-6 uppercase tracking-tighter title-glow">
            Ascend to <span className="text-primary">Monarch</span> status
          </h2>
          <p className="text-muted max-w-2xl mx-auto">
            Experience the most immersive Solo Leveling RPG on Discord. 
            Grow stronger, clear gates, and rule the world of hunters.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, idx) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.15 }}
              className="glass p-10 hover:border-primary border-transparent transition-all hover:bg-white/5 group"
            >
              <div className="text-5xl mb-8 transform group-hover:-translate-y-2 group-hover:scale-110 transition-all">
                {feature.icon}
              </div>
              <h3 className="text-xl font-black mb-4 uppercase tracking-tight group-hover:text-primary transition-colors">
                {feature.title}
              </h3>
              <p className="text-muted text-sm leading-relaxed">
                {feature.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;

'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';

const Hero = () => {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center p-6 overflow-hidden">
      {/* Background Image with epic overlay */}
      <div className="absolute inset-0 z-0">
        <Image 
          src="/hero-bg.png" 
          alt="Solo Leveling Background" 
          fill 
          className="object-cover opacity-60 scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-background/40" />
      </div>

      {/* Hero Content */}
      <div className="relative z-10 max-w-4xl w-full text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="bg-primary/10 border border-primary/20 backdrop-blur-sm px-4 py-1 rounded-full text-primary text-xs font-bold uppercase tracking-widest mb-6 inline-block"
        >
          The Ultimate Discord RPG Experience
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-6xl md:text-8xl font-black mb-8 tracking-tighter uppercase leading-[0.9] title-glow"
        >
          Solo <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Level Up</span>
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-muted text-lg md:text-xl max-w-2xl mx-auto mb-12 leading-relaxed"
        >
          We have developed for you Members of Lucent, a Live Stats System, So you can see your Stats better
          and compare with others, We hope you will have fun with it.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="flex flex-col md:flex-row items-center justify-center gap-6"
        >
          <button className="w-full md:w-auto px-10 py-4 glass bg-primary/20 text-white font-bold text-lg hover:bg-primary/40 transition-all hover:scale-105 active:scale-95 shadow-xl shadow-primary/10">
            Invite Bot
          </button>
          <button className="w-full md:w-auto px-10 py-4 glass bg-white/5 text-muted hover:text-white font-bold text-lg hover:bg-white/10 transition-all hover:scale-105 active:scale-95 border-white/10">
            View Leaderboard
          </button>
        </motion.div>
      </div>

      {/* Animated Floating Particles/Effect */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] hero-gradient z-0 pointer-events-none opacity-40" />
    </section>
  );
};

export default Hero;

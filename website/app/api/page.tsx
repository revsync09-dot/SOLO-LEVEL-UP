'use client';

import React from 'react';
import { motion } from 'framer-motion';

const endpoints = [
  { method: 'GET', url: '/api/player/:id', desc: 'Fetch hunter stats, inventory, and shadows.' },
  { method: 'GET', url: '/api/leaderboard/global', desc: 'Get the top 100 hunters worldwide.' },
  { method: 'GET', url: '/api/guild/:id', desc: 'Fetch guild details, members, and power stats.' },
  { method: 'GET', url: '/api/stats', desc: 'Get live global game statistics (hunts, kills, XP).' },
];

const ApiDocs = () => {
  return (
    <div className="pt-32 pb-24 px-6 relative z-10 min-h-screen bg-background">
      <div className="max-w-7xl mx-auto">
        <header className="mb-16">
          <h1 className="text-6xl font-black mb-6 uppercase tracking-tighter title-glow">
            Developer <span className="text-primary">API</span>
          </h1>
          <p className="text-muted text-lg max-w-2xl">
            Integrate Solo Level Up data into your own projects. 
            Our REST API provides read-only access to hunter and guild data.
          </p>
        </header>

        <div className="space-y-12">
          {endpoints.map((ep, idx) => (
            <motion.div
              key={ep.url}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="glass p-10 border border-white/5 hover:border-primary/30 transition-all hover:bg-white/5 group"
            >
              <div className="flex flex-col md:flex-row gap-6 md:items-center justify-between mb-8">
                <div className="flex gap-4 items-center flex-wrap">
                  <span className="px-5 py-2 bg-primary rounded-lg text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20">
                    {ep.method}
                  </span>
                  <code className="bg-white/5 px-4 py-2 rounded-lg text-accent font-black text-sm group-hover:bg-accent/10 transition-colors">
                    {ep.url}
                  </code>
                </div>
                <div className="text-muted text-xs font-bold uppercase tracking-widest">Rate Limit: 60/min</div>
              </div>

              <p className="text-muted text-lg leading-relaxed mb-8">
                {ep.desc}
              </p>

              <div className="bg-background rounded-2xl border border-white/5 p-8 overflow-x-auto group-hover:border-primary/20 transition-all">
                <div className="text-xs text-muted mb-4 uppercase font-black tracking-widest flex items-center justify-between">
                  <span>Example Response</span>
                  <span className="text-primary italic">JSON</span>
                </div>
                <pre className="text-xs font-mono text-white/50 group-hover:text-white transition-colors leading-relaxed">
{`{
  "status": "success",
  "data": {
    "user_id": "1425973312588",
    "name": "SungJinWoo",
    "level": 120,
    "rank": "Shadow Monarch",
    "xp": 9500000
  }
}`}
                </pre>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ApiDocs;

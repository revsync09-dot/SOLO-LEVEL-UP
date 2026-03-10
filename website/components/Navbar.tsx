'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

const Navbar = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4">
      <div className="max-w-7xl mx-auto glass px-6 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="relative w-10 h-10 shadow-lg shadow-primary/20 rounded-lg overflow-hidden border border-primary/30">
            <Image 
              src="/logo.png" 
              alt="Logo" 
              fill 
              className="object-cover"
              priority
            />
          </div>
          <span className="font-bold text-xl tracking-tighter title-glow uppercase">
            Solo Level Up
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted">
          <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
          <Link href="/leaderboard" className="hover:text-white transition-colors">Leaderboard</Link>
          <Link href="/stats" className="hover:text-white transition-colors">Stats</Link>
          <Link href="/guilds" className="hover:text-white transition-colors">Guild</Link>
        </div>

        <Link 
          href="https://discord.com" 
          className="bg-primary hover:bg-primary/80 text-white px-5 py-2 rounded-full text-sm font-bold transition-all hover:scale-105 active:scale-95 shadow-lg shadow-primary/20"
        >
          Invite Bot
        </Link>
      </div>
    </nav>
  );
};

export default Navbar;

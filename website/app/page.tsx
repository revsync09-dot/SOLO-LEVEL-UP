import React from 'react';
import Hero from '../components/Hero';
import StatsSection from '../components/StatsSection';
import FeaturesSection from '../components/FeaturesSection';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <Hero />
      <div className="relative">
        <StatsSection />
        <FeaturesSection />
      </div>

      {/* Footer / CTA Section */}
      <section className="py-24 px-6 text-center relative z-10">
        <div className="max-w-4xl mx-auto glass p-16 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 blur-[100px]" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/20 blur-[100px]" />
          
          <h2 className="text-4xl md:text-5xl font-black mb-8 uppercase tracking-tighter title-glow">
            Ready to <span className="text-primary italic">reawaken?</span>
          </h2>
          <p className="text-muted text-lg mb-12 max-w-xl mx-auto">
            Join Lucent's strongest hunters. The gates are open and your destiny awaits.
          </p>
          <div className="flex justify-center">
            <a href="/leaderboard" className="bg-primary text-white font-bold py-4 px-12 rounded-full hover:scale-105 transition-all shadow-lg shadow-primary/30">
              View Leaderboard
            </a>
          </div>
        </div>
      </section>

      <footer className="py-12 border-t border-white/5 text-center text-muted text-sm px-6">
        <p>© 2026 SOLO LEVEL UP Bot. Designed for the ultimate hunters of Lucent.</p>
        <div className="mt-4 flex gap-6 justify-center">
          <a href="#" className="hover:text-primary transition-colors">Privacy</a>
          <a href="#" className="hover:text-primary transition-colors">Terms</a>
          <a href="#" className="hover:text-primary transition-colors">Discord</a>
        </div>
      </footer>
    </div>
  );
}

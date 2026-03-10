import '../styles/globals.css'
import React from 'react'
import Navbar from '../components/Navbar'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Solo Level Up | The Ultimate Discord RPG',
  description: 'Experience the world of Solo Leveling on Discord. Level up, hunt monsters, and build your shadow army.',
  icons: {
    icon: '/logo.png',
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${inter.className} bg-background text-white selection:bg-primary/30 selection:text-primary`}>
        <Navbar />
        <main className="min-h-screen relative">{children}</main>
      </body>
    </html>
  )
}

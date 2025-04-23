'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { FiArrowRight, FiCheck, FiTrendingUp, FiVideo, FiMail, FiClock, FiStar } from 'react-icons/fi';
import CheckoutButton from '@/components/CheckoutButton';

export default function LandingPage() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Navbar */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled ? 'bg-gray-900/90 backdrop-blur-md py-3 shadow-xl' : 'bg-transparent py-5'
        }`}
      >
        <div className="container mx-auto px-6 flex justify-between items-center">
          <div className="flex items-center">
            <span className="text-2xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
              Lazy Trends
            </span>
          </div>
          <nav className="hidden md:flex space-x-10">
            <a href="#features" className="text-gray-300 hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="text-gray-300 hover:text-white transition-colors">How It Works</a>
            <a href="#pricing" className="text-gray-300 hover:text-white transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center space-x-4">
            <Link href="/auth/login" className="text-gray-300 hover:text-white transition-colors">
              Login
            </Link>
            <Link
              href="/auth/signup"
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-5 py-2 rounded-lg transition-all duration-300 transform hover:scale-105"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="container mx-auto">
          <div className="flex flex-col lg:flex-row items-center">
            <motion.div
              className="lg:w-1/2 mb-12 lg:mb-0"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
                <span className="block">Discover TikTok Trends</span>
                <span className="bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">Without the Effort</span>
              </h1>
              <p className="text-xl text-gray-300 mb-8">
                Lazy Trends analyzes trending TikTok content and generates personalized recommendations for your business. Stay ahead of the curve without spending hours on research.
              </p>
              <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                <Link
                  href="/auth/signup"
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-8 py-4 rounded-lg font-medium flex items-center justify-center transition-all duration-300 transform hover:scale-105"
                >
                  Start Free Trial <FiArrowRight className="ml-2" />
                </Link>
                <a
                  href="#how-it-works"
                  className="bg-gray-800 hover:bg-gray-700 text-white px-8 py-4 rounded-lg font-medium flex items-center justify-center transition-colors"
                >
                  See How It Works
                </a>
              </div>
            </motion.div>
            <motion.div
              className="lg:w-1/2"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl blur-lg opacity-75"></div>
                <div className="relative bg-gray-800 p-6 rounded-2xl shadow-2xl">
                  <div className="aspect-video rounded-lg overflow-hidden bg-gray-700">
                  <Image
                    src="/images/dashboard-preview.png"
                    alt="Lazy Trends Dashboard"
                    width={800}
                    height={450}
                    className="w-full h-full object-cover"
                    priority
                  />
                </div>
                  <div className="mt-6 grid grid-cols-2 gap-4">
                    <div className="bg-gray-700/50 p-4 rounded-lg">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-indigo-600/30 flex items-center justify-center">
                          <FiTrendingUp className="text-indigo-400" />
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium">Trending Topics</p>
                          <p className="text-xs text-gray-400">5 new trends</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gray-700/50 p-4 rounded-lg">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-purple-600/30 flex items-center justify-center">
                          <FiVideo className="text-purple-400" />
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium">Analyzed Videos</p>
                          <p className="text-xs text-gray-400">25 videos</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>



      {/* Features Section */}
      <section id="features" className="py-20 px-6">
        <div className="container mx-auto">
          <motion.div
            className="text-center max-w-3xl mx-auto mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              <span className="bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
                Features Designed for Busy Creators
              </span>
            </h2>
            <p className="text-xl text-gray-300">
              Lazy Trends gives you everything you need to stay on top of TikTok trends without the endless scrolling and research.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: <FiTrendingUp className="w-6 h-6 text-indigo-400" />,
                title: "AI-Powered Trend Analysis",
                description: "Our AI analyzes thousands of trending TikTok videos to identify patterns and opportunities for your niche."
              },
              {
                icon: <FiVideo className="w-6 h-6 text-purple-400" />,
                title: "Video Content Insights",
                description: "Get detailed breakdowns of what makes trending videos successful, from pacing to music choices."
              },
              {
                icon: <FiStar className="w-6 h-6 text-pink-400" />,
                title: "Personalized Recommendations",
                description: "Receive custom content ideas tailored to your business niche and audience preferences."
              },
              {
                icon: <FiMail className="w-6 h-6 text-blue-400" />,
                title: "Daily Email Updates",
                description: "Get fresh trend recommendations delivered to your inbox at your preferred time."
              },
              {
                icon: <FiClock className="w-6 h-6 text-green-400" />,
                title: "Time-Saving Automation",
                description: "Automatic trend analysis runs every 24 hours, keeping you updated without manual effort."
              },
              {
                icon: <FiCheck className="w-6 h-6 text-yellow-400" />,
                title: "Actionable Content Scripts",
                description: "Receive ready-to-use content ideas with specific guidance on how to recreate trending formats."
              }
            ].map((feature, index) => (
              <motion.div
                key={index}
                className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-indigo-500/50 transition-all duration-300"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ y: -5, boxShadow: "0 10px 25px -5px rgba(79, 70, 229, 0.2)" }}
              >
                <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-gray-400">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-6 bg-gray-800/30">
        <div className="container mx-auto">
          <motion.div
            className="text-center max-w-3xl mx-auto mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              <span className="bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
                How Lazy Trends Works
              </span>
            </h2>
            <p className="text-xl text-gray-300">
              Our streamlined process delivers valuable insights with minimal effort on your part.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Quick Onboarding",
                description: "Tell us about your business and content goals in our simple onboarding process."
              },
              {
                step: "02",
                title: "AI Analysis",
                description: "Our AI automatically scrapes and analyzes trending TikTok content relevant to your niche."
              },
              {
                step: "03",
                title: "Get Recommendations",
                description: "Receive personalized content recommendations and actionable insights via email and dashboard."
              }
            ].map((step, index) => (
              <motion.div
                key={index}
                className="relative"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.2 }}
              >
                <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 h-full">
                  <div className="text-5xl font-bold text-indigo-500/20 mb-4">{step.step}</div>
                  <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                  <p className="text-gray-400">{step.description}</p>
                </div>
                {index < 2 && (
                  <div className="hidden md:block absolute top-1/2 right-0 transform translate-x-1/2 -translate-y-1/2 text-indigo-500/50">
                    <FiArrowRight className="w-8 h-8" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials section removed as requested */}

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-6 bg-gray-800/30">
        <div className="container mx-auto">
          <motion.div
            className="text-center max-w-3xl mx-auto mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              <span className="bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
                Simple, Transparent Pricing
              </span>
            </h2>
            <p className="text-xl text-gray-300">
              Start your journey to better TikTok content today
            </p>
          </motion.div>

          <motion.div
            className="max-w-md mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="bg-gray-800 rounded-2xl overflow-hidden border border-gray-700 shadow-xl">
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6">
                <h3 className="text-2xl font-bold text-white mb-2">Pro Plan</h3>
                <div className="flex items-baseline">
                  <span className="text-4xl font-bold text-white">$39.95</span>
                  <span className="text-xl text-indigo-100 ml-1">/month</span>
                </div>
                <p className="text-indigo-100 mt-2">First week free</p>
              </div>

              <div className="p-6 space-y-4">
                <ul className="space-y-3">
                  <li className="flex items-center">
                    <svg className="h-5 w-5 text-green-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-gray-300">Daily trend analysis</span>
                  </li>
                  <li className="flex items-center">
                    <svg className="h-5 w-5 text-green-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-gray-300">Personalized recommendations</span>
                  </li>
                  <li className="flex items-center">
                    <svg className="h-5 w-5 text-green-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-gray-300">Daily email updates</span>
                  </li>
                  <li className="flex items-center">
                    <svg className="h-5 w-5 text-green-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-gray-300">Actionable content scripts</span>
                  </li>
                </ul>

                <CheckoutButton
                  priceId={process.env.NEXT_PUBLIC_PRICE_ID || ''}
                  className="mt-6 w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 md:py-4 md:text-lg md:px-10 transition-all duration-300 transform hover:scale-105"
                >
                  Start Free Trial
                </CheckoutButton>
                <p className="text-sm text-center text-gray-400 mt-3">Credit card required for trial</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto">
          <motion.div
            className="bg-gradient-to-r from-indigo-900/50 to-purple-900/50 rounded-2xl p-12 relative overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            {/* Background decoration */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
              <div className="absolute top-0 right-0 bg-indigo-500 opacity-10 w-96 h-96 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl"></div>
              <div className="absolute bottom-0 left-0 bg-purple-500 opacity-10 w-96 h-96 rounded-full translate-y-1/2 -translate-x-1/3 blur-3xl"></div>
            </div>

            <div className="relative z-10 text-center max-w-3xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Ready to Transform Your TikTok Strategy?
              </h2>
              <p className="text-xl text-gray-300 mb-8">
                Join thousands of creators who are saving time and growing their audience with Lazy Trends.
              </p>
              <CheckoutButton
                priceId={process.env.NEXT_PUBLIC_PRICE_ID || ''}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-8 py-4 rounded-lg font-medium inline-flex items-center justify-center transition-all duration-300 transform hover:scale-105"
              >
                Start Your Free Trial <FiArrowRight className="ml-2" />
              </CheckoutButton>

            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 bg-gray-800/50">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-8 md:mb-0">
              <div className="text-2xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent mb-2">
                Lazy Trends
              </div>
              <p className="text-gray-400">AI-powered TikTok trend recommendations</p>
            </div>
            <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-8">
              <a href="#features" className="text-gray-300 hover:text-white transition-colors">Features</a>
              <a href="#how-it-works" className="text-gray-300 hover:text-white transition-colors">How It Works</a>
              <a href="#pricing" className="text-gray-300 hover:text-white transition-colors">Pricing</a>
              <Link href="/auth/login" className="text-gray-300 hover:text-white transition-colors">Login</Link>
              <Link href="/auth/signup" className="text-gray-300 hover:text-white transition-colors">Sign Up</Link>
            </div>
          </div>
          <div className="border-t border-gray-700 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm mb-4 md:mb-0">© {new Date().getFullYear()} Lazy Trends. All rights reserved.</p>
            <div className="flex space-x-4">
              <Link href="/privacy" className="text-gray-400 hover:text-white transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms" className="text-gray-400 hover:text-white transition-colors">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

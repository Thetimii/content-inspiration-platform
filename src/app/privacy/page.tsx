'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiArrowLeft } from 'react-icons/fi';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Link 
              href="/landing" 
              className="inline-flex items-center text-indigo-400 hover:text-indigo-300 mb-8"
            >
              <FiArrowLeft className="mr-2" /> Back to Home
            </Link>
            
            <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
              Privacy Policy
            </h1>
            
            <div className="prose prose-lg prose-invert">
              <p className="text-gray-300">
                Last Updated: {new Date().toLocaleDateString()}
              </p>
              
              <h2 className="text-2xl font-semibold mt-8 mb-4 text-white">1. Introduction</h2>
              <p className="text-gray-300">
                Welcome to Lazy Trends. We respect your privacy and are committed to protecting your personal data. 
                This privacy policy will inform you about how we look after your personal data when you visit our website 
                and tell you about your privacy rights and how the law protects you.
              </p>
              
              <h2 className="text-2xl font-semibold mt-8 mb-4 text-white">2. Data We Collect</h2>
              <p className="text-gray-300">
                We may collect, use, store and transfer different kinds of personal data about you which we have grouped together as follows:
              </p>
              <ul className="list-disc pl-6 mt-4 space-y-2 text-gray-300">
                <li>Identity Data includes first name, last name, username or similar identifier.</li>
                <li>Contact Data includes email address.</li>
                <li>Technical Data includes internet protocol (IP) address, browser type and version, time zone setting and location, browser plug-in types and versions, operating system and platform, and other technology on the devices you use to access this website.</li>
                <li>Profile Data includes your username and password, your interests, preferences, feedback and survey responses.</li>
                <li>Usage Data includes information about how you use our website, products and services.</li>
              </ul>
              
              <h2 className="text-2xl font-semibold mt-8 mb-4 text-white">3. How We Use Your Data</h2>
              <p className="text-gray-300">
                We will only use your personal data when the law allows us to. Most commonly, we will use your personal data in the following circumstances:
              </p>
              <ul className="list-disc pl-6 mt-4 space-y-2 text-gray-300">
                <li>Where we need to perform the contract we are about to enter into or have entered into with you.</li>
                <li>Where it is necessary for our legitimate interests (or those of a third party) and your interests and fundamental rights do not override those interests.</li>
                <li>Where we need to comply with a legal obligation.</li>
              </ul>
              
              <h2 className="text-2xl font-semibold mt-8 mb-4 text-white">4. Data Security</h2>
              <p className="text-gray-300">
                We have put in place appropriate security measures to prevent your personal data from being accidentally lost, used or accessed in an unauthorized way, altered or disclosed. In addition, we limit access to your personal data to those employees, agents, contractors and other third parties who have a business need to know.
              </p>
              
              <h2 className="text-2xl font-semibold mt-8 mb-4 text-white">5. Your Legal Rights</h2>
              <p className="text-gray-300">
                Under certain circumstances, you have rights under data protection laws in relation to your personal data, including the right to:
              </p>
              <ul className="list-disc pl-6 mt-4 space-y-2 text-gray-300">
                <li>Request access to your personal data.</li>
                <li>Request correction of your personal data.</li>
                <li>Request erasure of your personal data.</li>
                <li>Object to processing of your personal data.</li>
                <li>Request restriction of processing your personal data.</li>
                <li>Request transfer of your personal data.</li>
                <li>Right to withdraw consent.</li>
              </ul>
              
              <h2 className="text-2xl font-semibold mt-8 mb-4 text-white">6. Contact Us</h2>
              <p className="text-gray-300">
                If you have any questions about this privacy policy or our privacy practices, please contact us at:
              </p>
              <p className="text-gray-300 mt-2">
                Email: support@lazytrends.com
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

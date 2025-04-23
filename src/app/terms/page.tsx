'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiArrowLeft } from 'react-icons/fi';

export default function TermsOfService() {
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
              Terms of Service
            </h1>
            
            <div className="prose prose-lg prose-invert">
              <p className="text-gray-300">
                Last Updated: {new Date().toLocaleDateString()}
              </p>
              
              <h2 className="text-2xl font-semibold mt-8 mb-4 text-white">1. Introduction</h2>
              <p className="text-gray-300">
                Welcome to Lazy Trends. These Terms of Service govern your use of our website and services. 
                By accessing or using our services, you agree to be bound by these Terms. If you disagree with any part of the terms, 
                you may not access the service.
              </p>
              
              <h2 className="text-2xl font-semibold mt-8 mb-4 text-white">2. Accounts</h2>
              <p className="text-gray-300">
                When you create an account with us, you must provide information that is accurate, complete, and current at all times. 
                Failure to do so constitutes a breach of the Terms, which may result in immediate termination of your account on our service.
              </p>
              <p className="text-gray-300 mt-4">
                You are responsible for safeguarding the password that you use to access the service and for any activities or actions under your password. 
                You agree not to disclose your password to any third party. You must notify us immediately upon becoming aware of any breach of security or unauthorized use of your account.
              </p>
              
              <h2 className="text-2xl font-semibold mt-8 mb-4 text-white">3. Subscription and Billing</h2>
              <p className="text-gray-300">
                Lazy Trends offers a subscription service with a free trial period. By signing up for our service, you agree to the following terms:
              </p>
              <ul className="list-disc pl-6 mt-4 space-y-2 text-gray-300">
                <li>Your free trial will last for one week from the date of sign-up.</li>
                <li>After the trial period, you will be automatically charged the subscription fee of $29.95 per month unless you cancel before the trial ends.</li>
                <li>You can cancel your subscription at any time through your account settings.</li>
                <li>No refunds will be provided for partial subscription periods.</li>
              </ul>
              
              <h2 className="text-2xl font-semibold mt-8 mb-4 text-white">4. Intellectual Property</h2>
              <p className="text-gray-300">
                The service and its original content, features, and functionality are and will remain the exclusive property of Lazy Trends and its licensors. 
                The service is protected by copyright, trademark, and other laws of both the United States and foreign countries. 
                Our trademarks and trade dress may not be used in connection with any product or service without the prior written consent of Lazy Trends.
              </p>
              
              <h2 className="text-2xl font-semibold mt-8 mb-4 text-white">5. Limitation of Liability</h2>
              <p className="text-gray-300">
                In no event shall Lazy Trends, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from:
              </p>
              <ul className="list-disc pl-6 mt-4 space-y-2 text-gray-300">
                <li>Your access to or use of or inability to access or use the service;</li>
                <li>Any conduct or content of any third party on the service;</li>
                <li>Any content obtained from the service; and</li>
                <li>Unauthorized access, use or alteration of your transmissions or content.</li>
              </ul>
              
              <h2 className="text-2xl font-semibold mt-8 mb-4 text-white">6. Changes</h2>
              <p className="text-gray-300">
                We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material we will try to provide at least 30 days' notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion.
              </p>
              
              <h2 className="text-2xl font-semibold mt-8 mb-4 text-white">7. Contact Us</h2>
              <p className="text-gray-300">
                If you have any questions about these Terms, please contact us at:
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

'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Onboarding() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    business_type: '',
    business_location: '',
    social_media_goal: '',
    experience_level: 'beginner',
    weekly_time_investment: '1-2 hours',
    email_notifications: true
  })

  const experienceLevels = [
    { value: 'beginner', label: 'Beginner - Just starting out' },
    { value: 'intermediate', label: 'Intermediate - Some experience' },
    { value: 'advanced', label: 'Advanced - Experienced creator' }
  ]

  const timeInvestmentOptions = [
    { value: '1-2 hours', label: '1-2 hours per week' },
    { value: '3-5 hours', label: '3-5 hours per week' },
    { value: '5-10 hours', label: '5-10 hours per week' },
    { value: '10+ hours', label: 'More than 10 hours per week' }
  ]

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No session found')

      const { error } = await supabase
        .from('user_onboarding')
        .insert([
          {
            user_id: session.user.id,
            ...formData
          }
        ])

      if (error) throw error

      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const nextStep = () => setStep(s => Math.min(s + 1, 4))
  const prevStep = () => setStep(s => Math.max(s - 1, 1))

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Let's personalize your experience
        </h2>
        <div className="mt-2 text-center text-sm text-gray-600">
          Step {step} of 4
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form onSubmit={handleSubmit} className="space-y-6">
            {step === 1 && (
              <div>
                <label htmlFor="business_type" className="block text-sm font-medium text-gray-700">
                  What type of business do you have?
                </label>
                <div className="mt-1">
                  <input
                    id="business_type"
                    name="business_type"
                    type="text"
                    required
                    value={formData.business_type}
                    onChange={handleChange}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <label htmlFor="business_location" className="block text-sm font-medium text-gray-700">
                  Where is your business located?
                </label>
                <div className="mt-1">
                  <input
                    id="business_location"
                    name="business_location"
                    type="text"
                    required
                    value={formData.business_location}
                    onChange={handleChange}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
              </div>
            )}

            {step === 3 && (
              <>
                <div>
                  <label htmlFor="social_media_goal" className="block text-sm font-medium text-gray-700">
                    What is your goal with social media content?
                  </label>
                  <div className="mt-1">
                    <textarea
                      id="social_media_goal"
                      name="social_media_goal"
                      required
                      value={formData.social_media_goal}
                      onChange={handleChange}
                      rows={3}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="experience_level" className="block text-sm font-medium text-gray-700">
                    What's your experience level with social media?
                  </label>
                  <select
                    id="experience_level"
                    name="experience_level"
                    value={formData.experience_level}
                    onChange={handleChange}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  >
                    {experienceLevels.map(level => (
                      <option key={level.value} value={level.value}>
                        {level.label}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {step === 4 && (
              <>
                <div>
                  <label htmlFor="weekly_time_investment" className="block text-sm font-medium text-gray-700">
                    How much time can you invest in content creation weekly?
                  </label>
                  <select
                    id="weekly_time_investment"
                    name="weekly_time_investment"
                    value={formData.weekly_time_investment}
                    onChange={handleChange}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  >
                    {timeInvestmentOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center">
                  <input
                    id="email_notifications"
                    name="email_notifications"
                    type="checkbox"
                    checked={formData.email_notifications}
                    onChange={handleChange}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="email_notifications" className="ml-2 block text-sm text-gray-900">
                    Receive email notifications for new content suggestions
                  </label>
                </div>
              </>
            )}

            {error && (
              <div className="text-red-600 text-sm">
                {error}
              </div>
            )}

            <div className="flex justify-between">
              {step > 1 && (
                <button
                  type="button"
                  onClick={prevStep}
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  Previous
                </button>
              )}
              
              {step < 4 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Next
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  {loading ? 'Saving...' : 'Complete Setup'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  )
} 
'use client'

import { useState, useEffect } from 'react'
import { CalendarIcon, BellIcon } from '@heroicons/react/24/outline'
import { supabase } from '@/lib/supabase'

export default function EmailSchedule() {
  const [loading, setLoading] = useState(true)
  const [emailNotifications, setEmailNotifications] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    fetchEmailSettings()
  }, [])

  const fetchEmailSettings = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data, error } = await supabase
        .from('user_onboarding')
        .select('email_notifications')
        .eq('user_id', session.user.id)
        .single()

      if (error) throw error

      setEmailNotifications(data.email_notifications)
    } catch (error) {
      console.error('Error fetching email settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleNotifications = async () => {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No session found')

      const { error } = await supabase
        .from('user_onboarding')
        .update({ email_notifications: !emailNotifications })
        .eq('user_id', session.user.id)

      if (error) throw error

      setEmailNotifications(!emailNotifications)
      setMessage({
        type: 'success',
        text: `Email notifications ${!emailNotifications ? 'enabled' : 'disabled'} successfully!`
      })
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.message
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Email Schedule</h1>
        <CalendarIcon className="h-6 w-6 text-indigo-600" />
      </div>

      {message && (
        <div className={`p-4 mb-6 rounded-md ${
          message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Email Notifications</h2>
            <p className="mt-1 text-sm text-gray-600">
              Receive daily content suggestions and insights via email.
            </p>
          </div>
          <button
            onClick={handleToggleNotifications}
            disabled={loading}
            className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
              emailNotifications ? 'bg-indigo-600' : 'bg-gray-200'
            }`}
          >
            <span className="sr-only">Toggle email notifications</span>
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 ${
                emailNotifications ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Email Schedule</h3>
          <div className="space-y-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <BellIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">Daily Content Suggestions</p>
                <p className="mt-1 text-sm text-gray-500">
                  Receive a daily email with trending content ideas and suggestions based on your business profile.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 
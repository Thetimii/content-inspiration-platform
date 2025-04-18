'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface NotificationSettings {
  email_notifications: boolean
  marketing_emails: boolean
}

export default function Settings() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    email_notifications: false,
    marketing_emails: false
  })

  useEffect(() => {
    fetchNotificationSettings()
  }, [])

  const fetchNotificationSettings = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data, error } = await supabase
        .from('user_onboarding')
        .select('email_notifications')
        .eq('user_id', session.user.id)
        .single()

      if (error) throw error

      setNotificationSettings(prev => ({
        ...prev,
        email_notifications: data.email_notifications
      }))
    } catch (error) {
      console.error('Error fetching notification settings:', error)
    }
  }

  const handleResetPassword = async () => {
    try {
      setLoading(true)
      setMessage(null)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user.email) {
        throw new Error('No email found for current user')
      }

      const { error } = await supabase.auth.resetPasswordForEmail(session.user.email)
      if (error) throw error

      setMessage({
        type: 'success',
        text: 'Password reset email sent! Please check your inbox.'
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

  const handleNotificationChange = async (field: keyof NotificationSettings) => {
    try {
      setLoading(true)
      const newValue = !notificationSettings[field]

      // If changing email_notifications, update in Supabase
      if (field === 'email_notifications') {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) throw new Error('No session found')

        const { error } = await supabase
          .from('user_onboarding')
          .update({ email_notifications: newValue })
          .eq('user_id', session.user.id)

        if (error) throw error
      }

      setNotificationSettings(prev => ({
        ...prev,
        [field]: newValue
      }))

      setMessage({
        type: 'success',
        text: 'Notification settings updated successfully!'
      })
    } catch (error: any) {
      console.error('Error updating notification settings:', error)
      setMessage({
        type: 'error',
        text: error.message
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      return
    }

    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No session found')

      // First delete the user's onboarding data
      const { error: onboardingError } = await supabase
        .from('user_onboarding')
        .delete()
        .eq('user_id', session.user.id)

      if (onboardingError) throw onboardingError

      // Then delete the user's auth account
      const { error: deleteError } = await supabase.auth.admin.deleteUser(
        session.user.id
      )

      if (deleteError) throw deleteError

      // Sign out the user
      await supabase.auth.signOut()
      window.location.href = '/' // Redirect to home page
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
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Settings</h1>

      {message && (
        <div className={`p-4 mb-6 rounded-md ${
          message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Account Settings</h2>
        <p className="text-sm text-gray-600 mb-4">
          Manage your account settings and preferences.
        </p>
        <button
          onClick={handleResetPassword}
          disabled={loading}
          className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {loading ? 'Processing...' : 'Reset Password'}
        </button>
      </div>

      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Notification Preferences</h2>
        <p className="text-sm text-gray-600 mb-4">
          Manage how you receive notifications.
        </p>
        <div className="space-y-4">
          <div className="flex items-start">
            <div className="flex items-center h-5">
              <input
                id="email_notifications"
                type="checkbox"
                checked={notificationSettings.email_notifications}
                onChange={() => handleNotificationChange('email_notifications')}
                disabled={loading}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
            </div>
            <div className="ml-3">
              <label htmlFor="email_notifications" className="font-medium text-gray-700">
                Email notifications
              </label>
              <p className="text-sm text-gray-500">
                Receive email updates about your account activity.
              </p>
            </div>
          </div>

          <div className="flex items-start">
            <div className="flex items-center h-5">
              <input
                id="marketing_emails"
                type="checkbox"
                checked={notificationSettings.marketing_emails}
                onChange={() => handleNotificationChange('marketing_emails')}
                disabled={loading}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
            </div>
            <div className="ml-3">
              <label htmlFor="marketing_emails" className="font-medium text-gray-700">
                Marketing emails
              </label>
              <p className="text-sm text-gray-500">
                Receive emails about new features and updates.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Delete Account</h2>
        <p className="text-sm text-gray-600 mb-4">
          Permanently remove your account and all of its contents from our platform.
        </p>
        <button
          onClick={handleDeleteAccount}
          disabled={loading}
          className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {loading ? 'Processing...' : 'Delete Account'}
        </button>
      </div>
    </div>
  )
} 
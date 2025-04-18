'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface UserData {
  id: string
  user_id: string
  business_type: string
  business_location: string
  social_media_goal: string
  experience_level: string
  weekly_time_investment: string
  email_notifications: boolean
}

export default function Facts() {
  const [userData, setUserData] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [editedData, setEditedData] = useState<UserData | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    fetchUserData()
  }, [])

  const fetchUserData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data, error } = await supabase
        .from('user_onboarding')
        .select('*')
        .eq('user_id', session.user.id)
        .single()

      if (error) throw error
      setUserData(data)
      setEditedData(data)
    } catch (error) {
      console.error('Error fetching user data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = () => {
    setIsEditing(true)
    setEditedData(userData)
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditedData(userData)
    setMessage(null)
  }

  const handleSave = async () => {
    if (!editedData) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { error } = await supabase
        .from('user_onboarding')
        .update({
          business_type: editedData.business_type,
          business_location: editedData.business_location,
          social_media_goal: editedData.social_media_goal,
          experience_level: editedData.experience_level,
          weekly_time_investment: editedData.weekly_time_investment,
          email_notifications: editedData.email_notifications
        })
        .eq('user_id', session.user.id)

      if (error) throw error

      setUserData(editedData)
      setIsEditing(false)
      setMessage({ type: 'success', text: 'Changes saved successfully!' })
    } catch (error: any) {
      console.error('Save error:', error)
      setMessage({ type: 'error', text: error.message })
    }
  }

  const handleChange = (field: keyof UserData, value: string | boolean) => {
    if (editedData) {
      setEditedData({ ...editedData, [field]: value })
    }
  }

  if (loading) {
    return <div className="p-4">Loading...</div>
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Facts About You</h1>
        {!isEditing ? (
          <button
            onClick={handleEdit}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Edit Facts
          </button>
        ) : (
          <div className="space-x-2">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Save
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {message && (
        <div className={`p-4 mb-4 rounded-md ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {message.text}
        </div>
      )}

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Profile Information</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Business Type</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedData?.business_type || ''}
                  onChange={(e) => handleChange('business_type', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              ) : (
                <p className="mt-1 text-sm text-gray-900">{userData?.business_type || 'Not specified'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Business Location</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedData?.business_location || ''}
                  onChange={(e) => handleChange('business_location', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              ) : (
                <p className="mt-1 text-sm text-gray-900">{userData?.business_location || 'Not specified'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Social Media Goal</label>
              {isEditing ? (
                <textarea
                  value={editedData?.social_media_goal || ''}
                  onChange={(e) => handleChange('social_media_goal', e.target.value)}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              ) : (
                <p className="mt-1 text-sm text-gray-900">{userData?.social_media_goal || 'Not specified'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Experience Level</label>
              {isEditing ? (
                <select
                  value={editedData?.experience_level || ''}
                  onChange={(e) => handleChange('experience_level', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="beginner">Beginner - Just starting out</option>
                  <option value="intermediate">Intermediate - Some experience</option>
                  <option value="advanced">Advanced - Experienced creator</option>
                </select>
              ) : (
                <p className="mt-1 text-sm text-gray-900">{userData?.experience_level || 'Not specified'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Weekly Time Investment</label>
              {isEditing ? (
                <select
                  value={editedData?.weekly_time_investment || ''}
                  onChange={(e) => handleChange('weekly_time_investment', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="1-2 hours">1-2 hours per week</option>
                  <option value="3-5 hours">3-5 hours per week</option>
                  <option value="5-10 hours">5-10 hours per week</option>
                  <option value="10+ hours">More than 10 hours per week</option>
                </select>
              ) : (
                <p className="mt-1 text-sm text-gray-900">{userData?.weekly_time_investment || 'Not specified'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Email Notifications</label>
              {isEditing ? (
                <input
                  type="checkbox"
                  checked={editedData?.email_notifications || false}
                  onChange={(e) => handleChange('email_notifications', e.target.checked)}
                  className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
              ) : (
                <p className="mt-1 text-sm text-gray-900">{userData?.email_notifications ? 'Enabled' : 'Disabled'}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {userData && (
        <div className="mt-8 bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Personalized Recommendations</h2>
          <p className="text-sm text-gray-600">
            Based on your profile, here are some suggestions to improve your social media presence:
          </p>
          <ul className="mt-4 space-y-2">
            {userData.experience_level === 'beginner' && (
              <>
                <li className="text-sm">• Start with basic content creation fundamentals</li>
                <li className="text-sm">• Focus on consistency over complexity</li>
                <li className="text-sm">• Learn one platform thoroughly before expanding</li>
              </>
            )}
            {userData.experience_level === 'intermediate' && (
              <>
                <li className="text-sm">• Experiment with different content formats</li>
                <li className="text-sm">• Analyze your best performing content</li>
                <li className="text-sm">• Start building a content calendar</li>
              </>
            )}
            {userData.experience_level === 'advanced' && (
              <>
                <li className="text-sm">• Optimize your content strategy</li>
                <li className="text-sm">• Focus on audience engagement metrics</li>
                <li className="text-sm">• Consider cross-platform promotion</li>
              </>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
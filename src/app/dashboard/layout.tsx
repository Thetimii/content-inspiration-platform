'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { 
  ChartBarIcon, 
  VideoCameraIcon, 
  UserCircleIcon, 
  Cog6ToothIcon, 
  ChatBubbleLeftRightIcon,
  CalendarIcon,
  SparklesIcon,
  ArrowLeftOnRectangleIcon
} from '@heroicons/react/24/outline'
import { supabase } from '@/lib/supabase'

const navigation = [
  {
    name: 'Report',
    href: '/dashboard',
    icon: ChartBarIcon,
    description: 'Overview and analytics'
  },
  {
    name: 'Analyzed Videos',
    href: '/dashboard/videos',
    icon: VideoCameraIcon,
    description: 'View analyzed content'
  },
  {
    name: 'Facts About You',
    href: '/dashboard/facts',
    icon: UserCircleIcon,
    description: 'Your profile information'
  },
  {
    name: "Today's Inspiration",
    href: '/dashboard/inspiration',
    icon: SparklesIcon,
    description: 'Daily content inspiration'
  },
  {
    name: 'Email Schedule',
    href: '/dashboard/email',
    icon: CalendarIcon,
    description: 'Manage email alerts'
  },
  {
    name: 'Feedback',
    href: '/dashboard/feedback',
    icon: ChatBubbleLeftRightIcon,
    description: 'Leave your feedback'
  },
  {
    name: 'Settings',
    href: '/dashboard/settings',
    icon: Cog6ToothIcon,
    description: 'Manage your account'
  }
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 min-h-screen bg-white shadow-sm">
          <div className="flex flex-col h-full">
            <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
              <div className="flex items-center flex-shrink-0 px-4">
                <h1 className="text-xl font-bold text-gray-900">Lazy</h1>
              </div>
              <nav className="mt-8 flex-1 px-2 space-y-1">
                {navigation.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                        isActive
                          ? 'bg-indigo-50 text-indigo-600'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <item.icon
                        className={`mr-3 flex-shrink-0 h-6 w-6 ${
                          isActive
                            ? 'text-indigo-600'
                            : 'text-gray-400 group-hover:text-gray-500'
                        }`}
                        aria-hidden="true"
                      />
                      <span className="flex-1">{item.name}</span>
                    </Link>
                  )
                })}
              </nav>
            </div>
            {/* Sign Out Button */}
            <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
              <button
                onClick={handleSignOut}
                className="group flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-600 hover:bg-gray-50 hover:text-gray-900 w-full"
              >
                <ArrowLeftOnRectangleIcon
                  className="mr-3 flex-shrink-0 h-6 w-6 text-gray-400 group-hover:text-gray-500"
                  aria-hidden="true"
                />
                Sign Out
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          <main className="py-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
} 
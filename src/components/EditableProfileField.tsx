import { useState } from 'react';
import { motion } from 'framer-motion';
import { FiEdit, FiCheck, FiX } from 'react-icons/fi';
import { useTheme } from '@/utils/themeContext';

interface EditableProfileFieldProps {
  label: string;
  value: string | number;
  onSave: (newValue: string) => Promise<void>;
  type?: 'text' | 'number' | 'select';
  options?: string[];
}

export default function EditableProfileField({
  label,
  value,
  onSave,
  type = 'text',
  options = [],
}: EditableProfileFieldProps) {
  const { isDarkMode } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value.toString());
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEdit = () => {
    setEditValue(value.toString());
    setIsEditing(true);
    setError(null);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setError(null);
  };

  const handleSave = async () => {
    if (!editValue.trim()) {
      setError('This field cannot be empty');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(editValue);
      setIsEditing(false);
      setError(null);
    } catch (err) {
      setError('Failed to save changes');
      console.error('Error saving profile field:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <h3 className={`text-md font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-black font-semibold'}`}>{label}</h3>

      {isEditing ? (
        <div className="space-y-2">
          {type === 'select' && options.length > 0 ? (
            <select
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${isDarkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              disabled={isSaving}
            >
              {options.map((option) => (
                <option key={option} value={option}>
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </option>
              ))}
            </select>
          ) : type === 'number' ? (
            <input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${isDarkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              disabled={isSaving}
            />
          ) : (
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${isDarkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              rows={3}
              disabled={isSaving}
            />
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex space-x-2">
            <motion.button
              onClick={handleSave}
              className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              disabled={isSaving}
            >
              <FiCheck className="mr-1" />
              Save
            </motion.button>
            <motion.button
              onClick={handleCancel}
              className="px-3 py-1 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 flex items-center"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              disabled={isSaving}
            >
              <FiX className="mr-1" />
              Cancel
            </motion.button>
          </div>
        </div>
      ) : (
        <div className={`p-4 rounded-lg flex justify-between items-center ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
          <p className={type === 'select' ? 'capitalize' : ''}>
            {value || 'Not specified'}
            {type === 'number' && value ? ' hours/week' : ''}
          </p>
          <motion.button
            onClick={handleEdit}
            className={`p-2 rounded-full ${isDarkMode ? 'text-indigo-400 hover:bg-gray-700' : 'text-indigo-600 hover:bg-indigo-50'}`}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <FiEdit />
          </motion.button>
        </div>
      )}
    </div>
  );
}

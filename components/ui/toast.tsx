import React, { useEffect } from 'react';
import { X, AlertCircle, CheckCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
  duration?: number;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose, duration = 3000 }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-500" />;
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getBgColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-100 dark:bg-green-900 dark:bg-opacity-20';
      case 'error':
        return 'bg-red-100 dark:bg-red-900 dark:bg-opacity-20';
      case 'info':
        return 'bg-blue-100 dark:bg-blue-900 dark:bg-opacity-20';
      default:
        return 'bg-blue-100 dark:bg-blue-900 dark:bg-opacity-20';
    }
  };

  const getBorderColor = () => {
    switch (type) {
      case 'success':
        return 'border-l-4 border-green-500';
      case 'error':
        return 'border-l-4 border-red-500';
      case 'info':
        return 'border-l-4 border-blue-500';
      default:
        return 'border-l-4 border-blue-500';
    }
  };

  return (
    <div className={`flex items-center justify-between p-4 mb-3 rounded shadow-lg text-sm ${getBgColor()} ${getBorderColor()} text-gray-800 dark:text-white`}>
      <div className="flex items-center">
        {getIcon()}
        <span className="ml-2">{message}</span>
      </div>
      <button onClick={onClose} className="ml-4 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default Toast;
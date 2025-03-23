'use client'
import React from 'react'
import Profile from './profile-page'
import { ToastProvider } from '@/components/ui/toast-provider';


const page = () => {
  return (
    <ToastProvider>
      <Profile />
    </ToastProvider>
  )
}

export default page
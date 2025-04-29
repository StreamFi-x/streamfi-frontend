'use client';

import React from 'react';
import { Home, Menu, Settings, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const MobNav = () => {
  const pathname = usePathname();
  
  // Define navigation items
  const navItems = [
    { name: 'Home', icon: Home, path: '/explore' },
    { name: 'Browse', icon: Menu, path: '/browse' },
    { name: 'Settings', icon: Settings, path: '/settings' },
    { name: 'Profile', icon: User, path: '/profile' }
  ];

  // Check if route is active
  const isActive = (path) => {
    return pathname === path || (path !== '/' && pathname.startsWith(path));
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-gray-800 py-2 px-4 md:hidden z-50">
      <div className='flex justify-between items-center'>
        {navItems.map((item) => {
          const active = isActive(item.path);
          const IconComponent = item.icon;
          
          return (
            <Link href={item.path} key={item.name} className="flex flex-col items-center">
              {item.name === 'Profile' ? (
                <div className={`rounded-full ${active ? 'bg-purple-700' : ''} p-1`}>
                  <IconComponent size={20} color={active ? '#8B5CF6' : 'white'} />
                </div>
              ) : (
                <IconComponent size={24} color={active ? '#8B5CF6' : 'white'} />
              )}
              <span className={`text-xs mt-1 ${active ? 'text-purple-500' : 'text-white'}`}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default MobNav;
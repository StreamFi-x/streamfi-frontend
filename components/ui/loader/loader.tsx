'use client'
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';
import './loader.css';

export default function NProgressProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    NProgress.configure({ 
      showSpinner: false,
      easing: 'ease',
      speed: 400,
      minimum: 0.1
    });
    NProgress.start();

    const timer = setTimeout(() => {
      NProgress.done();
    }, 500);

    return () => {
      clearTimeout(timer);
      NProgress.remove();
    };
  }, [pathname, searchParams]);

  return <>{children}</>;
}
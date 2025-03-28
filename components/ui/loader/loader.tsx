"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import NProgress from "nprogress";
import "nprogress/nprogress.css";
import "./loader.css";

export default function NProgressProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    NProgress.configure({
      showSpinner: false,
      easing: "ease",
      speed: 400,
      minimum: 0.1,
    });

    NProgress.start();

    // Debounce to prevent quick flickers
    timerRef.current = setTimeout(() => {
      NProgress.done();
    }, 500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      NProgress.done(); // Ensures progress bar ends if the component unmounts
    };
  }, [pathname, searchParams]);

  return <>{children}</>;
}

"use client"

import { FC } from 'react'
import NotFoundAnimation from "./NotFoundAnimation"
import BackgroundNumber from "./BackgroundNumber"
import AnimatedTitle from "./AnimatedTitle"
import ActionButtons from "./ActionButtons"
import LoadingDots from "./LoadingDots"

interface PageNotFoundContentProps {
  onGoBack: () => void
}

const PageNotFoundContent: FC<PageNotFoundContentProps> = ({ onGoBack }) => {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#16062B] p-4 text-center">
      <div className="max-w-md">
        <NotFoundAnimation>
          <BackgroundNumber />
          <AnimatedTitle />
        </NotFoundAnimation>

        <div className="mt-6 space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Page not found</h2>
            <p className="text-muted-foreground text-white">
              Oops! The page you're looking for seems to have wandered off into the digital wilderness.
            </p>
          </div>

          <ActionButtons onGoBack={onGoBack} />
        </div>
      </div>

      <LoadingDots />
    </div>
  )
}

export default PageNotFoundContent

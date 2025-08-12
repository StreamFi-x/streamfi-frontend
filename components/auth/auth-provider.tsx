"use client"

import { createContext, useContext, useEffect, useState, type ReactNode, useCallback } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAccount, useDisconnect, useConnect } from "@starknet-react/core"
import SimpleLoader from "@/components/ui/loader/simple-loader"
import { User, UserUpdateInput } from "@/types/user"

// Session timeout in milliseconds (24 hours)
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000
const SESSION_REFRESH_INTERVAL = 30 * 60 * 1000 // Refresh every 30 minutes

type AuthContextType = {
  user: User | null
  isLoading: boolean
  isInitializing: boolean
  error: string | null
  logout: () => void
  refreshUser: (walletAddress?: string) => Promise<User | null>
  updateUserProfile: (userData: UserUpdateInput) => Promise<boolean>
  isWalletConnecting: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: false,
  isInitializing: true,
  error: null,
  logout: () => {},
  refreshUser: async () => null,
  updateUserProfile: async () => false,
  isWalletConnecting: false,
})

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isWalletConnecting, setIsWalletConnecting] = useState(false)
  const [hasInitialized, setHasInitialized] = useState(false)

  const router = useRouter()
  const pathname = usePathname()
  const { address, isConnected, status } = useAccount()
  const { disconnect } = useDisconnect()
  const { connectors } = useConnect()

  // Wallet connection persistence
  const WALLET_CONNECTION_KEY = "starknet_last_wallet"
  const WALLET_AUTO_CONNECT_KEY = "starknet_auto_connect"

  const isSessionValid = (timestamp: number) => {
    return Date.now() - timestamp < SESSION_TIMEOUT
  }

  const setSessionCookies = (walletAddress: string) => {
    try {
      document.cookie = `wallet=${walletAddress}; path=/; max-age=${SESSION_TIMEOUT / 1000}; SameSite=Lax`
      localStorage.setItem("wallet", walletAddress)
      sessionStorage.setItem("wallet", walletAddress)
    } catch (error) {
      console.error("[AuthProvider] Error setting session cookies:", error)
    }
  }

  const clearSessionCookies = () => {
    document.cookie = "wallet=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax"
    localStorage.removeItem("wallet")
    sessionStorage.removeItem("wallet")
    // Don't clear StarkNet auto-connect data - this breaks auto-connect
    // localStorage.removeItem(WALLET_CONNECTION_KEY)
    // localStorage.removeItem(WALLET_AUTO_CONNECT_KEY)
  }

  const clearUserData = (walletAddress?: string) => {
    if (walletAddress) {
      localStorage.removeItem(`user_${walletAddress}`)
      localStorage.removeItem(`user_timestamp_${walletAddress}`)
    }
    sessionStorage.removeItem("userData")
    clearSessionCookies()
  }

  const clearAllData = () => {
    // This is for logout - clear everything including auto-connect
    document.cookie = "wallet=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax"
    localStorage.removeItem("wallet")
    sessionStorage.removeItem("wallet")
    localStorage.removeItem(WALLET_CONNECTION_KEY)
    localStorage.removeItem(WALLET_AUTO_CONNECT_KEY)
    sessionStorage.removeItem("userData")
  }

  const storeWalletConnection = (walletId: string, walletAddress: string) => {
    try {
      localStorage.setItem(WALLET_CONNECTION_KEY, walletId)
      localStorage.setItem(WALLET_AUTO_CONNECT_KEY, "true")
      console.log(`[AuthProvider] Stored wallet connection: ${walletId}`)
    } catch (error) {
      console.error("[AuthProvider] Error storing wallet connection:", error)
    }
  }

  const fetchUserData = async (walletAddress?: string): Promise<User | null> => {
    if (!walletAddress) {
      walletAddress = address || localStorage.getItem("wallet") || sessionStorage.getItem("wallet") || undefined
      if (!walletAddress) return null
    }

    try {
      setError(null)
      setIsLoading(true)

      // Check cached user data
      const cachedUserData = localStorage.getItem(`user_${walletAddress}`)
      const cachedTimestamp = localStorage.getItem(`user_timestamp_${walletAddress}`)

      if (cachedUserData && cachedTimestamp) {
        const parsedUser = JSON.parse(cachedUserData)
        const timestamp = Number.parseInt(cachedTimestamp)

        if (isSessionValid(timestamp)) {
          setUser(parsedUser)
          setSessionCookies(walletAddress)
          return parsedUser
        } else {
          localStorage.removeItem(`user_${walletAddress}`)
          localStorage.removeItem(`user_timestamp_${walletAddress}`)
          clearUserData(walletAddress) // Use clearUserData instead of clearSessionCookies
        }
      }

      const response = await fetch(`/api/users/wallet/${walletAddress}`, {
        headers: {
          "x-wallet-address": walletAddress,
        },
      })

      if (response.ok) {
        const data = await response.json()

        // Cache user data
        localStorage.setItem(`user_${walletAddress}`, JSON.stringify(data.user))
        localStorage.setItem(`user_timestamp_${walletAddress}`, Date.now().toString())

        // Store in sessionStorage for immediate access
        sessionStorage.setItem("userData", JSON.stringify(data.user))

        setSessionCookies(walletAddress)
        return data.user
      } else if (response.status === 404) {
        setUser(null)
        return null
      } else {
        throw new Error(`Failed to fetch user data: ${response.statusText}`)
      }
    } catch (err) {
      console.error("Error fetching user data:", err)
      setError("Failed to load user data")
      setUser(null)
      return null
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    // Disconnect wallet
    disconnect()

    // Clear user state
    setUser(null)

    // Clear all data including auto-connect (user explicitly logged out)
    clearAllData()

    // Navigate to home
    router.push("/")
  }

  // Handle wallet connection changes
  useEffect(() => {
    const handleWalletChange = async () => {
      if (status === "connecting") {
        setIsWalletConnecting(true)
        return
      }

      setIsWalletConnecting(false)

      if (isConnected && address) {
        // Store the address for auto-connect - let StarkNet handle connector detection
        localStorage.setItem("starknet_last_wallet", "auto")
        localStorage.setItem("starknet_auto_connect", "true")

        setSessionCookies(address)

        try {
          const userData = await fetchUserData(address)
          if (userData) {
            setUser(userData)
          }
        } catch (error) {
          console.error("[AuthProvider] Error fetching user data:", error)
        }
      } else if (status === "disconnected") {
        setUser(null)
        clearUserData(address)
      }
    }

    handleWalletChange()
  }, [isConnected, address, status, connectors])

  // Initialize auth on app start
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Check if auto-connect is enabled
        const shouldAutoConnect = localStorage.getItem(WALLET_AUTO_CONNECT_KEY) === "true"
        const lastWalletId = localStorage.getItem(WALLET_CONNECTION_KEY)

        // If wallet is already connected (due to StarkNet auto-connect), fetch user data
        if (isConnected && address) {
          await fetchUserData(address)
        } else if (shouldAutoConnect && lastWalletId) {
          // If auto-connect is enabled but wallet isn't connected yet, wait a bit longer
          return
        }
      } catch (err) {
        console.error("[AuthProvider] Error initializing authentication:", err)
        setError("Failed to initialize authentication")
      } finally {
        // Only set initializing to false if we're not waiting for auto-connect
        const shouldAutoConnect = localStorage.getItem(WALLET_AUTO_CONNECT_KEY) === "true"
        const lastWalletId = localStorage.getItem(WALLET_CONNECTION_KEY)
        
        if (!shouldAutoConnect || !lastWalletId || isConnected) {
          setIsInitializing(false)
          setHasInitialized(true)
        }
      }
    }

    // Add a delay to ensure StarkNet provider is ready
    const timer = setTimeout(initAuth, 500)
    return () => clearTimeout(timer)
  }, [])

  // Add a timeout to prevent infinite loading
  useEffect(() => {
    const shouldAutoConnect = localStorage.getItem(WALLET_AUTO_CONNECT_KEY) === "true"
    const lastWalletId = localStorage.getItem(WALLET_CONNECTION_KEY)
    
    if (shouldAutoConnect && lastWalletId && isInitializing) {
      // Set a timeout to prevent infinite loading (10 seconds)
      const timeout = setTimeout(() => {
        console.log("[AuthProvider] ⏰ Auto-connect timeout - stopping loading")
        setIsInitializing(false)
        setHasInitialized(true)
      }, 10000)
      
      return () => clearTimeout(timeout)
    }
  }, [isInitializing])

  // Handle auto-connect completion
  useEffect(() => {
    if (hasInitialized) return

    const shouldAutoConnect = localStorage.getItem(WALLET_AUTO_CONNECT_KEY) === "true"
    const lastWalletId = localStorage.getItem(WALLET_CONNECTION_KEY)

    // If auto-connect is enabled and we have a last wallet, wait for connection
    if (shouldAutoConnect && lastWalletId) {
      if (isConnected && address) {
        setIsInitializing(false)
        setHasInitialized(true)
      } else if (status === "disconnected" && !isWalletConnecting) {
        // Give auto-connect more time (up to 10 seconds)
        const autoConnectStartTime = Date.now()
        const maxAutoConnectTime = 10000 // 10 seconds
        
        if (autoConnectStartTime - window.performance.timing.navigationStart > maxAutoConnectTime) {
          setIsInitializing(false)
          setHasInitialized(true)
        }
      }
    } else if (!shouldAutoConnect || !lastWalletId) {
      // If auto-connect is not enabled, finish initialization immediately
      setIsInitializing(false)
      setHasInitialized(true)
    }

    // Emergency fallback: if we've been waiting too long, finish initialization
    if (isInitializing && !hasInitialized) {
      const pageLoadTime = Date.now() - window.performance.timing.navigationStart
      if (pageLoadTime > 15000) { // 15 seconds total
        setIsInitializing(false)
        setHasInitialized(true)
      }
    }
  }, [isConnected, address, status, isWalletConnecting, hasInitialized, connectors, isInitializing])

  // Refresh session periodically
  const refreshSession = useCallback(() => {
    const storedWallet = localStorage.getItem("wallet")
    const sessionWallet = sessionStorage.getItem("wallet")
    const walletAddress = address || storedWallet || sessionWallet

    if (walletAddress && isConnected) {
      setSessionCookies(walletAddress)
    }
  }, [address, isConnected])

  useEffect(() => {
    if (user && isConnected) {
      const interval = setInterval(refreshSession, SESSION_REFRESH_INTERVAL)
      return () => clearInterval(interval)
    }
  }, [user, isConnected, refreshSession])

  // Handle user activity for session refresh
  useEffect(() => {
    const handleUserActivity = () => {
      if (user && isConnected) {
        refreshSession()
      }
    }

    const events = ["mousemove", "keydown", "click", "scroll"]
    events.forEach((event) => {
      window.addEventListener(event, handleUserActivity)
    })

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleUserActivity)
      })
    }
  }, [user, isConnected, refreshSession])

  // Track page visibility changes (reloads, tab switches, etc.)
  useEffect(() => {
    const handleVisibilityChange = () => {
      console.log("[AuthProvider] 📄 Page visibility changed:", {
        hidden: document.hidden,
        timestamp: new Date().toISOString(),
        walletState: {
          isConnected,
          address,
          status,
        },
        storageState: {
          localStorage: {
            wallet: localStorage.getItem("wallet"),
            starknet_last_wallet: localStorage.getItem("starknet_last_wallet"),
            starknet_auto_connect: localStorage.getItem("starknet_auto_connect"),
          },
          sessionStorage: {
            wallet: sessionStorage.getItem("wallet"),
            userData: sessionStorage.getItem("userData") ? "exists" : "null",
          }
        }
      })
    }

    const handleBeforeUnload = () => {
      console.log("[AuthProvider] 🔄 Page unloading - wallet state:", {
        isConnected,
        address,
        status,
        timestamp: new Date().toISOString()
      })
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [isConnected, address, status])

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isInitializing,
        error,
        logout,
        refreshUser: fetchUserData,
        updateUserProfile: async (userData: UserUpdateInput) => {
          if (!user) return false

          try {
            const response = await fetch(`/api/users/update`, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                "x-wallet-address": user.wallet,
              },
              body: JSON.stringify(userData),
            })

            if (response.ok) {
              const updatedUser = await response.json()
              setUser(updatedUser)

              // Update cached data
              localStorage.setItem(`user_${user.wallet}`, JSON.stringify(updatedUser))
              localStorage.setItem(`user_timestamp_${user.wallet}`, Date.now().toString())
              sessionStorage.setItem("userData", JSON.stringify(updatedUser))

              return true
            } else {
              const errorData = await response.json()
              console.error("Error response from API:", errorData)
              return false
            }
          } catch (err) {
            console.error("Error updating user profile:", err)
            return false
          }
        },
        isWalletConnecting,
      }}
    >
      {children}
      {(isInitializing || isWalletConnecting) && <SimpleLoader />}
    </AuthContext.Provider>
  )
}

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
    localStorage.removeItem(WALLET_CONNECTION_KEY)
    localStorage.removeItem(WALLET_AUTO_CONNECT_KEY)
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
          clearSessionCookies()
        }
      }

      const response = await fetch(`/api/users/${walletAddress}`, {
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
    console.log("[AuthProvider] Logging out user")

    // Disconnect wallet
    disconnect()

    // Clear user state
    setUser(null)

    // Clear cached data
    const walletToRemove = address || localStorage.getItem("wallet") || sessionStorage.getItem("wallet")
    if (walletToRemove) {
      localStorage.removeItem(`user_${walletToRemove}`)
      localStorage.removeItem(`user_timestamp_${walletToRemove}`)
    }

    // Clear session data
    clearSessionCookies()
    sessionStorage.removeItem("userData")

    // Navigate to home
    router.push("/")
  }

  // Handle wallet connection changes
  useEffect(() => {
    const handleWalletChange = async () => {
      console.log(
        `[AuthProvider] Wallet status changed - Connected: ${isConnected}, Address: ${address}, Status: ${status}`,
      )

      if (status === "connecting") {
        setIsWalletConnecting(true)
        return
      }

      setIsWalletConnecting(false)

      if (isConnected && address) {
        console.log(`[AuthProvider] Wallet connected: ${address}`)

        // Store wallet connection for persistence
        const currentConnector = connectors.find((c) => c.available)
        if (currentConnector) {
          storeWalletConnection(currentConnector.id, address)
        }

        setSessionCookies(address)

        try {
          const userData = await fetchUserData(address)
          if (userData) {
            setUser(userData)
            console.log("[AuthProvider] User data loaded successfully")
          }
        } catch (error) {
          console.error("[AuthProvider] Error fetching user data:", error)
        }
      } else if (status === "disconnected") {
        console.log("[AuthProvider] Wallet disconnected")
        setUser(null)
        clearSessionCookies()
        sessionStorage.removeItem("userData")
      }
    }

    handleWalletChange()
  }, [isConnected, address, status, connectors])

  // Initialize auth on app start
  useEffect(() => {
    const initAuth = async () => {
      console.log("[AuthProvider] Initializing authentication")

      try {
        // Check if auto-connect is enabled
        const shouldAutoConnect = localStorage.getItem(WALLET_AUTO_CONNECT_KEY) === "true"
        const lastWalletId = localStorage.getItem(WALLET_CONNECTION_KEY)

        console.log(`[AuthProvider] Auto-connect enabled: ${shouldAutoConnect}, Last wallet: ${lastWalletId}`)

        // If wallet is already connected (due to StarkNet auto-connect), fetch user data
        if (isConnected && address) {
          console.log(`[AuthProvider] Wallet already connected: ${address}`)
          await fetchUserData(address)
        } else {
          // Check for stored wallet address and try to restore session
          const storedWallet = localStorage.getItem("wallet") || sessionStorage.getItem("wallet")
          if (storedWallet && shouldAutoConnect) {
            console.log(`[AuthProvider] Attempting to restore session for: ${storedWallet}`)
            // The StarkNet provider will handle auto-connection
            // We just need to wait for the connection status to update
          }
        }
      } catch (err) {
        console.error("[AuthProvider] Error initializing authentication:", err)
        setError("Failed to initialize authentication")
      } finally {
        setIsInitializing(false)
      }
    }

    // Add a small delay to ensure StarkNet provider is ready
    const timer = setTimeout(initAuth, 100)
    return () => clearTimeout(timer)
  }, [])

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

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isInitializing,
        error,
        logout,
        refreshUser: fetchUserData,
        isWalletConnecting,
        updateUserProfile: async (userData: UserUpdateInput) => {
          try {
            if (!user?.wallet) return false

            const formData = new FormData()

            // Append text fields
            if (userData.username !== undefined) formData.append("username", userData.username)
            if (userData.bio !== undefined) formData.append("bio", userData.bio)
            if (userData.email !== undefined) formData.append("email", userData.email)
            if (userData.streamkey !== undefined) formData.append("streamkey", userData.streamkey)
            if (userData.emailVerified !== undefined) formData.append("emailVerified", String(userData.emailVerified)) // Convert boolean to string
            if (userData.emailNotifications !== undefined)
              formData.append("emailNotifications", String(userData.emailNotifications)) // Convert boolean to string

            // Append socialLinks as a JSON string
            if (userData.socialLinks !== undefined) {
              formData.append("socialLinks", JSON.stringify(userData.socialLinks))
            }

            // Append creator as a JSON string
            if (userData.creator !== undefined) {
              formData.append("creator", JSON.stringify(userData.creator))
            }
            const avatar = userData.avatar
            // Handle avatar file if it's a Blob/File
            if (
              typeof avatar === "object" &&
              avatar !== null &&
              (avatar instanceof Blob || "name" in avatar)
            ) {
              formData.append("avatar", avatar as Blob)
            }

            const response = await fetch(`/api/users/updates/${user.wallet}`, {
              method: "PUT",
              // No 'Content-Type' header needed for FormData, fetch sets it automatically
              body: formData, // Send FormData directly
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
      }}
    >
      {children}
      {(isInitializing || isWalletConnecting) && <SimpleLoader />}
    </AuthContext.Provider>
  )
}

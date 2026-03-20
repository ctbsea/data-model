import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi, User } from '../api/auth'

interface AuthState {
  user: User | null
  token: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
  setUser: (user: User) => void
  setToken: (token: string, refreshToken: string) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,

      login: async (username: string, password: string) => {
        const response = await authApi.login({ username, password })
        localStorage.setItem('token', response.token)
        localStorage.setItem('refreshToken', response.refresh_token)
        set({ 
          token: response.token, 
          refreshToken: response.refresh_token,
          isAuthenticated: true 
        })
        
        // 获取用户信息
        const user = await authApi.me()
        set({ user })
      },

      logout: () => {
        localStorage.removeItem('token')
        localStorage.removeItem('refreshToken')
        set({ 
          user: null, 
          token: null, 
          refreshToken: null,
          isAuthenticated: false 
        })
      },

      refreshUser: async () => {
        const user = await authApi.me()
        set({ user })
      },

      setUser: (user: User) => {
        set({ user })
      },

      setToken: (token: string, refreshToken: string) => {
        localStorage.setItem('token', token)
        localStorage.setItem('refreshToken', refreshToken)
        set({ token, refreshToken })
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        token: state.token, 
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated 
      }),
    }
  )
)

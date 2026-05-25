import axios from 'axios'
import { clearCredentials, loadAuthHeader } from './auth'

export const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
})

api.interceptors.request.use((config) => {
  const header = loadAuthHeader()
  if (header) {
    config.headers.set('Authorization', header)
  }
  return config
})

let onUnauthorized: (() => void) | null = null

export function registerUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler
}

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      clearCredentials()
      onUnauthorized?.()
    }
    return Promise.reject(err)
  },
)

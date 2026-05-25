import { api } from './api'
import { unwrapArray } from './envelope'

export type Label = {
  _id: string
  name: string
  mode?: string
}

export async function fetchLabels(): Promise<Label[]> {
  const res = await api.get('/labels')
  return unwrapArray<Label>(res.data)
}

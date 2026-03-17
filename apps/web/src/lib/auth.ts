// Auth module — RBAC and user type definitions only.
// Authentication handled by Supabase Auth.

export type UserType = 'developer' | 'consumer'

export function isValidUserType(type: string): type is UserType {
  return type === 'developer' || type === 'consumer'
}

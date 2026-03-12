// Auth module — RBAC and user type definitions only.
// JWT/password functions removed (Clerk handles authentication).

export type UserType = 'developer' | 'consumer'

export function isValidUserType(type: string): type is UserType {
  return type === 'developer' || type === 'consumer'
}

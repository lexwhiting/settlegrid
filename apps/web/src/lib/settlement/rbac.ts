import { getMemberRole, type OrgRole } from './organizations'

// ---- Permission Matrix ------------------------------------------------------

export type OrgPermission =
  | 'org.manage'
  | 'org.manage_members'
  | 'org.manage_tools'
  | 'org.manage_budgets'
  | 'org.view_analytics'
  | 'tools.create'
  | 'tools.use'

const ROLE_HIERARCHY: Record<OrgRole, number> = {
  owner: 100,
  admin: 80,
  member: 40,
  viewer: 20,
}

const PERMISSION_MIN_ROLE: Record<OrgPermission, number> = {
  'org.manage': ROLE_HIERARCHY.owner,
  'org.manage_members': ROLE_HIERARCHY.admin,
  'org.manage_tools': ROLE_HIERARCHY.admin,
  'org.manage_budgets': ROLE_HIERARCHY.admin,
  'org.view_analytics': ROLE_HIERARCHY.viewer,
  'tools.create': ROLE_HIERARCHY.member,
  'tools.use': ROLE_HIERARCHY.member,
}

/**
 * Checks if a given role has a specific permission.
 */
export function hasPermission(role: OrgRole, permission: OrgPermission): boolean {
  const roleLevel = ROLE_HIERARCHY[role]
  const requiredLevel = PERMISSION_MIN_ROLE[permission]
  if (roleLevel === undefined || requiredLevel === undefined) return false
  return roleLevel >= requiredLevel
}

/**
 * Checks if a user in an org has a specific permission.
 * Returns true if they have it, false otherwise.
 */
export async function checkPermission(
  orgId: string,
  userId: string,
  permission: OrgPermission
): Promise<boolean> {
  const role = await getMemberRole(orgId, userId)
  if (!role) return false
  return hasPermission(role, permission)
}

/**
 * Throws an error if the user does not have the required permission.
 */
export async function requirePermission(
  orgId: string,
  userId: string,
  permission: OrgPermission
): Promise<void> {
  const allowed = await checkPermission(orgId, userId, permission)
  if (!allowed) {
    throw new PermissionDeniedError(
      `User ${userId} does not have permission '${permission}' in org ${orgId}`
    )
  }
}

export class PermissionDeniedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PermissionDeniedError'
  }
}

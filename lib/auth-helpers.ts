import { SupabaseClient } from '@supabase/supabase-js'
import { UserRole, UserRoleData } from './types'

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

export async function requireAuth(supabase: SupabaseClient) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new AuthError('Not authenticated')
  }

  return user
}

export async function getUserRole(
  supabase: SupabaseClient,
  userId: string
): Promise<UserRole> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    return 'user' // Default to user role if not found
  }

  return data.role as UserRole
}

export async function requireAdmin(supabase: SupabaseClient) {
  const user = await requireAuth(supabase)
  const role = await getUserRole(supabase, user.id)

  if (role !== 'admin') {
    throw new AuthError('Admin access required')
  }

  return user
}

export async function isAdmin(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const role = await getUserRole(supabase, userId)
  return role === 'admin'
}

export async function assignUserRole(
  supabase: SupabaseClient,
  userId: string,
  role: UserRole
) {
  const { error } = await supabase.from('user_roles').upsert(
    {
      user_id: userId,
      role,
    },
    {
      onConflict: 'user_id',
    }
  )

  if (error) {
    throw new Error(`Failed to assign role: ${error.message}`)
  }
}

export async function isFirstUser(supabase: SupabaseClient): Promise<boolean> {
  const { count, error } = await supabase
    .from('user_roles')
    .select('*', { count: 'exact', head: true })

  if (error) {
    console.error('Error checking first user:', error)
    return false
  }

  return count === 0
}

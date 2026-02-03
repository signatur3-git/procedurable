/**
 * BuilderRoleRegistry - Role-based builder resolution
 *
 * F3-001: Compose builders by role + style, not by hardcoded builder name.
 *
 * A role is a semantic category (e.g., "seating", "lighting", "table").
 * Each role can have multiple builder candidates, optionally style-specific.
 * Resolution picks the best match for the current style.
 */

import { getMetadataStore, MetadataNotFoundError } from '../../storage/MetadataStore';

// =============================================================================
// TYPES
// =============================================================================

/**
 * A single builder candidate for a role
 */
export interface RoleCandidate {
  /** Builder name */
  builder: string;
  /** Optional style(s) this candidate is best suited for */
  styles?: string[];
  /** Priority (higher = preferred). Default is 0. */
  priority?: number;
  /** Optional description */
  description?: string;
}

/**
 * Role definition - maps a role name to builder candidates
 */
export interface RoleDefinition {
  /** Role name (e.g., "seating", "table") */
  name: string;
  /** Description of what this role represents */
  description?: string;
  /** Builder candidates for this role */
  candidates: RoleCandidate[];
}

/**
 * Result of resolving a role to a builder
 */
export interface RoleResolutionResult {
  /** The resolved builder name */
  builder: string;
  /** How it was resolved */
  source: 'exact_match' | 'style_match' | 'default' | 'registered';
  /** The role that was resolved */
  role: string;
  /** The style used for resolution (if any) */
  style?: string;
}

// =============================================================================
// REGISTRY
// =============================================================================

/**
 * In-memory role registrations (for DSL commands)
 */
const registeredRoles = new Map<string, RoleDefinition>();

/**
 * Cache for loaded role definitions from metadata
 */
const roleCache = new Map<string, RoleDefinition>();

/**
 * Clear all caches (useful for testing)
 */
export function clearRoleCache(): void {
  roleCache.clear();
}

/**
 * Clear in-memory registrations (useful for testing)
 */
export function clearRegisteredRoles(): void {
  registeredRoles.clear();
}

/**
 * Register a builder for a role programmatically
 */
export function registerBuilderForRole(
  role: string,
  builder: string,
  options?: { styles?: string[]; priority?: number; description?: string }
): void {
  let roleDef = registeredRoles.get(role);
  if (!roleDef) {
    roleDef = { name: role, candidates: [] };
    registeredRoles.set(role, roleDef);
  }

  // Check if this builder is already registered
  const existingIdx = roleDef.candidates.findIndex(c => c.builder === builder);
  const candidate: RoleCandidate = {
    builder,
    styles: options?.styles,
    priority: options?.priority ?? 0,
    description: options?.description
  };

  if (existingIdx >= 0) {
    // Update existing
    roleDef.candidates[existingIdx] = candidate;
  } else {
    // Add new
    roleDef.candidates.push(candidate);
  }
}

/**
 * Unregister a builder from a role
 */
export function unregisterBuilderFromRole(role: string, builder: string): boolean {
  const roleDef = registeredRoles.get(role);
  if (!roleDef) return false;

  const idx = roleDef.candidates.findIndex(c => c.builder === builder);
  if (idx < 0) return false;

  roleDef.candidates.splice(idx, 1);
  if (roleDef.candidates.length === 0) {
    registeredRoles.delete(role);
  }
  return true;
}

/**
 * Load a role definition from metadata store
 */
export async function loadRoleFromMetadata(role: string): Promise<RoleDefinition | null> {
  // Check cache first
  if (roleCache.has(role)) {
    return roleCache.get(role)!;
  }

  const key = role.startsWith('builders/roles/') ? role : `builders/roles/${role}`;

  try {
    const store = getMetadataStore();
    const entry = await store.get<any>(key);

    if (entry?.value) {
      const roleDef: RoleDefinition = {
        name: entry.value.name || role,
        description: entry.value.description,
        candidates: entry.value.candidates || []
      };
      roleCache.set(role, roleDef);
      return roleDef;
    }
    return null;
  } catch (err) {
    if (err instanceof MetadataNotFoundError) {
      return null;
    }
    throw err;
  }
}

/**
 * Get a role definition (from registrations or metadata)
 */
export async function getRoleDefinition(role: string): Promise<RoleDefinition | null> {
  // Check in-memory registrations first
  const registered = registeredRoles.get(role);
  if (registered) {
    return registered;
  }

  // Try loading from metadata
  return loadRoleFromMetadata(role);
}

/**
 * Resolve a role to a builder name
 *
 * Resolution order:
 * 1. Exact match: candidate with matching style and highest priority
 * 2. Style match: candidate with style in its styles array
 * 3. Default: highest priority candidate with no style restriction
 * 4. Fallback: first candidate
 */
export async function resolveRole(
  role: string,
  style?: string
): Promise<RoleResolutionResult | null> {
  const roleDef = await getRoleDefinition(role);
  if (!roleDef || roleDef.candidates.length === 0) {
    return null;
  }

  const candidates = roleDef.candidates;

  // Sort by priority (descending)
  const sorted = [...candidates].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  // 1. Exact style match (highest priority candidate that explicitly lists this style)
  if (style) {
    const exactMatch = sorted.find(c => c.styles?.includes(style));
    if (exactMatch) {
      return {
        builder: exactMatch.builder,
        source: 'exact_match',
        role,
        style
      };
    }
  }

  // 2. Default (highest priority candidate with no style restriction)
  const defaultCandidate = sorted.find(c => !c.styles || c.styles.length === 0);
  if (defaultCandidate) {
    return {
      builder: defaultCandidate.builder,
      source: 'default',
      role,
      style
    };
  }

  // 3. Fallback to first candidate
  return {
    builder: sorted[0].builder,
    source: 'style_match',
    role,
    style
  };
}

/**
 * List all registered roles
 */
export function listRegisteredRoles(): string[] {
  return Array.from(registeredRoles.keys());
}

/**
 * Get all role definitions (registered + from metadata)
 */
export async function listAllRoles(): Promise<string[]> {
  const roles = new Set<string>(registeredRoles.keys());

  // Try to list from metadata
  try {
    const store = getMetadataStore();
    const result = await store.list({ prefix: 'builders/roles/' });
    for (const key of result.keys) {
      const roleName = key.replace('builders/roles/', '');
      roles.add(roleName);
    }
  } catch {
    // Metadata listing failed, just use registered roles
  }

  return Array.from(roles);
}

/**
 * Get detailed info about a role (for DSL commands)
 */
export async function getRoleInfo(role: string): Promise<{
  role: string;
  description?: string;
  candidates: Array<{
    builder: string;
    styles?: string[];
    priority: number;
    description?: string;
  }>;
  source: 'registered' | 'metadata' | 'not_found';
} | null> {
  const registered = registeredRoles.get(role);
  if (registered) {
    return {
      role: registered.name,
      description: registered.description,
      candidates: registered.candidates.map(c => ({
        builder: c.builder,
        styles: c.styles,
        priority: c.priority ?? 0,
        description: c.description
      })),
      source: 'registered'
    };
  }

  const fromMetadata = await loadRoleFromMetadata(role);
  if (fromMetadata) {
    return {
      role: fromMetadata.name,
      description: fromMetadata.description,
      candidates: fromMetadata.candidates.map(c => ({
        builder: c.builder,
        styles: c.styles,
        priority: c.priority ?? 0,
        description: c.description
      })),
      source: 'metadata'
    };
  }

  return null;
}

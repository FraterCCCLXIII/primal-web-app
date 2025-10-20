import { Kind } from '../constants';
import { PrimalGroup, PrimalCommunity, GroupMembership } from '../types/primal';

export interface GroupMetadata {
  id: string;
  name: string;
  description?: string;
  image?: string;
  picture?: string;
  about?: string;
  pubkey: string;
  created_at: number;
  tags: string[][];
  is_private?: boolean;
}

export interface CommunityMetadata {
  id: string;
  name: string;
  description?: string;
  image?: string;
  picture?: string;
  about?: string;
  pubkey: string;
  created_at: number;
  tags: string[][];
  is_private?: boolean;
}

/**
 * Parse group metadata from a Nostr event (kind 39000)
 */
export function parseGroupMetadata(event: any): GroupMetadata | null {
  console.log('Parsing group metadata for event:', event);
  if (event.kind !== Kind.CommunityDefinition) {
    console.log('Event kind does not match CommunityDefinition:', event.kind, 'expected:', Kind.CommunityDefinition);
    return null;
  }

  let id: string | undefined;
  let name: string | undefined;
  let description: string | undefined;
  let image: string | undefined;
  let picture: string | undefined;
  let about: string | undefined;
  let is_private = false;

  // Parse tags
  event.tags.forEach(([tagName, tagValue]: string[]) => {
    switch (tagName) {
      case 'd':
        id = tagValue;
        break;
      case 'name':
        name = tagValue;
        break;
      case 'description':
        description = tagValue;
        break;
      case 'image':
        image = tagValue;
        break;
      case 'picture':
        picture = tagValue;
        break;
      case 'about':
        about = tagValue;
        break;
      case 'private':
        is_private = tagValue === 'true';
        break;
    }
  });

  // Use 'd' tag as id if no name is provided
  if (!name && id) {
    name = id;
  }

  if (!name) {
    return null;
  }

  return {
    id: id || name,
    name,
    description,
    image,
    picture,
    about,
    pubkey: event.pubkey,
    created_at: event.created_at,
    tags: event.tags,
    is_private,
  };
}

/**
 * Parse community metadata from a Nostr event (kind 30000)
 */
export function parseCommunityMetadata(event: any): CommunityMetadata | null {
  if (event.kind !== Kind.CommunityDefinition) {
    return null;
  }

  let id: string | undefined;
  let name: string | undefined;
  let description: string | undefined;
  let image: string | undefined;
  let picture: string | undefined;
  let about: string | undefined;
  let is_private = false;

  // Parse tags
  event.tags.forEach(([tagName, tagValue]: string[]) => {
    switch (tagName) {
      case 'd':
        id = tagValue;
        break;
      case 'name':
        name = tagValue;
        break;
      case 'description':
        description = tagValue;
        break;
      case 'image':
        image = tagValue;
        break;
      case 'picture':
        picture = tagValue;
        break;
      case 'about':
        about = tagValue;
        break;
      case 'private':
        is_private = tagValue === 'true';
        break;
    }
  });

  // Use 'd' tag as id if no name is provided
  if (!name && id) {
    name = id;
  }

  if (!name) {
    return null;
  }

  return {
    id: id || name,
    name,
    description,
    image,
    picture,
    about,
    pubkey: event.pubkey,
    created_at: event.created_at,
    tags: event.tags,
    is_private,
  };
}

/**
 * Convert group metadata to PrimalGroup
 */
export function metadataToPrimalGroup(metadata: GroupMetadata, additionalData?: Partial<PrimalGroup>): PrimalGroup {
  return {
    id: metadata.id,
    name: metadata.name,
    description: metadata.description,
    image: metadata.image,
    picture: metadata.picture,
    about: metadata.about,
    pubkey: metadata.pubkey,
    created_at: metadata.created_at,
    tags: metadata.tags,
    is_private: metadata.is_private,
    member_count: 0,
    recent_posts: 0,
    is_member: false,
    is_admin: false,
    ...additionalData,
  };
}

/**
 * Convert community metadata to PrimalCommunity
 */
export function metadataToPrimalCommunity(metadata: CommunityMetadata, additionalData?: Partial<PrimalCommunity>): PrimalCommunity {
  return {
    id: metadata.id,
    name: metadata.name,
    description: metadata.description,
    image: metadata.image,
    picture: metadata.picture,
    about: metadata.about,
    pubkey: metadata.pubkey,
    created_at: metadata.created_at,
    tags: metadata.tags,
    is_private: metadata.is_private,
    member_count: 0,
    is_member: false,
    is_admin: false,
    ...additionalData,
  };
}

/**
 * Create group membership event
 */
export function createGroupMembershipEvent(
  groupId: string,
  pubkey: string,
  role: 'admin' | 'moderator' | 'member' = 'member'
): any {
  return {
    kind: Kind.CommunityMembership,
    content: '',
    tags: [
      ['a', `${Kind.CommunityDefinition}:${pubkey}:${groupId}`],
      ['p', pubkey],
      ['role', role],
    ],
    created_at: Math.floor(Date.now() / 1000),
  };
}

/**
 * Parse group membership from event
 */
export function parseGroupMembership(event: any): GroupMembership | null {
  if (event.kind !== Kind.CommunityMembership) {
    return null;
  }

  const aTag = event.tags.find((tag: string[]) => tag[0] === 'a');
  const pTag = event.tags.find((tag: string[]) => tag[0] === 'p');
  const roleTag = event.tags.find((tag: string[]) => tag[0] === 'role');

  if (!aTag || !pTag) {
    return null;
  }

  const [, , groupId] = aTag[1].split(':');
  const pubkey = pTag[1];
  const role = (roleTag?.[1] as 'admin' | 'moderator' | 'member') || 'member';

  return {
    pubkey,
    group_id: groupId,
    role,
    created_at: event.created_at,
  };
}

/**
 * Generate group identifier from pubkey and group name
 */
export function generateGroupId(pubkey: string, groupName: string): string {
  return `${pubkey}:${groupName}`;
}

/**
 * Extract group ID from group identifier
 */
export function extractGroupId(groupIdentifier: string): string {
  const parts = groupIdentifier.split(':');
  return parts[parts.length - 1];
}

/**
 * Check if user is member of group
 */
export function isGroupMember(memberships: GroupMembership[], pubkey: string, groupId: string): boolean {
  return memberships.some(
    membership => membership.pubkey === pubkey && membership.group_id === groupId
  );
}

/**
 * Check if user is admin of group
 */
export function isGroupAdmin(memberships: GroupMembership[], pubkey: string, groupId: string): boolean {
  return memberships.some(
    membership => 
      membership.pubkey === pubkey && 
      membership.group_id === groupId && 
      membership.role === 'admin'
  );
}

/**
 * Get user role in group
 */
export function getUserGroupRole(memberships: GroupMembership[], pubkey: string, groupId: string): 'admin' | 'moderator' | 'member' | null {
  const membership = memberships.find(
    m => m.pubkey === pubkey && m.group_id === groupId
  );
  return membership?.role || null;
}

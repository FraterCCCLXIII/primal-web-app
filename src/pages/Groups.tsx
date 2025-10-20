import { Component, createSignal, For, Show, onMount, createMemo } from 'solid-js';
import { useIntl } from '@cookbook/solid-intl';
import { useNavigate } from '@solidjs/router';
import { PrimalGroup, PrimalCommunity } from '../types/primal';
import { groups as tGroups } from '../translations';
import { useAccountContext } from '../contexts/AccountContext';
import { hookForDev } from '../lib/devTools';
import PageCaption from '../components/PageCaption/PageCaption';
import ButtonPrimary from '../components/Buttons/ButtonPrimary';
import ButtonSecondary from '../components/Buttons/ButtonSecondary';
import Avatar from '../components/Avatar/Avatar';
import { userName } from '../stores/profile';
import { Kind } from '../constants';
import { parseGroupMetadata, parseCommunityMetadata, metadataToPrimalGroup, metadataToPrimalCommunity } from '../lib/groups';
import { subsTo } from '../sockets';
import { getEventsByKind } from '../lib/feed';
import { APP_ID } from '../App';
import Loader from '../components/Loader/Loader';
import styles from './Groups.module.scss';

const Groups: Component = () => {
  const intl = useIntl();
  const navigate = useNavigate();
  const account = useAccountContext();

  const [groups, setGroups] = createSignal<PrimalGroup[]>([]);
  const [communities, setCommunities] = createSignal<PrimalCommunity[]>([]);
  const [isLoading, setIsLoading] = createSignal(true);
  const [activeTab, setActiveTab] = createSignal<'groups' | 'communities'>('groups');
  const [sortBy, setSortBy] = createSignal<'most_active' | 'newest' | 'member_count' | 'name'>('most_active');
  const [showSortDropdown, setShowSortDropdown] = createSignal(false);

  const sortOptions = [
    { value: 'most_active', label: 'Most Active' },
    { value: 'newest', label: 'Newest' },
    { value: 'member_count', label: 'Most Members' },
    { value: 'name', label: 'Name' }
  ];

  const sortedGroups = createMemo(() => {
    const groupsList = groups();
    const sort = sortBy();
    
    return [...groupsList].sort((a, b) => {
      switch (sort) {
        case 'most_active':
          // Sort by most recent activity (using created_at as proxy for now)
          // In a real implementation, you'd track actual activity timestamps
          return b.created_at - a.created_at;
        case 'newest':
          return b.created_at - a.created_at;
        case 'member_count':
          return (b.member_count || 0) - (a.member_count || 0);
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });
  });

  const sortedCommunities = createMemo(() => {
    const communitiesList = communities();
    const sort = sortBy();
    
    return [...communitiesList].sort((a, b) => {
      switch (sort) {
        case 'most_active':
          return b.created_at - a.created_at;
        case 'newest':
          return b.created_at - a.created_at;
        case 'member_count':
          return (b.member_count || 0) - (a.member_count || 0);
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });
  });

  const fetchGroups = () => {
    const subId = `groups_${APP_ID}`;
    const membershipsSubId = `group_memberships_${APP_ID}`;
    const postsSubId = `group_posts_${APP_ID}`;
    
    let groupDefinitions: any[] = [];
    let memberships: any[] = [];
    let groupPosts: any[] = [];
    
    // Track when all subscriptions are complete
    let definitionsComplete = false;
    let membershipsComplete = false;
    let postsComplete = false;
    
    const checkAllComplete = () => {
      if (definitionsComplete && membershipsComplete && postsComplete) {
        setIsLoading(false);
      }
    };

    const processGroups = () => {
      if (groupDefinitions.length === 0) return;

      const processedGroups = groupDefinitions.map(event => {
        const metadata = parseGroupMetadata(event);
        if (!metadata) return null;

        // Count members for this group
        const groupId = `${event.pubkey}:${metadata.id}`;
        const memberCount = memberships.filter(membership => {
          const aTag = membership.tags.find((tag: string[]) => tag[0] === 'a');
          return aTag && aTag[1] === groupId;
        }).length;

        // Count recent posts for this group
        const recentPosts = groupPosts.filter(post => {
          const aTag = post.tags.find((tag: string[]) => tag[0] === 'a');
          return aTag && aTag[1] === groupId;
        }).length;

        const primalGroup = metadataToPrimalGroup(metadata, {
          member_count: memberCount,
          recent_posts: recentPosts
        });

        return primalGroup;
      }).filter(Boolean);

      setGroups(processedGroups);
    };

    // Fetch group definitions (kind 30000)
    subsTo(subId, {
      onEvent: (_, event) => {
        console.log('Received event:', event);
        if (event.kind === Kind.CommunityDefinition) {
          console.log('Found community definition:', event);
          groupDefinitions.push(event);
        }
      },
      onEose: () => {
        console.log('Definitions EOSE, found:', groupDefinitions.length);
        definitionsComplete = true;
        processGroups();
        checkAllComplete();
      }
    });

    // Fetch group memberships (kind 30001)
    subsTo(membershipsSubId, {
      onEvent: (_, event) => {
        if (event.kind === Kind.CommunityMembership) {
          memberships.push(event);
        }
      },
      onEose: () => {
        membershipsComplete = true;
        processGroups();
        checkAllComplete();
      }
    });

    // Fetch group posts (kind 1 with #a tags)
    subsTo(postsSubId, {
      onEvent: (_, event) => {
        if (event.kind === 1) { // Short text note
          // Check if this note references a community
          const aTag = event.tags.find((tag: string[]) => tag[0] === 'a' && tag[1]?.startsWith('30000:'));
          if (aTag) {
            groupPosts.push(event);
          }
        }
      },
      onEose: () => {
        postsComplete = true;
        processGroups();
        checkAllComplete();
      }
    });

    // Request group definition events
    console.log('Requesting community definitions with kind:', Kind.CommunityDefinition);
    getEventsByKind(account?.publicKey, [Kind.CommunityDefinition], subId, 100);
    
    // Request membership events
    console.log('Requesting community memberships with kind:', Kind.CommunityMembership);
    getEventsByKind(account?.publicKey, [Kind.CommunityMembership], membershipsSubId, 1000);
    
    // Request recent posts that reference communities
    const sevenDaysAgo = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60);
    console.log('Requesting recent posts since:', sevenDaysAgo);
    getEventsByKind(account?.publicKey, [1], postsSubId, 500, 0, sevenDaysAgo);

    // Fallback: if no data comes through after 5 seconds, show empty state
    setTimeout(() => {
      if (groupDefinitions.length === 0) {
        console.log('No community data received, showing empty state');
        setIsLoading(false);
      }
    }, 5000);
  };

  onMount(() => {
    fetchGroups();
  });

  const handleCreateGroup = () => {
    navigate('/groups/create');
  };

  const handleGroupClick = (group: PrimalGroup) => {
    navigate(`/groups/${group.id}`);
  };

  const handleJoinGroup = (group: PrimalGroup) => {
    // TODO: Implement join group functionality
    console.log('Join group:', group.id);
  };

  const handleLeaveGroup = (group: PrimalGroup) => {
    // TODO: Implement leave group functionality
    console.log('Leave group:', group.id);
  };

  return (
    <div class={styles.groupsPage}>
      <PageCaption title={intl.formatMessage(tGroups.pageCaption)} />
      
      <div class={styles.header}>
        <div class={styles.tabs}>
          <div role="tablist" aria-orientation="horizontal" data-orientation="horizontal" class={styles.tabList}>
            <button 
              role="tab" 
              aria-selected={activeTab() === 'groups'}
              data-key="groups"
              data-orientation="horizontal"
              type="button" 
              class={`${styles.tab} ${activeTab() === 'groups' ? styles.active : ''}`}
              tabindex={activeTab() === 'groups' ? '0' : '-1'}
              onClick={() => setActiveTab('groups')}
            >
              Groups
            </button>
            <button 
              role="tab" 
              aria-selected={activeTab() === 'communities'}
              data-key="communities"
              data-orientation="horizontal"
              type="button" 
              class={`${styles.tab} ${activeTab() === 'communities' ? styles.active : ''}`}
              tabindex={activeTab() === 'communities' ? '0' : '-1'}
              onClick={() => setActiveTab('communities')}
            >
              Communities
            </button>
            <div role="presentation" data-orientation="horizontal" data-resizing="false" class={styles.tabIndicator}></div>
          </div>
        </div>
        
        <div class={styles.headerActions}>
          <div class={styles.sortDropdown}>
            <button 
              class={styles.sortButton}
              onClick={() => setShowSortDropdown(!showSortDropdown())}
            >
              <span>{sortOptions.find(opt => opt.value === sortBy())?.label}</span>
              <div class={styles.chevronDown}></div>
            </button>
            
            <Show when={showSortDropdown()}>
              <div class={styles.sortMenu}>
                <For each={sortOptions}>
                  {(option) => (
                    <button
                      class={`${styles.sortOption} ${sortBy() === option.value ? styles.active : ''}`}
                      onClick={() => {
                        setSortBy(option.value as any);
                        setShowSortDropdown(false);
                      }}
                    >
                      {option.label}
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>
          
          <ButtonPrimary onClick={handleCreateGroup}>
            {intl.formatMessage(tGroups.createGroup)}
          </ButtonPrimary>
        </div>
      </div>

      <Show when={isLoading()}>
        <div class={styles.loader}>
          <Loader />
        </div>
      </Show>

      <Show when={!isLoading()}>
        <div class={styles.content}>
          <Show when={activeTab() === 'groups'}>
            <Show 
              when={sortedGroups().length > 0}
              fallback={
                <div class={styles.emptyState}>
                  <p>{intl.formatMessage(tGroups.noGroups)}</p>
                </div>
              }
            >
              <div class={styles.groupList}>
                <For each={sortedGroups()}>
                  {(group) => (
                    <div class={styles.groupCard} onClick={() => handleGroupClick(group)}>
                      <div class={styles.groupImage}>
                        <Show 
                          when={group.image || group.picture}
                          fallback={
                            <div class={styles.defaultImage}>
                              <div class={styles.defaultIcon}>👥</div>
                            </div>
                          }
                        >
                          <Avatar user={{ pubkey: group.pubkey, picture: group.image || group.picture }} />
                        </Show>
                      </div>
                      
                      <div class={styles.groupInfo}>
                        <h3 class={styles.groupName}>{group.name}</h3>
                        <Show when={group.description || group.about}>
                          <p class={styles.groupDescription}>
                            {group.description || group.about}
                          </p>
                        </Show>
                        <div class={styles.groupMeta}>
                          <span class={styles.memberCount}>
                            {group.member_count || 0} members
                          </span>
                          <span class={styles.recentPosts}>
                            {group.recent_posts || 0} recent posts
                          </span>
                          <span class={styles.createdBy}>
                            {intl.formatMessage(tGroups.createdBy)} {userName({ pubkey: group.pubkey })}
                          </span>
                        </div>
                      </div>
                      
                      <div class={styles.groupActions}>
                        <Show 
                          when={group.is_member}
                          fallback={
                            <ButtonSecondary onClick={(e) => {
                              e.stopPropagation();
                              handleJoinGroup(group);
                            }}>
                              {intl.formatMessage(tGroups.joinGroup)}
                            </ButtonSecondary>
                          }
                        >
                          <ButtonSecondary onClick={(e) => {
                            e.stopPropagation();
                            handleLeaveGroup(group);
                          }}>
                            {intl.formatMessage(tGroups.leaveGroup)}
                          </ButtonSecondary>
                        </Show>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </Show>

          <Show when={activeTab() === 'communities'}>
            <Show 
              when={sortedCommunities().length > 0}
              fallback={
                <div class={styles.emptyState}>
                  <p>{intl.formatMessage(tGroups.noGroups)}</p>
                </div>
              }
            >
              <div class={styles.groupList}>
                <For each={sortedCommunities()}>
                  {(community) => (
                    <div class={styles.groupCard} onClick={() => handleGroupClick(community)}>
                      <div class={styles.groupImage}>
                        <Show 
                          when={community.image || community.picture}
                          fallback={
                            <div class={styles.defaultImage}>
                              <div class={styles.defaultIcon}>🏘️</div>
                            </div>
                          }
                        >
                          <Avatar user={{ pubkey: community.pubkey, picture: community.image || community.picture }} />
                        </Show>
                      </div>
                      
                      <div class={styles.groupInfo}>
                        <h3 class={styles.groupName}>{community.name}</h3>
                        <Show when={community.description || community.about}>
                          <p class={styles.groupDescription}>
                            {community.description || community.about}
                          </p>
                        </Show>
                        <div class={styles.groupMeta}>
                          <span class={styles.memberCount}>
                            {community.member_count || 0} members
                          </span>
                          <span class={styles.recentPosts}>
                            {community.recent_posts || 0} recent posts
                          </span>
                          <span class={styles.createdBy}>
                            {intl.formatMessage(tGroups.createdBy)} {userName({ pubkey: community.pubkey })}
                          </span>
                        </div>
                      </div>
                      
                      <div class={styles.groupActions}>
                        <Show 
                          when={community.is_member}
                          fallback={
                            <ButtonSecondary onClick={(e) => {
                              e.stopPropagation();
                              handleJoinGroup(community);
                            }}>
                              {intl.formatMessage(tGroups.joinGroup)}
                            </ButtonSecondary>
                          }
                        >
                          <ButtonSecondary onClick={(e) => {
                            e.stopPropagation();
                            handleLeaveGroup(community);
                          }}>
                            {intl.formatMessage(tGroups.leaveGroup)}
                          </ButtonSecondary>
                        </Show>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </Show>
        </div>
      </Show>
    </div>
  );
};

export default hookForDev(Groups);

import { Component, createSignal, For, Show, onMount } from 'solid-js';
import { useIntl } from '@cookbook/solid-intl';
import { useNavigate, useParams } from '@solidjs/router';
import { PrimalGroup } from '../types/primal';
import { groups as tGroups } from '../translations';
import { useAccountContext } from '../contexts/AccountContext';
import { hookForDev } from '../lib/devTools';
import PageCaption from '../components/PageCaption/PageCaption';
import ButtonPrimary from '../components/Buttons/ButtonPrimary';
import ButtonSecondary from '../components/Buttons/ButtonSecondary';
import Avatar from '../components/Avatar/Avatar';
import { userName } from '../stores/profile';
import { Kind } from '../constants';
import { parseGroupMetadata, metadataToPrimalGroup } from '../lib/groups';
import { subsTo } from '../sockets';
import { getEventsByKind } from '../lib/feed';
import { APP_ID } from '../App';
import Loader from '../components/Loader/Loader';
import styles from './GroupDetail.module.scss';

const GroupDetail: Component = () => {
  const intl = useIntl();
  const navigate = useNavigate();
  const params = useParams();
  const account = useAccountContext();

  const [group, setGroup] = createSignal<PrimalGroup | null>(null);
  const [isLoading, setIsLoading] = createSignal(true);
  const [isJoining, setIsJoining] = createSignal(false);
  const [isLeaving, setIsLeaving] = createSignal(false);

  const groupId = () => params.id;

  const fetchGroup = () => {
    const subId = `group_detail_${APP_ID}`;
    
    subsTo(subId, {
      onEvent: (_, event) => {
        if (event.kind === Kind.CommunityDefinition) {
          const metadata = parseGroupMetadata(event);
          if (metadata && metadata.id === groupId()) {
            const primalGroup = metadataToPrimalGroup(metadata);
            setGroup(primalGroup);
            setIsLoading(false);
          }
        }
      },
      onEose: () => {
        setIsLoading(false);
      }
    });

    // Request specific group event by identifier
    // We need to find events with the specific group ID
    getEventsByKind(account?.publicKey, [Kind.CommunityDefinition], subId, 100);
  };

  onMount(() => {
    if (groupId()) {
      fetchGroup();
    } else {
      setIsLoading(false);
    }
  });

  const handleJoinGroup = async () => {
    if (!account?.publicKey || !group()) return;

    setIsJoining(true);
    try {
      // TODO: Implement join group functionality
      console.log('Joining group:', group()?.id);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setGroup(prev => prev ? { ...prev, is_member: true } : null);
    } catch (error) {
      console.error('Error joining group:', error);
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!account?.publicKey || !group()) return;

    setIsLeaving(true);
    try {
      // TODO: Implement leave group functionality
      console.log('Leaving group:', group()?.id);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setGroup(prev => prev ? { ...prev, is_member: false } : null);
    } catch (error) {
      console.error('Error leaving group:', error);
    } finally {
      setIsLeaving(false);
    }
  };

  const handleEditGroup = () => {
    navigate(`/groups/${groupId()}/edit`);
  };

  const handleDeleteGroup = () => {
    // TODO: Implement delete group functionality
    console.log('Delete group:', group()?.id);
  };

  return (
    <div class={styles.groupDetailPage}>
      <Show when={isLoading()}>
        <div class={styles.loader}>
          <Loader />
        </div>
      </Show>

      <Show when={!isLoading() && group()}>
        <div class={styles.groupHeader}>
          <div class={styles.groupImage}>
            <Show 
              when={group()?.image || group()?.picture}
              fallback={
                <div class={styles.defaultImage}>
                  <div class={styles.defaultIcon}>👥</div>
                </div>
              }
            >
              <Avatar user={{ pubkey: group()!.pubkey, picture: group()!.image || group()!.picture }} />
            </Show>
          </div>
          
          <div class={styles.groupInfo}>
            <h1 class={styles.groupName}>{group()?.name}</h1>
            <Show when={group()?.description || group()?.about}>
              <p class={styles.groupDescription}>
                {group()?.description || group()?.about}
              </p>
            </Show>
            <div class={styles.groupMeta}>
              <span class={styles.memberCount}>
                {group()?.member_count || 0} members
              </span>
              <span class={styles.createdBy}>
                {intl.formatMessage(tGroups.createdBy)} {userName({ pubkey: group()!.pubkey })}
              </span>
              <Show when={group()?.is_private}>
                <span class={styles.privateBadge}>Private</span>
              </Show>
            </div>
          </div>
          
          <div class={styles.groupActions}>
            <Show when={group()?.is_admin}>
              <ButtonSecondary onClick={handleEditGroup}>
                {intl.formatMessage(tGroups.editGroup)}
              </ButtonSecondary>
              <ButtonSecondary onClick={handleDeleteGroup}>
                {intl.formatMessage(tGroups.deleteGroup)}
              </ButtonSecondary>
            </Show>
            
            <Show when={!group()?.is_admin}>
              <Show 
                when={group()?.is_member}
                fallback={
                  <ButtonPrimary 
                    onClick={handleJoinGroup}
                    disabled={isJoining()}
                  >
                    <Show when={isJoining()} fallback={intl.formatMessage(tGroups.joinGroup)}>
                      Joining...
                    </Show>
                  </ButtonPrimary>
                }
              >
                <ButtonSecondary 
                  onClick={handleLeaveGroup}
                  disabled={isLeaving()}
                >
                  <Show when={isLeaving()} fallback={intl.formatMessage(tGroups.leaveGroup)}>
                    Leaving...
                  </Show>
                </ButtonSecondary>
              </Show>
            </Show>
          </div>
        </div>

        <div class={styles.groupContent}>
          <div class={styles.groupTabs}>
            <button class={`${styles.tab} ${styles.active}`}>
              Posts
            </button>
            <button class={styles.tab}>
              Members
            </button>
            <button class={styles.tab}>
              About
            </button>
          </div>

          <div class={styles.tabContent}>
            <div class={styles.emptyState}>
              <p>No posts yet. Be the first to post in this group!</p>
            </div>
          </div>
        </div>
      </Show>

      <Show when={!isLoading() && !group()}>
        <div class={styles.notFound}>
          <h2>Group not found</h2>
          <p>The group you're looking for doesn't exist or has been deleted.</p>
          <ButtonPrimary onClick={() => navigate('/groups')}>
            Back to Groups
          </ButtonPrimary>
        </div>
      </Show>
    </div>
  );
};

export default hookForDev(GroupDetail);

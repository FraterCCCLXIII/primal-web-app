import { Component, createSignal, Show } from 'solid-js';
import { useIntl } from '@cookbook/solid-intl';
import { useNavigate } from '@solidjs/router';
import { groups as tGroups } from '../translations';
import { useAccountContext } from '../contexts/AccountContext';
import { hookForDev } from '../lib/devTools';
import PageCaption from '../components/PageCaption/PageCaption';
import ButtonPrimary from '../components/Buttons/ButtonPrimary';
import ButtonSecondary from '../components/Buttons/ButtonSecondary';
import TextInput from '../components/TextInput/TextInput';
import Checkbox from '../components/Checkbox/Checkbox';
import { Kind } from '../constants';
import { signEvent } from '../lib/nostrAPI';
import { generateGroupId } from '../lib/groups';
import styles from './CreateGroup.module.scss';

const CreateGroup: Component = () => {
  const intl = useIntl();
  const navigate = useNavigate();
  const account = useAccountContext();

  const [groupName, setGroupName] = createSignal('');
  const [groupDescription, setGroupDescription] = createSignal('');
  const [groupImage, setGroupImage] = createSignal('');
  const [isPrivate, setIsPrivate] = createSignal(false);
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [error, setError] = createSignal('');

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    
    if (!groupName().trim()) {
      setError('Group name is required');
      return;
    }

    if (!account?.publicKey) {
      setError('You must be logged in to create a group');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const groupId = generateGroupId(account.publicKey, groupName().trim());
      
      const event = {
        kind: Kind.CommunityDefinition,
        content: groupDescription().trim(),
        tags: [
          ['d', groupId],
          ['name', groupName().trim()],
          ['description', groupDescription().trim()],
          ...(groupImage().trim() ? [['image', groupImage().trim()]] : []),
          ['private', isPrivate().toString()],
        ],
        created_at: Math.floor(Date.now() / 1000),
      };

      const signedEvent = await signEvent(event);
      
      // TODO: Publish event to relays
      console.log('Group created:', signedEvent);
      
      // Navigate back to groups page
      navigate('/groups');
      
    } catch (err) {
      console.error('Error creating group:', err);
      setError('Failed to create group. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate('/groups');
  };

  return (
    <div class={styles.createGroupPage}>
      <PageCaption title={intl.formatMessage(tGroups.createGroup)} />
      
      <form onSubmit={handleSubmit} class={styles.form}>
        <div class={styles.formGroup}>
          <label class={styles.label}>
            {intl.formatMessage(tGroups.groupName)} *
          </label>
          <TextInput
            value={groupName()}
            onInput={(e) => setGroupName(e.currentTarget.value)}
            placeholder="Enter group name"
            required
          />
        </div>

        <div class={styles.formGroup}>
          <label class={styles.label}>
            {intl.formatMessage(tGroups.groupDescription)}
          </label>
          <TextInput
            value={groupDescription()}
            onInput={(e) => setGroupDescription(e.currentTarget.value)}
            placeholder="Enter group description"
            multiline
            rows={4}
          />
        </div>

        <div class={styles.formGroup}>
          <label class={styles.label}>
            {intl.formatMessage(tGroups.groupImage)}
          </label>
          <TextInput
            value={groupImage()}
            onInput={(e) => setGroupImage(e.currentTarget.value)}
            placeholder="Enter image URL"
          />
        </div>

        <div class={styles.formGroup}>
          <Checkbox
            checked={isPrivate()}
            onChange={(checked) => setIsPrivate(checked)}
            label={intl.formatMessage(tGroups.privateGroup)}
          />
        </div>

        <Show when={error()}>
          <div class={styles.error}>
            {error()}
          </div>
        </Show>

        <div class={styles.actions}>
          <ButtonSecondary onClick={handleCancel}>
            Cancel
          </ButtonSecondary>
          <ButtonPrimary 
            type="submit" 
            disabled={isSubmitting() || !groupName().trim()}
          >
            <Show when={isSubmitting()} fallback="Create Group">
              Creating...
            </Show>
          </ButtonPrimary>
        </div>
      </form>
    </div>
  );
};

export default hookForDev(CreateGroup);

/**
 * Space types for Concord — Communities vs Personal Spaces
 *
 * Communities: open group, open ownership — anyone can join, collaborative
 * Personal: closed group, closed ownership — invite-only, private
 */

import type { ChannelType } from '@concord/protocol';

export type SpaceKind = 'community' | 'personal';

export interface SpaceChannel {
  id: string;
  name: string;
  type: ChannelType;
  /** For ordering */
  order: number;
}

export interface Space {
  id: string;
  name: string;
  kind: SpaceKind;
  /** Icon/avatar URL or emoji */
  icon?: string;
  channels: SpaceChannel[];
  /** Order in sidebar */
  order: number;
  /** Expanded in sidebar */
  expanded?: boolean;
}

export interface CreateSpaceParams {
  name: string;
  kind: SpaceKind;
  icon?: string;
}

export interface CreateChannelParams {
  spaceId: string;
  name: string;
  type: ChannelType;
}

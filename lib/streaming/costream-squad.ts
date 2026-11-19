export type SquadInviteStatus = 'pending' | 'accepted' | 'declined' | 'left';

export interface SquadMember {
  userId: string;
  channelName: string;
  playbackId: string;
  joinedAt: number;
  isActive: boolean;
}

export interface CoStreamSquadState {
  squadId: string;
  hostUserId: string;
  members: SquadMember[];
  activeLayout: 'grid_equal' | 'host_prominent' | 'picture_in_picture';
  updatedAt: number;
}

export class CoStreamSquadManager {
  private squad: CoStreamSquadState;

  constructor(squadId: string, hostUserId: string, hostChannel: string, hostPlaybackId: string) {
    this.squad = {
      squadId,
      hostUserId,
      members: [
        {
          userId: hostUserId,
          channelName: hostChannel,
          playbackId: hostPlaybackId,
          joinedAt: Date.now(),
          isActive: true,
        },
      ],
      activeLayout: 'grid_equal',
      updatedAt: Date.now(),
    };
  }

  public getSquadState(): CoStreamSquadState {
    return { ...this.squad, members: [...this.squad.members] };
  }

  public addMember(member: Omit<SquadMember, 'joinedAt' | 'isActive'>): CoStreamSquadState {
    if (this.squad.members.length >= 4) {
      throw new Error('Squad capacity reached (maximum 4 co-streamers).');
    }

    this.squad.members.push({
      ...member,
      joinedAt: Date.now(),
      isActive: true,
    });
    this.squad.updatedAt = Date.now();
    return this.getSquadState();
  }

  public removeMember(userId: string): CoStreamSquadState {
    this.squad.members = this.squad.members.map((m) =>
      m.userId === userId ? { ...m, isActive: false } : m
    );
    this.squad.updatedAt = Date.now();
    return this.getSquadState();
  }

  public setLayout(layout: CoStreamSquadState['activeLayout']) {
    this.squad.activeLayout = layout;
    this.squad.updatedAt = Date.now();
  }
}

import EventEmitter from "events";

import BaseClient from "../src/client/BaseClient";
import ChannelManager from "../src/managers/ChannelManager";
import CommandEmitter from "../src/utils/CommandEmitter";
import UserManager from "../src/managers/UserManager";
import User from "../src/structures/User";
import { Client, Events, SubscriptionTypes } from "../src";

//#region Classes

export class BaseClient extends EventEmitter {
	public constructor(options?: ClientOptions);
	public channels: ChannelManager;
	public commands: CommandEmitter;
	public destroy(): Promise<void>;
	public login(token: string | { token: string, refreshToken?: string }): Promise<object | void>;
	public reconnect(): Promise<boolean>;
	public refreshToken(options: { clientId: string, clientSecret: string, refreshToken: string }): object;
	public get scopes(): Set;
	public users: UserManager;
	public user: User | null;
}

export class Client extends BaseClient {
	public action(channel: string, message: string, tags: object): Promise;
	public announce(message: string, channel?: string): Promise<object>;
	public ban(user: string, reason?: string, channel?: string): Promise;
	public clear(channel?: string): Promise;
	public color(color: string): Promise;
	public commercial(seconds: number, channel?: string): Promise;
	public deleteMessage(messageId: number, channel?: string): Promise;
	public host(user: string, channel?: string): Promise;
	public join(channel: string): Promise;
	public marker(description: string, channel?: string): Promise;
	public mod(user: string, channel?: string): Promise;
	public mods(channel?: string): Promise<Array>;
	public part(channel: string): Promise;
	public reply(channel: string, message: string, replyParentMsgId: number, tags: object): Promise;
	public send(channel: string, data: string | { content: string }, tags: object): Promise;
	public timeout(user: string, duration: number, reason?: string, channel?: string): Promise;
	public unban(user: string, channel?: string): Promise;
	public unhost(channel: string): Promise;
	public unmod(user: string, channel?: string): Promise;
	public unraid(user: string, channel?: string): Promise;
	public untimeout(user: string, channel?: string): Promise;
	public unvip(user: string, channel?: string): Promise;
	public vip(user: string, channel?: string): Promise;
	public vips(channel?: string): Promise<Array>;
	public whisper(userId: number, data: string | { content: string }): Promise;
	public _whisper(username: string, message: string): Promise;
	public live(channel?: string): Promise<boolean>;

	public on<Event extends keyof ClientEvents>(event: Event, listener: (...args: ClientEvents[Event]) => void): this;
	public once<Event extends keyof ClientEvents>(event: Event, listener: (...args: ClientEvents[Event]) => void): this;
	public emit<Event extends keyof ClientEvents>(event: Event, ...args: ClientEvents[Event]): boolean;
	public off<Event extends keyof ClientEvents>(event: Event, listener: (...args: ClientEvents[Event]) => void): this;
	public removeAllListeners<Event extends keyof ClientEvents>(event?: Event): this;
}

//#endregion

//#region Typedefs

export interface ClientEvents {
	error: [error: Error],
	friendLeaderboardPassed: [data: object],
	friendRequestAccepted: [data: object],
	friendRequestReceived: [data: object],
	friendTrackChallenge: [data: object],
	raw: [message: object],
	ready: [],
	subscriberTrackPublish: [data: object],
	trackLeaderboardPassed: [data: object],
	trackUsernameMention: [data: object]
}

export interface ClientOptions {
	channels?: Array,
	debug?: boolean,
	liveEvent?: boolean,
	prefix?: string,
	reconnect?: {
		attempts?: number,
		decay?: number,
		interval?: {
			max?: number,
			min?: number
		},
		maxattempts?: number
	}
}

export enum Events {
	ChannelBanAdd = 'channelBanAdd',
	ChannelCreate = 'channelCreate',
	ChannelDelete = 'channelDelete',
	ChannelHostAdd = 'channelHostAdd',
	ChannelHostRemove = 'channelHostRemove',
	ChannelTimeoutAdd = 'channelTimeoutAdd',
	ChannelUpdate = 'channelUpdate',
	ClientReady = 'ready',
	Debug = 'debug',
	Error = 'error',
	InteractionCreate = 'interactionCreate',
	MessageBulkDelete = 'messageDeleteBulk',
	MessageCreate = 'messageCreate',
	MessageDelete = 'messageDelete',
	MessageUpdate = 'messageUpdate',
	PresenceUpdate = 'presenceUpdate',
	Raw = 'raw',
	UserUpdate = 'userUpdate',
	Warn = 'warn'
}

export enum SubscriptionTypes {
	AutomodMessageHold = 'automod.message.hold',
	AutomodMessageUpdate = 'automod.message.update',
	AutomodSettingsUpdate = 'automod.settings.update',
	AutomodTermsUpdate = 'automod.terms.update',
	ChannelBitsUse = 'channel.bits.use',
	ChannelUpdate = 'channel.update',
	ChannelFollow = 'channel.follow',
	ChannelAdBreakBegin = 'channel.ad_break.begin',
	ChannelChatClear = 'channel.chat.clear',
	ChannelChatClearUserMessages = 'channel.chat.clear_user_messages',
	ChannelChatMessage = 'channel.chat.message',
	ChannelChatMessageDelete = 'channel.chat.message_delete',
	ChannelChatNotification = 'channel.chat.notification',
	ChannelChatSettingsUpdate = 'channel.chat_settings.update',
	ChannelChatUserMessageHold = 'channel.chat.user_message_hold',
	ChannelChatUserMessageUpdate = 'channel.chat.user_message_update',
	ChannelSharedChatSessionBegin = 'channel.shared_chat.begin',
	ChannelSharedChatSessionUpdate = 'channel.shared_chat.update',
	ChannelSharedChatSessionEnd = 'channel.shared_chat.end',
	ChannelSubscribe = 'channel.subscribe',
	ChannelSubscriptionEnd = 'channel.subscription.end',
	ChannelSubscriptionGift = 'channel.subscription.gift',
	ChannelSubscriptionMessage = 'channel.subscription.message',
	ChannelCheer = 'channel.cheer',
	ChannelRaid = 'channel.raid',
	ChannelBan = 'channel.ban',
	ChannelUnban = 'channel.unban',
	ChannelUnbanRequestCreate = 'channel.unban_request.create',
	ChannelUnbanRequestResolve = 'channel.unban_request.resolve',
	ChannelModerate = 'channel.moderate',
	ChannelModeratorAdd = 'channel.moderator.add',
	ChannelModeratorRemove = 'channel.moderator.remove',
	ChannelGuestStarSessionBegin = 'channel.guest_star_session.begin',
	ChannelGuestStarSessionEnd = 'channel.guest_star_session.end',
	ChannelGuestStarGuestUpdate = 'channel.guest_star_guest.update',
	ChannelGuestStarSettingsUpdate = 'channel.guest_star_settings.update',
	ChannelPointsAutomaticRewardRedemptionAdd = 'channel.channel_points_automatic_reward_redemption.add',
	ChannelPointsCustomRewardAdd = 'channel.channel_points_custom_reward.add',
	ChannelPointsCustomRewardUpdate = 'channel.channel_points_custom_reward.update',
	ChannelPointsCustomRewardRemove = 'channel.channel_points_custom_reward.remove',
	ChannelPointsCustomRewardRedemptionAdd = 'channel.channel_points_custom_reward_redemption.add',
	ChannelPointsCustomRewardRedemptionUpdate = 'channel.channel_points_custom_reward_redemption.update',
	ChannelPollBegin = 'channel.poll.begin',
	ChannelPollProgress = 'channel.poll.progress',
	ChannelPollEnd = 'channel.poll.end',
	ChannelPredictionBegin = 'channel.prediction.begin',
	ChannelPredictionProgress = 'channel.prediction.progress',
	ChannelPredictionLock = 'channel.prediction.lock',
	ChannelPredictionEnd = 'channel.prediction.end',
	ChannelSuspiciousUserMessage = 'channel.suspicious_user.message',
	ChannelSuspiciousUserUpdate = 'channel.suspicious_user.update',
	ChannelVIPAdd = 'channel.vip.add',
	ChannelVIPRemove = 'channel.vip.remove',
	ChannelWarningAcknowledgement = 'channel.warning.acknowledge',
	ChannelWarningSend = 'channel.warning.send',
	CharityDonation = 'channel.charity_campaign.donate',
	CharityCampaignStart = 'channel.charity_campaign.start',
	CharityCampaignProgress = 'channel.charity_campaign.progress',
	CharityCampaignStop = 'channel.charity_campaign.stop',
	ConduitShardDisabled = 'conduit.shard.disabled',
	DropEntitlementGrant = 'drop.entitlement.grant',
	ExtensionBitsTransactionCreate = 'extension.bits_transaction.create',
	GoalBegin = 'channel.goal.begin',
	GoalProgress = 'channel.goal.progress',
	GoalEnd = 'channel.goal.end',
	HypeTrainBegin = 'channel.hype_train.begin',
	HypeTrainProgress = 'channel.hype_train.progress',
	HypeTrainEnd = 'channel.hype_train.end',
	ShieldModeBegin = 'channel.shield_mode.begin',
	ShieldModeEnd = 'channel.shield_mode.end',
	ShoutoutCreate = 'channel.shoutout.create',
	ShoutoutReceived = 'channel.shoutout.receive',
	StreamOnline = 'stream.online',
	StreamOffline = 'stream.offline',
	UserAuthorizationGrant = 'user.authorization.grant',
	UserAuthorizationRevoke = 'user.authorization.revoke',
	UserUpdate = 'user.update',
	WhisperReceived = 'user.whisper.message'
}

//#endregion
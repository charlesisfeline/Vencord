/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { Devs } from "@utils/constants";
import { openUserProfile } from "@utils/discord";
import { classes } from "@utils/misc";
import definePlugin, { StartAt } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { FluxDispatcher, Parser } from "@webpack/common";
import { Guild } from "discord-types/general";


const AvatarStyles = findByPropsLazy("avatar", "zalgo");
const GuildManager = findByPropsLazy("joinGuild");

interface User {
    id: string;
    avatar: string;
    global_name: string;
    username: string;
}

function lurk(id: string) {
    GuildManager.joinGuild(id, { lurker: true })
        .then(() => { setTimeout(() => GuildManager.transitionToGuildSync(id), 100); })
        .catch(() => { throw new Error("Guild is not lurkable"); });
}

export default definePlugin({
    name: "BetterInvites",
    description: "See invites expiration date, view inviter profile and preview discoverable servers before joining by clicking their name",
    authors: [Devs.iamme],
    patches: [
        {
            find: ".Messages.HUB_INVITE_ANOTHER_SCHOOL_LINK",
            replacement: [
                {
                    match: /,(\i)&&(\(\i=\(0,\i\.jsx\)\(\i\.TooltipContainer.+)className:(\i.tooltipContainer),text:(\i\.\i\.Messages.GUEST_MEMBERSHIP_EXPLANATION)/,
                    replace: (_, isGuest, rest, className, message) => `,(${isGuest}||((!${isGuest})&&arguments[0].invite.expires_at)) && ${rest}text:$self.handleTip(${isGuest}, ${message}, arguments[0].invite.expires_at),className:${className}+" vc-bi-tool-tip-conainer"`
                },
                {
                    match: /(\.jsx\)\(\i.\i.Info,{.+onClick):(\i\?\i:null),/,
                    replace: "$1:$2 || $self.Lurkable(arguments[0].invite.guild.id, arguments[0].invite.guild.features),"
                },
                {
                    match: /(\.jsx\)\(\i\.\i\.Header,\{)text:(\i)/,
                    replace: "$1text: $self.Header(arguments[0].currentUserId, arguments[0].invite.inviter, $2)"
                }
            ]
        }
    ],
    handleTip(isGuest: boolean, message: string, expires_at: string) {
        return <>this invite will expire {Parser.parse(`<t:${Math.round(new Date(expires_at).getTime() / 1000)}:R>`)}{isGuest ? ". " + message : ""}</>;
    },
    Header(currentUserId: string, inviter: User | undefined, defaultMessage: string) {
        return <div className="vc-bi-header-inner">
            {(inviter && (currentUserId !== inviter.id)) ? <>
                <img
                    className={classes(AvatarStyles.avatar, AvatarStyles.clickable) + " vc-bi-inviter-avatar"}
                    onClick={() => openUserProfile(inviter.id)}
                    src={inviter.avatar ? `https://cdn.discordapp.com/avatars/${inviter.id}/${inviter.avatar}.webp?size=80` : "/assets/1f0bfc0865d324c2587920a7d80c609b.png?size=128"}
                />
                <p className="vc-bi-invite-title"> {inviter.global_name ? inviter.global_name.toUpperCase() : inviter.username.toUpperCase()} HAS INVITED YOU TO JOIN</p>
            </> : <p className="vc-bi-invite-title">{defaultMessage}</p>}</div>;
    },
    Lurkable: (id: string, features: Guild["features"] | Array<string>) => {
        let discoverable = false;

        if (features instanceof Set) discoverable = features.has("DISCOVERABLE");
        else if (features instanceof Array) discoverable = features.includes("DISCOVERABLE");

        if (discoverable) return () => lurk(id);
        return;
    },
    start() {
        FluxDispatcher.subscribe("GUILD_CREATE", e => console.warn(e));
    },
    startAt: StartAt.WebpackReady
});

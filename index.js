// Warnable
// Version 1.0.0 - By www.zachary.fun

const Discord = require("discord.js");
const jsonDB = require("node-json-db").JsonDB;
const moment = require('moment-timezone');
const Filter = require('bad-words');
const badWords = new Filter();
const client = new Discord.Client();
const botDB = new jsonDB("botData", true, true);
const config = require("./config.json");
client.login(config.token);

// Bot Listening
client.on("ready", () => {
    console.log(`${client.user.username} is now ready!`);
    if (client.guilds.size > 1) console.warn("!!! WARNING !!! Warnable is not supported for more than one Discord server.\nWarnings do NOT save for each server, all warnings sync across servers for users.\nThis may be supported in the future, but do not make an issue if you are using it in more than one server please :("); 
});

//- Commands
const commands = {
    "warn": (msg) => {
        if (msg.content.split(" ")[1].match(/^(<[@][!]?)?([0-9]+)(>)?/g)) {
            let warningUser = (/^(<[@][!]?)?([0-9]+)(>)?/g).exec(msg.content.split(" ")[1])[2] 
            var warningReason = msg.content.split(" ") // Use var cause we're gonna redefine this later
            warningReason.shift() // Remove the first two items from array. This is hacky but gets the job done considering there is no command library
            warningReason.shift() // .shift() returns the removed value and returns the original array, which is why we can't just .shift().shift()
            warningReason = warningReason.join(" ")
            if (warningReason !== "") {
                warningAdd(warningUser, warningReason, msg.author, msg.guild, function(res) {
                    msg.channel.send(res);
                });
            } else {
                msg.reply("A reason must be included.");
            }
        }
        else if (msg.content.split(" ")[1].startsWith('"')) {
            var warningUsername = extractUsername(msg.content);
            if (warningUsername.match(/.*#\d{4}\b/g)) {
                var warningUser = findUsernameUser(warningUsername);
                if (warningUser) {
                    var warningReason = msg.content.replace(config.prefix + 'warn "' + warningUsername + '" ', "");
                    if (warningReason !== "") {
                        warningAdd(warningUser, warningReason, msg.author, msg.guild, function(res) {
                            msg.channel.send(res);
                        });
                    }
                    else {
                        msg.reply("A reason must be included.");
                    }
                } 
                else {
                    msg.reply("Unable to find user.");
                }
            }
        }
        else {
            msg.reply("Command used incorrectly.");
        }
    },
    "remove": (msg) => {
        var warnID = msg.content.split(" ")[1]
        if (warnID) {
            warningRemove(warnID, function(res) {
                msg.reply(res);
            });
        }
        else {
            msg.channel.send("A warning ID must be specified.");
        }
    },
    "list": (msg) => {
        if (msg.content.split(" ")[1].match(/^(<[@][!]?)?([0-9]+)(>)?/g)) {
            let warningUser = (/^(<[@][!]?)?([0-9]+)(>)?/g).exec(msg.content.split(" ")[1])[2] 
            var warnList = dbRequest("/users/" + warningUser);
            if (warnList !== undefined) {
                var warnEmbed = [];
                var warnText = "";
                for (i = 0; i < warnList.length; i++) {
                    var warnInfo = dbRequest("/warnings/" + warnList[i]);
                    if (warnInfo) {
                        warnEmbed.push({ name: `Warning '${warnList[i]}'`, value: `By: <@${warnInfo.issuer}> | Time: ${moment(warnInfo.time).tz("UTC").format("MMM Do YY, h:mm:ss a")} (UTC)\nReason: '${warnInfo.reason}'` });
                        warnText = warnText + `\n**- Warning '${warnList[i]}**'\nBy: <@${warnInfo.issuer}> | Time: ${moment(warnInfo.time).tz("UTC").format("MMM Do YY, h:mm:ss a")} (UTC)\nReason: '${warnInfo.reason}'`;
                    }
                    if (warnList.length == i + 1) {
                        if (msg.channel.permissionsFor(client.user.id).has("EMBED_LINKS")) {
                            msg.channel.send("", {
                                embed: {
                                    color: 0x9b59b6,
                                    title: "List warnings",
                                    description: "Listing warnings for " + warningUser,
                                    fields: warnEmbed
                                }
                            });
                        }
                        else {
                            msg.channel.send(`**__Listing warnings for ${warningUser}__**${warnText}`);
                        }
                    }
                }
            }
            else {
                msg.reply("User has no warnings.");
            }
        }
        else if (msg.content.split(" ")[1].startsWith('"')) {
            var warningUsername = extractUsername(msg.content);
            if (warningUsername.match(/.*#\d{4}\b/g)) {
                var warningUser = findUsernameUser(warningUsername);
                var warnList = dbRequest("/users/" + warningUser);
                if (warnList !== undefined) {
                    var warnEmbed = [];
                    var warnText = "";
                    for (i=0; i < warnList.length; i++) {
                        var warnInfo = dbRequest("/warnings/" + warnList[i]);
                        if (warnInfo) {
                            warnEmbed.push({ name: `Warning '${warnList[i]}'`, value: `By: <@${warnInfo.issuer}> | Time: ${moment(warnInfo.time).tz("UTC").format("MMM Do YY, h:mm:ss a")} (UTC)\nReason: '${warnInfo.reason}'`});
                            warnText = warnText + `\n**- Warning '${warnList[i]}**'\nBy: <@${warnInfo.issuer}> | Time: ${moment(warnInfo.time).tz("UTC").format("MMM Do YY, h:mm:ss a")} (UTC)\nReason: '${warnInfo.reason}'`;
                        }
                        if (warnList.length == i + 1) { 
                            if (msg.channel.permissionsFor(client.user.id).has("EMBED_LINKS")) {
                                msg.channel.send("", {embed: {
                                    color: 0x9b59b6,
                                    title: "List warnings",
                                    description: "Listing warnings for " + warningUser,
                                    fields: warnEmbed
                                }});
                            }
                            else {
                                msg.channel.send(`**__Listing warnings for ${warningUser}__**${warnText}`);
                            }
                        }
                    }
                }
                else {
                    msg.reply("User has no warnings.");
                }
            }
        }
        else {
            msg.reply("Command used incorrectly.");
        }
    }
};

client.on("message", async msg => {
    if (msg.guild) {
        if (msg.content.startsWith(config.prefix)) {
            if (commands.hasOwnProperty(msg.content.toLowerCase().slice(config.prefix.length).split(' ')[0])) {
                if (msg.member.roles.array().some(r => config.admins.roles.indexOf(r.id) >= 0) || config.admins.users.includes(msg.author.id)) {
                    commands[msg.content.toLowerCase().slice(config.prefix.length).split(' ')[0]](msg);
                }
                else {
                    msg.reply("You don't have permission to use this command.");
                }
            }
        }
        // Rules
        if (!msg.author.bot && msg.guild.id == config.channels.guild) {
            let member = msg.mentions.members.first();
            if (!config.channels.ignore.includes(msg.channel.id) && !msg.guild.members.get(msg.author.id).roles.get(config.roles.immuneRole)) {
                if (msg.content.match(/(https?:\/\/)?(www\.)?(discord\.(gg|io|me|li)|discordapp\.com\/invite)\/.+[a-z]/gm)) {
                    if (config.automation.discordInvites.deleteMessage) {
                        msg.delete();
                        let embedMsg = await msg.channel.send(`<@${msg.author.id}>`, {embed: {
                            color: 0x9b59b6,
                            title: `You are not allowed to send Discord invite links in this server. This violation of the rules has resulted in one official warning.`
                        }})

                        embedMsg.delete(20000)
                    } 
                    if (config.automation.discordInvites.giveWarning) warningAdd(msg.author.id, "Automatic: Discord Invite", client.user, msg.guild, function() {});
                }
                else if (badWords.isProfane(msg.content)) {
                    if (config.automation.swearing.deleteMessage) msg.delete();
                    if (config.automation.swearing.giveWarning) warningAdd(msg.author.id, "Automatic: Swearing", client.user, msg.guild, function() {});
                }
                else if (msg.content.match(/^((http[s]?|ftp):\/)?\/?([^:\/\s]+)((\/\w+)*\/)([\w\-\.]+[^#?\s]+)(.*)?(#[\w\-]+)?$/gm)) {
                    if (config.automation.externalLinks.deleteMessage) msg.delete();
                    if (config.automation.externalLinks.giveWarning) warningAdd(msg.author.id, "Automatic: Links", client.user, msg.guild, function() {});
                }
            }
        }
        if (msg.guild.id == "191263668305002496") {
            if (["671119227234549770", "554566075333869579"].includes(msg.channel.id)) {
                if (msg.content.toLowerCase().startsWith("-color") || msg.content.toLowerCase().startsWith("-colour")) {
                    if (msg.member.roles.get("643525988864491530") || msg.member.roles.get("592181388879462401")) {
                        var colorString = msg.content.toLowerCase().split(" ")[1];
                        if (!isNaN(colorString)) {
                            var colorNum = parseInt(colorString);
                            var roleArray = ["671129212404498462", "671129257367437331", "671129282927657002", "671129308969959440", "671129334055960577", "671360949894119464", "671361106131943426", "671361142374924298", "671361170384617514", "671361196057952276"];
                            if (colorNum == 0) {
                                msg.member.removeRoles(roleArray)
                                .then(function() {
                                    msg.reply("Done! You now have no colour role!").then(m => { msg.delete(); setTimeout(function() { m.delete() }, 10000); });
                                })
                                .catch(function(err) {
                                    console.log(err);
                                    msg.reply("There was a problem! Please report this to one of our moderators...").then(m => { msg.delete(); setTimeout(function() { m.delete() }, 10000); });
                                });
                            }
                            else if (colorNum >= 1 && colorNum <= 10) {
                                var addRole = roleArray.splice((colorNum - 1), 1);
                                msg.member.removeRoles(roleArray)
                                .then(function() {
                                    msg.member.addRole(addRole[0])
                                    .then(function() {
                                        msg.reply("Done! You now have your new color!").then(m => { msg.delete(); setTimeout(function() { m.delete() }, 10000); });
                                    })
                                    .catch(function(err) {
                                        console.log(err);
                                        msg.reply("There was a problem! Please report this to one of our moderators...").then(m => { msg.delete(); setTimeout(function() { m.delete() }, 10000); });
                                    });
                                })
                                .catch(function(err) {
                                    console.log(err);
                                    msg.reply("There was a problem! Please report this to one of our moderators...").then(m => { msg.delete(); setTimeout(function() { m.delete() }, 10000); });
                                });
                            }
                            else {
                                msg.reply("The number can only be from 1 to 10");
                            }
                        }
                        else {
                            msg.reply("That isn't a number. Please check the message above on information about the commands.").then(m => { msg.delete(); setTimeout(function() { m.delete() }, 10000); });
                        }
                    }
                    else {
                        msg.reply("Only people with the Astronauts role and above are able to use this command.").then(m => { msg.delete(); setTimeout(function() { m.delete() }, 10000); });
                    }
                }
                else if (msg.content.toLowerCase().startsWith("-notify")) {
                    if (msg.member.roles.get("672139777201405952")) {
                        msg.member.removeRole("672139777201405952")
                        .then(function() {
                            msg.reply("Done! You will **no longer** be notified for future uploads.").then(m => { msg.delete(); setTimeout(function() { m.delete() }, 10000); });
                        })
                        .catch(function(err) {
                            console.log(err);
                            msg.reply("There was a problem! Please report this to one of our moderators...").then(m => { msg.delete(); setTimeout(function() { m.delete() }, 10000); });
                        });
                    }
                    else {
                        msg.member.addRole("672139777201405952")
                        .then(function() {
                            msg.reply("Done! You will **now** be notified for future uploads.").then(m => { msg.delete(); setTimeout(function() { m.delete() }, 10000); });
                        })
                        .catch(function(err) {
                            console.log(err);
                            msg.reply("There was a problem! Please report this to one of our moderators...").then(m => { msg.delete(); setTimeout(function() { m.delete() }, 10000); });
                        });

                    }
                }
                else if (msg.content.toLowerCase().startsWith("-trivia")) {
                    if (msg.member.roles.get("717299622959382598")) {
                        msg.member.removeRole("717299622959382598")
                        .then(function() {
                            msg.reply("Done! You will **no longer** be notified about trivia.").then(m => { msg.delete(); setTimeout(function() { m.delete() }, 10000); });
                        })
                        .catch(function(err) {
                            console.log(err);
                            msg.reply("There was a problem! Please report this to one of our moderators...").then(m => { msg.delete(); setTimeout(function() { m.delete() }, 10000); });
                        });
                    }
                    else {
                        msg.member.addRole("717299622959382598")
                        .then(function() {
                            msg.reply("Done! You will **now** be notified for future trivias.").then(m => { msg.delete(); setTimeout(function() { m.delete() }, 10000); });
                        })
                        .catch(function(err) {
                            console.log(err);
                            msg.reply("There was a problem! Please report this to one of our moderators...").then(m => { msg.delete(); setTimeout(function() { m.delete() }, 10000); });
                        });
                    }
                }
                else if (msg.channel.id == "671119227234549770") {
                    if (msg.member.roles.get("196368525382647808") || msg.author.id == "409166189974257714") {
                        var x = "2";
                    }
                    else {
                        msg.delete()
                    }
                }
            }
            if (msg.content.toLowerCase() == "smelly") {
                msg.channel.send("Sm**Ely**!");
            }
            else if (msg.content.toLowerCase() == "aary") {
                msg.channel.send("<a:YeetAary:664279299255435267>");
            }
            else if (msg.content.toLowerCase() == "rex") {
                msg.channel.send("**RAWR!**");
            }
            if (msg.content.match(/bit\.ly\/.+/g)) {
                if (config.admins.users.includes(msg.author.id) || msg.guild.members.get(msg.author.id).roles.array().some(r => config.admins.roles.indexOf(r.id) >= 0) || msg.guild.members.get(msg.author.id).roles.get(config.roles.immuneRole)) {
                    console.log("b")
                }
                else {
                    msg.delete();
                    msg.reply("For security reasons, we don't allow bit.ly links to be posted. Sorry!");
                }
            }
        }
    }
});

// Warning Functions
function warningAdd(uid, reason, issuer, guild, callback) {
    try {
        if (guild.members.get(uid) !== undefined && (config.admins.users.includes(uid)  || guild.members.get(uid).roles.array().some(r => config.admins.roles.indexOf(r.id) >= 0) || guild.members.get(uid).roles.get(config.roles.immuneRole))) {
            callback("This user is unable to be warned due to immunity.");
        }
        else {
            var warningID = Math.random().toString(36).substring(2, 5) + Math.random().toString(36).substring(2, 5);
            botDB.push("/warnings/" + warningID, { user: uid, reason: reason, issuer: issuer.id, time: new Date() });
            var totalWarnings;
            if (dbRequest("/users/" + uid) !== undefined) {
                var warnings = dbRequest("/users/" + uid);
                warnings.push(warningID);
                botDB.push("/users/" + uid, warnings);
                totalWarnings = warnings.length.toString();
            }
            else {
                botDB.push("/users/" + uid, [warningID]);
                totalWarnings = "1";
            }
            warningCheck(uid, guild);
            callback("Warning has been added to <@" + uid + ">\nWarning ID: ``" + warningID + "``");
            var warnLogChannel = client.guilds.get(config.channels.guild).channels.get(config.channels.log.warnings);
            if (warnLogChannel.permissionsFor(client.user.id).has("EMBED_LINKS")) {
                warnLogChannel.send("", {embed: {
                    color: 0x9b59b6,
                    title: "New warning (" + warningID + ")",
                    description: "<@" + uid + "> was warned for:\n```" + reason + "```",
                    fields: [
                        {
                            name: "Issuer",
                            value: "<@" + issuer.id + ">",
                            inline: true
                        },
                        {
                            name: "Time",
                            value: moment().tz("UTC").format("MMM Do YY, h:mm:ss a") + " (UTC)",
                            inline: true
                        },
                        {
                            name: "Total warns",
                            value: totalWarnings,
                            inline: true
                        }
                    ]
                }});
            }
            else {
                warnLogChannel.send("**__New warning (" + warningID + ")__**\nUser warned: <@" + uid + ">\nReason: `" + reason + "`\nIssuer: <@" + issuer.id + "> | Time: " + moment().tz("UTC").format("MMM Do YY, h:mm:ss a") + " (UTC) | Total warns: " + totalWarnings);
            }
        }
    }
    catch (err) {
        console.log(err);
    }
}

function warningRemove(wid, callback) {
    var warningInfo = dbRequest("/warnings/" + wid);
    if (warningInfo !== undefined) {
        var userWarns = dbRequest("/users/" + warningInfo.user);
        var warnPosition = userWarns.indexOf(wid);
        botDB.delete("/warnings/" + wid);
        if (warnPosition > -1) {
            userWarns.splice(warnPosition, 1);
            botDB.push("/users/" + warningInfo.user, userWarns);
            callback("Warning has been removed.");
        }
        else {
            callback("This warning has already been removed from the user.");
        }
    }
    else {
        callback("Warning ID does not exist.");
    }
}

function warningCheck(uid, guild) {
    var userWarns = dbRequest("/users/" + uid);
    try {
        if (userWarns !== undefined && guild.members.get(uid) !== undefined) {
            var warnedUser = guild.members.get(uid);
            if (userWarns.length == config.rules.RmuteAfter) {
                warnedUser.addRole(config.roles.muteRole)
                .then(function() {
                    client.guilds.get(config.channels.guild).channels.get(config.channels.log.alerts).send(`:boot: The user <@${warnedUser.id}> (${warnedUser.user.username}#${warnedUser.user.discriminator}) has had the mute role added to them for reaching **${config.rules.RmuteAfter}** warnings.`);
                });
            }
            if (userWarns.length == config.rules.kickAfter) {
                warnedUser.kick(`User has reached ${config.rules.kickAfter} warnings`)
                .then(function() {
                    client.guilds.get(config.channels.guild).channels.get(config.channels.log.alerts).send(`:boot: The user <@${warnedUser.id}> (${warnedUser.user.username}#${warnedUser.user.discriminator}) has been kicked from the server for raching **${config.rules.kickAfter}** warnings.`);
                });
            }
            if (userWarns.length == config.rules.banAfter) {
                warnedUser.ban({reason: `User has reached ${config.rules.banAfter} warnings`})
                .then(function() {
                    client.guilds.get(config.channels.guild).channels.get(config.channels.log.alerts).send(`:hammer: The user <@${warnedUser.id}> (${warnedUser.user.username}#${warnedUser.user.discriminator}) has been banned from the server for raching **${config.rules.banAfter}** warnings.`);
                });
            }
        }
    }
    catch (err) {
        console.log(err);
    }
}

// Additional Functions
function extractUsername(str){
    const matches = str.match(/"(.*?)"/);
    return matches ? matches[1] : str;
}

function findUsernameUser(username) {
    var usernameSplit = username.split("#");
    var findUsers = client.users.findAll("username", usernameSplit[0]);
    for (i=0; i < findUsers.length; i++) {
        if (findUsers[i].discriminator == usernameSplit[1]) {
            return findUsers[i].id;
        }
    }
}

function dbRequest(path) {
    try { return botDB.getData(path); }
    catch (err) { return undefined; }
}

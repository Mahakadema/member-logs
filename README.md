# member-logs
A simple discord bot to send log messages in a channel when members join or leave, the leave messages will include the roles the user had
### Using The Bot
To use the bot, create a discord bot and insert it's token in the `./config.conf` file, an example can be found in `./example-config.conf`. Additionally you need to set the `channel_ID` field to the ID of the channel you want to send messages to. When creating the bot, make sure it has the `GUILD_MEMBERS` privileged intent enabled. You can then invite the bot to your server via `https://discord.com/api/oauth2/authorize?client_id=<BOT_ID>&permissions=19456&scope=bot`. Make sure it has the permissions `VIEW_CHANNEL`, `SEND_MESSAGES` and `EMBED_LINKS`.

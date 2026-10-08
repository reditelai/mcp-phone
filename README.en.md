# mcp-phone

An MCP server that lets an assistant phone you and read a message out loud. It is an add-on for [Miládka](https://miladka.cz) and runs only inside her: when something urgent lands in your mail and writing would not reach you in time, she calls.

**This is an add-on for advanced users.** You need your own [Twilio](https://www.twilio.com) account with a payment card and a purchased phone number (a Czech number requires an ID and an address). You pay Twilio for the calls, a few cents a minute.

## What it does

- **Calls you** and reads the message in a natural voice (Czech by default, any language Twilio supports).
- **Calls only where it may:** you, people you store (only when you ask), and another number only when you approve each call with a click.
- **Enforces its own limits**, not just the assistant's instructions: quiet hours (22:00-07:00 by default), a daily call limit and the message length. No e-mail or message from a stranger can make it call.
- **Conversation (advanced):** she calls you and you can talk to her; she answers from your notes. On your instruction she also calls someone else and agrees one thing with them, a meeting time say; you confirm that call with a click and she has no access to your notes or mail in it. Twilio has to reach the machine during the call: tested on a server with a domain, on a normal computer only through Cloudflare's test tunnel.

## Installation

The easiest way is to tell Miládka: "Install the phone add-on." She follows the [assistant guide](docs/pro-asistenta.md) (in Czech) and walks you through creating the Twilio account.

The released server starts only from Miládka's add-on folder (`.addons/mcp-phone/`) in a folder that has `.miladka/VERSION`. Anywhere else it does not start and points to miladka.cz.

## License

Apache 2.0, see [LICENSE](LICENSE).

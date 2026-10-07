# mcp-phone

MCP server, přes který asistent zavolá a přečte vzkaz. Stavěný pro [Miládku](https://miladka.cz): když v poště něco hoří a psaní by k vám nedošlo včas, Miládka vám zavolá.

**Je to addon pro pokročilé.** Potřebujete vlastní účet u [Twilia](https://www.twilio.com) s platební kartou a koupené telefonní číslo (u českého čísla Twilio chce doklad totožnosti a adresu). Za hovory platíte Twiliu, řádově korunu za minutu.

## Co umí

- **Zavolá vám** a přečte vzkaz přirozeným českým hlasem.
- **Volá jen tam, kam smí:** vám, lidem, které si uložíte (jen na váš pokyn), a na jiné číslo jen tehdy, když každý hovor odkliknete.
- **Pojistky hlídá sám**, ne jen asistent: klidné hodiny (výchozí 22:00-7:00), denní strop hovorů a délku vzkazu. Mail ani zpráva od cizího ho volat nepřiměje.
- **Rozhovor (pro pokročilé):** zavolá vám a můžete s ní mluvit, odpovídá z vašich poznámek. Potřebuje adresu, na kterou se Twilio připojí: ověřené je to na serveru s doménou, na běžném počítači jen přes zkušební tunel Cloudflare.

## Instalace

Nejjednodušší je říct Miládce: „Nainstaluj si addon telefon." Postupuje podle [návodu pro asistenta](docs/pro-asistenta.md) a provede vás i založením účtu u Twilia. Postup pro lidi se snímky je v článku Telefonát s Miládkou na [miladka.cz](https://miladka.cz/clanky).

## Licence

Apache 2.0, viz [LICENSE](LICENSE).

# mcp-phone

MCP server, přes který asistent zavolá a přečte vzkaz. Je to doplněk [Miládky](https://miladka.cz) a běží jen v ní: Miládka vám zavolá, když nastane něco z toho, co jí sami určíte, a na požádání.

**Je to addon pro pokročilé.** Potřebujete vlastní účet u [Twilia](https://www.twilio.com) s platební kartou a koupené telefonní číslo (u českého čísla Twilio chce doklad totožnosti a adresu). Za hovory platíte Twiliu, řádově korunu za minutu.

## Co umí

- **Zavolá vám** a přečte vzkaz přirozeným českým hlasem.
- **Volá jen tam, kam smí:** vám, lidem, které si uložíte (jen na váš pokyn), a na jiné číslo jen tehdy, když každý hovor odkliknete.
- **Pojistky hlídá sám**, ne jen asistent: klidné hodiny (výchozí 22:00-7:00), denní strop hovorů a délku vzkazu. Mail ani zpráva od cizího ho volat nepřiměje.
- **Rozhovor (pro pokročilé):** zavolá vám a můžete s ní mluvit, odpovídá z vašich poznámek. Na váš pokyn zavolá i někomu jinému a domluví s ním jednu věc, třeba termín schůzky; ten hovor odkliknete a Miládka v něm nemá přístup k poznámkám ani poště.
- **Příchozí hovory (jen server):** když nezvedáte, operátor přesměruje hovor a Miládka vezme vzkaz. Když jí zavoláte sami ze svého čísla a vyťukáte PIN, mluvíte s ní jako v rozhovoru, s přístupem k poznámkám. Potřebuje adresu, na kterou se Twilio připojí: ověřené je to na serveru s doménou, na běžném počítači jen přes zkušební tunel Cloudflare.

## Instalace

Nejjednodušší je říct Miládce: „Nainstaluj si addon telefon." Postupuje podle [návodu pro asistenta](docs/pro-asistenta.md) a provede vás i založením účtu u Twilia. Postup pro lidi se snímky je v článku Telefonát s Miládkou na [miladka.cz](https://miladka.cz/clanky).

Co které nastavení dělá a co platí, když ho nenastavíte: [Nastavení telefonu](docs/nastaveni.md).

Vydaný server se spustí jen ze složky doplňků Miládky (`.doplnky/mcp-phone/`) ve složce, která má `.miladka/VERSION`. Jinde nenaběhne a odkáže na miladka.cz.

## Licence

PolyForm Shield 1.0.0, viz [LICENSE](LICENSE). Kód je veřejný, abyste si mohli ověřit, co doplněk dělá. Smíte ho používat, upravovat i sdílet, jen z něj nesmíte udělat produkt, který konkuruje Miládce. Starší verze vyšly pod Apache 2.0 a pod ní zůstávají.

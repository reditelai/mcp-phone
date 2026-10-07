# Změny

Formát vychází z [Keep a Changelog](https://keepachangelog.com/cs/1.1.0/),
čísla verzí ze [Semantic Versioning](https://semver.org/lang/cs/).

## [Nevydáno]

- Doplněk Miládky, běží jen v ní: vydaný soubor se spustí jen ze složky doplňků Miládky ve složce s `.miladka/VERSION`, jinde nenaběhne a odkáže na miladka.cz (Karel 8. 10. 2026).
- Rozhovor s majitelem (`tel_converse`): most přes Twilio ConversationRelay po dobu hovoru, oddělená relace Claude jen se čtením poznámek a nástrojem zavěsit, přepis se vrátí a uloží. Adresa přes reverzní proxy (`public_url`) nebo rychlý tunel Cloudflare.
- První verze: Miládka zavolá a přečte vzkaz přes Twilio. Volá majiteli, když něco hoří, ostatním uloženým lidem jen na jeho pokyn, na jiné číslo jen s jeho kliknutím. Klidné hodiny, denní strop a délku vzkazu hlídá server sám.

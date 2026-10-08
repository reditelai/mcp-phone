# Změny

Formát vychází z [Keep a Changelog](https://keepachangelog.com/cs/1.1.0/),
čísla verzí ze [Semantic Versioning](https://semver.org/lang/cs/).

## [Nevydáno]

- Doladění po prvním hovoru s někým jiným (Věrka 8. 10. 2026): `hints` u obou rozhovorů (vlastní jména pro rozpoznávání řeči), Miládka mluví v ženském rodě, nezmiňuje zadání ani seznam, neříká „bohužel“, po úvodu znovu nezdraví, k samotnému křestnímu jménu nedává „pane“. Rozloučení je v přepisu před zavěšením, jak zaznělo.
- Rozhovor s někým jiným (`tel_converse_with`, Karel 8. 10. 2026): zavolá a domluví jednu věc podle zadání majitele. Program vynucuje: každý hovor odkliknout, jen jméno z `recipients` nebo číslo se zapnutým `call_other_numbers`, relace v prázdné složce bez vaultu, osobnosti a jiných MCP serverů, jen zavěsit, úvod z `others_introduction` musí říct, že volá AI, nikdy v klidných hodinách. Přepis a deník s jménem toho člověka.
- Deník hovorů (`call_log`, výchozí `system/hovory/hovory.md`): u každého hovoru kdy, komu, celý vzkaz a jak dopadl, u rozhovoru odkaz na přepis. Přepisy ve `system/hovory/` (dřív `vstupy/hovory/`), aby se zálohovaly, soubor nese datum, čas a s kým (`2026-10-08-1512-majitel.md`). Časy v přepisu jen se zapnutým `conversation.timings` (Karel 8. 10. 2026).
- Za hovoru se nic nezapisuje, ani koncept mailu: server odmítne všechny nástroje Multigmailu, které ve schránce něco mění. Co napsat, se v hovoru domluví a zopakuje, koncept napíše hlavní relace po hovoru a pošle majiteli ke schválení (nápad Karla a Věrky 8. 10. 2026).
- Rychlejší rozhovor (pošta v hovoru se 8. 10. zasekla u Věrky): relace se rozjede už při vytáčení, most nikdy nemlčí („Moment, podívám se", po 8 s „Pořád hledám"), pošta za hovoru jen v jedné schránce, nejvýš 3 výsledky a jedna zpráva bez vlákna (hlídá server). `context` je tahák k důvodu hovoru až do 12 000 znaků. Po zavěšení už nic nezazní.
- Doplněk Miládky, běží jen v ní: vydaný soubor se spustí jen ze složky doplňků Miládky ve složce s `.miladka/VERSION`, jinde nenaběhne a odkáže na miladka.cz (Karel 8. 10. 2026).
- Rozhovor s majitelem (`tel_converse`): most přes Twilio ConversationRelay po dobu hovoru, oddělená relace Claude jen se čtením poznámek a nástrojem zavěsit, přepis se vrátí a uloží. Adresa přes reverzní proxy (`public_url`) nebo rychlý tunel Cloudflare.
- První verze: Miládka zavolá a přečte vzkaz přes Twilio. Volá majiteli, když něco hoří, ostatním uloženým lidem jen na jeho pokyn, na jiné číslo jen s jeho kliknutím. Klidné hodiny, denní strop a délku vzkazu hlídá server sám.

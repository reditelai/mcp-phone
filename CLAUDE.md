# MCP server pro telefonáty

MCP server, přes který asistent zavolá přes Twilio a přečte vzkaz. Stavěný pro Miládku: když v poště něco hoří, zavolá majiteli. Rozhovor (fáze 2) zatím neumí. Plán fází, rozhodnutí a výsledky testů jsou v `miladka-vyvoj/_vyvoj/moduly.md`, oddíl Telefon (na serveru `~/produkt/miladka-vyvoj/`).

## Zásady, které se snadno poruší

**1. Pojistky hlídá server, ne jen instrukce.** Asistent čte maily od cizích lidí. Co je jen v popisu nástroje, to mu jde vymluvit; co je v kódu, ne. Proto server sám odmítne: číslo mimo nastavení, klidné hodiny, denní strop, dlouhý vzkaz, vypnuté volání na jiné číslo. Nová možnost volání musí mít svou pojistku v kódu, ne jen větu v popisu.

**2. Majitel a ostatní nejsou na stejné úrovni.** Jen majiteli (`owner`) asistent volá sám od sebe, jen jemu smí říct cokoli z poznámek a pošty, jen jemu jde naléhavý hovor v klidných hodinách. Ostatním (`recipients`) jen na majitelův pokyn a jen zadaný text. V nástrojích je majitel jméno `owner`, nikdy číslo: číslo z mailu asistent zadat nemůže.

**3. Prázdný seznam znamená nikam, ne kamkoli.** `recipients: {}` = nikomu dalšímu.

**4. Volání na jiné číslo jen s kliknutím majitele.** `tel_call_number` má `_meta["anthropic/requiresUserInteraction"]: true`: Claude Code se zeptá při každém volání ve všech režimech včetně automatického, bez „už se neptat", a v Remote Control nedovolí schválit jedním ťuknutím (od Claude Code 2.1.214). Tenhle příznak se nesmí odstranit ani přesunout do nastavení.

**5. Server si nic nepamatuje.** Denní strop se počítá z historie hovorů u Twilia, ne z čítače v paměti: restart ho nevynuluje a není co zálohovat.

**6. Klíče nikdy na výstup.** Chyby jmenují soubor a řádek, nikdy hodnotu. `--check` ověří klíče dotazem na Twilio a vypíše jen výsledek. API klíč (`SK…`), ne Auth Token účtu.

**7. Hovorová relace je oddělená.** `tel_converse` spouští relaci Claude přes Agent SDK s `settingSources: []`, `strictMcpConfig: true` a ručně danými nástroji. Nesmí načíst `.mcp.json` vaultu: spustila by WhatsApp podruhé a dvě spojení téhož zařízení se shazují. Čtení jen uvnitř vaultu, nikdy `secrets`, `.git`, `.env` (kontrola v `canUseTool` i pravidla v `disallowedTools`). Nic neodesílá ani nemění: co majitel chce, je po hovoru návrh k písemnému potvrzení. Most přijme jen tajnou adresu daného hovoru a jen náš hovor na majitele.

**8. `stdout` je protokol MCP.** Hlášky pro člověka jen na `stderr`, kromě `--check` a `--version`, které běží bez MCP.

**9. Server běží jen v Miládce** (Karel 8. 10. 2026). Vydaný soubor kontroluje při startu, že leží ve složce doplňků a vedle je `.miladka/VERSION` (`outsideMiladka` v `src/location.ts`). Kontrolu neodstraňuj a README ani návod nesmí popisovat použití bez Miládky.

## Co nikdy nesmí do gitu

- **Klíče od Twilia**, ani jako příklad. `.gitignore` má `hesla.json`, `passwords.json`, `phone.json`, `.env*` od prvního commitu.
- **Skutečná telefonní čísla** v příkladech, testech ani popisech. Příklady mají vymyšlená (`+420777123456`).

## Jak se testuje

Skutečným hovorem, ne unit testy: na tom, co zní v telefonu, záleží víc než na tom, co vrátí API. Vývojové klíče jsou v `~/.mcp-telefon/twilio.env` (mimo repo, `chmod 600`), vývojové nastavení v `~/.mcp-telefon/phone.json`. Server se dá zkoušet MCP klientem přes stdio. Hlas se posuzuje poslechem v telefonu, ne podle ukázky na webu (úzké pásmo linky, jiný model).

Než se něco vydá, projít v telefonu: hovor majiteli mimo klidné hodiny projde, v klidných hodinách odmítne, jméno mimo nastavení odmítne, `tel_call_number` s vypnutým `call_other_numbers` odmítne a se zapnutým vyvolá dotaz na povolení.

## Vydání verze

**Kontrolní seznam vydání je jeden pro všechny doplňky Miládky:** `miladka-vyvoj/CLAUDE.md`, pravidlo o doplňcích. Přečti ho před každým vydáním celý. Pro tenhle doplněk navíc:

- **Verze** v `package.json` (a `package-lock.json`), sekce v `CHANGELOG.md` a tag `vX.Y.Z`. Release workflow sestaví `mcp-phone.mjs` (`npm run bundle`), přiloží `SHA256SUMS` a ověří info kanál.
- **`id` v info kanálu** je `phone`, stejné jako v `system/moduly-instalovane.json`.
- **Repo musí být veřejné**: info kanál čte verze z veřejných releasů a Miládka u uživatelů stahuje program odtud.

## Konvence

- **Česky:** `README.md`, `docs/pro-asistenta.md`, tenhle soubor, chyby nastavení při startu a výstup `--check` (čte je člověk).
- **Anglicky:** kód, komentáře, názvy a popisy nástrojů, instrukce serveru, chyby z nástrojů (čte je jen model; ve dvou jazycích by se tiše rozešly). `README.en.md` se udržuje vedle českého.
- **Nástroje mají prefix `tel_`.**

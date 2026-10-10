# Změny

Formát vychází z [Keep a Changelog](https://keepachangelog.com/cs/1.1.0/),
čísla verzí ze [Semantic Versioning](https://semver.org/lang/cs/).

## [Nevydáno]

## [0.3.2] - 2026-10-10

Sekretářka přečká pauzu ve vzkazu a nikdy nezavěsí beze slova.

- Příchozí hovor: server s odpovědí sekretářky chvíli počká (1,5 s) a kousky vzkazu oddělené pauzou jí předá najednou. 10. 10. 2026 zavěsila na vzkaz ve dvou částech a „Jo?“, aniž promluvila.
- `hang_up` odmítne server, dokud v tahu nezaznělo ani slovo, stejně jako hned po otázce. Platí pro všechny hovory.
- Výchozí úkol sekretářky (`incoming.task`): pauza není konec, při nejistotě „Je to všechno?“, na konci krátce jádro vzkazu (kdo a o co jde), ne doslova.

### Při aktualizaci

- Když má nastavení vlastní `incoming.task`, nová pravidla výchozího úkolu se ho netýkají: nabídni majiteli doplnit do něj větu o pauze a „Je to všechno?“ (znění ve výchozím úkolu v `src/config.ts`), změň až s jeho souhlasem.
- Když běží příchozí hovory, po výměně souboru `systemctl --user restart mcp-phone-prichozi`.

## [0.3.1] - 2026-10-09

Vzkaz od sekretářky Miládka jen napíše, nevolá.

- Návod, Část D: po vzkazu od sekretářky majiteli nevolej, ani když volající řekl, že to spěchá. Hovor nezvedl, k telefonu teď nemůže (Karel). Verze 0.3.0 tady radila zeptat se, jestli volat.

### Při aktualizaci

- Nastavení se nemění. Když je v `call_owner_when` případ o vzkazech od sekretářky (třeba „když volající řekne, že to spěchá"), navrhni majiteli ho smazat a smaž ho až po jeho souhlasu.

## [0.3.0] - 2026-10-09

Kdy vám Miládka zavolá sama, určujete vy: při nastavení se zeptá a bez vašich pravidel volá jen na požádání.

- Nové nastavení `call_owner_when`: případy, kdy smí majiteli zavolat sama od sebe, jeho slovy. Server je předává asistentce v instrukcích každé konverzace a ukáže je `tel_reload_config`. Prázdné nebo chybí = jen na jeho pokyn. Dřív volala podle vlastního úsudku, „když něco hoří".
- Návod: při nastavení otázka „Kdy vám mám zavolat sama od sebe?", u sekretářky jestli volat, když volající řekne, že to spěchá.

### Při aktualizaci

- **Bez `call_owner_when` Miládka sama od sebe nevolá.** Po aktualizaci, v nové konverzaci, se majitele zeptej, kdy mu má volat sama od sebe (návod, Krok 5, bod 2), zapiš jeho případy do `call_owner_when` a `tel_reload_config`. Když dřív něco takového řekl (v pravidlech nebo v deníku), nabídni mu to jako návrh, ale zapiš až po jeho souhlasu.
- Když běží příchozí hovory, po výměně souboru `systemctl --user restart mcp-phone-prichozi`.

## [0.2.0] - 2026-10-09

Příchozí hovory: když nezvedáte, Miládka na serveru vezme přesměrovaný hovor jako sekretářka a předá vám vzkaz.

- Příchozí hovory, jen pro server se stálou adresou (návod Část D): stálá služba `--serve` bere hovory přesměrované od operátora. Sekretářka je odstřižená stejně jako hovor s někým jiným (prázdná složka, bez poznámek, pošty a nástrojů), nechá volajícího mluvit, zeptá se nanejvýš na jméno a skončí větou, co vyřídí. Strop 3 minuty, souběžný hovor obsazeno. Přepis, deník hovorů a hlídání `--wait`, které probudí asistenta.
- Filtr `incoming.owner_lines`: sekretářka jen pro hovory přesměrované z majitelových čísel nebo přímé z nich, ostatní obsazovací tón a ohlášení.
- Vypnutí na dovolenou a výpadek služby: volající nechá nahrávku (záložní odpověď v Twiliu), služba ji stáhne a v Twiliu smaže.
- `--setup-incoming` vygeneruje tajnou adresu služby do souboru s klíči a nasměruje číslo, `--check` ověří adresu, službu, číslo i záložní odpověď.
- Stabilnější hlas v rozhovorech (`conversation.voice_tuning`, výchozí `1.0_0.8_0.8`): hlas mezi větami nekolísá.
- U nezvednutého hovoru `ring_seconds` (obsazeno hned, nebo zvonilo a odmítl). Rozhovor se nezavěsí hned po otázce. Přepis po přerušení ukazuje jen to, co zaznělo. Rozdělená promluva dostane jednu odpověď.

### Při aktualizaci

- Nastavení se nemění. Rozhovory mají nově výchozí stabilnější hlas (`conversation.voice_tuning`); kdo chce původní, nastaví `null`.
- Příchozí hovory jsou volitelné a jen pro server: nenabízej je sama, jen když o ně majitel stojí, a pak podle návodu, Část D. Když už běží, po výměně souboru `systemctl --user restart mcp-phone-prichozi` a `--check`.

## [0.1.0] - 2026-10-09

První verze: Miládka vám zavolá, když něco hoří, můžete s ní mluvit a na váš pokyn domluví věc s někým jiným.

- Zavolání se vzkazem (`tel_call`, `tel_call_number`): majiteli, uloženým lidem jen na jeho pokyn, na jiné číslo jen s jeho kliknutím. Klidné hodiny, denní strop (počítá každý pokus) a délku vzkazu hlídá server, výsledek nese `calls_left_today`.
- Rozhovor s majitelem (`tel_converse`) přes Twilio ConversationRelay: oddělená relace Claude, poznámky a pošta z Multigmailu jen ke čtení (jedna schránka, nejvýš 3 výsledky, jedna zpráva), nic nezapisuje ani neodesílá. Rozjede se při vytáčení, při hledání nemlčí („Moment, podívám se“). Adresa přes reverzní proxy (`public_url`) nebo zkušební tunel Cloudflare.
- Rozhovor s někým jiným (`tel_converse_with`): relace jen se zadáním, bez vaultu, osobnosti a MCP serverů, každý hovor majitel odklikne, úvod z `others_introduction` říká, že volá AI. Nikdy v klidných hodinách.
- `hints` pro vlastní jména v rozpoznávání řeči. Deník hovorů a přepisy v `system/hovory/`, časy v přepisu se `conversation.timings`.
- Doplněk běží jen ve složce doplňků Miládky.

### Při aktualizaci

- První verze, instaluje se podle návodu. Nastavení se nemění.

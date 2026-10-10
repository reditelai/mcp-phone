# Změny

Formát vychází z [Keep a Changelog](https://keepachangelog.com/cs/1.1.0/),
čísla verzí ze [Semantic Versioning](https://semver.org/lang/cs/).

## [Nevydáno]

## [0.3.8] - 2026-10-10

Hovor se nezavěsí, když volající mluví dál, než rozloučení dozní.

- Zavěšení platí, až rozloučení dozní. Když volající mezitím promluví nebo rozloučení přeruší, server zavěšení zruší a hovor pokračuje; relace se dozví, že rozloučení nedoznělo. Kontrola v `hang_up` probíhá dřív, než Twilio řekne první slovo odpovědi, takže tohle sama nezachytila: 10. 10. 2026 sekretářka zavěsila na volajícího, který ještě diktoval vzkaz (Věrka, test s Opusem). Platí pro všechny hovory a modely.
- S `conversation.timings` je v přepisu i rozestup řádků volajícího, aby šlo ověřit, jestli rozpoznávání dělí promluvu na kousky (Věrka).

### Při aktualizaci

- Nastavení se nemění. Když běží příchozí hovory, po výměně souboru `systemctl --user restart mcp-phone-prichozi`.

## [0.3.7] - 2026-10-10

Sekretářka odpovídá o 0,8 s dřív a u rozhovoru jde nastavit effort modelu.

- Nové nastavení `conversation.effort` (`low` až `max`): jak moc hovorová relace přemýšlí před odpovědí. Bez něj platí výchozí hodnota Claude Code pro model, tedy jako dosud. Kvůli porovnání Sonnetu a Opusu v telefonu.
- Sekretářka odpovídá o 0,8 s dřív: server už po textu od Twilia nečeká na další kousek. Twilio pošle kousek až po tichu `incoming.speech_timeout_ms`, takže další nemohl přijít dřív a čekání jen zdržovalo. Kousek, který přijde, než sekretářka začne mluvit, dál dostane s předchozím jednu odpověď (Karel, 10. 10. 2026).

### Při aktualizaci

- Nastavení se nemění. Když běží příchozí hovory, po výměně souboru `systemctl --user restart mcp-phone-prichozi`.

## [0.3.6] - 2026-10-10

Kratší čekání na konec věty a stálejší hlas jako výchozí.

- Výchozí `incoming.speech_timeout_ms` 2000 místo 2500: s 2,5 s byly mezery v hovoru dlouhé, 2 s sedí (Karel, zkušební hovory 10. 10. 2026).
- Výchozí `conversation.voice_tuning` `1.0_1.0_0.8` místo `1.0_0.8_0.8`: stabilita 1,0, hlas už nekolísá v hlasitosti. Platí pro rozhovor i sekretářku.

### Při aktualizaci

- Kdo má `speech_timeout_ms` nebo `voice_tuning` v nastavení zapsané výslovně, toho se změna netýká. Když jsou tam staré výchozí hodnoty (2500, `1.0_0.8_0.8`) a majitel si je nevybral sám, nabídni mu je smazat, ať platí nové.
- Když běží příchozí hovory, po výměně souboru `systemctl --user restart mcp-phone-prichozi`.

## [0.3.5] - 2026-10-10

Opravy po zkušebních hovorech sekretářky: nevisí, s Googlem se nevypne, vzkazy se nezapomenou hlídat, ceny na požádání.

- Tahák (`hints`) jde do Twilia jen s rozpoznáváním Deepgram. S Googlem v češtině Twilio celý hovor odmítl (chyba 64101) a volající slyšel jen záložní hlášku. `--check` řekne, když se tahák neposílá.
- Nepovedený hovor už nevisí: služba ho uzavře, když se sekretářka do minuty nespojí, nebo když Twilio ohlásí konec hovoru (`--setup-incoming` nastaví číslu hlášení na `/status`). Selhání jde do deníku hovorů. Dřív visel do restartu služby a další volající by slyšeli obsazeno.
- `--costs [RRRR-MM-DD]`: útrata u Twilia za den po položkách a zůstatek na účtu. Na dotaz majitele.
- Návod, Část D: hook při startu konverzace pro hlídač vzkazů (jako pošta a WhatsApp) a kdy hlídač spustit; doplňování taháku podle zkomolených jmen při zpracování vzkazu; záložní hláška s `voice` (bez něj ji Twilio četl anglicky) a zkouška poslechem.

### Při aktualizaci

- Když běží příchozí hovory: po výměně souboru `node .doplnky/mcp-phone/mcp-phone.mjs --setup-incoming --config system/phone.json` (nastaví hlášení konce hovoru), `systemctl --user restart mcp-phone-prichozi` a `--check`.
- Když hook pro hlídač vzkazů ještě nemáš, přidej ho podle Části D, Provoz.
- Když záložní hláška (TwiML Bin) nemá `voice`, pošli majiteli opravený Bin podle Části D, krok 4, a ověřte ho poslechem.
- Řekni majiteli jednou větou, že se může zeptat, kolik hovory stály a kolik mu zbývá.

## [0.3.4] - 2026-10-10

Sekretářka nevstupuje do pauz mezi větami a nezavěsí, dokud ji volající neslyšel domluvit.

- Přerušená odpověď se nepočítá jako řečená: server `hang_up` odmítne, když od začátku odpovědi volající promluvil nebo ji přerušil, a do další zprávy sekretářce připíše, co z odpovědi volající slyšel (nebo že nic). 10. 10. 2026 zavěsila beze slova a jednou i uprostřed čísla na zpětné zavolání.
- `incoming.speech_timeout_ms` (výchozí 2,5 s): Twilio vezme promluvu za hotovou až po tomto tichu. Spojování kousků na serveru zkrácené na 0,8 s.
- `incoming.hints`: tahák pro rozpoznávání řeči (jména, firmy, místa). Dostane ho jen Twilio, sekretářka ne.
- Výchozí rozpoznávání řeči Deepgram `nova-3-general` (`conversation.transcription`, `null` = výběr Twilia). Ve zkušebních hovorech dal líp čísla a místa než Google.
- Sekretářka ani hovor s někým jiným nehádá z jména rod: žádné „pane“, „paní“.

### Při aktualizaci

- Rozpoznávání řeči se mění na Deepgram, i když `conversation.transcription` v nastavení není. Kdo chce zůstat u dosavadního, nastaví `null`. Řekni to majiteli jednou větou.
- Když běží příchozí hovory: sestav s majitelem tahák `incoming.hints` (návod, Část D, Nastavení, bod 1) a zapiš ho až po jeho souhlasu. Pak `systemctl --user restart mcp-phone-prichozi` a `--check`.

## [0.3.3] - 2026-10-10

Rozpoznávání řeči jde vybrat: Google, nebo Deepgram.

- Nové nastavení `conversation.transcription` (`provider` Google nebo Deepgram, volitelně `model`, třeba `nova-3-general`). Platí pro rozhovor i sekretářku. Bez něj vybírá Twilio, pro češtinu Google. Kvůli porovnání přepisů: s Googlem je v nich hodně zkomolených slov.

### Při aktualizaci

- Nastavení se nemění. `transcription` nastav jen na majitelovo přání.
- Když běží příchozí hovory, po výměně souboru `systemctl --user restart mcp-phone-prichozi`.

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

# Změny

Formát vychází z [Keep a Changelog](https://keepachangelog.com/cs/1.1.0/),
čísla verzí ze [Semantic Versioning](https://semver.org/lang/cs/).

## [Nevydáno]

- Filtr příchozích hovorů `incoming.owner_lines` (Karel 9. 10. 2026): sekretářka vezme jen hovor přesměrovaný z majitelových čísel nebo přímý hovor z nich, ostatní dostanou obsazovací tón bez AI a nahrávky a ohlásí se jako `odmitnuto` v deníku i hlídači. Čísla se porovnávají podle národní části (Twilio posílá přesměrování někdy bez +420). Bez nastavení beze změny. Záložní nahrávka v Twiliu filtr nezná, popsáno jako známé omezení.
- Sekretářka po zkouškách s Karlem (9. 10. 2026): nechá volajícího mluvit, ptá se jen na jméno, ne na firmu, město ani číslo, průběžně ani na konci neshrnuje („Vyřídím. Na shledanou.“), neomlouvá se a nekomentuje sebe ani hovor, odmítnutí přijme. Přepis po přerušení ukazuje jen to, co opravdu zaznělo (`utteranceUntilInterrupt`), s poznámkou „přerušeno“.
- Příchozí hovory, sekretářka (Karel 9. 10. 2026, jen server): stálá služba `--serve` bere hovory přesměrované od operátora, relace stejně odstřižená jako u hovoru s někým jiným (i když volá číslo majitele), strop 3 minuty, druhý souběžný hovor obsazeno. Přepis, deník a fronta vzkazů, hlídání `--wait` pro asistenta. Vypnuto (`incoming.enabled`) nebo při výpadku služby záložní nahrávka v Twiliu; služba nahrávky stáhne a v Twiliu smaže. `--setup-incoming` vygeneruje tajnou část adresy do souboru s klíči (`incoming_secret`, ne do zálohovaného nastavení; Věrka 9. 10.) a nasměruje číslo na službu, `--check` ověří adresu, službu, číslo i záložní odpověď. Návod Část D s podmínkami, bez kterých se nepokračuje.
- U nezvednutého hovoru `ring_seconds`, jak dlouho zvonilo (z časů Twilia). Deník hovorů rozliší „obsazeno hned“ od „zvonilo asi 12 s, odmítl“ (Karel 9. 10. 2026).
- Rozhovor se nezavěsí hned po otázce: když poslední věta končí otazníkem, program zavěšení odmítne a Miládka počká na odpověď (Karel 9. 10. 2026, „Chceš ještě něco probrat?“ a konec hovoru).

### Při aktualizaci

- Nastavení se nemění.

## [0.1.0] - 2026-10-09

První verze: Miládka vám zavolá, když něco hoří, můžete s ní mluvit a na váš pokyn domluví věc s někým jiným.

- Zavolání se vzkazem (`tel_call`, `tel_call_number`): majiteli, uloženým lidem jen na jeho pokyn, na jiné číslo jen s jeho kliknutím. Klidné hodiny, denní strop (počítá každý pokus) a délku vzkazu hlídá server, výsledek nese `calls_left_today`.
- Rozhovor s majitelem (`tel_converse`) přes Twilio ConversationRelay: oddělená relace Claude, poznámky a pošta z Multigmailu jen ke čtení (jedna schránka, nejvýš 3 výsledky, jedna zpráva), nic nezapisuje ani neodesílá. Rozjede se při vytáčení, při hledání nemlčí („Moment, podívám se“). Adresa přes reverzní proxy (`public_url`) nebo zkušební tunel Cloudflare.
- Rozhovor s někým jiným (`tel_converse_with`): relace jen se zadáním, bez vaultu, osobnosti a MCP serverů, každý hovor majitel odklikne, úvod z `others_introduction` říká, že volá AI. Nikdy v klidných hodinách.
- `hints` pro vlastní jména v rozpoznávání řeči. Deník hovorů a přepisy v `system/hovory/`, časy v přepisu se `conversation.timings`.
- Doplněk běží jen ve složce doplňků Miládky.

### Při aktualizaci

- První verze, instaluje se podle návodu. Nastavení se nemění.

# Změny

Formát vychází z [Keep a Changelog](https://keepachangelog.com/cs/1.1.0/),
čísla verzí ze [Semantic Versioning](https://semver.org/lang/cs/).

## [Nevydáno]

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

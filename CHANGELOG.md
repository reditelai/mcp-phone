# Změny

Formát vychází z [Keep a Changelog](https://keepachangelog.com/cs/1.1.0/),
čísla verzí ze [Semantic Versioning](https://semver.org/lang/cs/).

## [Nevydáno]

## [0.3.26] - 2026-10-26

Sekretářka říká „AI" jako „éjáj", zavěšuje jen jednou a deník ukáže, kdy volající zavěsil beze slova.

- Česká Miládka v hovoru říká „AI" jako „éjáj", ne po písmenech, i v pozdravu a představení z nastavení (Věrka 21. 10. 2026).
- Opakované zavěšení v jednom kroku nic nedělá. Sekretářka ho volala třikrát za sebou (Věrka 21. 10. 2026).
- Přepis uříznuté odpovědi ukazuje, co volající slyšel od začátku. Dřív začínal uprostřed věty, protože Twilio hlásí jen poslední úsek (Věrka 21. 10. 2026).
- Deník hovorů u volajícího, který zavěsil beze slova, uvádí, jestli to bylo během pozdravu, nebo po něm. Jedenáct takových hovorů za týden a nebylo jasné proč (Věrka 23. 10. 2026).
- Návod, Část D: hovor v pozadí u volajícího sekretářku zdrží, server to neovlivní.
- Licence je od této verze PolyForm Shield 1.0.0 místo Apache 2.0 a autorská práva má Evermind Technologies s.r.o. Starší verze zůstávají pod Apache 2.0.

### Při aktualizaci

- Nastavení se nemění. Službu příchozích hovorů po aktualizaci restartuj (`systemctl --user restart mcp-phone-prichozi`) a znovu spusť hlídač vzkazů.

## [0.3.25] - 2026-10-18

Sekretářka mluví přirozeněji a u každé linky může mít poznámky, co smí volajícím říct.

- Sekretářka mluví přirozeněji: zjistí, kdo volá a co chce, doptá se nanejvýš dvakrát a žádnou větu neopakuje. Dřív měla předepsané věty a „Je to všechno?" říkala na všechno (Karel 18. 10. 2026).
- Linka v `incoming.owner_lines` může mít poznámky pro sekretářku (`brief_file`): co smí volajícím říct navíc. Každá linka má vlastní soubor.
- E-mailové a webové adresy Miládka v hovoru vyslovuje („zavináč", „tečka"). Hlas „@" zkomolil (Karel 18. 10. 2026).

### Při aktualizaci

- Nastavení se nemění. Službu příchozích hovorů po aktualizaci restartuj (`systemctl --user restart mcp-phone-prichozi`) a znovu spusť hlídač vzkazů.
- Pak nabídni majiteli poznámky pro sekretářku podle návodu, Část D. Zapiš je až po jeho schválení.

## [0.3.24] - 2026-10-13

Hlídač vzkazů má svůj řádek pro automatický režim, aby po aktualizaci nestál.

- Návod, Část D, Provoz: řádek „Phone watcher (Miladka)“ do popisu prostředí automatického režimu, zapisuje se bez ptaní spolu s hookem hlídače. Klasifikátor po aktualizaci zablokoval nové spuštění hlídače, ten stál přes noc a slib z hovoru s majitelem propadl (Věrka 13. 10. 2026).
- Návod, aktualizace: po restartu služby znovu spustit hlídač a ověřit, že běží.

### Při aktualizaci

- Když běží příchozí hovory a v popisu prostředí automatického režimu chybí řádek „Phone watcher (Miladka)“, doplň ho podle návodu (Accept edits předem, pak připomeň návrat). Nastavení telefonu se nemění.

## [0.3.23] - 2026-10-13

V hovoru s majitelem se Miládka zbytečně neptá, jména líp rozpozná a koncept mailu uloží hned.

- Koncept mailu (`mg_save_draft`) jde uložit přímo v hovoru s majitelem, po zopakování a jeho souhlasu. Nic jiného se v hovoru dál nezapíše ani neodešle, hlídá to server. Slib „draft připravím po hovoru“ se nesplnil, když hlavní relace o hovoru nevěděla (Věrka 13. 10. 2026).
- Bez upřesnění hledá v hlavní schránce a jméno, které poznámky znají jednou, bere bez ptaní. Dotaz „ve které schránce a kterou Jarku?“ stál kolo čekání navíc.
- Tahák jmen (`incoming.hints`) dostávají i hovory s majitelem, nejen sekretářka („Jarku“ se přepsalo jako „Jirku“).

### Při aktualizaci

- Když má majitel v `conversation.allowed_tools` nástroje Multigmailu, nabídni mu přidat `mcp__multi-gmail__mg_save_draft`: koncepty pak vzniknou rovnou v hovoru. Zapiš až po souhlasu, pak `tel_reload_config`.
- Službu příchozích hovorů po aktualizaci restartuj (`systemctl --user restart mcp-phone-prichozi`).

## [0.3.22] - 2026-10-13

Sekretářka nezní jako záznamník a jméno volajícího nahlas neopakuje.

- Doporučený pozdrav je krátký a končí otázkou „S kým mluvím?“. S „můžu mu něco vyřídit?“ volající považoval sekretářku za záznamník, namluvil vzkaz a položil (Karlův test 13. 10. 2026). Návod a `docs/nastaveni.md`.
- Pokyny sekretářky: na jméno odpoví „Děkuji. Karel teď nemůže k telefonu. Co mu mám vyřídit?“ a jméno ani firmu volajícímu nikdy neopakuje: rozpoznávání řeči jména plete a zkomolené jméno zní nedbale. Majitel je má v přepisu (Karel).

### Při aktualizaci

- Když má majitel pozdrav ve starém tvaru („…nemůže k telefonu, můžu mu něco vyřídit?“), navrhni mu nový podle návodu (krátký, se jménem asistentky a otázkou „S kým mluvím?“) a zapiš až po souhlasu.
- Když má vlastní `incoming.task`, nové pokyny o jménu se ho netýkají: nabídni ho smazat, ať platí vestavěné.
- Službu příchozích hovorů po aktualizaci restartuj (`systemctl --user restart mcp-phone-prichozi`).

## [0.3.21] - 2026-10-13

Návod: připojení serveru ověřuje asistent sám a ptá se jen na volby uživatele.

- Návod, zásada 8: „Na co se ptáš a co uděláš sama“, stejně jako u ostatních doplňků (Karlův test 13. 10. 2026).
- Návod: připojení serveru ověřuje asistent sám podle nástrojů, uživatele nežádá o `/mcp`: v aplikaci Claude ten příkaz nefunguje, jen v terminálu (Karel 13. 10. 2026).

### Při aktualizaci

- Nastavení se nemění.

## [0.3.20] - 2026-10-12

Automatická hláška operátora už nedrží sekretářku v hovoru.

- Řádek, který druhá strana řekne znovu slovo od slova (aspoň pět slov), se bere jako automatická hláška, třeba „Nezavěšujte prosím, vyčkejte na spojení“: nedostane odpověď a nezruší zavěšení. Když skočila do rozloučení, hovor po něm skončí. Krátké opakování („Haló?“) je dál člověk. Skutečný hovor 12. 10. 2026: volající si dal hovor do čekání, hláška se opakovala každé čtyři vteřiny a sekretářka se dvanáctkrát loučila (Věrka).
- Zavěšení se v jednom hovoru zruší nejvýš třikrát, pak hovor po rozloučení skončí, ať se do něj mluví cokoli.

### Při aktualizaci

- Nastavení se nemění.
- Službu příchozích hovorů po aktualizaci restartuj (`systemctl --user restart mcp-phone-prichozi`).

## [0.3.19] - 2026-10-12

Režim dovolená: volající se hned dozví, že je majitel pryč, a sekretářka vezme vzkaz.

- Nové nastavení `incoming.vacation` (`until`, `greeting`, volitelně `substitute` a `report`). Do posledního dne dovolené sekretářka zdraví textem o dovolené, neslibuje rychlé zavolání zpět a na naléhavé věci řekne, kdo zastupuje. Po posledním dni se sama vrátí k běžnému pozdravu. Majitel na dobu dovolené přesměruje všechny hovory (`**21*`), takže je sekretářka bere hned (Karel).
- `report`: vzkazy majiteli hned (`now`, výchozí), nebo do denního přehledu s naléhavými hned (`daily`).
- `--check` ukáže, jestli platí dovolená a do kdy.

### Při aktualizaci

- Nastavení se nemění. Majiteli můžeš jednou větou říct, že před dovolenou stačí napsat, do kdy je pryč.
- Službu příchozích hovorů po aktualizaci restartuj (`systemctl --user restart mcp-phone-prichozi`).

## [0.3.18] - 2026-10-12

Sekretářka má výchozí effort Claude Code a konec věty pozná automatikou Twilia.

- Výchozí `incoming.effort` je `null` (výchozí Claude Code) místo `low`: v hovorech nebyl `low` rychlejší (první slovo 1,44 s proti 1,42 s) a model s výchozím effortem líp zvládá odbočky volajícího.
- Výchozí `incoming.speech_timeout_ms` je `null` (automatika Twilia) místo 1000: rozpozná konec věty o 0,5 až 1 s dřív. Zátěžový test s pauzami ustála a plynulý hovor zněl podle Karla výrazně lépe.

### Při aktualizaci

- Když má `system/phone.json` v bloku `incoming` výslovně `effort` `low` nebo `speech_timeout_ms` 1000 a majitel si je nevybral sám, nabídni je smazat, ať platí nové výchozí.
- Službu příchozích hovorů po aktualizaci restartuj (`systemctl --user restart mcp-phone-prichozi`).

## [0.3.17] - 2026-10-12

Sekretářce jde nastavit výchozí effort Claude Code.

- `incoming.effort` jde nastavit na `null` = výchozí effort Claude Code, jako v hovorech s majitelem. Výchozí zůstává `low`. Kvůli srovnání: v měření nebyla sekretářka s `low` jednoznačně rychlejší (Karel).

### Při aktualizaci

- Nastavení se nemění.
- Službu příchozích hovorů po aktualizaci restartuj (`systemctl --user restart mcp-phone-prichozi`).

## [0.3.16] - 2026-10-12

Přímý hovor z majitelova čísla s PINem už nekončí u sekretářky, překlep v PINu nevypne službu a sekretářka jde zkusit s automatikou Twilia.

- S nastaveným PINem dostane přímý hovor z majitelova čísla jen výzvu k PINu: správný pustí k asistentce, bez PINu nebo po třech špatných se služba rozloučí a položí. Sekretářka se zkouší z jiného telefonu přes přesměrování (Karel).
- PIN v souboru s klíči, který nemá 4 až 10 číslic, už službu neshodí: sekretářka dál bere přesměrované hovory, přímé hovory majitele se pokládají, asistent dostane vzkaz `pin` a `--check` to ukáže. Dosud kvůli překlepu v PINu nebrala hovory vůbec (12. 10. 2026).
- `incoming.speech_timeout_ms` jde nastavit na `null`: automatika Twilia jako v hovorech s majitelem, v měření o 0,5 až 1 s rychlejší. Výchozí zůstává 1000.
- Návod: když se asistentka u majitele jmenuje jinak než Miládka, pozdrav `conversation.greeting` s jejím jménem (po PINu se představila cizím jménem).

### Při aktualizaci

- Když majitel PIN má a dosud zkoušel sekretářku z vlastního čísla bez PINu, řekni mu, že to už nejde: přímý hovor bez PINu se položí, sekretářku zkusí z jiného telefonu přes přesměrování.
- Když se asistentka u majitele jmenuje jinak než Miládka a `conversation.greeting` nemá, nabídni pozdrav s jejím jménem.
- Službu příchozích hovorů po aktualizaci restartuj (`systemctl --user restart mcp-phone-prichozi`).

## [0.3.15] - 2026-10-12

PIN stačí čtyřmístný a služba mluví jazykem nastavení.

- `owner_pin` má 4 až 10 číslic místo 6 až 10. S deseti pokusy za den a podvrženým číslem navíc to stačí (Karel).
- Výzva k PINu, rozloučení, poděkování po záznamníku a věta při překročení délky hovoru zní podle `language`: `cs-…` česky, jinak anglicky. Dosud byly vždy česky.

### Při aktualizaci

- Nastavení se nemění.
- Službu příchozích hovorů po aktualizaci restartuj (`systemctl --user restart mcp-phone-prichozi`).

## [0.3.14] - 2026-10-12

Model a effort hovorů s majitelem, s jinými a sekretářky jsou nezávislé, žádný nepřebírá nastavení jiného.

- `conversation.model` a `conversation.effort` platí jen pro hovory s majitelem (Miládka volá jemu, nebo on jí s PINem). Hovory s jinými mají `conversation.others` (výchozí model Sonnet, effort výchozí Claude Code), sekretářka `incoming.model` (výchozí Sonnet) a `incoming.effort` (výchozí `low`). V 0.3.12 a 0.3.13 si je převzaly od majitele, když neměly vlastní: Opus na zkoušku v hovorech s majitelem by zpomalil i sekretářku (Karel).

### Při aktualizaci

- Když má `system/phone.json` jiný `conversation.model` nebo `conversation.effort` než výchozí a majitel ho chtěl i pro sekretářku nebo hovory s jinými, zapiš ho se souhlasem i do `incoming` nebo `conversation.others`. Jinak se nastavení nemění.
- Službu příchozích hovorů po aktualizaci restartuj (`systemctl --user restart mcp-phone-prichozi`).

## [0.3.13] - 2026-10-12

Majitel se s PINem dovolá k Miládce v plném režimu a nastavení má úplnou dokumentaci.

- PIN: přímý hovor z majitelova čísla (`owner` nebo `incoming.owner_lines`) se zeptá na PIN (`owner_pin` v souboru s klíči, 6 až 10 číslic). Se správným PINem mluví majitel s Miládkou jako v `tel_converse`: poznámky, pošta ke čtení, nástroje z nastavení, model a effort hovorů s majitelem. Bez PINu (nic nezmáčkne) vezme hovor sekretářka jako dřív. Tři špatné pokusy hovor ukončí a asistent dostane vzkaz `pin`, deset za den vypne PIN do půlnoci (počítá se v souboru). Číslo volajícího jde podvrhnout, PIN ne (Karel). Hlídač hlásí hovor majitele jako vzkaz `majitel`.
- Nová dokumentace `docs/nastaveni.md`: každý klíč, co dělá, výchozí hodnota a co platí, když chybí. Test při vydání hlídá, že popisuje všechny klíče a výchozí hodnoty souhlasí s programem. Návod pro asistenta na ni odkazuje místo vlastních tabulek (Karel: výchozí hodnoty nebyly jasné).
- Testy a návod bez skutečných telefonních čísel.

### Při aktualizaci

- Nastavení se nemění. PIN je vypnutý, dokud si ho majitel nezapíše do souboru s klíči sám (návod, Část D, Majitel volá sám): řekni mu o něm jednou větou a nech ho rozhodnout. Jeho PIN nikdy nečti ani nevypisuj.
- Službu příchozích hovorů po aktualizaci restartuj (`systemctl --user restart mcp-phone-prichozi`).

## [0.3.12] - 2026-10-12

Sekretářka odpovídá rychleji a loučí se krátce, každý druh hovoru může mít vlastní model a effort a služba si změněné nastavení načte sama.

- Služba příchozích hovorů si `phone.json` po změně načte znovu před dalším hovorem. Dosud ho četla jen při startu, `tel_reload_config` měnil jen server v konverzaci: celé odpoledne zkušebních hovorů 12. 10. 2026 běželo na starých hodnotách.
- Model a effort zvlášť pro hovory s majitelem (`conversation.model`, `conversation.effort`), s jinými lidmi (`conversation.others`) a pro sekretářku (`incoming.model`, `incoming.effort`); co chybí, platí od majitele (Karel).
- Sekretářka: výchozí `incoming.effort` `low` a `incoming.speech_timeout_ms` 1000 místo 2000. Měřeno z nahrávky: Twilio přidá ke svému čekání asi 0,6 s, s 2 s volající čekal přes 4 s, teď kolem 3 s. Při 1 s Twilio dělí vzkaz při nadechnutí, server kousky spojí a z rozjetých odpovědí nic nezazní.
- Sekretářka se na konci jen krátce rozloučí („Děkuji, vyřídím to. Na shledanou."), vzkaz volajícímu neopakuje: majitel dostane celý hovor a shrnutí bylo nejpomalejší odpovědí hovoru (Karel).

### Při aktualizaci

- Když má `system/phone.json` v bloku `incoming` výslovně `speech_timeout_ms` 2000 (dřívější výchozí) nebo vlastní `task` se starou větou o zopakování vzkazu, a majitel si je nevybral sám, nabídni je smazat, ať platí nové výchozí.
- Když je `conversation.effort` nastavený jen kvůli sekretářce, nabídni ho smazat: sekretářka má teď `low` sama a hovory s majitelem pak přemýšlí jako dřív.
- Službu příchozích hovorů po aktualizaci restartuj (`systemctl --user restart mcp-phone-prichozi`), ať běží nová verze. Další změny nastavení už si načte sama.

## [0.3.11] - 2026-10-12

Měření, jak dlouho volající čeká na odpověď sekretářky, z nahrávky hovoru (na ladění, výchozí vypnuté).

- Nové nastavení `incoming.measure_gaps` (výchozí vypnuté, jen na ladění): služba hovor nahraje do dvou stop, po zavěšení z nahrávky změří, jak dlouho volající u každé odpovědi čekal, a zapíše to do přepisu s rozpadem na Twilio, model a hlas. Nahrávku pak z Twilia smaže. Časy v přepisu začínají až předáním věty od Twilia, Karel stopkami naměřil mezery 4 až 5 s proti zhruba 2,5 s z časů (12. 10. 2026).

### Při aktualizaci

- Nastavení se nemění. Měření je ve výchozím stavu vypnuté, zapíná se jen na majitelův pokyn ke zkušebním hovorům.

## [0.3.10] - 2026-10-12

Úprava návodu pro asistenta: lidštější slova a návod číst celý.

- Návod: na začátku poznámka, že uživateli „složka Miládky", ne „vault", a že se návod čte celý ze staženého souboru, ne nástrojem na čtení webu (Karlův test 11. 10. 2026).

### Při aktualizaci

- Nastavení se nemění.

## [0.3.9] - 2026-10-10

Na volajícího, který mluví do rozloučení, se už nezavěsí, a po odpovědi na jeho otázku se sekretářka nerozloučí.

- Hovor zůstane po odhadnutém konci rozloučení ještě 2 s otevřený. Twilio konec přehrávání nehlásí a přerušení pošle, až řeč rozpozná: v 0.3.8 přišlo přerušení posledních slov rozloučení pozdě a hovor se zavěsil (Věrka, test 10. 10. 2026). Přerušení nebo další věta v té době zavěšení zruší.
- Výchozí úkol sekretářky: na otázku volajícího krátce odpoví a zeptá se „Je to všechno?“, v téže odpovědi se nerozloučí. 10. 10. 2026 odpověděla na „kdy bude k zastižení“ a rozloučila se dřív, než volající řekl číslo. Když volající jen něco sdělí, otázku navíc neklade (Karel).

### Při aktualizaci

- Když má nastavení vlastní `incoming.task`, nová věta výchozího úkolu se ho netýká: nabídni majiteli doplnit ji (znění ve výchozím úkolu v `src/config.ts`, věta „If the caller asks you something…“) a změň až s jeho souhlasem.
- Když běží příchozí hovory, po výměně souboru `systemctl --user restart mcp-phone-prichozi`.

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

# Nastavení telefonu

Úplný popis nastavení doplňku: co každý klíč dělá, co platí, když v souboru není, a kdy ho měnit. Čte ho asistent i člověk. Postup instalace je v [návodu pro asistenta](pro-asistenta.md).

**Výchozí hodnota** je to, co server použije, když klíč v souboru chybí. Do souboru se proto píše jen to, co má být jinak. Test při každém vydání kontroluje, že tu je popsaný každý klíč a že výchozí hodnoty souhlasí s programem.

## Kde nastavení je a kdy platí

| Soubor | Co v něm je |
|---|---|
| `system/phone.json` ve složce Miládky | všechno níž kromě klíčů. Zálohuje se do gitu, proto v něm nesmí být nic tajného. |
| soubor s klíči (v Miládce `.miladka/secrets/phone/hesla.json`, anglicky `passwords.json`) | klíče od Twilia, tajná adresa služby a PIN (oddíl Klíče). Nezálohuje se, nikdy se nečte nahlas ani nevypisuje. |

**Kdy se změna projeví:**

- **Server v konverzaci** (volání majiteli a ostatním): po nástroji `tel_reload_config`, hned, bez nové konverzace. Když soubor nejde načíst, nezmění se nic a chyba řekne proč.
- **Služba příchozích hovorů** (sekretářka, PIN): sama před dalším hovorem, když se soubor změnil. Když v něm je chyba, platí dosavadní nastavení a chyba je v logu služby. Jen změna `conversation.public_url` a `incoming.listen_port` chce restart služby (`systemctl --user restart mcp-phone-prichozi`).
- **Nová verze programu**: služba příchozích hovorů po aktualizaci vždycky restart.

Čísla se píšou vždycky mezinárodně, bez mezer: `+420777123456`. Jinak server nastavení odmítne.

## Základ

| Klíč | Výchozí | Co dělá |
|---|---|---|
| `owner` | povinné | Číslo majitele. Jen jemu Miládka volá sama od sebe, jen jemu smí říct cokoli z poznámek a pošty, jen jeho naléhavý hovor projde klidnými hodinami. Z tohohle čísla (a z `incoming.owner_lines`) se dá zavolat s PINem. |
| `from` | povinné | Číslo od Twilia, ze kterého se volá a na které se přesměrovávají příchozí hovory. |
| `call_owner_when` | nenastaveno | Kdy Miládka volá majiteli sama od sebe, jeho slovy, jedna položka na jeden případ (nejvýš 20, každá do 300 znaků). Server je dává asistentovi v instrukcích každé konverzace. Když chybí nebo je prázdné, volá jen na majitelův pokyn. |
| `recipients` | `{}` | Další lidé, které smí zavolat, jméno → číslo, jen na majitelův pokyn a jen s textem, který zadá. Prázdné znamená nikomu, ne komukoli. Jméno `owner` je vyhrazené. |
| `call_other_numbers` | `false` | `true`: na majitelův pokyn smí volat i na číslo, které není v nastavení. Každý takový hovor majitel potvrdí kliknutím, v každém režimu oprávnění. |
| `voice` | `"ElevenLabs.bF7C2fCv7Zf30iT84wZ1"` | Hlas vzkazů i rozhovorů (ženský, česky). Náhradní ženské hlasy, kdyby přestal fungovat: `ElevenLabs.7JbZPqJGWUfXXBim0T8U`, `ElevenLabs.OAAjJsQDvpg3sVjiLgyl`, nakonec `Google.cs-CZ-Wavenet-B`. Vybírá se poslechem v telefonu. |
| `language` | `"cs-CZ"` | Jazyk hlasu a rozpoznávání řeči. Podle něj server mluví česky nebo anglicky (`en-…`). |
| `quiet_hours` | `{"from":"22:00","to":"07:00"}` | Kdy nevolat. `null` = kdykoli. |
| `quiet_hours_mode` | `"never"` | Co v klidných hodinách: `never` nevolá vůbec, `urgent_only` projde jen naléhavý hovor majiteli. |
| `timezone` | `"Europe/Prague"` | Časové pásmo klidných hodin, data v přepisech a denního stropu. |
| `daily_limit` | `10` | Nejvýš hovorů za den (1 až 100). Počítá se každý pokus, i nezvednutý, z historie u Twilia, takže ho restart nevynuluje. |
| `max_message_length` | `500` | Nejdelší vzkaz `tel_call` ve znacích (20 až 3000). |
| `passwords_file` | nenastaveno | Jiné umístění souboru s klíči. V Miládce netřeba, server si ho najde sám. |
| `call_log` | `"system/hovory/hovory.md"` | Deník hovorů: u každého kdy, komu, co zaznělo, jak dopadl a odkaz na přepis. `null` ho vypne. |

## Rozhovor (`conversation`)

Rozhovor s majitelem (`tel_converse`), s jinými lidmi (`tel_converse_with`) a základ pro sekretářku. Potřebuje veřejnou adresu, na kterou se Twilio připojí.

| Klíč | Výchozí | Co dělá |
|---|---|---|
| `conversation.enabled` | `false` | Zapne rozhovory. Vypnuté: umí jen `tel_call`. |
| `conversation.public_url` | nenastaveno | Stálá adresa `https://…` (bez lomítka na konci), přes kterou se Twilio připojí. Bez ní jde jen zkušební tunel (`tunnel`), příchozí hovory vůbec. |
| `conversation.tunnel` | `"none"` | `quick`: rychlý tunel Cloudflare na dobu jednoho hovoru, když `public_url` chybí. Mění adresu, pro příchozí hovory nejde. |
| `conversation.cloudflared_path` | `"cloudflared"` | Program pro tunel. |
| `conversation.listen_host` | `"127.0.0.1"` | Kde most pro rozhovory poslouchá. Nedávat na veřejné rozhraní: dovnitř se jde jen přes proxy nebo tunel. |
| `conversation.listen_port` | `8787` | Port mostu. |
| `conversation.claude_path` | `"claude"` | Claude Code, na kterém běží hovorová relace. |
| `conversation.model` | `"sonnet"` | Model hovorů s majitelem, ať volá Miládka jemu, nebo on jí s PINem. Hovory s jinými a sekretářka mají vlastní (`conversation.others`, `incoming.model`) a tenhle je neovlivní. Sonnet v testech odpovídal nejrychleji a česky nejlíp; na složitější hovory jde zkusit `opus`. |
| `conversation.effort` | nenastaveno | Jak moc relace hovoru s majitelem přemýšlí: `low`, `medium`, `high`, `xhigh`, `max`. Nenastaveno = výchozí hodnota Claude Code pro model. Nižší odpovídá dřív, vyšší přemýšlí víc. Jen hovory s majitelem. |
| `conversation.others` | `{"model":"sonnet"}` | Model a effort hovorů s jinými lidmi za majitele, třeba `{"model": "sonnet", "effort": "medium"}`. Effort nenastavený = výchozí Claude Code. Nezávisí na nastavení hovorů s majitelem. |
| `conversation.voice_tuning` | `"1.0_1.0_0.8"` | Hlas v rozhovoru: rychlost_stabilita_podobnost (rychlost 0,7 až 1,2, ostatní 0 až 1). Vyšší stabilita drží hlas stejnější mezi větami. `null` = výchozí ElevenLabs, u kterých bylo slyšet kolísání hlasitosti. |
| `conversation.transcription` | `{"provider":"Deepgram","model":"nova-3-general"}` | Rozpoznávání řeči v rozhovorech i u sekretářky. Česky umí Google a Deepgram `nova-3-general` a `nova-2-general`, Deepgram `flux` ne. `null` = co vybere Twilio (pro češtinu Google). Deepgram v testech líp slyšel čísla a místa. |
| `conversation.greeting` | `"Ahoj, tady Miládka. Poslouchám."` | První věta hovoru s majitelem, když `tel_converse` nedostane `opening`, a pozdrav po správném PINu. |
| `conversation.max_minutes` | `10` | Nejdelší rozhovor s majitelem a s jinými (1 až 60). Hovor, který Miládka vytočí, pak Twilio ukončí; hovor s majitelem po PINu ukončí služba větou, že musí končit. |
| `conversation.vault_dir` | nenastaveno | Složka, kterou relace hovoru s majitelem čte. Nenastaveno = složka Miládky. |
| `conversation.persona_file` | `"CLAUDE.md"` | Kdo je Miládka a jak mluví, načte se do hovoru s majitelem. |
| `conversation.transcript_dir` | `"system/hovory"` | Kam se ukládá přepis každého hovoru. V `system/`, aby se zálohoval. |
| `conversation.timings` | `false` | Časy v přepisu: za jak dlouho po větě volajícího začala odpověď, rozestup jeho řádků, běh nástrojů, start relace. Na ladění rychlosti. |
| `conversation.vault_read` | `true` | Relace hovoru s majitelem smí číst poznámky. |
| `conversation.mcp_servers` | `{}` | Další servery pro hovor s majitelem, stejný tvar jako v `.mcp.json`. Jen spouštěné z počítače, nikdy WhatsApp (drží jedno spojení, druhá relace by ho shodila). Konektory z claude.ai do hovoru dát nejde. |
| `conversation.allowed_tools` | `[]` | Nástroje z `mcp_servers`, které hovor s majitelem smí použít. Pro poštu z Multigmailu `mg_list_accounts`, `mg_search_threads`, `mg_get_message` (s předponou `mcp__multi-gmail__`). Cokoli, co ve schránce něco mění, server za hovoru odmítne i tak. |
| `conversation.others_introduction` | nenastaveno | První věta hovoru s kýmkoli jiným než majitelem: kdo volá a že je to AI asistentka, třeba „Dobrý den, tady Miládka, AI asistentka Jana Nováka.“ Musí obsahovat „AI“. Bez ní `tel_converse_with` nefunguje. |

## Příchozí hovory (`incoming`)

Sekretářka bere hovory, které majitel nezvedne a operátor je přesměruje na číslo u Twilia, a s PINem pustí majitele k Miládce. Běží jako stálá služba (`--serve`).

| Klíč | Výchozí | Co dělá |
|---|---|---|
| `incoming.enabled` | `false` | Zapne sekretářku. Vypnuté (třeba dovolená): volající uslyší `voicemail_text` a může nechat vzkaz. |
| `incoming.listen_port` | `8788` | Port služby příchozích hovorů. Změna chce restart služby. |
| `incoming.owner_lines` | nenastaveno | Majitelova čísla, ze kterých přesměrovává (soukromé, pracovní). Když jsou nastavená, služba bere jen hovory přesměrované z nich a přímé hovory z nich; všechno ostatní dostane obsazovací tón, nic nehraje a Twilio ho neúčtuje. Nenastaveno = sekretářka vezme každý hovor na číslo u Twilia. Nesmí být prázdné. |
| `incoming.max_minutes` | `3` | Nejdelší hovor se sekretářkou (1 až 10), pak řekne, že musí končit, a zavěsí. Hovor s majitelem po PINu se řídí `conversation.max_minutes`. |
| `incoming.speech_timeout_ms` | `1000` | Kolik milisekund ticha Twilio počká, než vezme, co volající řekl, za hotové (600 až 5000). Twilio k tomu přidá asi 0,6 s vlastních. Při 1000 dělí vzkaz při nadechnutí, server kousky spojí a z rozjeté odpovědi nic nezazní. Když volajícím skáče do řeči, zvýšit (třeba 1500); když odpovídá pomalu, snížit. |
| `incoming.model` | `"sonnet"` | Model sekretářky. Nezávisí na modelu hovorů s majitelem. |
| `incoming.effort` | `"low"` | Jak moc sekretářka přemýšlí. Jen zapisuje vzkaz, `low` odpovídá stejně dobře a dřív. |
| `incoming.measure_gaps` | `false` | Jen na ladění, na majitelův pokyn: hovor se nahraje do dvou stop, služba z nahrávky změří, jak dlouho volající u každé odpovědi čekal, zapíše to do přepisu (řádky `měření:`, rozpad na Twilio, model a hlas) a nahrávku z Twilia smaže. Volající o nahrávání neví, proto jen na zkušební hovory. |
| `incoming.hints` | nenastaveno | Tahák pro rozpoznávání řeči: jména, firmy a místa z majitelových hovorů (nejvýš 60, každé do 60 znaků). Dostane ho jen rozpoznávání u Twilia, sekretářka ne. Funguje jen s Deepgramem. |
| `incoming.greeting` | nenastaveno | Co volající uslyší jako první. Musí říct, že hovor bere AI asistentka (slovo „AI“). Bez něj sekretářka nenaběhne. |
| `incoming.task` | vestavěné pokyny (anglicky) | Pokyny sekretářky: nechá volajícího mluvit, zeptá se jen na jméno, nic neslíbí ani neprozradí, krátce se rozloučí. Měnit jen výjimečně: vlastní text nahradí vestavěný celý a s novými verzemi se nezlepšuje. |
| `incoming.voicemail_text` | `"Dobrý den, teď to nikdo nemůže vzít. Nechte prosím vzkaz po pípnutí."` | Co uslyší volající, když je sekretářka vypnutá. |
| `incoming.queue_file` | `".doplnky/mcp-phone/prichozi.jsonl"` | Fronta vzkazů pro hlídač (`--wait`). Nezálohuje se. |

## Klíče (soubor s klíči)

Nic z toho nepatří do `system/phone.json`. Hodnoty se nikdy nečtou nahlas, nevypisují ani nekopírují do chatu.

| Klíč | Výchozí | Co dělá |
|---|---|---|
| `account_sid` | povinné | Účet u Twilia, `AC…`. |
| `api_key` | povinné | API klíč Twilia, `SK…`. Klíč, ne Auth Token účtu: jde zrušit samostatně. |
| `api_secret` | povinné | Tajná část API klíče. |
| `anthropic_api_key` | nenastaveno | Hovorová relace pak platí z tohoto klíče Anthropicu místo předplatného Claude. |
| `incoming_secret` | nenastaveno | Tajná část adresy, na kterou Twilio posílá příchozí hovory. Zapíše ji `--setup-incoming`, nikdo ji nečte. Bez ní služba příchozích hovorů nenaběhne. |
| `owner_pin` | nenastaveno | PIN majitele, 6 až 10 číslic. Přímý hovor z majitelova čísla se na něj zeptá; se správným PINem mluví majitel s Miládkou v plném režimu (poznámky, pošta ke čtení, nástroje). Bez PINu vezme hovor sekretářka. Tři špatné pokusy ukončí hovor a asistent dostane zprávu, deset za den vypne PIN do půlnoci. Majitel ho píše do souboru sám. Nenastaveno = funkce vypnutá. |
